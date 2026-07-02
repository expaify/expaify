import { FlightProvider, FlightSearchRange, NormalizedFare, NormalizedFlightSegment, PricePoint, Result } from '../types';
import { cache } from '../cache/redis';
import { fetchWithProviderTimeout } from './timeout';
import { buildConfirmedItinerary, buildPartialOrUnavailable, unavailableItinerary } from './itinerary';

const TOKEN_URL = 'https://test.api.amadeus.com/v1/security/oauth2/token';
const FLIGHT_OFFERS_URL = 'https://test.api.amadeus.com/v2/shopping/flight-offers';
const CACHE_TTL = 21600; // 6 hours

// ─── Amadeus API response shapes ─────────────────────────────────────────────

interface AmadeusTokenResponse {
  access_token: string;
  expires_in: number;
}

interface AmadeusSegment {
  departure: { iataCode: string; at?: string };
  arrival: { iataCode: string; at?: string };
  carrierCode?: string;
  number?: string;
  numberOfStops?: number;
}

interface AmadeusItinerary {
  segments: AmadeusSegment[];
  duration?: string;
}

interface AmadeusOffer {
  id: string;
  itineraries: AmadeusItinerary[];
  price: { grandTotal: string; currency: string };
  validatingAirlineCodes?: string[];
}

interface AmadeusSearchResponse {
  data: AmadeusOffer[];
}

// ─────────────────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAmadeusSearchResponse(value: unknown): value is AmadeusSearchResponse {
  return isRecord(value) && Array.isArray(value.data);
}

function decimalStringToCents(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;

  const whole = Number(match[1]);
  const cents = Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(cents)) return null;

  const total = whole * 100 + cents;
  return Number.isSafeInteger(total) ? total : null;
}

function parseIsoDurationMinutes(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?$/.exec(value);
  if (!match) return null;

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const total = days * 1440 + hours * 60 + minutes;
  return Number.isFinite(total) && total >= 0 ? total : null;
}

function normalizeAmadeusItinerary(itinerary: AmadeusItinerary | undefined) {
  if (!itinerary || !Array.isArray(itinerary.segments)) return unavailableItinerary();

  const segments: NormalizedFlightSegment[] = itinerary.segments.map(segment => ({
    origin: segment.departure?.iataCode ?? '',
    destination: segment.arrival?.iataCode ?? '',
    depart: segment.departure?.at ?? '',
    arrive: segment.arrival?.at ?? '',
    carrier: segment.carrierCode,
    flightNumber: segment.number,
  }));
  const confirmed = buildConfirmedItinerary(segments);
  if (confirmed) return confirmed;

  const lastSegment = itinerary.segments[itinerary.segments.length - 1];
  return buildPartialOrUnavailable({
    durationMinutes: parseIsoDurationMinutes(itinerary.duration),
    arrive: lastSegment?.arrival?.at,
  });
}

export class AmadeusProvider implements FlightProvider {
  // Read env vars at call time so tests can set them before any method runs
  private get clientId(): string {
    return process.env.AMADEUS_ID ?? process.env.AMADEUS_CLIENT_ID ?? '';
  }

  private get clientSecret(): string {
    return process.env.AMADEUS_SECRET ?? process.env.AMADEUS_CLIENT_SECRET ?? '';
  }

  private async getToken(): Promise<Result<string>> {
    const cached = await cache.get<string>('amadeus:token');
    if (cached !== null) return { ok: true, data: cached };

    const res = await fetchWithProviderTimeout('Amadeus', TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:
        `grant_type=client_credentials` +
        `&client_id=${encodeURIComponent(this.clientId)}` +
        `&client_secret=${encodeURIComponent(this.clientSecret)}`,
    });

    if (!res.ok) {
      return { ok: false, reason: `Amadeus token fetch HTTP ${res.status}` };
    }

    const json = (await res.json()) as Partial<AmadeusTokenResponse>;
    if (typeof json.access_token !== 'string' || typeof json.expires_in !== 'number') {
      return { ok: false, reason: 'Amadeus returned a malformed response' };
    }

