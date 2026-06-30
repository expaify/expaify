import { FlightProvider, FlightSearchRange, NormalizedFare, PricePoint, Result } from '../types';
import { cache } from '../cache/redis';

const BASE_URL = 'https://api.tequila.kiwi.com';
const CACHE_TTL = 21600; // 6 hours

// ─── Kiwi Tequila API response shapes ────────────────────────────────────────

interface KiwiRoute {
  local_arrival: string;
  [key: string]: unknown;
}

interface KiwiOffer {
  id: string;
  flyFrom: string;
  flyTo: string;
  local_departure: string;
  local_arrival: string;
  airlines: string[];
  price: number;
  route: KiwiRoute[];
  has_stopover: boolean;
  transfers: unknown[];
  deep_link: string;
}

interface KiwiSearchResponse {
  data: KiwiOffer[];
}

// ─────────────────────────────────────────────────────────────────────────────

/** Convert YYYY-MM-DD to DD/MM/YYYY as required by Kiwi Tequila. */
function toKiwiDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

export class KiwiProvider implements FlightProvider {
  // Read env var at call time so tests can set it before any method runs
  private get apiKey(): string {
    return process.env.KIWI_KEY ?? '';
  }

  // ─── priceTrends ───────────────────────────────────────────────────────────

  async priceTrends(_origin: string, _dest: string): Promise<Result<PricePoint[]>> {
    // Kiwi Tequila does not support price trend data via this API
    return { ok: true, data: [] };
  }

  // ─── searchFares ───────────────────────────────────────────────────────────

  async searchFares(
    origin: string,
    dest: string,
    range: FlightSearchRange
  ): Promise<Result<NormalizedFare[]>> {
    if (!dest) return { ok: true, data: [] };

    const apiKey = this.apiKey;
    if (!apiKey) return { ok: false, reason: 'Kiwi not configured' };

    const passengerCount = range.passengers;
    const cacheKey = `kiwi:search:${origin}:${dest}:${range.depart}:${range.return ?? ''}:pax:${passengerCount}`;

    try {
      const cached = await cache.get<NormalizedFare[]>(cacheKey);
      if (cached !== null) return { ok: true, data: cached };

      const departKiwi = toKiwiDate(range.depart);

      let url =
        `${BASE_URL}/v2/search` +
        `?fly_from=${encodeURIComponent(origin)}` +
        `&fly_to=${encodeURIComponent(dest)}` +
        `&date_from=${encodeURIComponent(departKiwi)}` +
        `&date_to=${encodeURIComponent(departKiwi)}` +
        `&adults=${encodeURIComponent(String(passengerCount))}` +
        `&curr=USD` +
        `&limit=20` +
        `&sort=price`;

      if (range.return) {
        const returnKiwi = toKiwiDate(range.return);
        url +=
          `&return_from=${encodeURIComponent(returnKiwi)}` +
          `&return_to=${encodeURIComponent(returnKiwi)}`;
      }

      const res = await fetch(url, {
        headers: { apikey: apiKey },
      });

      if (!res.ok) {
        return { ok: false, reason: `Kiwi /v2/search HTTP ${res.status}` };
      }

      const json = (await res.json()) as KiwiSearchResponse;
      const fetchedAt = new Date().toISOString();

      const fares: NormalizedFare[] = (json.data ?? []).map((offer) => {
        const fare: NormalizedFare = {
          id: `kiwi-${offer.id}`,
          fareType: 'cash',
          origin: offer.flyFrom,
          destination: offer.flyTo,
          depart: offer.local_departure,
          stops: offer.transfers.length,
          carrier: offer.airlines[0] ?? 'Unknown',
          price: {
            priceCents: Math.round(offer.price * 100),
            currency: 'USD',
          },
          passengerCount,
          priceScope: 'party_total',
          deeplink: offer.deep_link,
          source: 'kiwi',
          fetchedAt,
        };

        // Include `return` when there are multiple route segments (round trip)
        if (offer.route.length > 1) {
          fare.return = offer.route[offer.route.length - 1].local_arrival;
        }

        return fare;
      });

      await cache.set(cacheKey, fares, CACHE_TTL);
      return { ok: true, data: fares };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Shared singleton — used by snapshot-job and other scripts. */
export const kiwi = new KiwiProvider();
