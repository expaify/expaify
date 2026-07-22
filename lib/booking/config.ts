import type {
  HotelLocation,
  HotelLocationAnchorKind,
  HotelLocationAnchorSource,
  HotelLocationEvidenceSource,
  HotelLocationPrecision,
  HotelOffer,
  NormalizedFare,
} from '../types';
import {
  hasValidCoordinates,
  hasVerifiedHotelLocationComparison,
} from '../hotels/locationEvidence';

export type BookingFareContext = {
  offerId: string;
  provider: string;
  origin: string;
  destination: string;
  depart: string;
  return?: string;
  carrier: string;
  stops: number;
  priceCents: number;
  currency: string;
  passengerCount: number;
  priceScope: 'per_person' | 'party_total';
};

export type BookingHotelContext = {
  kind: 'hotel';
  offerId: string;
  provider: string;
  name: string;
  area?: string;
  location?: HotelLocation;
  priceCents: number;
  currency: string;
  priceBasis: 'per_night_before_taxes_fees';
  providerUrl: string;
};

export const BOOKING_FORM_PASSENGER_LIMIT = 1;

type SearchParams = Record<string, string | string[] | undefined>;
type FareContextInput = Partial<Record<keyof BookingFareContext, unknown>>;
type HotelContextInput = Partial<Record<keyof BookingHotelContext, unknown>> & {
  locationPrecision?: unknown;
  locationLabel?: unknown;
  locationAddress?: unknown;
  locationLat?: unknown;
  locationLng?: unknown;
  locationArea?: unknown;
  locationSource?: unknown;
  locationAnchorKind?: unknown;
  locationAnchorId?: unknown;
  locationAnchorName?: unknown;
  locationAnchorLat?: unknown;
  locationAnchorLng?: unknown;
  locationAnchorSource?: unknown;
  locationDistanceValue?: unknown;
  locationDistanceUnit?: unknown;
  locationDistanceMethod?: unknown;
  locationDistanceSource?: unknown;
  locationProviderName?: unknown;
};

export function isBookingEnabled(): boolean {
  return process.env.BOOKING_ENABLED === 'true';
}

