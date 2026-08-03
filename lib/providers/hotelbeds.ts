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
import { AIRPORTS } from '../airports/data';
import { notEstablishedHotelGuestIdentity } from './hotelGuestIdentity';

// Hotelbeds is a wholesale B2B hotel API (not an affiliate network like the
// defunct Hotellook integration it replaces). It has no public per-hotel
// consumer booking page, so we cannot populate `deeplink` with a real outbound
// URL — offers are returned with an empty deeplink and the UI's existing
// `isValidBookingUrl` check correctly falls back to "Booking unavailable"
// until a real Hotelbeds Booking API (checkRate + booking confirm) flow is
// built. Search availability + real photos are wired now; booking is not.
const BOOKING_BASE = process.env.HOTELBEDS_BASE_URL ?? 'https://api.test.hotelbeds.com';
const CONTENT_BASE = process.env.HOTELBEDS_CONTENT_BASE_URL ?? 'https://api.test.hotelbeds.com';
const PHOTO_BASE = 'https://photos.hotelbeds.com/giata/bigger';
const CACHE_TTL = 21600; // 6 hours
const SEARCH_RADIUS_KM = 30;
const RESULT_LIMIT = 20;

interface HotelbedsRate {
  net?: string;
  rateClass?: string;
}

interface HotelbedsRoom {
  rates?: HotelbedsRate[];
}

interface HotelbedsHotelResult {
  code?: number;
  name?: string;
  categoryCode?: string;
  destinationName?: string;
  zoneName?: string;
  latitude?: string;
  longitude?: string;
  rooms?: HotelbedsRoom[];
}

interface HotelbedsSearchResponse {
  hotels?: {
    hotels?: HotelbedsHotelResult[];
  };
}

interface HotelbedsImage {
  path?: string;
  order?: number;
}

interface HotelbedsContentHotel {
  code?: number;
  images?: HotelbedsImage[];
}

interface HotelbedsContentResponse {
  hotels?: HotelbedsContentHotel[];
}

type HotelbedsOffer = HotelOffer & { stars: number };

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function categoryCodeToStars(categoryCode: string | undefined): number {
  if (!categoryCode) return 0;
  const match = categoryCode.match(/(\d)/);
  if (!match) return 0;
  const stars = Number(match[1]);
  return Number.isFinite(stars) && stars > 0 && stars <= 5 ? stars : 0;
}

function lowestRateCents(rooms: HotelbedsRoom[] | undefined): number | null {
  if (!rooms || rooms.length === 0) return null;
  let lowest: number | null = null;
  for (const room of rooms) {
    for (const rate of room.rates ?? []) {
      const net = Number(rate.net);
      if (!Number.isFinite(net) || net <= 0) continue;
      const cents = Math.round(net * 100);
      if (lowest === null || cents < lowest) lowest = cents;
    }
  }
  return lowest;
}

function buildHotelClassEvidence(stars: number, fetchedAt: string): HotelRatingEvidence {
  if (stars > 0) {
    return {
      kind: 'hotel_class',
      value: stars,
      scaleMax: 5,
      sourceLabel: 'Hotelbeds',
      fetchedAt,
      confidence: 'provider_only',
    };
  }
  return {
    kind: 'unknown',
    sourceLabel: 'Hotelbeds',
    fetchedAt,
    confidence: 'unavailable',
  };
}

function applySearchContext(hotel: HotelOffer, context?: HotelSearchContext): HotelOffer {
  if (!hotel.location) return hotel;
  return {
    ...hotel,
    location: withCalculatedAnchorDistance(hotel.location, context?.anchor),
  };
}

export class HotelbedsProvider implements HotelProvider {
  private get apiKey(): string {
    return process.env.HOTELBEDS_API_KEY ?? '';
  }

  private get secret(): string {
    return process.env.HOTELBEDS_SECRET ?? '';
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await sha256Hex(`${this.apiKey}${this.secret}${timestamp}`);
    return {
      'Api-key': this.apiKey,
      'X-Signature': signature,
      Accept: 'application/json',
    };
  }

  /** Resolves an IATA airport code to lat/lng using the same dataset the app
   *  already uses for anchor-distance evidence. Hotelbeds' own destination
   *  taxonomy does not align with IATA codes (e.g. Hotelbeds "CDG" is a city
   *  in Brazil, not Paris) so geolocation search is used instead of a
   *  destination-code lookup. */
  private resolveCoordinates(iata: string): { lat: number; lng: number } | undefined {
    const normalized = iata.trim().toUpperCase();
    const airport = AIRPORTS.find(a => a.iata === normalized);
    if (!airport || typeof airport.lat !== 'number' || typeof airport.lon !== 'number') {
      return undefined;
    }
    return { lat: airport.lat, lng: airport.lon };
  }

