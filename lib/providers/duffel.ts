import { FlightProvider, NormalizedFare, PricePoint, Result } from '../types';
import { cache } from '../cache/redis';

const BASE_URL = 'https://api.duffel.com';
const CACHE_TTL = 1800; // 30 minutes

// ─── Duffel API response shapes ──────────────────────────────────────────────

interface DuffelPlace {
  iata_code: string;
}

interface DuffelSegment {
  [key: string]: unknown;
}

interface DuffelSlice {
  origin: DuffelPlace;
  destination: DuffelPlace;
  departing_at: string;
  arriving_at: string;
  segments: DuffelSegment[];
}

interface DuffelOffer {
  id: string;
  owner: { iata_code: string };
  total_amount: string;
  total_currency: string;
  slices: DuffelSlice[];
}

interface DuffelOfferRequestResponse {
  data: {
    id: string;
    offers: DuffelOffer[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export class DuffelProvider implements FlightProvider {
  // Read env var at call time so tests can set it before any method runs
  private get apiKey(): string {
    return process.env.DUFFEL_KEY ?? '';
  }

  // ─── priceTrends ───────────────────────────────────────────────────────────

  async priceTrends(_origin: string, _dest: string): Promise<Result<PricePoint[]>> {
    // Duffel does not support historical price trends
    return { ok: true, data: [] };
  }

  // ─── searchFares ───────────────────────────────────────────────────────────

  async searchFares(
    origin: string,
    dest: string,
    range: { depart: string; return?: string }
  ): Promise<Result<NormalizedFare[]>> {
    // Duffel requires a destination and a valid future departure date
    if (!dest) return { ok: true, data: [] };

    const departDate = range.depart && /^\d{4}-\d{2}-\d{2}$/.test(range.depart)
      ? range.depart
      : null;
    if (!departDate) return { ok: true, data: [] };

    // Reject past dates — Duffel returns 422 for them
    if (departDate < new Date().toISOString().slice(0, 10)) return { ok: true, data: [] };

    const apiKey = this.apiKey;
    if (!apiKey) return { ok: false, reason: 'Duffel not configured' };

    const cacheKey = `duffel:search:${origin}:${dest}:${departDate}`;

    try {
      const cached = await cache.get<NormalizedFare[]>(cacheKey);
      if (cached !== null) return { ok: true, data: cached };

      // Build slices — outbound always present, return slice optional
      const slices: Array<{ origin: string; destination: string; departure_date: string }> = [
        { origin, destination: dest, departure_date: departDate },
      ];

      if (range.return && /^\d{4}-\d{2}-\d{2}$/.test(range.return) && range.return >= departDate) {
        slices.push({ origin: dest, destination: origin, departure_date: range.return });
      }

      const res = await fetch(`${BASE_URL}/air/offer_requests`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Duffel-Version': 'v2',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            slices,
            passengers: [{ type: 'adult' }],
            cabin_class: 'economy',
            return_offers: false,
          },
        }),
      });

      if (!res.ok) {
        const body = await Promise.resolve().then(() => res.text()).catch(() => '');
        return { ok: false, reason: `Duffel /air/offer_requests HTTP ${res.status}: ${body.slice(0, 200)}` };
      }

      const json = (await res.json()) as DuffelOfferRequestResponse;
      const offers = json.data.offers;

      const fetchedAt = new Date().toISOString();

      const fares: NormalizedFare[] = offers.map((offer) => {
        const firstSlice = offer.slices[0];
        const lastSlice = offer.slices[offer.slices.length - 1];

        // stops = sum of (segments.length - 1) per slice
        const stops = offer.slices.reduce(
          (total, slice) => total + Math.max(0, slice.segments.length - 1),
          0
        );

        const fare: NormalizedFare = {
          id: offer.id,
          fareType: 'cash',
          origin: firstSlice.origin.iata_code,
          destination: firstSlice.destination.iata_code,
          depart: firstSlice.departing_at,
          stops,
          carrier: offer.owner.iata_code,
          price: {
            // total_amount is a decimal string (e.g. "450.00") — convert to integer cents
            priceCents: Math.round(parseFloat(offer.total_amount) * 100),
            currency: offer.total_currency,
          },
          // Phase 3+ will replace this with a proper Duffel booking flow
          deeplink: `https://app.duffel.com/offers/${offer.id}`,
          source: 'duffel',
          fetchedAt,
        };

        // Only include `return` field for round-trip itineraries
        if (offer.slices.length > 1) {
          fare.return = lastSlice.arriving_at;
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
export const duffel = new DuffelProvider();
