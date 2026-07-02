import { FlightProvider, FlightSearchRange, NormalizedFare, NormalizedFlightSegment, PricePoint, Result } from '../types';
import { cache } from '../cache/redis';
import { buildBookingHref } from '../booking/config';
import { fetchWithProviderTimeout } from './timeout';
import { buildConfirmedItinerary, buildPartialItinerary, buildPartialOrUnavailable, unavailableItinerary } from './itinerary';

const BASE_URL = 'https://api.duffel.com';
const CACHE_TTL = 21600; // 6 hours
const DEFAULT_CABIN_CLASS = 'economy';

// ─── Duffel API response shapes ──────────────────────────────────────────────

interface DuffelPlace {
  iata_code: string;
}

interface DuffelSegment {
  origin?: DuffelPlace;
  destination?: DuffelPlace;
  departing_at?: string;
  arriving_at?: string;
  marketing_carrier?: { iata_code?: string };
  marketing_carrier_flight_number?: string;
  passengers?: Array<{ cabin_class?: string }>;
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

function decimalStringToCents(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;

  const whole = Number(match[1]);
  const cents = Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(cents)) return null;

  const total = whole * 100 + cents;
  return Number.isSafeInteger(total) ? total : null;
}

function isDuffelOfferResponse(value: unknown): value is DuffelOfferRequestResponse {
  if (typeof value !== 'object' || value === null || !('data' in value)) return false;
  const data = (value as { data?: unknown }).data;
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as { offers?: unknown }).offers)
  );
}

function buildDuffelSearchCacheKey(params: {
  origin: string;
  dest: string;
  departDate: string;
  returnDate: string | null;
  passengerCount: number;
  cabinClass: string;
}): string {
  const returnPart = params.returnDate ? `return:${params.returnDate}` : 'trip:one-way';

  return [
    'duffel',
    'search',
    `origin:${params.origin}`,
    `dest:${params.dest}`,
    `depart:${params.departDate}`,
    returnPart,
    `pax:${params.passengerCount}`,
    `cabin:${params.cabinClass}`,
  ].join(':');
}

function normalizeDuffelSliceItinerary(slice: DuffelSlice | undefined) {
  if (!slice) return unavailableItinerary();

  const segments: NormalizedFlightSegment[] = slice.segments.map(segment => ({
    origin: segment.origin?.iata_code ?? '',
    destination: segment.destination?.iata_code ?? '',
    depart: segment.departing_at ?? '',
    arrive: segment.arriving_at ?? '',
    carrier: segment.marketing_carrier?.iata_code,
    flightNumber: segment.marketing_carrier_flight_number,
  }));
  const confirmed = buildConfirmedItinerary(segments);
  if (confirmed) return confirmed;

  const partialDuration = slice.departing_at && slice.arriving_at
    ? buildPartialItinerary({
      durationMinutes: Math.round((new Date(slice.arriving_at).getTime() - new Date(slice.departing_at).getTime()) / 60_000),
      depart: slice.departing_at,
      arrive: slice.arriving_at,
    })
    : null;

  if (partialDuration?.durationMinutes !== undefined || partialDuration?.arrive) {
    return partialDuration;
  }

  return unavailableItinerary();
}

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
    range: FlightSearchRange
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

    const passengerCount = range.passengers;
    const returnDate = range.return && /^\d{4}-\d{2}-\d{2}$/.test(range.return) && range.return >= departDate
      ? range.return
      : null;
    const cacheKey = buildDuffelSearchCacheKey({
      origin,
      dest,
      departDate,
      returnDate,
      passengerCount,
      cabinClass: DEFAULT_CABIN_CLASS,
    });

    try {
      const cached = await cache.get<NormalizedFare[]>(cacheKey);
      if (cached !== null) return { ok: true, data: cached };

      // Build slices — outbound always present, return slice optional
      const slices: Array<{ origin: string; destination: string; departure_date: string }> = [
        { origin, destination: dest, departure_date: departDate },
      ];

      if (returnDate) {
        slices.push({ origin: dest, destination: origin, departure_date: returnDate });
      }

      const res = await fetchWithProviderTimeout('Duffel', `${BASE_URL}/air/offer_requests`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Duffel-Version': 'v2',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            slices,
            passengers: Array.from({ length: passengerCount }, () => ({ type: 'adult' })),
            cabin_class: DEFAULT_CABIN_CLASS,
            return_offers: false,
          },
        }),
      });

      if (!res.ok) {
        return { ok: false, reason: `Duffel /air/offer_requests HTTP ${res.status}` };
      }

      const json = await res.json();
      if (!isDuffelOfferResponse(json)) {
        return { ok: false, reason: 'Duffel returned a malformed response' };
      }

      const offers = json.data.offers;

      const fetchedAt = new Date().toISOString();

      const fares: NormalizedFare[] = offers.map((offer) => {
        const firstSlice = offer.slices[0];
        const lastSlice = offer.slices[offer.slices.length - 1];
        const priceCents = decimalStringToCents(offer.total_amount);

        if (!firstSlice || !lastSlice || !offer.owner?.iata_code || priceCents === null) return null;

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
          cabin: (firstSlice.segments[0]?.passengers?.[0]?.cabin_class ?? 'economy') as NormalizedFare['cabin'],
          stops,
          carrier: offer.owner.iata_code,
          price: {
            priceCents,
            currency: offer.total_currency,
          },
          passengerCount,
          priceScope: 'party_total',
          deeplink: '',
          source: 'duffel',
          fetchedAt,
          itinerary: offer.slices.length === 1
            ? normalizeDuffelSliceItinerary(firstSlice)
            : buildPartialOrUnavailable({ arrive: firstSlice.arriving_at }),
        };

        // Only include `return` field for round-trip itineraries
        if (offer.slices.length > 1) {
          fare.return = lastSlice.arriving_at;
        }

        fare.deeplink = buildBookingHref(fare);

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
export const duffel = new DuffelProvider();
