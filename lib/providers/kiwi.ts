import { FlightProvider, FlightSearchRange, NormalizedFare, PricePoint, Result } from '../types';
import { cache } from '../cache/redis';

const BASE_URL = 'https://api.tequila.kiwi.com';
const CACHE_TTL = 21600; // 6 hours

interface KiwiProviderConfig {
  approved?: boolean;
  apiKey?: string;
  deeplinkAttributionParam?: string;
  deeplinkAttributionValue?: string;
}

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

function isKiwiSearchResponse(value: unknown): value is KiwiSearchResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { data?: unknown }).data)
  );
}

/** Convert YYYY-MM-DD to DD/MM/YYYY as required by Kiwi Tequila. */
function toKiwiDate(isoDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function toPriceCents(price: number): number | null {
  const priceText = String(price);
  if (!/^\d+(?:\.\d{1,2})?$/.test(priceText)) return null;

  const [whole, cents = ''] = priceText.split('.');
  return Number(whole) * 100 + Number(cents.padEnd(2, '0'));
}

export class KiwiProvider implements FlightProvider {
  constructor(private readonly config: KiwiProviderConfig = {}) {}

  private validateConfig(): Result<{
    apiKey: string;
    deeplinkAttributionParam: string;
    deeplinkAttributionValue: string;
  }> {
    const {
      approved,
      apiKey,
      deeplinkAttributionParam,
      deeplinkAttributionValue,
    } = this.config;

    if (!approved) return { ok: false, reason: 'Kiwi not approved' };
    if (!apiKey) return { ok: false, reason: 'Kiwi not configured' };
    if (!deeplinkAttributionParam || !deeplinkAttributionValue) {
      return { ok: false, reason: 'Kiwi affiliate attribution not configured' };
    }

    return {
      ok: true,
      data: { apiKey, deeplinkAttributionParam, deeplinkAttributionValue },
    };
  }

  private buildAttributedDeeplink(
    deeplink: string,
    attribution: { param: string; value: string }
  ): Result<string> {
    try {
      const url = new URL(deeplink);
      url.searchParams.set(attribution.param, attribution.value);
      return { ok: true, data: url.toString() };
    } catch {
      return { ok: false, reason: 'Kiwi returned an invalid deeplink' };
    }
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

    const config = this.validateConfig();
    if (!config.ok) return config;

    const passengerCount = range.passengers;
    const cacheKey = `kiwi:search:${origin}:${dest}:${range.depart}:${range.return ?? ''}:pax:${passengerCount}`;

    try {
      const cached = await cache.get<NormalizedFare[]>(cacheKey);
      if (cached !== null) return { ok: true, data: cached };

      const departKiwi = toKiwiDate(range.depart);
      if (departKiwi === null) return { ok: true, data: [] };

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
        if (returnKiwi === null) return { ok: true, data: [] };
        url +=
          `&return_from=${encodeURIComponent(returnKiwi)}` +
          `&return_to=${encodeURIComponent(returnKiwi)}`;
      }

      const res = await fetch(url, {
        headers: { apikey: config.data.apiKey },
      });

      if (!res.ok) {
        return { ok: false, reason: `Kiwi /v2/search HTTP ${res.status}` };
      }

      const json = await res.json();
      if (!isKiwiSearchResponse(json)) {
        return { ok: false, reason: 'Kiwi returned a malformed response' };
      }

      const fetchedAt = new Date().toISOString();
      const attribution = {
        param: config.data.deeplinkAttributionParam,
        value: config.data.deeplinkAttributionValue,
      };

      const fares: NormalizedFare[] = [];

      for (const offer of json.data ?? []) {
        if (typeof offer !== 'object' || offer === null) {
          return { ok: false, reason: 'Kiwi returned a malformed response' };
        }

        if (!Array.isArray(offer.transfers) || !Array.isArray(offer.airlines) || !Array.isArray(offer.route)) {
          return { ok: false, reason: 'Kiwi returned a malformed response' };
        }

        const priceCents = toPriceCents(offer.price);
        if (priceCents === null) {
          return { ok: false, reason: 'Kiwi returned an invalid price' };
        }

        const deeplink = this.buildAttributedDeeplink(offer.deep_link, attribution);
        if (!deeplink.ok) return deeplink;

        const fare: NormalizedFare = {
          id: `kiwi-${offer.id}`,
          fareType: 'cash',
          origin: offer.flyFrom,
          destination: offer.flyTo,
          depart: offer.local_departure,
          stops: offer.transfers.length,
          carrier: offer.airlines[0] ?? 'Unknown',
          price: {
            priceCents,
            currency: 'USD',
          },
          passengerCount,
          priceScope: 'party_total',
          deeplink: deeplink.data,
          source: 'kiwi',
          fetchedAt,
        };

        // Include `return` when there are multiple route segments (round trip)
        if (offer.route.length > 1) {
          fare.return = offer.route[offer.route.length - 1].local_arrival;
        }

        fares.push(fare);
      }

      await cache.set(cacheKey, fares, CACHE_TTL);
      return { ok: true, data: fares };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Shared singleton — used by snapshot-job and other scripts. */
export const kiwi = new KiwiProvider();
