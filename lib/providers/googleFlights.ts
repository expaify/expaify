import { FlightProvider, FlightSearchRange, NormalizedFare, PricePoint, Result } from '../types';
import { cache } from '../cache/redis';
import { fetchWithProviderTimeout } from './timeout';
import { buildPartialOrUnavailable } from './itinerary';

const BASE_URL = 'https://google-flights2.p.rapidapi.com';
const API_HOST = 'google-flights2.p.rapidapi.com';
const CACHE_TTL = 21600; // 6 hours

// ─── Google Flights (google-flights2 RapidAPI) response shapes ──────────────

interface GoogleFlightsAirport {
  airport_code?: string;
  airport_name?: string;
  time?: string;
}

interface GoogleFlightsSegment {
  departure_airport?: GoogleFlightsAirport;
  arrival_airport?: GoogleFlightsAirport;
  airline?: string;
  flight_number?: string;
  aircraft?: string;
  [key: string]: unknown;
}

interface GoogleFlightsItinerary {
  departure_time?: string;
  arrival_time?: string;
  duration?: { raw?: number; text?: string };
  flights?: GoogleFlightsSegment[];
  layovers?: unknown[] | null;
  price?: number;
  stops?: number;
  booking_token?: string;
  [key: string]: unknown;
}

interface GoogleFlightsSearchResponse {
  data?: {
    itineraries?: {
      topFlights?: unknown;
      otherFlights?: unknown;
    };
  };
}

// ─────────────────────────────────────────────────────────────────────────────

function isGoogleFlightsResponse(value: unknown): value is GoogleFlightsSearchResponse {
  return typeof value === 'object' && value !== null && 'data' in value;
}

/**
 * Same cents-safe conversion Kiwi uses -- the sample payloads we captured
 * (2026-08-06) only ever returned whole-or-2dp USD numbers via `price`, so
 * this rejects (rather than silently truncating) anything with more
 * precision than that instead of guessing.
 */
function toPriceCents(price: number): number | null {
  const priceText = String(price);
  if (!/^\d+(?:\.\d{1,2})?$/.test(priceText)) return null;

  const [whole, cents = ''] = priceText.split('.');
  return Number(whole) * 100 + Number(cents.padEnd(2, '0'));
}

/**
 * Google Flights returns `departure_time`/`arrival_time` as
 * "DD-MM-YYYY hh:mm AM/PM" (e.g. "10-09-2026 01:55 PM") with no timezone
 * offset. Converts to an ISO-shaped "YYYY-MM-DDTHH:mm:00" string (still no
 * offset) so `fare.depart`/date-relation slicing behaves the same as every
 * other provider's date strings.
 */
function parseGoogleFlightsDateTime(value: string): string | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim());
  if (!match) return null;

  const [, dd, mm, yyyy, hh, min, meridiem] = match;
  const month = Number(mm);
  const day = Number(dd);
  let hour = Number(hh);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 1 || hour > 12) return null;

  if (/pm/i.test(meridiem) && hour !== 12) hour += 12;
  if (/am/i.test(meridiem) && hour === 12) hour = 0;

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${yyyy}-${pad(month)}-${pad(day)}T${pad(hour)}:${min}:00`;
}

/**
 * Google Flights gives the airline as a full display name (e.g. "JetBlue"),
 * not an IATA code. `flight_number` (e.g. "B6 624") carries the real code as
 * its first token, so prefer that and fall back to the display name only if
 * it doesn't parse.
 */
function extractCarrier(item: GoogleFlightsItinerary): string {
  const firstSegment = Array.isArray(item.flights) ? item.flights[0] : undefined;
  const flightNumber = firstSegment?.flight_number;
  if (typeof flightNumber === 'string') {
    const match = /^([A-Z0-9]{2,3})\s/.exec(flightNumber.trim().toUpperCase());
    if (match) return match[1];
  }
  if (typeof firstSegment?.airline === 'string' && firstSegment.airline.trim()) {
    return firstSegment.airline.trim();
  }
  return 'Unknown';
}

/**
 * A genuine Google Flights *search* URL -- verified live (2026-08-06) to
 * resolve to real search results for the requested route/date. This API has
 * no booking/checkout flow of its own (`booking_token` is only meaningful to
 * an undocumented-to-us follow-up call), so the deeplink must never imply
 * more capability than "here's the same search on Google Flights."
 */
function buildGoogleFlightsDeeplink(origin: string, dest: string, departDate: string): string {
  const query = `Flights from ${origin} to ${dest} on ${departDate}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
}

export class GoogleFlightsProvider implements FlightProvider {
  // Read env var at call time so tests can set it before any method runs
  private get apiKey(): string {
    return process.env.RAPIDAPI_KEY_GOOGLE_FLIGHTS ?? '';
  }

  // ─── priceTrends ───────────────────────────────────────────────────────────

  async priceTrends(_origin: string, _dest: string): Promise<Result<PricePoint[]>> {
    // This API has no historical price-trend endpoint
    return { ok: true, data: [] };
  }

  // ─── searchFares ───────────────────────────────────────────────────────────

