import { FlightProvider, FlightSearchRange, NormalizedFare, PricePoint, Result } from '../types';
import { cache } from '../cache/redis';
import { fetchWithProviderTimeout } from './timeout';

const DEFAULT_HOST = 'booking-com15.p.rapidapi.com';
const DEFAULT_BASE_URL = `https://${DEFAULT_HOST}`;
const DEFAULT_FLIGHT_PATH = '/api/v1/flights/getMinPriceMultiStops';
const CACHE_TTL = 21600;

type RapidApiFlightProviderConfig = {
  apiKey?: string;
  host?: string;
  baseUrl?: string;
  flightPath?: string;
};

type BookingComRapidApiResponse = {
  status?: boolean;
  message?: string;
  data?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildLegsParam(origin: string, dest: string, range: FlightSearchRange): string {
  const legs = [
    { fromId: `${origin}.AIRPORT`, toId: `${dest}.AIRPORT`, date: range.depart },
  ];

  if (range.return) {
    legs.push({ fromId: `${dest}.AIRPORT`, toId: `${origin}.AIRPORT`, date: range.return });
  }

  return JSON.stringify(legs);
}

export class BookingComRapidApiProvider implements FlightProvider {
  constructor(private readonly config: RapidApiFlightProviderConfig = {}) {}

  private get apiKey(): string {
    return this.config.apiKey ?? process.env.RAPIDAPI_KEY ?? '';
  }

  private get host(): string {
    return this.config.host ?? process.env.RAPIDAPI_HOST ?? DEFAULT_HOST;
  }

  private get baseUrl(): string {
    return this.config.baseUrl ?? process.env.RAPIDAPI_BASE_URL ?? DEFAULT_BASE_URL;
  }

  private get flightPath(): string {
    return this.config.flightPath ?? process.env.RAPIDAPI_FLIGHT_PATH ?? DEFAULT_FLIGHT_PATH;
  }

  async priceTrends(_origin: string, _dest: string): Promise<Result<PricePoint[]>> {
    return { ok: true, data: [] };
  }

  async searchFares(
    origin: string,
    dest: string,
    range: FlightSearchRange
  ): Promise<Result<NormalizedFare[]>> {
    if (!dest) return { ok: true, data: [] };
    if (!this.apiKey) return { ok: false, reason: 'RAPIDAPI_KEY not configured' };
    if (!this.host) return { ok: false, reason: 'RAPIDAPI_HOST not configured' };

    const cacheKey = [
      'bookingcom-rapidapi',
      origin,
      dest,
      range.depart,
      range.return ?? '',
      `pax:${range.passengers}`,
    ].join(':');

    try {
      const cached = await cache.get<NormalizedFare[]>(cacheKey);
      if (cached !== null) return { ok: true, data: cached };

      const url = new URL(this.flightPath, this.baseUrl);
      url.searchParams.set('legs', buildLegsParam(origin, dest, range));
      url.searchParams.set('cabinClass', 'ECONOMY');
      url.searchParams.set('currency_code', 'USD');

      const res = await fetchWithProviderTimeout('Booking.com', url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-host': this.host,
          'x-rapidapi-key': this.apiKey,
        },
      });

      if (!res.ok) {
        return { ok: false, reason: `Booking.com RapidAPI flight endpoint HTTP ${res.status}` };
      }

      const json = await res.json() as BookingComRapidApiResponse;
      if (!isRecord(json)) {
        return { ok: false, reason: 'Booking.com RapidAPI returned a malformed response' };
      }

      // We do not map this provider into user-facing fares until we have a
      // verified live payload that includes trustworthy offer fields.
      return { ok: false, reason: 'Booking.com RapidAPI response mapping not finalized; provide a sample JSON response body' };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    } finally {
      // no-op; cache writes intentionally deferred until response mapping is proven
      void CACHE_TTL;
    }
  }
}

export const bookingComRapidApi = new BookingComRapidApiProvider();
