import {
  FlightProvider,
  FlightSearchRange,
  NormalizedFare,
  PricePoint,
  Result,
} from '../types';
import { buildBookingHref } from '../booking/config';
import { cache } from '../cache/redis';
import { buildPartialOrUnavailable } from './itinerary';
import { fetchWithProviderTimeout } from './timeout';

const API_HOST = 'sky-scrapper.p.rapidapi.com';
const BASE_URL = `https://${API_HOST}`;
const CACHE_TTL = 21600;
const DEFAULT_CABIN_CLASS = 'economy';

interface SkyScrapperLeg {
  origin?: { displayCode?: unknown };
  destination?: { displayCode?: unknown };
  durationInMinutes?: unknown;
  stopCount?: unknown;
  departure?: unknown;
  arrival?: unknown;
  carriers?: { marketing?: unknown };
  segments?: unknown;
}

interface SkyScrapperItinerary {
  id?: unknown;
  price?: { raw?: unknown };
  legs?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeFloatToCents(value: number): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const cents = Math.round((value + Number.EPSILON) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function isDateTime(value: unknown): value is string {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(value) &&
    Number.isFinite(new Date(value).getTime());
}

function airportCode(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? value : fallback;
}

function carrierCode(leg: SkyScrapperLeg): string {
  const marketing = leg.carriers?.marketing;
  if (Array.isArray(marketing) && isRecord(marketing[0])) {
    const alternateId = marketing[0].alternateId;
    if (typeof alternateId === 'string' && alternateId.length > 0) return alternateId;
  }

  if (Array.isArray(leg.segments) && isRecord(leg.segments[0])) {
    const marketingCarrier = leg.segments[0].marketingCarrier;
    if (isRecord(marketingCarrier) && typeof marketingCarrier.alternateId === 'string') {
      return marketingCarrier.alternateId || 'Unknown';
    }
  }

  return 'Unknown';
}

function buildCacheKey(params: {
  origin: string;
  dest: string;
  depart: string;
  returnDate?: string;
  passengers: number;
}): string {
  return [
    'skyscrapper',
    'search',
    `origin:${params.origin}`,
    `dest:${params.dest}`,
    `depart:${params.depart}`,
    params.returnDate ? `return:${params.returnDate}` : 'trip:one-way',
    `pax:${params.passengers}`,
    `cabin:${DEFAULT_CABIN_CLASS}`,
  ].join(':');
}

function getItineraries(payload: unknown): SkyScrapperItinerary[] | null {
  if (!isRecord(payload) || !isRecord(payload.data) || !Array.isArray(payload.data.itineraries)) {
    return null;
  }
  return payload.data.itineraries as SkyScrapperItinerary[];
}

export class SkyScrapperProvider implements FlightProvider {
  private get apiKey(): string {
    return process.env.RAPIDAPI_KEY_SKYSCRAPPER ?? '';
  }

  async priceTrends(_origin: string, _dest: string): Promise<Result<PricePoint[]>> {
    return { ok: true, data: [] };
  }

  async searchFares(
    origin: string,
    dest: string,
    range: FlightSearchRange,
  ): Promise<Result<NormalizedFare[]>> {
    if (!dest || !/^\d{4}-\d{2}-\d{2}$/.test(range.depart)) {
      return { ok: true, data: [] };
    }

    const apiKey = this.apiKey;
    if (!apiKey) {
      return { ok: false, reason: 'SkyScrapper provider key not configured' };
    }

    const cacheKey = buildCacheKey({
      origin,
      dest,
      depart: range.depart,
      returnDate: range.return,
      passengers: range.passengers,
    });

    try {
      const cached = await cache.get<NormalizedFare[]>(cacheKey);
      if (cached !== null) return { ok: true, data: cached };

      const params = new URLSearchParams({
        originSkyId: origin,
        destinationSkyId: dest,
        date: range.depart,
        cabinClass: DEFAULT_CABIN_CLASS,
        adults: String(range.passengers),
        currency: 'USD',
      });
      if (range.return) params.set('returnDate', range.return);

      const response = await fetchWithProviderTimeout(
        'SkyScrapper',
        `${BASE_URL}/api/v1/flights/searchFlights?${params.toString()}`,
        {
          headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': API_HOST,
          },
        },
      );

      if (!response.ok) {
        console.error('[SkyScrapper] API error', { status: response.status });
        await cache.set('debug:skyscanner:last_error', {
          kind: 'http_error',
          status: response.status,
          at: new Date().toISOString(),
        }, 300).catch(() => {});
        return { ok: false, reason: `SkyScrapper HTTP error ${response.status}` };
      }

      const rawItineraries = getItineraries(await response.json());
      if (rawItineraries === null) {
        return { ok: false, reason: 'SkyScrapper response failed schema validation' };
      }

      const fetchedAt = new Date().toISOString();
      const fares = rawItineraries.flatMap((item, index): NormalizedFare[] => {
        if (!isRecord(item) || !isRecord(item.price) || !Array.isArray(item.legs) || item.legs.length === 0) {
          return [];
        }

        const rawPrice = item.price.raw;
        const priceCents = typeof rawPrice === 'number' ? safeFloatToCents(rawPrice) : null;
        const legs = item.legs.filter(isRecord) as SkyScrapperLeg[];
        if (priceCents === null || legs.length !== item.legs.length) return [];

        const firstLeg = legs[0];
        const lastLeg = legs[legs.length - 1];
        if (!isDateTime(firstLeg.departure) || !isDateTime(firstLeg.arrival)) return [];

        const fare: NormalizedFare = {
          id: `skyScrapper-${typeof item.id === 'string' && item.id ? item.id : index}`,
          fareType: 'cash',
          origin: airportCode(firstLeg.origin?.displayCode, origin),
          destination: airportCode(lastLeg.destination?.displayCode, dest),
          depart: firstLeg.departure,
          cabin: DEFAULT_CABIN_CLASS,
          stops: Math.max(...legs.map(leg =>
            typeof leg.stopCount === 'number' && Number.isFinite(leg.stopCount)
              ? Math.max(0, Math.trunc(leg.stopCount))
              : 0
          )),
          carrier: carrierCode(firstLeg),
          price: { priceCents, currency: 'USD' },
          passengerCount: range.passengers,
          priceScope: 'party_total',
          deeplink: '',
          source: 'skyScrapper',
          fetchedAt,
          itinerary: buildPartialOrUnavailable({
            durationMinutes: typeof firstLeg.durationInMinutes === 'number'
              ? firstLeg.durationInMinutes
              : null,
            depart: firstLeg.departure,
            arrive: firstLeg.arrival,
          }),
        };

        if (legs.length === 2 && isDateTime(legs[1].departure)) {
          fare.return = legs[1].departure;
        }
        fare.deeplink = buildBookingHref(fare);
        return [fare];
      });

      await cache.set(cacheKey, fares, CACHE_TTL);
      return { ok: true, data: fares };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export const skyScrapper = new SkyScrapperProvider();
