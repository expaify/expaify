import { HotelProvider, HotelLocation, HotelOffer, HotelRatingEvidence, Result } from '../types';
import { cache } from '../cache/redis';
import { fetchWithProviderTimeout } from './timeout';

const ENGINE_BASE = 'https://engine.hotellook.com/api/v2/cache.json';
const CACHE_TTL = 21600; // 6 hours

// ─── API response shapes ──────────────────────────────────────────────────────

interface HotelLookCacheEntry {
  hotelId: number;
  hotelName: string;
  stars?: number | string;
  location?: {
    name?: string;
    geo?: {
      lat?: number | string;
      lon?: number | string;
    };
    lat?: number | string;
    lon?: number | string;
  };
  address?: string | Record<string, unknown>;
  distance?: number | string;
  priceFrom?: number | string;
  photoUrl?: string;
  propertyType?: string;
}

type HotelLookOffer = HotelOffer & {
  stars: number;
  photoUrl?: string;
};

// ─────────────────────────────────────────────────────────────────────────────

function isHotelLookEntry(value: unknown): value is HotelLookCacheEntry {
  return typeof value === 'object' && value !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sourceLabel(source: string): string {
  return source.toLowerCase() === 'hotellook' ? 'Hotellook' : source;
}

function cleanString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function cleanLocalizedString(value: unknown): string | undefined {
  if (typeof value === 'string') return cleanString(value);
  if (!isRecord(value)) return undefined;

  const english = cleanString(value.en);
  if (english) return english;

  for (const candidate of Object.values(value)) {
    const cleaned = cleanString(candidate);
    if (cleaned) return cleaned;
  }

  return undefined;
}

function parseCoordinate(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : undefined;
}

function parseLatitude(value: unknown): number | undefined {
  const coordinate = parseCoordinate(value);
  return coordinate !== undefined && coordinate >= -90 && coordinate <= 90 ? coordinate : undefined;
}

function parseLongitude(value: unknown): number | undefined {
  const coordinate = parseCoordinate(value);
  return coordinate !== undefined && coordinate >= -180 && coordinate <= 180 ? coordinate : undefined;
}

function parseProviderDistance(value: unknown): HotelLocation['distance'] | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  const distance = Number(value);
  if (!Number.isFinite(distance) || distance < 0) return undefined;

  return {
    value: Math.round(distance * 10) / 10,
    unit: 'km',
    referencePoint: 'city center',
  };
}

function normalizeHotelLocation(input: {
  area: string;
  address?: unknown;
  distance?: unknown;
  location?: HotelLookCacheEntry['location'];
}): HotelLocation | undefined {
  const providerLocationName = cleanString(input.location?.name);
  const address = cleanLocalizedString(input.address);
  const lat = parseLatitude(input.location?.geo?.lat ?? input.location?.lat);
  const lng = parseLongitude(input.location?.geo?.lon ?? input.location?.lon);
  const distance = parseProviderDistance(input.distance);
  const label = address ?? providerLocationName ?? input.area;

  if (address) {
    return {
      label,
      precision: 'exact',
      address,
      ...(lat !== undefined ? { lat } : {}),
      ...(lng !== undefined ? { lng } : {}),
      ...(distance ? { distance } : {}),
      ...(providerLocationName ? { providerLocationName } : {}),
    };
  }

  if (lat !== undefined && lng !== undefined) {
    return {
      label,
      precision: 'coordinates',
      lat,
      lng,
      ...(distance ? { distance } : {}),
      ...(providerLocationName ? { providerLocationName } : {}),
    };
  }

  if (providerLocationName) {
    return {
      label: providerLocationName,
      precision: 'area',
      ...(distance ? { distance } : {}),
      providerLocationName,
    };
  }

  return undefined;
}

function normalizeCachedHotelLocation(value: unknown, area: string): HotelLocation | undefined {
  if (!isRecord(value)) return undefined;

  const precision = value.precision;
  const distance = value.distance;
  const lat = parseLatitude(value.lat);
  const lng = parseLongitude(value.lng);
  const normalized: HotelLocation = {};

  if (
    precision === 'exact' ||
    precision === 'coordinates' ||
    precision === 'area' ||
    precision === 'search_area' ||
    precision === 'missing'
  ) {
    normalized.precision = precision;
  }

  const label = cleanString(value.label);
  const address = cleanString(value.address);
  const providerLocationName = cleanString(value.providerLocationName);
  if (label) normalized.label = label;
  if (address) normalized.address = address;
  if (providerLocationName) normalized.providerLocationName = providerLocationName;
  if (lat !== undefined && lng !== undefined) {
    normalized.lat = lat;
    normalized.lng = lng;
  }
  if (
    isRecord(distance) &&
    typeof distance.value === 'number' &&
    Number.isFinite(distance.value) &&
    distance.value >= 0 &&
    (distance.unit === 'mi' || distance.unit === 'km') &&
    typeof distance.referencePoint === 'string' &&
    distance.referencePoint.trim() !== ''
  ) {
    normalized.distance = {
      value: distance.value,
      unit: distance.unit,
      referencePoint: distance.referencePoint.trim(),
    };
  }

  if (
    normalized.precision === undefined &&
    normalized.label === undefined &&
    normalized.address === undefined &&
    normalized.lat === undefined &&
    normalized.lng === undefined &&
    normalized.distance === undefined &&
    normalized.providerLocationName === undefined
  ) {
    return undefined;
  }

  if (!normalized.precision) {
    normalized.precision = normalized.address
      ? 'exact'
      : normalized.lat !== undefined && normalized.lng !== undefined
        ? 'coordinates'
        : 'area';
  }
  if (!normalized.label) normalized.label = normalized.address ?? normalized.providerLocationName ?? area;

  return normalized;
}

