import { FlightProvider, NormalizedFare, PricePoint, Result } from '../types';
import { cache } from '../cache/redis';
import { convertToUSD } from '../fx/convert';

const BASE_URL = 'https://api.travelpayouts.com/v1';
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

interface CheapEntry {
  price: number;       // whole RUB
  airline?: string;
  flight_number?: number;
  departure_at?: string;
  return_at?: string;
  transfers?: number;
  duration?: number;
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
        `${BASE_URL}/prices/monthly` +
        `?origin=${encodeURIComponent(origin)}` +
        `&destination=${encodeURIComponent(dest)}` +
        `&token=${encodeURIComponent(this.token)}`;

      const res = await fetch(url);
      if (!res.ok) {
        return { ok: false, reason: `Travelpayouts /prices/monthly HTTP ${res.status}` };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();

      // The API wraps results under a "data" key; guard both shapes
      const entries: Record<string, MonthlyEntry> =
        json.data != null ? (json.data as Record<string, MonthlyEntry>) : (json as Record<string, MonthlyEntry>);

      const points: PricePoint[] = Object.entries(entries).map(([date, entry]) => ({
        date,
        // price is whole RUB → convert to RUB cents → USD cents
        priceCents: convertToUSD(Math.round(entry.price * 100), 'RUB'),
        currency: 'USD',
      }));

      await cache.set(cacheKey, points, CACHE_TTL);
      return { ok: true, data: points };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }

  // ─── searchFares ───────────────────────────────────────────────────────────

  async searchFares(
    origin: string,
    dest: string,
    range: { depart: string; return?: string }
  ): Promise<Result<NormalizedFare[]>> {
    const extraParams = `${range.depart}:${range.return ?? ''}`;
    const cacheKey = `tp:searchFares:${origin}:${dest}:${extraParams}`;

    try {
      const cached = await cache.get<NormalizedFare[]>(cacheKey);
      if (cached !== null) return { ok: true, data: cached };

      let url =
        `${BASE_URL}/prices/cheap` +
        `?origin=${encodeURIComponent(origin)}` +
        `&destination=${encodeURIComponent(dest)}` +
        `&depart_date=${encodeURIComponent(range.depart)}` +
        `&token=${encodeURIComponent(this.token)}`;

      if (range.return) {
        url += `&return_date=${encodeURIComponent(range.return)}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        return { ok: false, reason: `Travelpayouts /prices/cheap HTTP ${res.status}` };
      }

      const json = (await res.json()) as {
        data?: Record<string, Record<string, CheapEntry>>;
        success?: boolean;
      };

      const data: Record<string, Record<string, CheapEntry>> =
        json.data ?? (json as unknown as Record<string, Record<string, CheapEntry>>);

      const fetchedAt = new Date().toISOString();
      const fares: NormalizedFare[] = [];

      for (const [airline, slots] of Object.entries(data)) {
        for (const fareData of Object.values(slots)) {
          const departAt = fareData.departure_at ?? range.depart;
          const returnAt = fareData.return_at ?? range.return;

          fares.push({
            id: `tp-${airline}-${origin}-${dest}-${departAt}`,
            fareType: 'cash',
            origin,
            destination: dest,
            depart: departAt,
            return: returnAt,
            stops: fareData.transfers ?? 0,
            carrier: airline,
            price: {
              // price is whole RUB → RUB cents → USD cents
              priceCents: convertToUSD(Math.round(fareData.price * 100), 'RUB'),
              currency: 'USD',
            },
            deeplink: this.buildDeeplink(origin, dest, departAt),
            source: 'travelpayouts',
            fetchedAt,
          });
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
