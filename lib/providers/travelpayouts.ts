import { FlightProvider, NormalizedFare, PricePoint, Result } from '../types';
import { cache } from '../cache/redis';

const BASE_V1 = 'https://api.travelpayouts.com/v1';
const BASE_V2 = 'https://api.travelpayouts.com/v2';
const CACHE_TTL = 21600; // 6 hours

// ─── Travelpayouts API response shapes ───────────────────────────────────────

interface MonthlyEntry {
  price: number;       // whole RUB
  airline: string;
  flight_number?: number;
  departure_at?: string;
  return_at?: string;
  transfers?: number;
  duration?: number;
}

// v2/prices/latest entry — prices already in requested currency
interface LatestEntry {
  origin: string;
  destination: string;
  depart_date: string;
  return_date?: string;
  gate: string;          // booking channel / airline
  value: number;         // USD whole dollars
  number_of_changes: number;
  found_at: string;
}

// v1/prices/cheap entry — prices in requested currency, keyed by dest then slot
interface CheapEntry {
  price: number;         // USD whole dollars when currency=usd
  airline?: string;
  flight_number?: number;
  departure_at?: string;
  return_at?: string;
  transfers?: number;
  duration?: number;
}

// v1/prices/calendar entry — cheapest fare per departure date
interface CalendarEntry {
  origin: string;
  destination: string;
  airline: string;
  departure_at: string;
  return_at?: string;
  price: number;         // USD whole dollars
  transfers: number;
  flight_number?: number;
}

// ─────────────────────────────────────────────────────────────────────────────

export class TravelpayoutsProvider implements FlightProvider {
  // Read env vars at call time so tests can set them before any method runs
  private get token(): string {
    return process.env.TP_TOKEN ?? '';
  }

  private get marker(): string {
    return process.env.TP_AFFILIATE_MARKER ?? '';
  }

  private buildDeeplink(origin: string, dest: string, departDate: string): string {
    const compact = departDate.slice(0, 10).replace(/-/g, '').slice(4); // MMDD
    const marker = this.marker;
    if (!marker) console.warn('[travelpayouts] TP_AFFILIATE_MARKER is unset — deeplinks will not earn affiliate revenue');
    const base = `https://www.aviasales.com/search/${origin}${compact}${dest}1`;
    return marker ? `${base}?marker=${marker}` : base;
  }

  // ─── priceTrends ───────────────────────────────────────────────────────────

