import { FlightProvider, NormalizedFare, PricePoint, Result } from '../types';
import { cache } from '../cache/redis';

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
  numberOfStops?: number;
}

interface AmadeusItinerary {
  segments: AmadeusSegment[];
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

function decimalStringToCents(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;

  const whole = Number(match[1]);
  const cents = Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(cents)) return null;

  const total = whole * 100 + cents;
  return Number.isSafeInteger(total) ? total : null;
}

export class AmadeusProvider implements FlightProvider {
  // Read env vars at call time so tests can set them before any method runs
  private get clientId(): string {
    return process.env.AMADEUS_CLIENT_ID ?? '';
  }

  private get clientSecret(): string {
    return process.env.AMADEUS_CLIENT_SECRET ?? '';
  }

  private async getToken(): Promise<Result<string>> {
    const cached = await cache.get<string>('amadeus:token');
    if (cached !== null) return { ok: true, data: cached };

    const res = await fetch(TOKEN_URL, {
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

    const json = (await res.json()) as AmadeusTokenResponse;
    if (!json.access_token) return { ok: false, reason: 'Amadeus token response missing access_token' };

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
    range: { depart: string; return?: string }
  ): Promise<Result<NormalizedFare[]>> {
    if (!dest) return { ok: true, data: [] };

    const clientId = this.clientId;
    const clientSecret = this.clientSecret;
    if (!clientId || !clientSecret) {
      return { ok: false, reason: 'Amadeus not configured' };
    }

    const cacheKey = `amadeus:search:${origin}:${dest}:${range.depart}:${range.return ?? ''}`;

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

      const res = await fetch(FLIGHT_OFFERS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.data}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currencyCode: 'USD',
          originDestinations,
          travelers: [{ id: '1', travelerType: 'ADULT' }],
          sources: ['GDS'],
          searchCriteria: { maxFlightOffers: 20 },
        }),
      });

      if (!res.ok) {
        return { ok: false, reason: `Amadeus /shopping/flight-offers HTTP ${res.status}` };
      }

      const json = (await res.json()) as AmadeusSearchResponse;
      const fetchedAt = new Date().toISOString();

      const fares: NormalizedFare[] = (json.data ?? []).map((offer) => {
        const firstItinerary = offer.itineraries[0];
        if (!firstItinerary) return null;

        const lastItinerary = offer.itineraries[offer.itineraries.length - 1];
        const firstSegment = firstItinerary.segments[0];
        if (!firstSegment) return null;

        const lastSegmentOfFirstItin =
          firstItinerary.segments[firstItinerary.segments.length - 1];
        if (!lastSegmentOfFirstItin) return null;

        const originCode = firstSegment.departure.iataCode;
        const destCode = lastSegmentOfFirstItin.arrival.iataCode;
        const depart = firstSegment.departure.at ?? range.depart;

        const stops = offer.itineraries.reduce((total, itinerary) => {
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
          deeplink: `https://www.amadeus.com/en/search?from=${originCode}&to=${destCode}&departure=${depart}`,
          source: 'amadeus',
          fetchedAt,
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
