import type {
  HotelLocation,
  HotelLocationAnchorKind,
  HotelLocationAnchorSource,
  HotelLocationEvidenceSource,
  HotelLocationPrecision,
  HotelOffer,
  HotelRatingEvidence,
  DealScore,
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
  entrySource: HotelDetailEntrySource;
  returnUrl: string;
  checkIn?: string;
  checkOut?: string;
  nightCount?: number;
  score?: DealScore;
  priceCheckedAt?: string;
  hotelClass?: HotelRatingEvidence;
  guestRating?: HotelRatingEvidence;
};

export type HotelDetailEntrySource = 'hotel_results' | 'saved_deals' | 'direct';

export type HotelBookingHrefOptions = {
  entrySource?: HotelDetailEntrySource;
  returnUrl?: string;
  checkIn?: string;
  checkOut?: string;
  nightCount?: number;
  score?: DealScore | null;
  priceCheckedAt?: string;
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
  scorePercentile?: unknown;
  scorePctVsMedian?: unknown;
  scoreMedianCents?: unknown;
  scoreCurrency?: unknown;
  scoreVerdict?: unknown;
  scoreConfidence?: unknown;
  scoreExplanation?: unknown;
  hotelClassKind?: unknown;
  hotelClassValue?: unknown;
  hotelClassScaleMax?: unknown;
  hotelClassSourceLabel?: unknown;
  hotelClassReviewCount?: unknown;
  hotelClassFetchedAt?: unknown;
  hotelClassConfidence?: unknown;
  guestRatingKind?: unknown;
  guestRatingValue?: unknown;
  guestRatingScaleMax?: unknown;
  guestRatingSourceLabel?: unknown;
  guestRatingReviewCount?: unknown;
  guestRatingFetchedAt?: unknown;
  guestRatingConfidence?: unknown;
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

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
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

export function isValidatedAffiliateProviderUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname) return false;

    return ['marker', 'aid', 'affcid', 'affilid', 'affiliate_id', 'aff_id']
      .some((key) => Boolean(url.searchParams.get(key)?.trim()));
  } catch {
    return false;
  }
}

function isHotelDetailEntrySource(value: string): value is HotelDetailEntrySource {
  return value === 'hotel_results' || value === 'saved_deals' || value === 'direct';
}

export function validateHotelReturnUrl(value: unknown, entrySource: HotelDetailEntrySource): string {
  const fallback = entrySource === 'saved_deals' ? '/deals' : '/';
  const candidate = cleanRequired(value);
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//') || /[\u0000-\u001f\u007f]/.test(candidate)) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, 'https://expaify.invalid');
    if (parsed.origin !== 'https://expaify.invalid' || parsed.username || parsed.password) return fallback;
    const allowed = entrySource === 'saved_deals'
      ? parsed.pathname === '/deals'
      : entrySource === 'hotel_results'
        ? parsed.pathname === '/' || parsed.pathname.startsWith('/destinations/')
        : parsed.pathname === '/';
    return allowed ? `${parsed.pathname}${parsed.search}` : fallback;
  } catch {
    return fallback;
  }
}

function isValidDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T.+)?$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function isStayDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseStayContext(input: HotelContextInput): Pick<BookingHotelContext, 'checkIn' | 'checkOut' | 'nightCount'> | null {
  const checkIn = cleanOptional(input.checkIn);
  const checkOut = cleanOptional(input.checkOut);
  const nightCount = isBlank(input.nightCount)
    ? undefined
    : parseInteger(input.nightCount);

  if ((checkIn && !isStayDate(checkIn)) || (checkOut && !isStayDate(checkOut))) return null;
  if (nightCount === null || (nightCount !== undefined && (nightCount < 1 || nightCount > 365))) return null;

  if (checkIn && checkOut) {
    const calculatedNights = Math.round((Date.parse(`${checkOut}T00:00:00.000Z`) - Date.parse(`${checkIn}T00:00:00.000Z`)) / 86_400_000);
    if (calculatedNights < 1 || (nightCount !== undefined && nightCount !== calculatedNights)) return null;
  }

  return { checkIn, checkOut, nightCount };
}