  async priceTrends(origin: string, dest: string): Promise<Result<PricePoint[]>> {
    const cacheKey = `tp:priceTrends:${origin}:${dest}:monthly`;

    try {
      const cached = await cache.get<PricePoint[]>(cacheKey);
      if (cached !== null) return { ok: true, data: cached };

      const url =
        `${BASE_V1}/prices/monthly` +
        `?origin=${encodeURIComponent(origin)}` +
        `&destination=${encodeURIComponent(dest)}` +
        `&currency=usd` +
        `&token=${encodeURIComponent(this.token)}`;

      const res = await fetch(url);
      if (!res.ok) {
        return { ok: false, reason: `Travelpayouts /prices/monthly HTTP ${res.status}` };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();

      const entries: Record<string, MonthlyEntry> =
        json.data != null ? (json.data as Record<string, MonthlyEntry>) : (json as Record<string, MonthlyEntry>);

      const points: PricePoint[] = Object.entries(entries).map(([date, entry]) => ({
        date,
        priceCents: Math.round(entry.price * 100), // already USD when currency=usd
        currency: 'USD',
      }));

      await cache.set(cacheKey, points, CACHE_TTL);
      return { ok: true, data: points };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }

  // ─── searchFares — fans out to v2/latest + v1/cheap for maximum coverage ──

  async searchFares(
    origin: string,
    dest: string,
    range: { depart: string; return?: string }
  ): Promise<Result<NormalizedFare[]>> {
    const extraParams = `${range.depart}:${range.return ?? ''}`;
    const cacheKey = `tp:searchFares:v2:${origin}:${dest}:${extraParams}`;

    try {
      const cached = await cache.get<NormalizedFare[]>(cacheKey);
      if (cached !== null) return { ok: true, data: cached };

      const fetchedAt = new Date().toISOString();
      const fares: NormalizedFare[] = [];

      // ── v2/prices/latest — multiple booking gates, more results ────────────
      let latestUrl =
        `${BASE_V2}/prices/latest` +
        `?origin=${encodeURIComponent(origin)}` +
        `&currency=usd` +
        `&limit=20` +
        `&token=${encodeURIComponent(this.token)}`;
      if (dest) latestUrl += `&destination=${encodeURIComponent(dest)}`;
      if (range.depart) latestUrl += `&depart_date=${encodeURIComponent(range.depart)}`;

      const latestRes = await fetch(latestUrl);
      if (latestRes.ok) {
        const latestJson = (await latestRes.json()) as { data?: LatestEntry[]; success?: boolean };
        const entries: LatestEntry[] = latestJson.data ?? [];
        for (const entry of entries) {
          const departAt = entry.depart_date;
          fares.push({
            id: `tp-v2-${entry.gate}-${entry.origin}-${entry.destination}-${departAt}`,
            fareType: 'cash',
            origin: entry.origin,
            destination: entry.destination,
            depart: departAt,
            return: entry.return_date || undefined,
            cabin: 'economy',
            stops: entry.number_of_changes,
            carrier: entry.gate,
            price: { priceCents: Math.round(entry.value * 100), currency: 'USD' },
            deeplink: this.buildDeeplink(entry.origin, entry.destination, departAt),
            source: 'travelpayouts',
            fetchedAt,
          });
        }
      }

      // ── v1/prices/calendar — cheapest fare per day for the month ──────────
      if (dest && range.depart) {
        const monthParam = range.depart.slice(0, 7); // YYYY-MM
        const calUrl =
          `${BASE_V1}/prices/calendar` +
          `?origin=${encodeURIComponent(origin)}` +
          `&destination=${encodeURIComponent(dest)}` +
          `&depart_date=${encodeURIComponent(monthParam)}` +
          `&calendar_type=departure_date` +
          `&currency=usd` +
          `&token=${encodeURIComponent(this.token)}`;

        const calRes = await fetch(calUrl);
        if (calRes.ok) {
          const calJson = (await calRes.json()) as { data?: Record<string, CalendarEntry> };
          for (const entry of Object.values(calJson.data ?? {})) {
            fares.push({
              id: `tp-cal-${entry.airline}-${entry.origin}-${entry.destination}-${entry.departure_at}`,
              fareType: 'cash',
              origin: entry.origin,
              destination: entry.destination,
              depart: entry.departure_at,
              return: entry.return_at || undefined,
              cabin: 'economy',
              stops: entry.transfers,
              carrier: entry.airline,
              price: { priceCents: Math.round(entry.price * 100), currency: 'USD' },
              deeplink: this.buildDeeplink(entry.origin, entry.destination, entry.departure_at),
              source: 'travelpayouts',
              fetchedAt,
            });
          }
        }
      }

      // ── v1/prices/cheap — cheapest fare per airline ────────────────────────
      if (dest) {
        let cheapUrl =
          `${BASE_V1}/prices/cheap` +
          `?origin=${encodeURIComponent(origin)}` +
          `&destination=${encodeURIComponent(dest)}` +
          `&currency=usd` +
          `&token=${encodeURIComponent(this.token)}`;
        if (range.depart) cheapUrl += `&depart_date=${encodeURIComponent(range.depart)}`;
        if (range.return) cheapUrl += `&return_date=${encodeURIComponent(range.return)}`;

        const cheapRes = await fetch(cheapUrl);
        if (cheapRes.ok) {
          const cheapJson = (await cheapRes.json()) as { data?: Record<string, Record<string, CheapEntry>> };
          // Shape: { data: { [destCode]: { [slot]: CheapEntry } } }
          for (const slots of Object.values(cheapJson.data ?? {})) {
            for (const fareData of Object.values(slots)) {
              const airline = fareData.airline ?? 'Unknown';
              const departAt = fareData.departure_at ?? range.depart;
              fares.push({
                id: `tp-v1-${airline}-${origin}-${dest}-${departAt}`,
                fareType: 'cash',
                origin,
                destination: dest,
                depart: departAt,
                return: fareData.return_at || range.return,
                cabin: 'economy',
                stops: fareData.transfers ?? 0,
                carrier: airline,
                price: { priceCents: Math.round(fareData.price * 100), currency: 'USD' },
                deeplink: this.buildDeeplink(origin, dest, departAt),
                source: 'travelpayouts',
                fetchedAt,
              });
            }
          }
        }
      }

      await cache.set(cacheKey, fares, CACHE_TTL);
      return { ok: true, data: fares };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Shared singleton — used by snapshot-job and other scripts. */
export const travelpayouts = new TravelpayoutsProvider();