  private async fetchImages(hotelCodes: number[]): Promise<Map<number, string>> {
    const photoByCode = new Map<number, string>();
    if (hotelCodes.length === 0) return photoByCode;

    try {
      const headers = await this.authHeaders();
      const url = `${CONTENT_BASE}/hotel-content-api/1.0/hotels?fields=images&language=ENG&codes=${hotelCodes.join(',')}`;
      const res = await fetchWithProviderTimeout('Hotelbeds', url, { headers });
      if (!res.ok) return photoByCode;

      const json = (await res.json()) as HotelbedsContentResponse;
      for (const hotel of json.hotels ?? []) {
        if (typeof hotel.code !== 'number') continue;
        const images = [...(hotel.images ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const path = images[0]?.path;
        if (path) photoByCode.set(hotel.code, `${PHOTO_BASE}/${path}`);
      }
    } catch {
      // Photos are best-effort; a failure here should not fail the whole search.
    }

    return photoByCode;
  }

  async searchHotels(
    area: string,
    range: { checkin: string; checkout: string },
    context?: HotelSearchContext
  ): Promise<Result<HotelSearchPage>> {
    if (!this.apiKey) return { ok: false, reason: 'HOTELBEDS_API_KEY not configured' };
    if (!this.secret) return { ok: false, reason: 'HOTELBEDS_SECRET not configured' };

    const coordinates = this.resolveCoordinates(area);
    if (!coordinates) return { ok: false, reason: `No coordinates available for area ${area}` };

    const location = area.trim().toUpperCase();
    const cacheKey = `hotelbeds:search:${location}:${range.checkin}:${range.checkout}`;

    try {
      const cached = await cache.get<HotelbedsOffer[]>(cacheKey);
      if (Array.isArray(cached)) {
        return {
          ok: true,
          data: {
            offers: cached.map(hotel => applySearchContext(hotel, context)),
            coverage: 'unconfirmed',
          },
        };
      }

      const headers = await this.authHeaders();
      const body = {
        stay: { checkIn: range.checkin, checkOut: range.checkout },
        occupancies: [{ rooms: 1, adults: 2, children: 0 }],
        geolocation: {
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          radius: SEARCH_RADIUS_KM,
          unit: 'km',
        },
      };

      const res = await fetchWithProviderTimeout('Hotelbeds', `${BOOKING_BASE}/hotel-api/1.0/hotels`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) return { ok: false, reason: `Hotelbeds HTTP ${res.status}` };

      const json = (await res.json()) as HotelbedsSearchResponse;
      const results = json.hotels?.hotels;
      if (!Array.isArray(results)) {
        return { ok: false, reason: 'Hotelbeds returned a malformed response' };
      }
      if (results.length === 0) {
        return { ok: true, data: { offers: [], coverage: 'unconfirmed' } };
      }

      const fetchedAt = new Date().toISOString();
      const limited = results.slice(0, RESULT_LIMIT);
      const photoByCode = await this.fetchImages(
        limited.map(h => h.code).filter((c): c is number => typeof c === 'number')
      );

      const hotels: HotelbedsOffer[] = limited.flatMap((entry) => {
        if (typeof entry.code !== 'number' || typeof entry.name !== 'string') return [];
        const priceCents = lowestRateCents(entry.rooms);
        if (priceCents === null) return [];

        const stars = categoryCodeToStars(entry.categoryCode);
        const lat = Number(entry.latitude);
        const lng = Number(entry.longitude);
        const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
        const access = normalizeHotelAmenityEvidence(undefined, 'Hotelbeds');

        const locationEvidence: HotelLocation = {
          area: entry.destinationName ?? location,
          providerLocationName: entry.zoneName,
          source: hasCoords ? 'provider' : 'search_fallback',
          precision: hasCoords ? 'coordinates' : 'area',
          ...(hasCoords ? { lat, lng } : {}),
        };

        return [{
          id: String(entry.code),
          name: entry.name,
          area: entry.destinationName ?? location,
          location: locationEvidence,
          stars,
          pricePerNight: { priceCents, currency: 'USD' },
          deeplink: '',
          source: 'hotelbeds',
          documentReadiness: notProvidedHotelDocumentReadiness('Hotelbeds'),
          hotelClass: buildHotelClassEvidence(stars, fetchedAt),
          amenityEvidence: access.evidence,
          accessEvidenceState: access.state,
          fundsPolicy: createNotReturnedHotelFundsPolicy('Hotelbeds'),
          smokingPolicy: notProvidedHotelSmokingPolicy(),
          rateEligibilityCapability: HOTEL_RATE_ELIGIBILITY_UNSUPPORTED,
          admissionPolicyCapability: HOTEL_ADMISSION_POLICY_UNSUPPORTED,
          photoUrl: photoByCode.get(entry.code),
        }];
      });

      await cache.set(cacheKey, hotels, CACHE_TTL);

      return {
        ok: true,
        data: {
          offers: hotels.map(hotel => applySearchContext(hotel, context)),
          coverage: 'unconfirmed',
        },
      };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }

  async checkDocumentReadiness(
    _offer: Pick<HotelOffer, 'id' | 'source' | 'deeplink' | 'documentReadiness'>,
  ): Promise<Result<HotelOffer['documentReadiness']>> {
    // Hotelbeds' search response has no rate/stay-scoped document fields.
    // Preserve that supplier omission instead of inferring availability.
    return { ok: true, data: notProvidedHotelDocumentReadiness('Hotelbeds') };
  }

  async checkGuestIdentityRequirements(offer: Pick<HotelOffer, 'id' | 'source'>, locale: string) {
    return { ok: true as const, data: notEstablishedHotelGuestIdentity({ propertyId: offer.id, supplier: offer.source, locale }) };
  }
}

export const hotelbeds = new HotelbedsProvider();