function isQualityKind(value: string): value is HotelRatingEvidence['kind'] {
  return value === 'hotel_class' || value === 'guest_review' || value === 'provider_quality' || value === 'inferred' || value === 'unknown';
}

function isQualityConfidence(value: string): value is HotelRatingEvidence['confidence'] {
  return value === 'verified' || value === 'provider_only' || value === 'inferred' || value === 'unavailable';
}

function parseRatingEvidence(input: HotelContextInput, prefix: 'hotelClass' | 'guestRating'): HotelRatingEvidence | undefined | null {
  const kind = cleanOptional(input[`${prefix}Kind`]);
  const confidence = cleanOptional(input[`${prefix}Confidence`]);
  const value = parseOptionalNumber(input[`${prefix}Value`]);
  const scaleMax = parseOptionalNumber(input[`${prefix}ScaleMax`]);
  const reviewCount = isBlank(input[`${prefix}ReviewCount`])
    ? undefined
    : parseInteger(input[`${prefix}ReviewCount`]);
  const sourceLabel = cleanOptional(input[`${prefix}SourceLabel`]);
  const fetchedAt = cleanOptional(input[`${prefix}FetchedAt`]);

  const hasAny = kind !== undefined || confidence !== undefined || value !== undefined || scaleMax !== undefined || reviewCount !== undefined || sourceLabel !== undefined || fetchedAt !== undefined;
  if (!hasAny) return undefined;
  if (!kind || !isQualityKind(kind) || !confidence || !isQualityConfidence(confidence)) return null;
  if (value === null || scaleMax === null || reviewCount === null) return null;
  if (value !== undefined && (value <= 0 || value > 100)) return null;
  if (scaleMax !== undefined && (scaleMax <= 0 || scaleMax > 100 || (value !== undefined && value > scaleMax))) return null;
  if (reviewCount !== undefined && reviewCount < 1) return null;
  if (fetchedAt && !isValidDateInput(fetchedAt)) return null;

  return { kind, confidence, value, scaleMax, sourceLabel, reviewCount, fetchedAt };
}