  async searchFares(
    origin: string,
    dest: string,
    range: FlightSearchRange
  ): Promise<Result<NormalizedFare[]>> {
    if (!dest) return { ok: true, data: [] };

    const departDate = range.depart && /^\d{4}-\d{2}-\d{2}$/.test(range.depart)
      ? range.depart
      : null;
    if (!departDate) return { ok: true, data: [] };

    const apiKey = this.apiKey;
    if (!apiKey) return { ok: false, reason: 'GoogleFlights not configured' };

    const passengerCount = range.passengers;
    const returnDate = range.return && /^\d{4}-\d{2}-\d{2}$/.test(range.return) && range.return >= departDate
      ? range.return
      : null;

    const cacheKey = `googleFlights:search:${origin}:${dest}:${departDate}:${returnDate ?? ''}:pax:${passengerCount}`;

    try {
      const cached = await cache.get<NormalizedFare[]>(cacheKey);
      if (cached !== null) return { ok: true, data: cached };

      let url =
        `${BASE_URL}/api/v1/searchFlights` +
        `?departure_id=${encodeURIComponent(origin)}` +
        `&arrival_id=${encodeURIComponent(dest)}` +
        `&outbound_date=${encodeURIComponent(departDate)}` +
        `&travel_class=ECONOMY` +
        `&adults=${encodeURIComponent(String(passengerCount))}` +
        `&currency=USD` +
        `&language_code=en-US` +
        `&country_code=US`;

      // Round-trip param name is confirmed against the vendor's own published
      // docs (`return_date`, format YYYY-MM-DD) -- we could not exercise a
      // live authenticated round-trip call ourselves. See note below on why
      // `fare.return` is never populated as a result.
      if (returnDate) {
        url += `&return_date=${encodeURIComponent(returnDate)}`;
      }

      const res = await fetchWithProviderTimeout('GoogleFlights', url, {
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': API_HOST,
        },
      });

      if (!res.ok) {
        return { ok: false, reason: `GoogleFlights /api/v1/searchFlights HTTP ${res.status}` };
      }

      const json = await res.json();
      if (!isGoogleFlightsResponse(json)) {
        return { ok: false, reason: 'GoogleFlights returned a malformed response' };
      }

      const itineraries = json.data?.itineraries;
      const topFlights = itineraries?.topFlights;
      const otherFlights = itineraries?.otherFlights;
      if (topFlights !== undefined && !Array.isArray(topFlights)) {
        return { ok: false, reason: 'GoogleFlights returned a malformed response' };
      }
      if (otherFlights !== undefined && !Array.isArray(otherFlights)) {
        return { ok: false, reason: 'GoogleFlights returned a malformed response' };
      }

      const rawItineraries: unknown[] = [
        ...(Array.isArray(topFlights) ? topFlights : []),
        ...(Array.isArray(otherFlights) ? otherFlights : []),
      ];

      const fetchedAt = new Date().toISOString();
      const fares: NormalizedFare[] = [];

      for (let index = 0; index < rawItineraries.length; index += 1) {
        const raw = rawItineraries[index];
        if (typeof raw !== 'object' || raw === null) {
          continue;
        }
        const item = raw as GoogleFlightsItinerary;

        // Round-trip results can legitimately include unpriced itineraries
        // (e.g. mixed-carrier "self transfer" combos where Google can't quote
        // a combined fare) -- confirmed live via a real round-trip payload
        // where `price` was the literal string "unavailable" on 2 of 73
        // items. Skip just that item instead of discarding every real fare
        // in the response over a handful of unbookable ones.
        if (typeof item.price !== 'number') {
          continue;
        }
        const priceCents = toPriceCents(item.price);
        if (priceCents === null) {
          continue;
        }

        if (typeof item.departure_time !== 'string' || typeof item.arrival_time !== 'string') {
          continue;
        }
        const parsedDepart = parseGoogleFlightsDateTime(item.departure_time);
        const parsedArrive = parseGoogleFlightsDateTime(item.arrival_time);
        if (parsedDepart === null || parsedArrive === null) {
          continue;
        }

        const segments = Array.isArray(item.flights) ? item.flights : [];
        const firstSegment = segments[0];
        const lastSegment = segments[segments.length - 1];
        const fareOrigin = firstSegment?.departure_airport?.airport_code || origin;
        const fareDestination = lastSegment?.arrival_airport?.airport_code || dest;
        const stops = typeof item.stops === 'number' ? item.stops : Math.max(0, segments.length - 1);
        const durationMinutes = typeof item.duration?.raw === 'number' ? item.duration.raw : null;

        const fare: NormalizedFare = {
          id: `googleFlights-${index}-${(item.booking_token ?? '').slice(0, 24)}`,
          fareType: 'cash',
          origin: fareOrigin,
          destination: fareDestination,
          depart: parsedDepart,
          stops,
          carrier: extractCarrier(item),
          price: {
            priceCents,
            currency: 'USD',
          },
          passengerCount,
          priceScope: 'party_total',
          deeplink: buildGoogleFlightsDeeplink(origin, dest, departDate),
          source: 'googleFlights',
          fetchedAt,
          itinerary: buildPartialOrUnavailable({
            durationMinutes,
            depart: parsedDepart,
            arrive: parsedArrive,
          }),
        };

        // `return` is intentionally never set here. Google's own docs example
        // for this endpoint doesn't demonstrate the round-trip response shape,
        // and we have no verified live round-trip payload showing whether
        // `departure_time`/`arrival_time`/`flights[]` describe the outbound
        // leg only or the whole trip. Rather than guess at a return-leg
        // timestamp, we leave the field unset -- `price` is still trusted as
        // the API's own total for the requested passenger count either way.

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
export const googleFlights = new GoogleFlightsProvider();