    // Cache the token with TTL 60s less than expires_in (usually 1799s → 1740s)
    const ttl = Math.max(0, json.expires_in - 60);
    await cache.set('amadeus:token', json.access_token, ttl);
    return { ok: true, data: json.access_token };
  }

  // ─── priceTrends ───────────────────────────────────────────────────────────

  async priceTrends(_origin: string, _dest: string): Promise<Result<PricePoint[]>> {
    // Amadeus Self-Service does not support price trend data
    return { ok: true, data: [] };
  }

  // ─── searchFares ───────────────────────────────────────────────────────────

  async searchFares(
    origin: string,
    dest: string,
    range: FlightSearchRange
  ): Promise<Result<NormalizedFare[]>> {
    if (!dest) return { ok: true, data: [] };

    const clientId = this.clientId;
    const clientSecret = this.clientSecret;
    if (!clientId || !clientSecret) {
      return { ok: false, reason: 'Amadeus not configured' };
    }

    const passengerCount = range.passengers;
    const cacheKey = `amadeus:search:${origin}:${dest}:${range.depart}:${range.return ?? ''}:pax:${passengerCount}`;

    try {
      const cached = await cache.get<NormalizedFare[]>(cacheKey);
      if (cached !== null) return { ok: true, data: cached };

      const token = await this.getToken();
      if (!token.ok) return token;

      const originDestinations = [
        {
          id: '1',
          originLocationCode: origin,
          destinationLocationCode: dest,
          departureDateTimeRange: { date: range.depart },
        },
      ];

      if (range.return) {
        originDestinations.push({
          id: '2',
          originLocationCode: dest,
          destinationLocationCode: origin,
          departureDateTimeRange: { date: range.return },
        });
      }

      const res = await fetchWithProviderTimeout('Amadeus', FLIGHT_OFFERS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.data}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currencyCode: 'USD',
          originDestinations,
          travelers: Array.from({ length: passengerCount }, (_, index) => ({
            id: String(index + 1),
            travelerType: 'ADULT',
          })),
          sources: ['GDS'],
          searchCriteria: { maxFlightOffers: 20 },
        }),
      });

      if (!res.ok) {
        return { ok: false, reason: `Amadeus /shopping/flight-offers HTTP ${res.status}` };
      }

      const json = await res.json();
      if (!isAmadeusSearchResponse(json)) {
        return { ok: false, reason: 'Amadeus returned a malformed response' };
      }

      const fetchedAt = new Date().toISOString();

      const fares: NormalizedFare[] = (json.data ?? []).map((offer) => {
        if (!Array.isArray(offer.itineraries)) return null;
        const firstItinerary = offer.itineraries[0];
        if (!firstItinerary || !Array.isArray(firstItinerary.segments)) return null;

        const lastItinerary = offer.itineraries[offer.itineraries.length - 1];
        if (!lastItinerary || !Array.isArray(lastItinerary.segments)) return null;
        const firstSegment = firstItinerary.segments[0];
        if (!firstSegment) return null;

        const lastSegmentOfFirstItin =
          firstItinerary.segments[firstItinerary.segments.length - 1];
        if (!lastSegmentOfFirstItin) return null;

        const originCode = firstSegment.departure?.iataCode;
        const destCode = lastSegmentOfFirstItin.arrival?.iataCode;
        const depart = firstSegment.departure?.at ?? range.depart;
        if (!originCode || !destCode || !offer.price?.grandTotal || !offer.price.currency) {
          return null;
        }

        const stops = offer.itineraries.reduce((total, itinerary) => {
          if (!Array.isArray(itinerary.segments)) return total;
          const connectionStops = Math.max(0, itinerary.segments.length - 1);
          const technicalStops = itinerary.segments.reduce(
            (sum, seg) => sum + (seg.numberOfStops ?? 0),
            0
          );
          return total + connectionStops + technicalStops;
        }, 0);

        const priceCents = decimalStringToCents(offer.price.grandTotal);
        if (priceCents === null) return null;

        const carrier = firstSegment.carrierCode ?? offer.validatingAirlineCodes?.[0] ?? 'Unknown';

        const fare: NormalizedFare = {
          id: `amadeus-${offer.id}`,
          fareType: 'cash',
          origin: originCode,
          destination: destCode,
          depart,
          stops,
          carrier,
          price: {
            priceCents,
            currency: offer.price.currency,
          },
          passengerCount,
          priceScope: 'party_total',
          deeplink: '',
          source: 'amadeus',
          fetchedAt,
          itinerary: offer.itineraries.length === 1
            ? normalizeAmadeusItinerary(firstItinerary)
            : buildPartialOrUnavailable({
              durationMinutes: parseIsoDurationMinutes(firstItinerary.duration),
              arrive: lastSegmentOfFirstItin.arrival?.at,
            }),
        };

        // Only include `return` for round-trip itineraries (>1 itinerary)
        if (offer.itineraries.length > 1) {
          const lastSegs = lastItinerary.segments;
          const finalReturnSegment = lastSegs[lastSegs.length - 1];
          fare.return = finalReturnSegment?.arrival.at ?? range.return;
        }

        return fare;
      }).filter((fare): fare is NormalizedFare => fare !== null);

      await cache.set(cacheKey, fares, CACHE_TTL);
      return { ok: true, data: fares };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Shared singleton — used by snapshot-job and other scripts. */
export const amadeus = new AmadeusProvider();