function parseDealScore(input: HotelContextInput, observedCurrency: string): DealScore | undefined | null {
  const fields = [input.scorePercentile, input.scorePctVsMedian, input.scoreMedianCents, input.scoreCurrency, input.scoreVerdict, input.scoreConfidence, input.scoreExplanation];
  if (fields.every(isBlank)) return undefined;

  const percentile = parseNumber(input.scorePercentile);
  const pctVsMedian = parseNumber(input.scorePctVsMedian);
  const medianCents = parseInteger(input.scoreMedianCents);
  const currency = cleanRequired(input.scoreCurrency);
  const verdict = cleanRequired(input.scoreVerdict);
  const confidence = cleanRequired(input.scoreConfidence);
  const explanation = cleanRequired(input.scoreExplanation);
  if (
    percentile === null || percentile < 0 || percentile > 100 ||
    pctVsMedian === null || pctVsMedian < -100 || pctVsMedian > 10_000 ||
    medianCents === null || medianCents <= 0 ||
    !isCurrencyCode(currency) || currency !== observedCurrency ||
    (verdict !== 'Great' && verdict !== 'Good' && verdict !== 'Typical') ||
    (confidence !== 'high' && confidence !== 'low') || !explanation || explanation.length > 300
  ) return null;

  return { percentile, pctVsMedian, medianCents, currency, verdict, confidence, explanation };
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

  const precision = precisionValue === undefined
    ? undefined
    : isLocationPrecision(precisionValue)
      ? precisionValue
      : undefined;

  const source = sourceValue === undefined
    ? undefined
    : isLocationEvidenceSource(sourceValue)
      ? sourceValue
      : undefined;

  const propertyCoordinates = lat !== undefined && lat !== null && lng !== undefined && lng !== null
    ? { lat, lng }
    : undefined;

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
      anchorLat === null ||
      anchorLng === undefined ||
      anchorLng === null ||
      anchorSourceValue === undefined ||
      !isLocationAnchorSource(anchorSourceValue)
    ) {
      anchor = undefined;
    } else {
      anchor = {
        kind: anchorKindValue,
        id: anchorId,
        name: anchorName,
        lat: anchorLat,
        lng: anchorLng,
        source: anchorSourceValue,
      };
    }
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
      distance = undefined;
    } else {
      distance = {
        value: distanceValue,
        unit: distanceUnit,
        method: distanceMethod,
        source: distanceSource,
      };
    }
  }

  if (
    precision === undefined &&
    label === undefined &&
    address === undefined &&
    propertyCoordinates === undefined &&
    area === undefined &&
    source === undefined &&
    anchor === undefined &&
    distance === undefined &&
    providerLocationName === undefined
  ) {
    return undefined;
  }

  if (source === undefined) return undefined;

  const location: HotelLocation = {
    label,
    precision,
    address,
    ...propertyCoordinates,
    area,
    source,
    anchor,
    distance,
    providerLocationName,
  };

  if (!anchor || !distance || !hasVerifiedHotelLocationComparison(location)) {
    delete location.anchor;
    delete location.distance;
  }

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
  const entrySourceValue = cleanOptional(input.entrySource) ?? 'direct';
  const entrySource = isHotelDetailEntrySource(entrySourceValue) ? entrySourceValue : null;
  const stay = parseStayContext(input);
  const score = parseDealScore(input, currency);
  const priceCheckedAt = cleanOptional(input.priceCheckedAt);
  const hotelClass = parseRatingEvidence(input, 'hotelClass');
  const guestRating = parseRatingEvidence(input, 'guestRating');

  if (
    kind !== 'hotel' ||
    !offerId ||
    !provider ||
    !name ||
    !isCurrencyCode(currency) ||
    priceCents === null ||
    priceCents <= 0 ||
    priceBasis !== 'per_night_before_taxes_fees' ||
    !isValidatedAffiliateProviderUrl(providerUrl) ||
    location === null ||
    entrySource === null || stay === null || score === null || hotelClass === null || guestRating === null ||
    (priceCheckedAt !== undefined && !isValidDateInput(priceCheckedAt))
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
    entrySource,
    returnUrl: validateHotelReturnUrl(input.returnUrl, entrySource),
    ...(stay.checkIn ? { checkIn: stay.checkIn } : {}),
    ...(stay.checkOut ? { checkOut: stay.checkOut } : {}),
    ...(stay.nightCount ? { nightCount: stay.nightCount } : {}),
    ...(score ? { score } : {}),
    ...(priceCheckedAt ? { priceCheckedAt } : {}),
    ...(hotelClass ? { hotelClass } : {}),
    ...(guestRating ? { guestRating } : {}),
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
    entrySource: firstParam(params.entrySource),
    returnUrl: firstParam(params.returnUrl),
    checkIn: firstParam(params.checkIn),
    checkOut: firstParam(params.checkOut),
    nightCount: firstParam(params.nightCount),
    scorePercentile: firstParam(params.scorePercentile),
    scorePctVsMedian: firstParam(params.scorePctVsMedian),
    scoreMedianCents: firstParam(params.scoreMedianCents),
    scoreCurrency: firstParam(params.scoreCurrency),
    scoreVerdict: firstParam(params.scoreVerdict),
    scoreConfidence: firstParam(params.scoreConfidence),
    scoreExplanation: firstParam(params.scoreExplanation),
    priceCheckedAt: firstParam(params.priceCheckedAt),
    hotelClassKind: firstParam(params.hotelClassKind),
    hotelClassValue: firstParam(params.hotelClassValue),
    hotelClassScaleMax: firstParam(params.hotelClassScaleMax),
    hotelClassSourceLabel: firstParam(params.hotelClassSourceLabel),
    hotelClassReviewCount: firstParam(params.hotelClassReviewCount),
    hotelClassFetchedAt: firstParam(params.hotelClassFetchedAt),
    hotelClassConfidence: firstParam(params.hotelClassConfidence),
    guestRatingKind: firstParam(params.guestRatingKind),
    guestRatingValue: firstParam(params.guestRatingValue),
    guestRatingScaleMax: firstParam(params.guestRatingScaleMax),
    guestRatingSourceLabel: firstParam(params.guestRatingSourceLabel),
    guestRatingReviewCount: firstParam(params.guestRatingReviewCount),
    guestRatingFetchedAt: firstParam(params.guestRatingFetchedAt),
    guestRatingConfidence: firstParam(params.guestRatingConfidence),
  });
}

