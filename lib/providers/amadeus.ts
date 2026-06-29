import { FlightProvider, NormalizedFare, PricePoint, Result } from '../types';
import { cache } from '../cache/redis';

const TOKEN_URL = 'https://test.api.amadeus.com/v1/security/oauth2/token';
const BASE_URL = 'https://test.api.amadeus.com/v1';
const CACHE_TTL = 1800; // 30 minutes

// ─── Amadeus API response shapes ─────────────────────────────────────────────

interface AmadeusTokenResponse {
  access_token: string;
  expires_in: number;
}

interface AmadeusSegment {
  departure: { iataCode: string; at: string };
  arrival: { iataCode: string; at: string };
  carrierCode: string;
  number: string;
  numberOfStops: number;
}

interface AmadeusItinerary {
  segments: AmadeusSegment[];
}

interface AmadeusOffer {
  id: string;
  itineraries: AmadeusItinerary[];
  price: { grandTotal: string; currency: string };
}

interface AmadeusSearchResponse {
  data: AmadeusOffer[];
}

// ─────────────────────────────────────────────────────────────────────────────

export class AmadeusProvider implements FlightProvider {
  // Read env vars at call time so tests can set them before any method runs
  private get clientId(): string {
    return process.env.AMADEUS_ID ?? '';
  }

  private get clientSecret(): string {
    return process.env.AMADEUS_SECRET ?? '';
  }

  private async getToken(): Promise<string> {
    const cached = await cache.get<string>('amadeus:token');
    if (cached !== null) return cached;

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:
        `grant_type=client_credentials` +
        `&client_id=${encodeURIComponent(this.clientId)}` +
        `&client_secret=${encodeURIComponent(this.clientSecret)}`,
    });

    if (!res.ok) {
      throw new Error(`Amadeus token fetch HTTP ${res.status}`);
    }

    const json = (await res.json()) as AmadeusTokenResponse;
    // Cache the token with TTL 60s less than expires_in (usually 1799s → 1740s)
    const ttl = Math.max(0, json.expires_in - 60);
    await cache.set('amadeus:token', json.access_token, ttl);
    return json.access_token;
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

    const cacheKey = `amadeus:search:${origin}:${dest}:${range.depart}`;

    try {
      const cached = await cache.get<NormalizedFare[]>(cacheKey);
      if (cached !== null) return { ok: true, data: cached };

      const token = await this.getToken();

      let url =
        `${BASE_URL}/shopping/flight-offers` +
        `?originLocationCode=${encodeURIComponent(origin)}` +
        `&destinationLocationCode=${encodeURIComponent(dest)}` +
        `&departureDate=${encodeURIComponent(range.depart)}` +
        `&adults=1` +
        `&max=20` +
        `&currencyCode=USD`;

      if (range.return) {
        url += `&returnDate=${encodeURIComponent(range.return)}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        return { ok: false, reason: `Amadeus /shopping/flight-offers HTTP ${res.status}` };
      }

      const json = (await res.json()) as AmadeusSearchResponse;
      const fetchedAt = new Date().toISOString();

      const fares: NormalizedFare[] = (json.data ?? []).map((offer) => {
        const firstItinerary = offer.itineraries[0];
        const lastItinerary = offer.itineraries[offer.itineraries.length - 1];
        const firstSegment = firstItinerary.segments[0];
        const lastSegmentOfFirstItin =
          firstItinerary.segments[firstItinerary.segments.length - 1];

        const originCode = firstSegment.departure.iataCode;
        const destCode = lastSegmentOfFirstItin.arrival.iataCode;
        const depart = firstSegment.departure.at;

        // stops = sum of numberOfStops across all segments of first itinerary
        const stops = firstItinerary.segments.reduce(
          (sum, seg) => sum + seg.numberOfStops,
          0
        );

        const fare: NormalizedFare = {
          id: `amadeus-${offer.id}`,
          fareType: 'cash',
          origin: originCode,
          destination: destCode,
          depart,
          stops,
          carrier: firstSegment.carrierCode,
          price: {
            priceCents: Math.round(parseFloat(offer.price.grandTotal) * 100),
            currency: 'USD',
          },
          deeplink: `https://www.amadeus.com/en/search?from=${originCode}&to=${destCode}&departure=${depart}`,
          source: 'amadeus',
          fetchedAt,
        };

        // Only include `return` for round-trip itineraries (>1 itinerary)
        if (offer.itineraries.length > 1) {
          const lastSegs = lastItinerary.segments;
          fare.return = lastSegs[lastSegs.length - 1].arrival.at;
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
export const amadeus = new AmadeusProvider();
