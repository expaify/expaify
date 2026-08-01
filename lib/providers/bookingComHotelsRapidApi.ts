import { HotelProvider, HotelLocation, HotelOffer, HotelRatingEvidence, HotelSearchContext, HotelSearchPage, Result } from '../types';
import { cache } from '../cache/redis';
import { fetchWithProviderTimeout } from './timeout';
import { normalizeHotelAmenityEvidence } from './hotelAmenityEvidence';
import { withCalculatedAnchorDistance } from '../hotels/locationEvidence';
import { notProvidedHotelDocumentReadiness } from './hotelDocumentReadiness';
import { createNotReturnedHotelFundsPolicy } from '../hotels/fundsPolicy';
import { notProvidedHotelSmokingPolicy } from '../hotels/smokingPolicy';
import { HOTEL_RATE_ELIGIBILITY_UNSUPPORTED } from '../hotels/rateEligibility';
import { HOTEL_ADMISSION_POLICY_UNSUPPORTED } from '../hotels/admissionPolicy';

// Real, live Booking.com inventory via RapidAPI. Unlike Hotelbeds (a wholesale
// B2B API with no public consumer booking page), this aggregator has no
// affiliate-marker mechanism exposed either, so `deeplink` is left empty here
// too — the existing `isValidBookingUrl` UI check correctly falls back to
// "Booking unavailable" until a real affiliate/booking integration exists.
const DEFAULT_HOST = 'booking-com15.p.rapidapi.com';
const DEFAULT_BASE_URL = `https://${DEFAULT_HOST}`;
const DEST_CACHE_TTL = 30 * 24 * 60 * 60; // destination IDs are effectively static
const SEARCH_CACHE_TTL = 21600; // 6 hours
const RESULT_LIMIT = 20;

interface DestinationCandidate {
  dest_id?: string | number;
  dest_type?: string;
  search_type?: string;
  name?: string;
}

interface DestinationSearchResponse {
  data?: DestinationCandidate[];
}

interface HotelProperty {
  name?: string;
  latitude?: number;
  longitude?: number;
  reviewScore?: number;
  reviewCount?: number;
  propertyClass?: number;
  photoUrls?: string[];
  wishlistName?: string;
  priceBreakdown?: { grossPrice?: { value?: number; currency?: string } };
}

interface HotelResult {
  hotel_id?: number;
  property?: HotelProperty;
}

interface HotelSearchResponse {
  data?: { hotels?: HotelResult[] };
}

type RapidHotelOffer = HotelOffer & { stars: number };

function buildHotelClassEvidence(stars: number, fetchedAt: string): HotelRatingEvidence {
  if (stars > 0) {
    return { kind: 'hotel_class', value: stars, scaleMax: 5, sourceLabel: 'Booking.com', fetchedAt, confidence: 'provider_only' };
  }
  return { kind: 'unknown', sourceLabel: 'Booking.com', fetchedAt, confidence: 'unavailable' };
}

function buildGuestRatingEvidence(reviewScore: number | undefined, fetchedAt: string): HotelRatingEvidence | undefined {
  if (typeof reviewScore !== 'number' || !Number.isFinite(reviewScore) || reviewScore <= 0) return undefined;
  return {
    kind: 'guest_review',
    value: reviewScore,
    scaleMax: 10,
    sourceLabel: 'Booking.com',
    fetchedAt,
    confidence: 'provider_only',
  };
}

function applySearchContext(hotel: HotelOffer, context?: HotelSearchContext): HotelOffer {
  if (!hotel.location) return hotel;
  return { ...hotel, location: withCalculatedAnchorDistance(hotel.location, context?.anchor) };
}

export class BookingComHotelsRapidApiProvider implements HotelProvider {
  private get apiKey(): string {
    return process.env.RAPIDAPI_KEY ?? '';
  }

  private get host(): string {
    return process.env.RAPIDAPI_HOST ?? DEFAULT_HOST;
  }

  private get baseUrl(): string {
    return process.env.RAPIDAPI_BASE_URL ?? DEFAULT_BASE_URL;
  }

  private get headers(): Record<string, string> {
    return { 'x-rapidapi-key': this.apiKey, 'x-rapidapi-host': this.host };
  }

  /** Looks up a Booking.com destination id for an IATA airport code, preferring
   *  the airport-typed result over the surrounding city so search stays
   *  anchored to what the user actually searched for. Cached long-term since
   *  destination ids are stable. */
  private async resolveDestination(iata: string): Promise<{ destId: string; searchType: string } | undefined> {
    const cacheKey = `bookingcom-rapidapi:dest:${iata}`;
    const cached = await cache.get<{ destId: string; searchType: string }>(cacheKey);
    if (cached) return cached;

    const url = `${this.baseUrl}/api/v1/hotels/searchDestination?query=${encodeURIComponent(iata)}`;
    const res = await fetchWithProviderTimeout('Booking.com', url, { headers: this.headers });
    if (!res.ok) return undefined;

    const json = (await res.json()) as DestinationSearchResponse;
    const candidates = json.data ?? [];
    const best =
      candidates.find(c => c.dest_type === 'airport') ??
      candidates.find(c => c.dest_type === 'city') ??
      candidates[0];

    if (!best || best.dest_id === undefined || !best.search_type) return undefined;

    const resolved = { destId: String(best.dest_id), searchType: best.search_type };
    await cache.set(cacheKey, resolved, DEST_CACHE_TTL);
    return resolved;
  }