export function isDuffelSandboxMode(): boolean {
  const key = process.env.DUFFEL_KEY ?? '';
  return key.startsWith('duffel_test_') || process.env.DUFFEL_ENV === 'sandbox';
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function cleanRequired(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanOptional(value: unknown): string | undefined {
  const cleaned = cleanRequired(value);
  return cleaned ? cleaned : undefined;
}

function parseInteger(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : null;
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseOptionalNumber(value: unknown): number | undefined | null {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isAirportCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

function isCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

function isSafeProviderUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function isValidDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T.+)?$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function isLocationPrecision(value: string): value is HotelLocationPrecision {
  return value === 'exact' ||
    value === 'coordinates' ||
    value === 'area' ||
    value === 'search_area' ||
    value === 'missing';
}

function isLocationEvidenceSource(value: string): value is HotelLocationEvidenceSource {
  return value === 'provider' || value === 'search_fallback' || value === 'unavailable';
}

function isLocationAnchorKind(value: string): value is HotelLocationAnchorKind {
  return value === 'airport' || value === 'venue' || value === 'landmark' || value === 'city_center';
}

function isLocationAnchorSource(value: string): value is HotelLocationAnchorSource {
  return value === 'user_selected' || value === 'search_linked' || value === 'provider_declared';
}

function parseLatitude(value: unknown): number | undefined | null {
  const parsed = parseOptionalNumber(value);
  if (parsed === undefined || parsed === null) return parsed;
  return parsed >= -90 && parsed <= 90 ? parsed : null;
}

function parseLongitude(value: unknown): number | undefined | null {
  const parsed = parseOptionalNumber(value);
  if (parsed === undefined || parsed === null) return parsed;
  return parsed >= -180 && parsed <= 180 ? parsed : null;
}

function validateHotelLocation(input: HotelContextInput): HotelLocation | undefined | null {
  const precisionValue = cleanOptional(input.locationPrecision);
  const label = cleanOptional(input.locationLabel);
  const address = cleanOptional(input.locationAddress);
  const providerLocationName = cleanOptional(input.locationProviderName);
  const area = cleanOptional(input.locationArea);
  const sourceValue = cleanOptional(input.locationSource);
  const lat = parseLatitude(input.locationLat);
  const lng = parseLongitude(input.locationLng);
  const anchorKindValue = cleanOptional(input.locationAnchorKind);
  const anchorId = cleanOptional(input.locationAnchorId);
  const anchorName = cleanOptional(input.locationAnchorName);
  const anchorLat = parseLatitude(input.locationAnchorLat);
  const anchorLng = parseLongitude(input.locationAnchorLng);
  const anchorSourceValue = cleanOptional(input.locationAnchorSource);
  const distanceValue = parseOptionalNumber(input.locationDistanceValue);
  const distanceUnit = cleanOptional(input.locationDistanceUnit);
  const distanceMethod = cleanOptional(input.locationDistanceMethod);
  const distanceSource = cleanOptional(input.locationDistanceSource);

  if (lat === null || lng === null || anchorLat === null || anchorLng === null) return null;
  if ((lat === undefined) !== (lng === undefined)) return null;
  if ((anchorLat === undefined) !== (anchorLng === undefined)) return null;

  const precision = precisionValue === undefined
    ? undefined
    : isLocationPrecision(precisionValue)
      ? precisionValue
      : null;
  if (precision === null) return null;

  const source = sourceValue === undefined
    ? undefined
    : isLocationEvidenceSource(sourceValue)
      ? sourceValue
      : null;
  if (source === null) return null;

  const hasAnchorInput = anchorKindValue !== undefined ||
    anchorId !== undefined ||
    anchorName !== undefined ||
    anchorLat !== undefined ||
    anchorLng !== undefined ||
    anchorSourceValue !== undefined;
  let anchor: HotelLocation['anchor'];
  if (hasAnchorInput) {
    if (
      anchorKindValue === undefined ||
      !isLocationAnchorKind(anchorKindValue) ||
      anchorId === undefined ||
      anchorName === undefined ||
      anchorLat === undefined ||
      anchorLng === undefined ||
      anchorSourceValue === undefined ||
      !isLocationAnchorSource(anchorSourceValue)
    ) {
      return null;
    }
    anchor = {
      kind: anchorKindValue,
      id: anchorId,
      name: anchorName,
      lat: anchorLat,
      lng: anchorLng,
      source: anchorSourceValue,
    };
  }

  let distance: HotelLocation['distance'];
  const hasDistanceInput = distanceValue !== undefined ||
    distanceUnit !== undefined ||
    distanceMethod !== undefined ||
    distanceSource !== undefined;
  if (hasDistanceInput) {
    if (
      distanceValue === undefined ||
      distanceValue === null ||
      distanceValue < 0 ||
      (distanceUnit !== 'mi' && distanceUnit !== 'km') ||
      distanceMethod !== 'straight_line' ||
      (distanceSource !== 'expaify_calculated' && distanceSource !== 'provider_documented')
    ) {
      return null;
    }
    distance = {
      value: distanceValue,
      unit: distanceUnit,
      method: distanceMethod,
      source: distanceSource,
    };
  }

  if (
    precision === undefined &&
    label === undefined &&
    address === undefined &&
    lat === undefined &&
    lng === undefined &&
    area === undefined &&
    source === undefined &&
    anchor === undefined &&
    distance === undefined &&
    providerLocationName === undefined
  ) {
    return undefined;
  }

  if (source === undefined) return null;

  const location: HotelLocation = {
    label,
    precision,
    address,
    lat,
    lng,
    area,
    source,
    anchor,
    distance,
    providerLocationName,
  };

  if ((anchor === undefined) !== (distance === undefined)) return null;
  if (anchor && distance && !hasVerifiedHotelLocationComparison(location)) return null;

  return location;
}

export function validateBookingFareContext(input: FareContextInput): BookingFareContext | null {
  const offerId = cleanRequired(input.offerId);
  const provider = cleanRequired(input.provider);
  const origin = cleanRequired(input.origin);
  const destination = cleanRequired(input.destination);
  const depart = cleanRequired(input.depart);
  const returnDate = cleanOptional(input.return);
  const carrier = cleanRequired(input.carrier);
  const currency = cleanRequired(input.currency);
  const priceCents = parseInteger(input.priceCents);
  const stops = parseInteger(input.stops);
  const passengerCount = parseInteger(input.passengerCount);
  const priceScope = cleanRequired(input.priceScope);

  if (
    !offerId ||
    !provider ||
    !isAirportCode(origin) ||
    !isAirportCode(destination) ||
    !depart ||
    !isValidDateInput(depart) ||
    (returnDate !== undefined && !isValidDateInput(returnDate)) ||
    !carrier ||
    !isCurrencyCode(currency) ||
    priceCents === null ||
    priceCents <= 0 ||
    stops === null ||
    stops < 0 ||
    passengerCount === null ||
    passengerCount < 1 ||
    passengerCount > 9 ||
    (priceScope !== 'per_person' && priceScope !== 'party_total')
  ) {
    return null;
  }

  return {
    offerId,
    provider,
    origin,
    destination,
    depart,
    return: returnDate,
    carrier,
    stops,
    priceCents,
    currency,
    passengerCount,
    priceScope,
  };
}

export function parseBookingFareContext(params: SearchParams): BookingFareContext | null {
  return validateBookingFareContext({
    offerId: firstParam(params.offerId),
    provider: firstParam(params.provider),
    origin: firstParam(params.origin),
    destination: firstParam(params.destination),
    depart: firstParam(params.depart),
    return: firstParam(params.return),
    carrier: firstParam(params.carrier),
    stops: firstParam(params.stops),
    priceCents: firstParam(params.priceCents),
    currency: firstParam(params.currency),
    passengerCount: firstParam(params.passengerCount),
    priceScope: firstParam(params.priceScope),
  });
}

export function validateBookingHotelContext(input: HotelContextInput): BookingHotelContext | null {
  const kind = cleanRequired(input.kind);
  const offerId = cleanRequired(input.offerId);
  const provider = cleanRequired(input.provider);
  const name = cleanRequired(input.name);
  const area = cleanOptional(input.area);
  const currency = cleanRequired(input.currency);
  const priceCents = parseInteger(input.priceCents);
  const priceBasis = cleanRequired(input.priceBasis);
  const providerUrl = cleanRequired(input.providerUrl);
  const location = validateHotelLocation(input);

  if (
    kind !== 'hotel' ||
    !offerId ||
    !provider ||
    !name ||
    !isCurrencyCode(currency) ||
    priceCents === null ||
    priceCents <= 0 ||
    priceBasis !== 'per_night_before_taxes_fees' ||
    !isSafeProviderUrl(providerUrl) ||
    location === null
  ) {
    return null;
  }

  return {
    kind: 'hotel',
    offerId,
    provider,
    name,
    area,
    location,
    priceCents,
    currency,
    priceBasis,
    providerUrl,
  };
}

export function parseBookingHotelContext(params: SearchParams): BookingHotelContext | null {
  return validateBookingHotelContext({
    kind: firstParam(params.kind),
    offerId: firstParam(params.offerId),
    provider: firstParam(params.provider),
    name: firstParam(params.name),
    area: firstParam(params.area),
    locationPrecision: firstParam(params.locationPrecision),
    locationLabel: firstParam(params.locationLabel),
    locationAddress: firstParam(params.locationAddress),
    locationLat: firstParam(params.locationLat),
    locationLng: firstParam(params.locationLng),
    locationArea: firstParam(params.locationArea),
    locationSource: firstParam(params.locationSource),
    locationAnchorKind: firstParam(params.locationAnchorKind),
    locationAnchorId: firstParam(params.locationAnchorId),
    locationAnchorName: firstParam(params.locationAnchorName),
    locationAnchorLat: firstParam(params.locationAnchorLat),
    locationAnchorLng: firstParam(params.locationAnchorLng),
    locationAnchorSource: firstParam(params.locationAnchorSource),
    locationDistanceValue: firstParam(params.locationDistanceValue),
    locationDistanceUnit: firstParam(params.locationDistanceUnit),
    locationDistanceMethod: firstParam(params.locationDistanceMethod),
    locationDistanceSource: firstParam(params.locationDistanceSource),
    locationProviderName: firstParam(params.locationProviderName),
    priceCents: firstParam(params.priceCents),
    currency: firstParam(params.currency),
    priceBasis: firstParam(params.priceBasis),
    providerUrl: firstParam(params.providerUrl),
  });
}

export function buildBookingHref(fare: NormalizedFare): string {
  const params = new URLSearchParams({
    offerId: fare.id,
    provider: fare.source,
    origin: fare.origin,
    destination: fare.destination,
    depart: fare.depart,
    carrier: fare.carrier,
    stops: String(fare.stops),
    priceCents: String(fare.price.priceCents),
    currency: fare.price.currency,
    passengerCount: String(fare.passengerCount ?? 1),
    priceScope: fare.priceScope ?? 'per_person',
  });

  if (fare.return) params.set('return', fare.return);

  return `/book?${params.toString()}`;
}

export function buildHotelBookingHref(hotel: HotelOffer): string {
  const params = new URLSearchParams({
    kind: 'hotel',
    offerId: hotel.id,
    provider: hotel.source,
    name: hotel.name,
    priceCents: String(hotel.pricePerNight.priceCents),
    currency: hotel.pricePerNight.currency,
    priceBasis: hotel.priceBasis ?? 'per_night_before_taxes_fees',
    providerUrl: hotel.deeplink,
  });

  if (hotel.area) params.set('area', hotel.area);
  if (hotel.location?.precision) params.set('locationPrecision', hotel.location.precision);
  if (hotel.location?.label) params.set('locationLabel', hotel.location.label);
  if (hotel.location?.address) params.set('locationAddress', hotel.location.address);
  if (hotel.location?.area) params.set('locationArea', hotel.location.area);
  if (hotel.location?.source) params.set('locationSource', hotel.location.source);
  if (hotel.location && hasValidCoordinates(hotel.location)) {
    params.set('locationLat', String(hotel.location.lat));
    params.set('locationLng', String(hotel.location.lng));
  }
  if (hasVerifiedHotelLocationComparison(hotel.location)) {
    params.set('locationAnchorKind', hotel.location.anchor.kind);
    params.set('locationAnchorId', hotel.location.anchor.id);
    params.set('locationAnchorName', hotel.location.anchor.name);
    params.set('locationAnchorLat', String(hotel.location.anchor.lat));
    params.set('locationAnchorLng', String(hotel.location.anchor.lng));
    params.set('locationAnchorSource', hotel.location.anchor.source);
    params.set('locationDistanceValue', String(hotel.location.distance.value));
    params.set('locationDistanceUnit', hotel.location.distance.unit);
    params.set('locationDistanceMethod', hotel.location.distance.method);
    params.set('locationDistanceSource', hotel.location.distance.source);
  }
  if (hotel.location?.providerLocationName) params.set('locationProviderName', hotel.location.providerLocationName);

  return `/book?${params.toString()}`;
}