function isHotelQualityKind(value: unknown): value is HotelRatingEvidence['kind'] {
  return (
    value === 'hotel_class' ||
    value === 'guest_review' ||
    value === 'provider_quality' ||
    value === 'inferred' ||
    value === 'unknown'
  );
}

function buildHotelClassEvidence(input: {
  stars: number;
  source: string;
  fetchedAt?: string;
}): HotelRatingEvidence {
  if (Number.isFinite(input.stars) && input.stars > 0) {
    return {
      kind: 'hotel_class',
      value: input.stars,
      scaleMax: 5,
      sourceLabel: sourceLabel(input.source),
      fetchedAt: input.fetchedAt,
      confidence: 'provider_only',
    };
  }

  return {
    kind: 'unknown',
    sourceLabel: sourceLabel(input.source),
    fetchedAt: input.fetchedAt,
    confidence: 'unavailable',
  };
}

function buildGuestRatingEvidence(input: {
  legacyRating?: number;
  stars: number;
  source: string;
  fetchedAt?: string;
}): HotelRatingEvidence {
  const base = {
    sourceLabel: sourceLabel(input.source),
    fetchedAt: input.fetchedAt,
  };

  if (input.legacyRating !== undefined) {
    return {
      ...base,
      kind: 'inferred',
      value: input.legacyRating,
      scaleMax: Number.isFinite(input.stars) && input.stars > 0 ? 5 : undefined,
      confidence: 'inferred',
    };
  }

  return {
    ...base,
    kind: 'unknown',
    confidence: 'unavailable',
  };
}

function normalizeCachedEvidence(
  value: unknown,
  expectedKind: HotelRatingEvidence['kind']
): HotelRatingEvidence | undefined {
  if (!isRecord(value)) return undefined;

  const kind = value.kind;
  const confidence = value.confidence;
  if (
    !isHotelQualityKind(kind) ||
    kind !== expectedKind ||
    (confidence !== 'verified' &&
      confidence !== 'provider_only' &&
      confidence !== 'inferred' &&
      confidence !== 'unavailable')
  ) {
    return undefined;
  }

  const normalized: HotelRatingEvidence = { kind: expectedKind, confidence };
  if (typeof value.value === 'number' && Number.isFinite(value.value)) normalized.value = value.value;
  if (typeof value.scaleMax === 'number' && Number.isFinite(value.scaleMax) && value.scaleMax > 0) {
    normalized.scaleMax = value.scaleMax;
  }
  if (typeof value.sourceLabel === 'string' && value.sourceLabel.trim() !== '') {
    normalized.sourceLabel = value.sourceLabel;
  }
  if (
    typeof value.reviewCount === 'number' &&
    Number.isSafeInteger(value.reviewCount) &&
    value.reviewCount > 0
  ) {
    normalized.reviewCount = value.reviewCount;
  }
  if (typeof value.fetchedAt === 'string' && value.fetchedAt.trim() !== '') {
    normalized.fetchedAt = value.fetchedAt;
  }

  return normalized;
}

function normalizeCachedHotelOffer(value: unknown): HotelOffer | null {
  if (!isRecord(value)) return null;

  const price = value.pricePerNight;
  const stars = value.stars;
  const rating = value.rating;
  if (!isRecord(price)) return null;

  const priceCents = price.priceCents;
  const currency = price.currency;

  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.area !== 'string' ||
    typeof value.deeplink !== 'string' ||
    typeof value.source !== 'string' ||
    typeof stars !== 'number' ||
    !Number.isFinite(stars) ||
    typeof priceCents !== 'number' ||
    !Number.isSafeInteger(priceCents) ||
    priceCents <= 0 ||
    typeof currency !== 'string' ||
    currency.trim() === ''
  ) {
    return null;
  }

  const normalizedRating = typeof rating === 'number' && Number.isFinite(rating) ? rating : undefined;
  const photoUrl = typeof value.photoUrl === 'string' && value.photoUrl.trim() !== ''
    ? value.photoUrl
    : undefined;
  const location = normalizeCachedHotelLocation(value.location, value.area);
  const hotelClass = normalizeCachedEvidence(value.hotelClass, 'hotel_class') ??
    buildHotelClassEvidence({ stars, source: value.source });
  const guestRating =
    normalizeCachedEvidence(value.guestRating, 'guest_review') ??
    normalizeCachedEvidence(value.guestRating, 'provider_quality') ??
    normalizeCachedEvidence(value.guestRating, 'inferred') ??
    normalizeCachedEvidence(value.guestRating, 'unknown') ??
    buildGuestRatingEvidence({
      legacyRating: normalizedRating,
      stars,
      source: value.source,
    });

  return {
    id: value.id,
    name: value.name,
    area: value.area,
    location,
    stars,
    rating: normalizedRating,
    photoUrl,
    pricePerNight: {
      priceCents,
      currency,
    },
    deeplink: value.deeplink,
    source: value.source,
    hotelClass,
    guestRating,
  };
}