export function parseHotelDetailRecovery(params: SearchParams): Pick<BookingHotelContext, 'entrySource' | 'returnUrl'> {
  const value = firstParam(params.entrySource);
  const entrySource = isHotelDetailEntrySource(value) ? value : 'direct';
  return { entrySource, returnUrl: validateHotelReturnUrl(firstParam(params.returnUrl), entrySource) };
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

function addRatingEvidenceParams(params: URLSearchParams, prefix: 'hotelClass' | 'guestRating', evidence?: HotelRatingEvidence): void {
  if (!evidence) return;
  params.set(`${prefix}Kind`, evidence.kind);
  params.set(`${prefix}Confidence`, evidence.confidence);
  if (evidence.value !== undefined) params.set(`${prefix}Value`, String(evidence.value));
  if (evidence.scaleMax !== undefined) params.set(`${prefix}ScaleMax`, String(evidence.scaleMax));
  if (evidence.sourceLabel) params.set(`${prefix}SourceLabel`, evidence.sourceLabel);
  if (evidence.reviewCount !== undefined) params.set(`${prefix}ReviewCount`, String(evidence.reviewCount));
  if (evidence.fetchedAt) params.set(`${prefix}FetchedAt`, evidence.fetchedAt);
}

export function buildHotelBookingHref(hotel: HotelOffer, options: HotelBookingHrefOptions = {}): string {
  const entrySource = options.entrySource ?? 'hotel_results';
  const priceCheckedAt = options.priceCheckedAt ?? hotel.fetchedAt ?? hotel.hotelClass?.fetchedAt ?? hotel.guestRating?.fetchedAt;
  const params = new URLSearchParams({
    kind: 'hotel',
    offerId: hotel.id,
    provider: hotel.source,
    name: hotel.name,
    priceCents: String(hotel.pricePerNight.priceCents),
    currency: hotel.pricePerNight.currency,
    priceBasis: hotel.priceBasis ?? 'per_night_before_taxes_fees',
    providerUrl: hotel.deeplink,
    entrySource,
    returnUrl: validateHotelReturnUrl(options.returnUrl, entrySource),
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
  if (options.checkIn) params.set('checkIn', options.checkIn);
  if (options.checkOut) params.set('checkOut', options.checkOut);
  if (options.nightCount !== undefined) params.set('nightCount', String(options.nightCount));
  if (priceCheckedAt) params.set('priceCheckedAt', priceCheckedAt);
  if (options.score) {
    params.set('scorePercentile', String(options.score.percentile));
    params.set('scorePctVsMedian', String(options.score.pctVsMedian));
    params.set('scoreMedianCents', String(options.score.medianCents));
    params.set('scoreCurrency', options.score.currency);
    params.set('scoreVerdict', options.score.verdict);
    params.set('scoreConfidence', options.score.confidence);
    params.set('scoreExplanation', options.score.explanation);
  }
  addRatingEvidenceParams(params, 'hotelClass', hotel.hotelClass);
  addRatingEvidenceParams(params, 'guestRating', hotel.guestRating);

  return `/book?${params.toString()}`;
}