  async searchHotels(
    area: string,
    range: { checkin: string; checkout: string },
    context?: HotelSearchContext
  ): Promise<Result<HotelSearchPage>> {
    if (!this.apiKey) return { ok: false, reason: 'RAPIDAPI_KEY not configured' };

    const location = area.trim().toUpperCase();
    const searchCacheKey = `bookingcom-rapidapi:search:${location}:${range.checkin}:${range.checkout}`;

    try {
      const cached = await cache.get<RapidHotelOffer[]>(searchCacheKey);
      if (Array.isArray(cached)) {
        return { ok: true, data: { offers: cached.map(hotel => applySearchContext(hotel, context)), coverage: 'unconfirmed' } };
      }

      const destination = await this.resolveDestination(location);
      if (!destination) return { ok: false, reason: `No Booking.com destination found for area ${area}` };

      const url =
        `${this.baseUrl}/api/v1/hotels/searchHotels` +
        `?dest_id=${encodeURIComponent(destination.destId)}` +
        `&search_type=${encodeURIComponent(destination.searchType.toUpperCase())}` +
        `&arrival_date=${encodeURIComponent(range.checkin)}` +
        `&departure_date=${encodeURIComponent(range.checkout)}` +
        `&adults=2&room_qty=1&page_number=1&currency_code=USD`;

      const res = await fetchWithProviderTimeout('Booking.com', url, { headers: this.headers });
      if (!res.ok) return { ok: false, reason: `Booking.com HTTP ${res.status}` };

      const json = (await res.json()) as HotelSearchResponse;
      const results = json.data?.hotels;
      if (!Array.isArray(results)) return { ok: false, reason: 'Booking.com returned a malformed response' };
      if (results.length === 0) return { ok: true, data: { offers: [], coverage: 'unconfirmed' } };

      const fetchedAt = new Date().toISOString();
      const hotels: RapidHotelOffer[] = results.slice(0, RESULT_LIMIT).flatMap((entry) => {
        const property = entry.property;
        if (typeof entry.hotel_id !== 'number' || !property || typeof property.name !== 'string') return [];

        const priceValue = property.priceBreakdown?.grossPrice?.value;
        if (typeof priceValue !== 'number' || !Number.isFinite(priceValue) || priceValue <= 0) return [];
        const priceCents = Math.round(priceValue * 100);

        const stars = Number.isFinite(property.propertyClass) && (property.propertyClass ?? 0) > 0 ? Number(property.propertyClass) : 0;
        const hasCoords = typeof property.latitude === 'number' && typeof property.longitude === 'number';
        const access = normalizeHotelAmenityEvidence(undefined, 'Booking.com');
        const guestRating = buildGuestRatingEvidence(property.reviewScore, fetchedAt);

        const locationEvidence: HotelLocation = {
          area: property.wishlistName ?? location,
          source: hasCoords ? 'provider' : 'search_fallback',
          precision: hasCoords ? 'coordinates' : 'area',
          ...(hasCoords ? { lat: property.latitude, lng: property.longitude } : {}),
        };

        return [{
          id: String(entry.hotel_id),
          name: property.name,
          area: property.wishlistName ?? location,
          location: locationEvidence,
          stars,
          pricePerNight: { priceCents, currency: property.priceBreakdown?.grossPrice?.currency ?? 'USD' },
          deeplink: '',
          source: 'booking.com',
          documentReadiness: notProvidedHotelDocumentReadiness('Booking.com'),
          hotelClass: buildHotelClassEvidence(stars, fetchedAt),
          ...(guestRating ? { guestRating } : {}),
          amenityEvidence: access.evidence,
          accessEvidenceState: access.state,
          fundsPolicy: createNotReturnedHotelFundsPolicy('Booking.com'),
          smokingPolicy: notProvidedHotelSmokingPolicy(),
          rateEligibilityCapability: HOTEL_RATE_ELIGIBILITY_UNSUPPORTED,
          admissionPolicyCapability: HOTEL_ADMISSION_POLICY_UNSUPPORTED,
          photoUrl: property.photoUrls?.[0],
        }];
      });

      await cache.set(searchCacheKey, hotels, SEARCH_CACHE_TTL);

      return { ok: true, data: { offers: hotels.map(hotel => applySearchContext(hotel, context)), coverage: 'unconfirmed' } };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }

  async checkDocumentReadiness(
    _offer: Pick<HotelOffer, 'id' | 'source' | 'deeplink' | 'documentReadiness'>,
  ): Promise<Result<HotelOffer['documentReadiness']>> {
    return { ok: true, data: notProvidedHotelDocumentReadiness('Booking.com') };
  }
}

export const bookingComHotels = new BookingComHotelsRapidApiProvider();