function priceFromToCents(priceFrom: HotelLookCacheEntry['priceFrom']): number | null {
  if (priceFrom === undefined || priceFrom === null) return null;
  if (typeof priceFrom === 'string' && priceFrom.trim() === '') return null;

  const majorUnits = Number(priceFrom);
  if (!Number.isFinite(majorUnits) || majorUnits <= 0) return null;

  // HotelLook cache.json returns priceFrom in the requested currency's major
  // units (currency=USD above), so store integer cents for the app contract.
  const cents = Math.round(majorUnits * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export class HotellookProvider implements HotelProvider {
  private get token(): string {
    return process.env.TP_TOKEN ?? '';
  }

  private get marker(): string {
    return process.env.HOTEL_AFFILIATE_ID ?? process.env.TP_AFFILIATE_MARKER ?? '';
  }

  private buildDeeplink(hotelId: number): string {
    return `https://tp.media/r?marker=${encodeURIComponent(this.marker)}&trs=233847&p=4536&u=https://hotellook.com/hotels/${encodeURIComponent(String(hotelId))}`;
  }

  async searchHotels(
    area: string,
    range: { checkin: string; checkout: string }
  ): Promise<Result<HotelOffer[]>> {
    const token = this.token;
    if (!token) return { ok: false, reason: 'TP_TOKEN not configured' };
    if (!this.marker) return { ok: false, reason: 'HOTEL_AFFILIATE_ID not configured' };

    const location = area.trim().toUpperCase();
    const cacheKey = `hotellook:search:${location}:${range.checkin}:${range.checkout}`;

    try {
      const cached = await cache.get<unknown>(cacheKey);
      if (Array.isArray(cached)) {
        const hotels = cached.map(normalizeCachedHotelOffer);
        if (hotels.every((hotel): hotel is HotelOffer => hotel !== null)) {
          return { ok: true, data: hotels };
        }
      }

      const url =
        `${ENGINE_BASE}` +
        `?location=${encodeURIComponent(location)}` +
        `&checkIn=${encodeURIComponent(range.checkin)}` +
        `&checkOut=${encodeURIComponent(range.checkout)}` +
        `&currency=USD` +
        `&token=${encodeURIComponent(token)}` +
        `&limit=20`;

      const res = await fetchWithProviderTimeout('HotelLook', url);
      if (!res.ok) return { ok: false, reason: `HotelLook HTTP ${res.status}` };

      const json = await res.json();
      if (!Array.isArray(json)) {
        return { ok: false, reason: 'HotelLook returned a malformed response' };
      }
      if (json.length === 0) return { ok: true, data: [] };

      const fetchedAt = new Date().toISOString();
      const hotels: HotelLookOffer[] = json.flatMap((entry) => {
        if (!isHotelLookEntry(entry)) return [];
        const hotelId = Number(entry.hotelId);
        const stars = Number(entry.stars ?? 0);
        const priceCents = priceFromToCents(entry.priceFrom);
        if (!Number.isSafeInteger(hotelId) || hotelId <= 0 || typeof entry.hotelName !== 'string') {
          return [];
        }
        if (priceCents === null) return [];

        return {
          id: String(entry.hotelId),
          name: entry.hotelName,
          area: entry.location?.name ?? location,
          location: normalizeHotelLocation({
            area: entry.location?.name ?? location,
            address: entry.address,
            distance: entry.distance,
            location: entry.location,
          }),
          stars: Number.isFinite(stars) ? stars : 0,
          pricePerNight: {
            priceCents,
            currency: 'USD',
          },
          deeplink: this.buildDeeplink(hotelId),
          photoUrl: entry.photoUrl || undefined,
          source: 'hotellook',
          hotelClass: buildHotelClassEvidence({
            stars: Number.isFinite(stars) ? stars : 0,
            source: 'hotellook',
            fetchedAt,
          }),
          guestRating: buildGuestRatingEvidence({
            stars: Number.isFinite(stars) ? stars : 0,
            source: 'hotellook',
            fetchedAt,
          }),
        };
      });

      await cache.set(cacheKey, hotels, CACHE_TTL);
      return { ok: true, data: hotels };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Shared singleton — used by API routes and other scripts. */
export const hotellook = new HotellookProvider();
