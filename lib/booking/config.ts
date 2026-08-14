import type {
  DealScore,
  HotelAdmissionAgeEvidence,
  HotelAmenityEvidence,
  HotelAdmissionFamily,
  HotelAdmissionLoadState,
  HotelAdmissionPolicyCapability,
  HotelAdmissionPolicyEvidence,
  HotelAdmissionStatementEvidence,
  HotelLocation,
  HotelLocationAnchorKind,
  HotelLocationAnchorSource,
  HotelLocationEvidenceSource,
  HotelLocationPrecision,
  HotelClimateEvidence,
  HotelDocumentReadiness,
  HotelDocumentStatus,
  HotelFundsPolicyEvidence,
  HotelOffer,
  HotelPaymentAcceptanceCapability,
  HotelPaymentAcceptanceConflict,
  HotelPaymentAcceptanceEvidence,
  HotelPropertyPaymentInstrumentClass,
  HotelQualityConfidence,
  HotelQualityKind,
  HotelRateEligibilityCapability,
  HotelRateEligibilityEvidence,
  HotelRateFamilyEvidence,
  HotelRatingEvidence,
  HotelPriceDisclosureState,
  HotelRequiredChargeCapabilities,
  HotelRequiredChargeEvidence,
  HotelReviewEvidence,
  HotelSmokingDimension,
  HotelSmokingPolicy,
  HotelTransportAction,
  HotelTransportChargeBasis,
  HotelTransportConflictDimension,
  HotelTransportCostState,
  HotelTransportDirection,
  HotelTransportEvidence,
  HotelTransportHoursMode,
  HotelTransportOperator,
  HotelTransportServiceKind,
  HotelTransportTripBasis,
  PropertySmokingPolicyValue,
  RoomSmokingPolicyValue,
  SupplierAdmissionStatement,
  SupplierSmokingStatement,
  NormalizedFare,
} from '../types';
import { normalizeHotelFundsPolicyEvidence } from '../hotels/fundsPolicy';
import {
  normalizeHotelDocumentReadiness,
  notProvidedHotelDocumentReadiness,
} from '../providers/hotelDocumentReadiness';
import {
  hasValidCoordinates,
  hasVerifiedHotelLocationComparison,
} from '../hotels/locationEvidence';
import { normalizeHotelSmokingPolicy, unavailableHotelSmokingPolicy } from '../hotels/smokingPolicy';
import {
  buildHotelPriceComposition,
  normalizeHotelRequiredChargeCapabilities,
} from '../hotels/priceDisclosure';
import { createUnsupportedHotelClimateEvidence, validateHotelClimateEvidence } from '../hotels/climateEvidence';

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
  /** Bounded, validated relative path back to the results the traveler came
   * from (e.g. `/deals?...`). Populated from the `returnTo` query param by
   * `parseBookingFareContext` via `validateInternalReturnPath`. Absent or
   * invalid input is dropped silently — every consumer must fall back to
   * `/` on its own, never trust this as always present. */
  returnTo?: string;
};

export type BookingHotelEntrySource = 'search' | 'saved' | 'direct';

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
  documentReadiness: HotelDocumentReadiness;
  fundsPolicy: HotelFundsPolicyEvidence;
  entrySource?: BookingHotelEntrySource;
  returnUrl?: string;
  checkIn?: string;
  checkOut?: string;
  nightCount?: number;
  dealScore?: DealScore;
  priceCheckedAt?: string;
  hotelClass?: HotelRatingEvidence;
  guestRating?: HotelRatingEvidence;
  reviewEvidence?: HotelReviewEvidence;
  smokingPolicy?: HotelSmokingPolicy;
  transportEvidence?: HotelTransportEvidence;
  rateEligibility?: HotelRateEligibilityEvidence;
  rateEligibilityCapability?: HotelRateEligibilityCapability;
  admissionPolicy?: HotelAdmissionPolicyEvidence;
  admissionPolicyCapability?: HotelAdmissionPolicyCapability;
  paymentAcceptance?: HotelPaymentAcceptanceEvidence;
  paymentAcceptanceCapability?: HotelPaymentAcceptanceCapability;
  amenityEvidence?: readonly HotelAmenityEvidence[];
  taxEvidence?: HotelRequiredChargeEvidence;
  mandatoryPropertyChargeEvidence?: HotelRequiredChargeEvidence;
  requiredChargeCapabilities?: HotelRequiredChargeCapabilities;
  priceDisclosureState?: HotelPriceDisclosureState;
  climateEvidence?: HotelClimateEvidence;
};

export const BOOKING_FORM_PASSENGER_LIMIT = 1;
export const MAX_INLINE_HOTEL_BOOKING_HREF_LENGTH = 4_096;
export const HOTEL_CONTEXT_REFERENCE_REQUIRED = 'required';

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
  documentStatus?: unknown;
  documentScope?: unknown;
  documentTypes?: unknown;
  documentInvoiceIssuerRole?: unknown;
  documentInvoiceIssuerName?: unknown;
  documentReceiptIssuerRole?: unknown;
  documentReceiptIssuerName?: unknown;
  documentConfirmationIssuerRole?: unknown;
  documentConfirmationIssuerName?: unknown;
  documentBillingDetailsStep?: unknown;
  documentTaxIdentifierEligibility?: unknown;
  documentNameEligibility?: unknown;
  documentCondition?: unknown;
  documentSourceLabel?: unknown;
  documentSourcePolicyId?: unknown;
  documentSourceObservedAt?: unknown;
  documentConflict1Source?: unknown;
  documentConflict1Statement?: unknown;
  documentConflict2Source?: unknown;
  documentConflict2Statement?: unknown;
  documentConflict3Source?: unknown;
  documentConflict3Statement?: unknown;
  documentConflict4Source?: unknown;
  documentConflict4Statement?: unknown;
  documentVerificationRole?: unknown;
  documentVerificationUrl?: unknown;
  fundsPolicy?: unknown;
  smokingPolicy?: unknown;
  transportEvidence?: unknown;
  climateEvidence?: unknown;
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

const AFFILIATE_MARKER_PARAMS = ['marker', 'aid', 'affcid', 'affilid', 'affiliate_id', 'aff_id'];

export function isValidatedAffiliateProviderUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    return AFFILIATE_MARKER_PARAMS.some(param => Boolean(url.searchParams.get(param)));
  } catch {
    return false;
  }
}

const HOTEL_RETURN_URL_ALLOWED_PATHS = [/^\/$/, /^\/deals(?:\/.*)?$/, /^\/destinations\/[A-Za-z0-9_-]+(?:\/.*)?$/];

export function validateHotelReturnUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(trimmed)) return undefined;
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) return undefined;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return undefined;

  let url: URL;
  try {
    url = new URL(trimmed, 'https://expaify.internal');
  } catch {
    return undefined;
  }

  if (url.username || url.password || url.hostname !== 'expaify.internal') return undefined;
  if (!HOTEL_RETURN_URL_ALLOWED_PATHS.some(pattern => pattern.test(url.pathname))) return undefined;

  return `${url.pathname}${url.search}`;
}

/**
 * Same relative-path allowlist check as `validateHotelReturnUrl`, exported
 * under a neutral name for non-hotel callers (flight booking review `returnTo`)
 * that link back to the same `/`, `/deals`, and `/destinations/*` results
 * surfaces. Rejects absolute URLs, protocol-relative URLs (`//evil.com`), and
 * any path outside the allowlist — this is the open-redirect guard for every
 * booking-review "back to search" link, flight or hotel.
 */
export const validateInternalReturnPath = validateHotelReturnUrl;

/** Attaches a validated internal `returnTo` path to an internal `/book` href
 * built by `buildBookingHref`. Called client-side (the current results URL
 * is not known when `buildBookingHref` runs server-side at fetch time), so
 * `returnTo` here is whatever the browser's current URL already is — no new
 * encoding is invented, and the receiving page must still validate it via
 * `validateInternalReturnPath` before using it, since query params are
 * user-editable. */
export function appendBookingReturnTo(href: string, returnTo: string): string {
  const validated = validateInternalReturnPath(returnTo);
  if (!validated) return href;
  const [path, query = ''] = href.split('?');
  const params = new URLSearchParams(query);
  params.set('returnTo', validated);
  return `${path}?${params.toString()}`;
}

function providerEvidenceLabel(provider: string): string {
  return provider.toLowerCase() === 'hotellook' ? 'Hotellook' : provider || 'Hotel provider';
}

function documentReadinessInput(input: HotelContextInput, provider: string): unknown {
  if (input.documentReadiness !== undefined) return input.documentReadiness;

  const hasSerializedEvidence = input.documentStatus !== undefined || input.documentSourceLabel !== undefined;
  if (!hasSerializedEvidence) return notProvidedHotelDocumentReadiness(providerEvidenceLabel(provider));

  const issuerByDocument = {
    invoice: {
      role: input.documentInvoiceIssuerRole,
      displayName: input.documentInvoiceIssuerName,
    },
    receipt: {
      role: input.documentReceiptIssuerRole,
      displayName: input.documentReceiptIssuerName,
    },
    booking_confirmation: {
      role: input.documentConfirmationIssuerRole,
      displayName: input.documentConfirmationIssuerName,
    },
  };
  const conflictStatements = [1, 2, 3, 4].map((index) => ({
    sourceLabel: input[`documentConflict${index}Source` as keyof HotelContextInput],
    statement: input[`documentConflict${index}Statement` as keyof HotelContextInput],
  }));

  return {
    status: input.documentStatus,
    scope: input.documentScope,
    documentTypes: typeof input.documentTypes === 'string' ? input.documentTypes.split(',') : input.documentTypes,
    issuerByDocument,
    billingDetailsStep: input.documentBillingDetailsStep,
    taxIdentifierEligibility: input.documentTaxIdentifierEligibility,
    documentNameEligibility: input.documentNameEligibility,
    condition: input.documentCondition,
    source: {
      label: input.documentSourceLabel,
      policyId: input.documentSourcePolicyId,
      observedAt: input.documentSourceObservedAt,
    },
    conflictStatements,
    verificationTarget: {
      role: input.documentVerificationRole,
      url: input.documentVerificationUrl,
    },
  };
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
  const returnTo = validateInternalReturnPath(input.returnTo);

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
    ...(returnTo !== undefined ? { returnTo } : {}),
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
    returnTo: firstParam(params.returnTo),
  });
}

function isBookingHotelEntrySource(value: string): value is BookingHotelEntrySource {
  return value === 'search' || value === 'saved' || value === 'direct';
}

type StayContinuity = { checkIn?: string; checkOut?: string; nightCount?: number };

function validateHotelStayContinuity(input: HotelContextInput): StayContinuity | null {
  const checkIn = cleanOptional(input.checkIn);
  const checkOut = cleanOptional(input.checkOut);
  const nightCountRaw = parseOptionalNumber(input.nightCount);

  if (checkIn !== undefined && !isValidDateInput(checkIn)) return null;
  if (checkOut !== undefined && !isValidDateInput(checkOut)) return null;
  if (nightCountRaw === null) return null;
  const nightCount = nightCountRaw === undefined ? undefined : nightCountRaw;
  if (nightCount !== undefined && (!Number.isInteger(nightCount) || nightCount <= 0)) return null;

  if (checkIn !== undefined && checkOut !== undefined) {
    const checkInMs = Date.parse(checkIn);
    const checkOutMs = Date.parse(checkOut);
    if (checkOutMs <= checkInMs) return null;
    const observedNights = Math.round((checkOutMs - checkInMs) / 86_400_000);
    if (nightCount !== undefined && nightCount !== observedNights) return null;
    return { checkIn, checkOut, nightCount: nightCount ?? observedNights };
  }

  return { checkIn, checkOut, nightCount };
}

function isHotelQualityKind(value: unknown): value is HotelQualityKind {
  return value === 'hotel_class' || value === 'guest_review' || value === 'provider_quality' ||
    value === 'inferred' || value === 'unknown';
}

function isHotelQualityConfidence(value: unknown): value is HotelQualityConfidence {
  return value === 'verified' || value === 'provider_only' || value === 'inferred' || value === 'unavailable';
}

function validateHotelRatingEvidence(value: unknown): HotelRatingEvidence | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const kind = record.kind;
  const confidence = record.confidence;
  if (!isHotelQualityKind(kind) || !isHotelQualityConfidence(confidence)) return null;

  const evidenceValue = parseOptionalNumber(record.value);
  const scaleMax = parseOptionalNumber(record.scaleMax);
  const reviewCount = parseOptionalNumber(record.reviewCount);
  if (evidenceValue === null || scaleMax === null || reviewCount === null) return null;
  const sourceLabel = cleanOptional(record.sourceLabel);
  const fetchedAt = cleanOptional(record.fetchedAt);
  if (fetchedAt !== undefined && !isValidDateInput(fetchedAt)) return null;

  return {
    kind,
    confidence,
    ...(evidenceValue !== undefined ? { value: evidenceValue } : {}),
    ...(scaleMax !== undefined ? { scaleMax } : {}),
    ...(sourceLabel !== undefined ? { sourceLabel } : {}),
    ...(reviewCount !== undefined ? { reviewCount } : {}),
    ...(fetchedAt !== undefined ? { fetchedAt } : {}),
  };
}

function validateHotelDealScore(value: unknown, observedCurrency: string): DealScore | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const percentile = parseNumber(record.percentile);
  const pctVsMedian = parseNumber(record.pctVsMedian);
  const medianCents = parseInteger(record.medianCents);
  const currency = cleanRequired(record.currency);
  const verdict = record.verdict;
  const confidence = record.confidence;
  const explanation = cleanRequired(record.explanation);

  if (
    percentile === null ||
    pctVsMedian === null ||
    medianCents === null || medianCents <= 0 ||
    !isCurrencyCode(currency) || currency !== observedCurrency ||
    (verdict !== 'Great' && verdict !== 'Good' && verdict !== 'Typical') ||
    (confidence !== 'high' && confidence !== 'low') ||
    !explanation
  ) {
    return null;
  }

  const parsedSampleSize = parseInteger(record.sampleSize);
  const sampleSize = parsedSampleSize !== null && parsedSampleSize >= 0 ? parsedSampleSize : undefined;

  return {
    percentile, pctVsMedian, medianCents, currency, verdict, confidence, explanation,
    ...(sampleSize !== undefined ? { sampleSize } : {}),
  };
}

const RATE_ELIGIBILITY_FAMILY_STATES = new Set(['restricted', 'clear', 'not_provided']);

/** A malformed family is isolated to that family; it never blocks the surrounding hotel context. */
function validateHotelRateFamilyEvidence(value: unknown): HotelRateFamilyEvidence | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!RATE_ELIGIBILITY_FAMILY_STATES.has(record.state as string)) return null;
  const state = record.state as HotelRateFamilyEvidence['state'];
  if (state !== 'restricted') return { state };

  const membershipLabel = cleanOptional(record.membershipLabel);
  const residencyPlace = cleanOptional(record.residencyPlace);
  const minAge = parseOptionalNumber(record.minAge);
  const maxAge = parseOptionalNumber(record.maxAge);
  if (minAge === null || maxAge === null) return null;

  return {
    state: 'restricted',
    ...(membershipLabel !== undefined ? { membershipLabel } : {}),
    ...(residencyPlace !== undefined ? { residencyPlace } : {}),
    ...(minAge !== undefined ? { minAge } : {}),
    ...(maxAge !== undefined ? { maxAge } : {}),
  };
}

/** Preserved verbatim through cache/URL round-trip; conservative derivation happens at read time. */
function validateHotelRateEligibilityEvidence(value: unknown): HotelRateEligibilityEvidence | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const offerId = cleanRequired(record.offerId);
  const supplier = cleanRequired(record.supplier);
  const fetchedAt = cleanOptional(record.fetchedAt);
  if (!offerId || !supplier) return null;
  if (fetchedAt !== undefined && !isValidDateInput(fetchedAt)) return null;

  const membership = validateHotelRateFamilyEvidence(record.membership);
  const residency = validateHotelRateFamilyEvidence(record.residency);
  const age = validateHotelRateFamilyEvidence(record.age);
  const refundability = validateHotelRateFamilyEvidence(record.refundability);
  if (!membership || !residency || !age || !refundability) return null;

  return {
    offerId,
    supplier,
    ...(fetchedAt !== undefined ? { fetchedAt } : {}),
    membership,
    residency,
    age,
    refundability,
  };
}

function validateHotelRateEligibilityCapability(value: unknown): HotelRateEligibilityCapability | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = ['membership', 'residency', 'age', 'refundability'] as const;
  if (keys.some(key => typeof record[key] !== 'boolean')) return null;
  return {
    membership: record.membership as boolean,
    residency: record.residency as boolean,
    age: record.age as boolean,
    refundability: record.refundability as boolean,
  };
}

const ADMISSION_DOCUMENT_STATES = new Set<HotelDocumentStatus>(['confirmed', 'conditional', 'unavailable', 'not_provided', 'conflicting']);
const ADMISSION_FAMILY_KEYS: readonly HotelAdmissionFamily[] = ['checkin_age', 'checkin_identity', 'local_guest_restriction', 'occupancy_admission'];
const MAX_ADMISSION_SOURCE_LABEL_LENGTH = 80;
const MAX_ADMISSION_SOURCE_TEXT_LENGTH = 300;

function validateSupplierAdmissionStatement(value: unknown): SupplierAdmissionStatement | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const id = cleanRequired(record.id);
  const sourceLabel = cleanRequired(record.sourceLabel);
  const sourceText = cleanRequired(record.sourceText);
  const observedAt = cleanOptional(record.observedAt);
  if (!id || !sourceLabel || !sourceText) return null;
  if (sourceLabel.length > MAX_ADMISSION_SOURCE_LABEL_LENGTH || sourceText.length > MAX_ADMISSION_SOURCE_TEXT_LENGTH) return null;
  if (observedAt !== undefined && !isValidDateInput(observedAt)) return null;
  return { id, sourceLabel, sourceText, ...(observedAt !== undefined ? { observedAt } : {}) };
}

function validateSupplierAdmissionStatements(value: unknown): SupplierAdmissionStatement[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const statements: SupplierAdmissionStatement[] = [];
  for (const item of value) {
    const statement = validateSupplierAdmissionStatement(item);
    if (!statement) return null;
    statements.push(statement);
  }
  return statements;
}

/** A malformed family is isolated to that family; it never blocks the surrounding hotel context. */
function validateHotelAdmissionStatementEvidence(value: unknown): HotelAdmissionStatementEvidence | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!ADMISSION_DOCUMENT_STATES.has(record.state as HotelDocumentStatus)) return null;
  const statements = validateSupplierAdmissionStatements(record.statements);
  if (statements === null) return null;
  return { state: record.state as HotelDocumentStatus, statements };
}

function validateHotelAdmissionAgeEvidence(value: unknown): HotelAdmissionAgeEvidence | null {
  const base = validateHotelAdmissionStatementEvidence(value);
  if (!base) return null;
  const record = value as Record<string, unknown>;
  const minimumAge = parseOptionalNumber(record.minimumAge);
  if (minimumAge === null) return null;
  return { ...base, ...(minimumAge !== undefined ? { minimumAge } : {}) };
}

/** Preserved verbatim through cache/URL round-trip; conservative derivation happens at read time. */
function validateHotelAdmissionPolicyEvidence(value: unknown): HotelAdmissionPolicyEvidence | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const propertyId = cleanRequired(record.propertyId);
  const supplier = cleanRequired(record.supplier);
  const fetchedAt = cleanOptional(record.fetchedAt);
  if (record.scope !== 'property' || !propertyId || !supplier) return null;
  if (record.loadState !== 'loading' && record.loadState !== 'ready' && record.loadState !== 'error') return null;
  if (fetchedAt !== undefined && !isValidDateInput(fetchedAt)) return null;

  const familiesRecord = typeof record.families === 'object' && record.families !== null && !Array.isArray(record.families)
    ? record.families as Record<string, unknown>
    : null;
  if (!familiesRecord) return null;

  const checkinAge = validateHotelAdmissionAgeEvidence(familiesRecord.checkin_age);
  const checkinIdentity = validateHotelAdmissionStatementEvidence(familiesRecord.checkin_identity);
  const localGuestRestriction = validateHotelAdmissionStatementEvidence(familiesRecord.local_guest_restriction);
  const occupancyAdmission = validateHotelAdmissionStatementEvidence(familiesRecord.occupancy_admission);
  if (!checkinAge || !checkinIdentity || !localGuestRestriction || !occupancyAdmission) return null;

  return {
    scope: 'property',
    propertyId,
    supplier,
    loadState: record.loadState as HotelAdmissionLoadState,
    ...(fetchedAt !== undefined ? { fetchedAt } : {}),
    families: {
      checkin_age: checkinAge,
      checkin_identity: checkinIdentity,
      local_guest_restriction: localGuestRestriction,
      occupancy_admission: occupancyAdmission,
    },
  };
}

function validateHotelAdmissionPolicyCapability(value: unknown): HotelAdmissionPolicyCapability | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (ADMISSION_FAMILY_KEYS.some(key => typeof record[key] !== 'boolean')) return null;
  return {
    checkin_age: record.checkin_age as boolean,
    checkin_identity: record.checkin_identity as boolean,
    local_guest_restriction: record.local_guest_restriction as boolean,
    occupancy_admission: record.occupancy_admission as boolean,
  };
}

const CARD_REQUIREMENT_VALUES = new Set(['required', 'not_required', 'not_confirmed']);
const INSTRUMENT_STATE_VALUES = new Set(['accepted', 'not_accepted', 'not_confirmed']);
const GATE_DIVERGENCE_VALUES = new Set(['same', 'differs', 'not_confirmed']);
const PAYMENT_INSTRUMENT_CLASS_KEYS: readonly HotelPropertyPaymentInstrumentClass[] = ['credit_card', 'debit_card', 'prepaid_card', 'cash'];
const MAX_CONFLICT_LABEL_LENGTH = 80;
const MAX_CONFLICT_VALUE_LENGTH = 40;

function validateHotelPaymentAcceptanceConflict(value: unknown): HotelPaymentAcceptanceConflict | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const sourceLabelA = cleanRequired(record.sourceLabelA);
  const valueA = cleanRequired(record.valueA);
  const sourceLabelB = cleanRequired(record.sourceLabelB);
  const valueB = cleanRequired(record.valueB);
  if (!sourceLabelA || !valueA || !sourceLabelB || !valueB) return null;
  if (sourceLabelA.length > MAX_CONFLICT_LABEL_LENGTH || sourceLabelB.length > MAX_CONFLICT_LABEL_LENGTH) return null;
  if (valueA.length > MAX_CONFLICT_VALUE_LENGTH || valueB.length > MAX_CONFLICT_VALUE_LENGTH) return null;
  return { sourceLabelA, valueA, sourceLabelB, valueB };
}

function validateHotelPaymentAcceptanceEvidence(value: unknown): HotelPaymentAcceptanceEvidence | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const propertyId = cleanRequired(record.propertyId);
  const supplier = cleanRequired(record.supplier);
  const fetchedAt = cleanOptional(record.fetchedAt);
  const scope = record.scope;
  if (!propertyId || !supplier) return null;
  if (scope !== 'property' && scope !== 'room' && scope !== 'rate' && scope !== 'selected_stay' && scope !== 'not_returned') return null;
  if (record.loadState !== 'loading' && record.loadState !== 'ready' && record.loadState !== 'error') return null;
  if (fetchedAt !== undefined && !isValidDateInput(fetchedAt)) return null;
  if (!CARD_REQUIREMENT_VALUES.has(record.cardRequiredAtProperty as string)) return null;
  if (!GATE_DIVERGENCE_VALUES.has(record.bookingGateDivergence as string)) return null;

  const instrumentsRecord = typeof record.instruments === 'object' && record.instruments !== null && !Array.isArray(record.instruments)
    ? record.instruments as Record<string, unknown>
    : null;
  if (!instrumentsRecord) return null;
  const instruments: Record<string, string> = {};
  for (const key of PAYMENT_INSTRUMENT_CLASS_KEYS) {
    const instrumentValue = instrumentsRecord[key];
    if (!INSTRUMENT_STATE_VALUES.has(instrumentValue as string)) return null;
    instruments[key] = instrumentValue as string;
  }

  const cardRequiredConflict = validateHotelPaymentAcceptanceConflict(record.cardRequiredConflict);
  if (cardRequiredConflict === null) return null;
  const bookingGateDivergenceConflict = validateHotelPaymentAcceptanceConflict(record.bookingGateDivergenceConflict);
  if (bookingGateDivergenceConflict === null) return null;

  const instrumentConflictsRecord = typeof record.instrumentConflicts === 'object' && record.instrumentConflicts !== null && !Array.isArray(record.instrumentConflicts)
    ? record.instrumentConflicts as Record<string, unknown>
    : undefined;
  const instrumentConflicts: Record<string, HotelPaymentAcceptanceConflict> = {};
  if (instrumentConflictsRecord) {
    for (const key of PAYMENT_INSTRUMENT_CLASS_KEYS) {
      if (!(key in instrumentConflictsRecord)) continue;
      const conflict = validateHotelPaymentAcceptanceConflict(instrumentConflictsRecord[key]);
      if (conflict === null) return null;
      if (conflict !== undefined) instrumentConflicts[key] = conflict;
    }
  }

  const sourceLabel = cleanRequired(record.sourceLabel);
  if (!sourceLabel) return null;

  return {
    scope: scope as HotelPaymentAcceptanceEvidence['scope'],
    propertyId,
    supplier,
    loadState: record.loadState as HotelPaymentAcceptanceEvidence['loadState'],
    ...(fetchedAt !== undefined ? { fetchedAt } : {}),
    cardRequiredAtProperty: record.cardRequiredAtProperty as HotelPaymentAcceptanceEvidence['cardRequiredAtProperty'],
    ...(cardRequiredConflict !== undefined ? { cardRequiredConflict } : {}),
    instruments: instruments as HotelPaymentAcceptanceEvidence['instruments'],
    ...(Object.keys(instrumentConflicts).length > 0 ? { instrumentConflicts: instrumentConflicts as HotelPaymentAcceptanceEvidence['instrumentConflicts'] } : {}),
    bookingGateDivergence: record.bookingGateDivergence as HotelPaymentAcceptanceEvidence['bookingGateDivergence'],
    ...(bookingGateDivergenceConflict !== undefined ? { bookingGateDivergenceConflict } : {}),
    sourceLabel,
  };
}

function validateHotelPaymentAcceptanceCapability(value: unknown): HotelPaymentAcceptanceCapability | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = ['cardRequiredAtProperty', 'instrumentClasses', 'bookingGateDivergence'] as const;
  if (keys.some(key => typeof record[key] !== 'boolean')) return null;
  return {
    cardRequiredAtProperty: record.cardRequiredAtProperty as boolean,
    instrumentClasses: record.instrumentClasses as boolean,
    bookingGateDivergence: record.bookingGateDivergence as boolean,
  };
}

const AMENITY_EVIDENCE_STATUS_VALUES = new Set(['confirmed', 'unavailable', 'not_returned', 'unknown']);
const AMENITY_EVIDENCE_SCOPE_VALUES = new Set(['property', 'room', 'rate', 'selected_stay']);
const AMENITY_EVIDENCE_FEE_VALUES = new Set(['included', 'paid', 'unknown']);
const AMENITY_EVIDENCE_CERTAINTY_VALUES = new Set(['guaranteed', 'requestable']);

/** A single malformed item never invalidates the whole list — it is dropped in place, mirroring how a
 * hotel offer can carry many independent amenity facts from a supplier. */
function validateHotelAmenityEvidenceItem(value: unknown): HotelAmenityEvidence | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const id = cleanRequired(record.id);
  const label = cleanRequired(record.label);
  const sourceLabel = cleanRequired(record.sourceLabel);
  const fetchedAt = cleanOptional(record.fetchedAt);
  if (!id || !label || !sourceLabel) return null;
  if (!AMENITY_EVIDENCE_STATUS_VALUES.has(record.status as string)) return null;
  if (!AMENITY_EVIDENCE_SCOPE_VALUES.has(record.scope as string)) return null;
  if (record.fee !== undefined && !AMENITY_EVIDENCE_FEE_VALUES.has(record.fee as string)) return null;
  if (record.certainty !== undefined && !AMENITY_EVIDENCE_CERTAINTY_VALUES.has(record.certainty as string)) return null;
  if (fetchedAt !== undefined && !isValidDateInput(fetchedAt)) return null;

  return {
    id,
    label,
    status: record.status as HotelAmenityEvidence['status'],
    scope: record.scope as HotelAmenityEvidence['scope'],
    sourceLabel,
    ...(record.fee !== undefined ? { fee: record.fee as HotelAmenityEvidence['fee'] } : {}),
    ...(fetchedAt !== undefined ? { fetchedAt } : {}),
    ...(record.confidence !== undefined ? { confidence: record.confidence as HotelAmenityEvidence['confidence'] } : {}),
    ...(record.certainty !== undefined ? { certainty: record.certainty as HotelAmenityEvidence['certainty'] } : {}),
  };
}

function validateHotelAmenityEvidenceList(value: unknown): HotelAmenityEvidence[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  const items = value.map(validateHotelAmenityEvidenceItem).filter((item): item is HotelAmenityEvidence => item !== null);
  return items.length > 0 ? items : undefined;
}

const TRANSPORT_SERVICE_KINDS = new Set<HotelTransportServiceKind>(['airport_shuttle', 'airport_transfer', 'other_documented']);
const TRANSPORT_DIRECTIONS = new Set<HotelTransportDirection>(['to_property', 'from_property', 'round_trip', 'unknown']);
const TRANSPORT_OPERATORS = new Set<HotelTransportOperator>(['property', 'third_party', 'unknown']);
const TRANSPORT_COST_STATES = new Set<HotelTransportCostState>(['included', 'paid', 'unknown']);
const TRANSPORT_CHARGE_BASES = new Set<HotelTransportChargeBasis>(['per_person', 'per_vehicle', 'per_booking', 'unknown']);
const TRANSPORT_TRIP_BASES = new Set<HotelTransportTripBasis>(['each_way', 'round_trip', 'unknown']);
const TRANSPORT_HOURS_MODES = new Set<HotelTransportHoursMode>(['24_hours', 'scheduled', 'on_request', 'unknown']);
const TRANSPORT_ACTIONS = new Set<HotelTransportAction>(['none_documented', 'reserve_before_arrival', 'call_on_arrival', 'contact_property', 'unknown']);
const TRANSPORT_CONFLICT_DIMENSIONS = new Set<HotelTransportConflictDimension>(['facility', 'service_kind', 'direction', 'operator', 'cost', 'hours', 'action']);

function unclearHotelTransportEvidence(revision = 'invalid-booking-context'): HotelTransportEvidence {
  return {
    state: 'ready',
    facilityStatus: 'unknown',
    evidenceRevision: revision,
  };
}

function validateHotelTransportEvidence(value: unknown): HotelTransportEvidence | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return unclearHotelTransportEvidence();
  const record = value as Record<string, unknown>;
  const revision = cleanRequired(record.evidenceRevision);
  const state = record.state;
  const facilityStatus = record.facilityStatus;
  if (
    !revision ||
    (state !== 'loading' && state !== 'ready' && state !== 'error') ||
    (facilityStatus !== 'confirmed' && facilityStatus !== 'unavailable' && facilityStatus !== 'not_returned' && facilityStatus !== 'unknown')
  ) return unclearHotelTransportEvidence(revision || undefined);

  const serviceKind = TRANSPORT_SERVICE_KINDS.has(record.serviceKind as HotelTransportServiceKind)
    ? record.serviceKind as HotelTransportServiceKind
    : undefined;
  const direction = TRANSPORT_DIRECTIONS.has(record.direction as HotelTransportDirection)
    ? record.direction as HotelTransportDirection
    : undefined;
  const operator = TRANSPORT_OPERATORS.has(record.operator as HotelTransportOperator)
    ? record.operator as HotelTransportOperator
    : undefined;
  const sourceLabel = cleanOptional(record.sourceLabel);
  const fetchedAtValue = cleanOptional(record.fetchedAt);
  const fetchedAt = fetchedAtValue && isValidDateInput(fetchedAtValue) ? fetchedAtValue : undefined;
  const confidence = isHotelQualityConfidence(record.confidence) ? record.confidence : undefined;

  let cost: HotelTransportEvidence['cost'];
  if (typeof record.cost === 'object' && record.cost !== null && !Array.isArray(record.cost)) {
    const costRecord = record.cost as Record<string, unknown>;
    if (TRANSPORT_COST_STATES.has(costRecord.state as HotelTransportCostState)) {
      const amountRecord = typeof costRecord.amount === 'object' && costRecord.amount !== null && !Array.isArray(costRecord.amount)
        ? costRecord.amount as Record<string, unknown>
        : undefined;
      const amountCents = amountRecord ? parseInteger(amountRecord.priceCents) : null;
      const amountCurrency = amountRecord ? cleanRequired(amountRecord.currency) : '';
      const amount = amountCents !== null && amountCents > 0 && isCurrencyCode(amountCurrency)
        ? { priceCents: amountCents, currency: amountCurrency }
        : undefined;
      cost = {
        state: costRecord.state as HotelTransportCostState,
        chargeBasis: TRANSPORT_CHARGE_BASES.has(costRecord.chargeBasis as HotelTransportChargeBasis)
          ? costRecord.chargeBasis as HotelTransportChargeBasis
          : 'unknown',
        tripBasis: TRANSPORT_TRIP_BASES.has(costRecord.tripBasis as HotelTransportTripBasis)
          ? costRecord.tripBasis as HotelTransportTripBasis
          : 'unknown',
        ...(amount ? { amount } : {}),
      };
    }
  }

  let hours: HotelTransportEvidence['hours'];
  if (typeof record.hours === 'object' && record.hours !== null && !Array.isArray(record.hours)) {
    const hoursRecord = record.hours as Record<string, unknown>;
    const mode = TRANSPORT_HOURS_MODES.has(hoursRecord.mode as HotelTransportHoursMode)
      ? hoursRecord.mode as HotelTransportHoursMode
      : 'unknown';
    const windows = Array.isArray(hoursRecord.windows)
      ? hoursRecord.windows.flatMap(window => {
          if (typeof window !== 'object' || window === null || Array.isArray(window)) return [];
          const windowRecord = window as Record<string, unknown>;
          const startLocal = cleanRequired(windowRecord.startLocal);
          const endLocal = cleanRequired(windowRecord.endLocal);
          if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startLocal) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endLocal)) return [];
          const days = cleanOptional(windowRecord.days);
          return [{ startLocal, endLocal, ...(days ? { days } : {}) }];
        })
      : undefined;
    hours = {
      mode: mode === 'scheduled' && !windows?.length ? 'unknown' : mode,
      ...(windows?.length ? { windows } : {}),
      ...(cleanOptional(hoursRecord.timezone) ? { timezone: cleanOptional(hoursRecord.timezone) } : {}),
    };
  }

  let action: HotelTransportEvidence['action'];
  if (typeof record.action === 'object' && record.action !== null && !Array.isArray(record.action)) {
    const actionRecord = record.action as Record<string, unknown>;
    if (TRANSPORT_ACTIONS.has(actionRecord.kind as HotelTransportAction)) {
      const instruction = cleanOptional(actionRecord.instruction);
      const advanceDeadline = cleanOptional(actionRecord.advanceDeadline);
      action = {
        kind: actionRecord.kind as HotelTransportAction,
        ...(instruction ? { instruction } : {}),
        ...(advanceDeadline ? { advanceDeadline } : {}),
      };
    }
  }

  const conflictDimensions = Array.isArray(record.conflictDimensions)
    ? record.conflictDimensions.filter((item): item is HotelTransportConflictDimension => TRANSPORT_CONFLICT_DIMENSIONS.has(item as HotelTransportConflictDimension))
    : undefined;

  return {
    state,
    facilityStatus,
    evidenceRevision: revision,
    ...(serviceKind ? { serviceKind } : {}),
    ...(cleanOptional(record.endpointName) ? { endpointName: cleanOptional(record.endpointName) } : {}),
    ...(direction ? { direction } : {}),
    ...(operator ? { operator } : {}),
    ...(cost ? { cost } : {}),
    ...(hours ? { hours } : {}),
    ...(action ? { action } : {}),
    ...(sourceLabel ? { sourceLabel } : {}),
    ...(fetchedAt ? { fetchedAt } : {}),
    ...(confidence ? { confidence } : {}),
    ...(conflictDimensions?.length ? { conflictDimensions } : {}),
  };
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
  const documentReadiness = normalizeHotelDocumentReadiness(
    documentReadinessInput(input, provider),
    providerEvidenceLabel(provider),
  );
  const fundsPolicy = normalizeHotelFundsPolicyEvidence(input.fundsPolicy, provider || 'Hotel provider');
  const entrySourceValue = cleanOptional(input.entrySource);
  const returnUrl = validateHotelReturnUrl(input.returnUrl);
  const stayContinuity = validateHotelStayContinuity(input);
  const priceCheckedAt = cleanOptional(input.priceCheckedAt);
  const hotelClass = validateHotelRatingEvidence(input.hotelClass);
  const guestRating = validateHotelRatingEvidence(input.guestRating);
  const reviewEvidence = input.reviewEvidence && typeof input.reviewEvidence === 'object' && !Array.isArray(input.reviewEvidence)
    ? input.reviewEvidence as HotelReviewEvidence
    : undefined;
  const dealScore = validateHotelDealScore(input.dealScore, currency);
  const smokingPolicy = input.smokingPolicy === undefined
    ? unavailableHotelSmokingPolicy()
    : normalizeHotelSmokingPolicy(input.smokingPolicy, provider);
  // Invalid/tampered eligibility context degrades to "not provided" at read time; it
  // must never block an otherwise-valid hotel context or the review/handoff gate.
  const rateEligibility = validateHotelRateEligibilityEvidence(input.rateEligibility) ?? undefined;
  const rateEligibilityCapability = validateHotelRateEligibilityCapability(input.rateEligibilityCapability) ?? undefined;
  const admissionPolicy = validateHotelAdmissionPolicyEvidence(input.admissionPolicy) ?? undefined;
  const admissionPolicyCapability = validateHotelAdmissionPolicyCapability(input.admissionPolicyCapability) ?? undefined;
  const paymentAcceptance = validateHotelPaymentAcceptanceEvidence(input.paymentAcceptance) ?? undefined;
  const paymentAcceptanceCapability = validateHotelPaymentAcceptanceCapability(input.paymentAcceptanceCapability) ?? undefined;
  const amenityEvidence = validateHotelAmenityEvidenceList(input.amenityEvidence);
  const transportEvidence = validateHotelTransportEvidence(input.transportEvidence);
  const requiredChargeCapabilities = normalizeHotelRequiredChargeCapabilities(input.requiredChargeCapabilities);
  const priceComposition = buildHotelPriceComposition({
    offerId,
    supplier: provider,
    stayCostState: 'nightly_only',
    taxEvidence: input.taxEvidence,
    mandatoryPropertyChargeEvidence: input.mandatoryPropertyChargeEvidence,
    capabilities: requiredChargeCapabilities,
  });
  const climateEvidence = input.climateEvidence === undefined
    ? undefined
    : validateHotelClimateEvidence(input.climateEvidence, { offerId });

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
    (entrySourceValue !== undefined && !isBookingHotelEntrySource(entrySourceValue)) ||
    stayContinuity === null ||
    (priceCheckedAt !== undefined && !isValidDateInput(priceCheckedAt)) ||
    hotelClass === null ||
    guestRating === null ||
    dealScore === null
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
    documentReadiness,
    fundsPolicy,
    ...(entrySourceValue !== undefined ? { entrySource: entrySourceValue as BookingHotelEntrySource } : {}),
    ...(returnUrl !== undefined ? { returnUrl } : {}),
    ...(stayContinuity?.checkIn !== undefined ? { checkIn: stayContinuity.checkIn } : {}),
    ...(stayContinuity?.checkOut !== undefined ? { checkOut: stayContinuity.checkOut } : {}),
    ...(stayContinuity?.nightCount !== undefined ? { nightCount: stayContinuity.nightCount } : {}),
    ...(dealScore !== undefined ? { dealScore } : {}),
    ...(priceCheckedAt !== undefined ? { priceCheckedAt } : {}),
    ...(hotelClass !== undefined ? { hotelClass } : {}),
    ...(guestRating !== undefined ? { guestRating } : {}),
    ...(reviewEvidence !== undefined ? { reviewEvidence } : {}),
    smokingPolicy,
    ...(rateEligibility !== undefined ? { rateEligibility } : {}),
    ...(rateEligibilityCapability !== undefined ? { rateEligibilityCapability } : {}),
    ...(admissionPolicy !== undefined ? { admissionPolicy } : {}),
    ...(admissionPolicyCapability !== undefined ? { admissionPolicyCapability } : {}),
    ...(paymentAcceptance !== undefined ? { paymentAcceptance } : {}),
    ...(paymentAcceptanceCapability !== undefined ? { paymentAcceptanceCapability } : {}),
    ...(amenityEvidence !== undefined ? { amenityEvidence } : {}),
    ...(transportEvidence !== undefined ? { transportEvidence } : {}),
    taxEvidence: priceComposition.taxes,
    mandatoryPropertyChargeEvidence: priceComposition.mandatoryPropertyCharges,
    requiredChargeCapabilities,
    priceDisclosureState: priceComposition.priceDisclosureState,
    ...(climateEvidence !== null && climateEvidence !== undefined ? { climateEvidence } : {}),
  };
}

const SMOKING_STATEMENT_FIELDS = [
  'id', 'value', 'scope', 'sourceLabel', 'sourceText', 'fetchedAt',
  'checkin', 'checkout', 'roomId', 'rateId',
] as const;

function parseSmokingDimensionParams(params: SearchParams, kind: 'Room' | 'Property'): Record<string, unknown> {
  const prefix = `smoking${kind}`;
  const countValue = firstParam(params[`${prefix}StatementCount`]);
  const count = /^\d+$/.test(countValue) ? Number(countValue) : -1;
  const statements = count >= 0 && count <= 20
    ? Array.from({ length: count }, (_, index) => {
        const statement: Record<string, unknown> = {};
        for (const field of SMOKING_STATEMENT_FIELDS) {
          const value = firstParam(params[`${prefix}Statement${index}${field[0].toUpperCase()}${field.slice(1)}`]);
          if (value !== '') statement[field] = value;
        }
        return statement;
      })
    : [{}];

  const dimension: Record<string, unknown> = {
    state: firstParam(params[`${prefix}State`]),
    statements,
  };
  const value = firstParam(params[`${prefix}Value`]);
  const scope = firstParam(params[`${prefix}Scope`]);
  if (value) dimension.value = value;
  if (scope) dimension.scope = scope;
  if (firstParam(params[`${prefix}Stale`]) === '1') dimension.isStale = true;
  return dimension;
}

function parseSmokingPolicyParams(params: SearchParams): HotelSmokingPolicy | undefined {
  const version = firstParam(params.smokingPolicyVersion);
  if (!version) return undefined;
  if (version !== '1') return unavailableHotelSmokingPolicy();
  return normalizeHotelSmokingPolicy({
    loadState: firstParam(params.smokingLoadState),
    refreshFailed: firstParam(params.smokingRefreshFailed) === '1',
    room: parseSmokingDimensionParams(params, 'Room'),
    property: parseSmokingDimensionParams(params, 'Property'),
  }, firstParam(params.provider));
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
    documentStatus: firstParam(params.documentStatus),
    documentScope: firstParam(params.documentScope),
    documentTypes: firstParam(params.documentTypes),
    documentInvoiceIssuerRole: firstParam(params.documentInvoiceIssuerRole),
    documentInvoiceIssuerName: firstParam(params.documentInvoiceIssuerName),
    documentReceiptIssuerRole: firstParam(params.documentReceiptIssuerRole),
    documentReceiptIssuerName: firstParam(params.documentReceiptIssuerName),
    documentConfirmationIssuerRole: firstParam(params.documentConfirmationIssuerRole),
    documentConfirmationIssuerName: firstParam(params.documentConfirmationIssuerName),
    documentBillingDetailsStep: firstParam(params.documentBillingDetailsStep),
    documentTaxIdentifierEligibility: parseJsonQueryParam(firstParam(params.documentTaxIdentifierEligibility)),
    documentNameEligibility: parseJsonQueryParam(firstParam(params.documentNameEligibility)),
    documentCondition: firstParam(params.documentCondition),
    documentSourceLabel: firstParam(params.documentSourceLabel),
    documentSourcePolicyId: firstParam(params.documentSourcePolicyId),
    documentSourceObservedAt: firstParam(params.documentSourceObservedAt),
    documentConflict1Source: firstParam(params.documentConflict1Source),
    documentConflict1Statement: firstParam(params.documentConflict1Statement),
    documentConflict2Source: firstParam(params.documentConflict2Source),
    documentConflict2Statement: firstParam(params.documentConflict2Statement),
    documentConflict3Source: firstParam(params.documentConflict3Source),
    documentConflict3Statement: firstParam(params.documentConflict3Statement),
    documentConflict4Source: firstParam(params.documentConflict4Source),
    documentConflict4Statement: firstParam(params.documentConflict4Statement),
    documentVerificationRole: firstParam(params.documentVerificationRole),
    documentVerificationUrl: firstParam(params.documentVerificationUrl),
    priceCents: firstParam(params.priceCents),
    currency: firstParam(params.currency),
    priceBasis: firstParam(params.priceBasis),
    providerUrl: firstParam(params.providerUrl),
    fundsPolicy: parseJsonQueryParam(firstParam(params.fundsPolicy)),
    entrySource: firstParam(params.entrySource),
    returnUrl: firstParam(params.returnUrl),
    checkIn: firstParam(params.checkIn),
    checkOut: firstParam(params.checkOut),
    nightCount: firstParam(params.nightCount),
    priceCheckedAt: firstParam(params.priceCheckedAt),
    dealScore: parseJsonQueryParam(firstParam(params.dealScore)),
    hotelClass: parseJsonQueryParam(firstParam(params.hotelClass)),
    guestRating: parseJsonQueryParam(firstParam(params.guestRating)),
    reviewEvidence: parseJsonQueryParam(firstParam(params.reviewEvidence)),
    smokingPolicy: parseSmokingPolicyParams(params),
    rateEligibility: parseJsonQueryParam(firstParam(params.rateEligibility)),
    rateEligibilityCapability: parseJsonQueryParam(firstParam(params.rateEligibilityCapability)),
    admissionPolicy: parseJsonQueryParam(firstParam(params.admissionPolicy)),
    admissionPolicyCapability: parseJsonQueryParam(firstParam(params.admissionPolicyCapability)),
    paymentAcceptance: parseJsonQueryParam(firstParam(params.paymentAcceptance)),
    paymentAcceptanceCapability: parseJsonQueryParam(firstParam(params.paymentAcceptanceCapability)),
    amenityEvidence: parseJsonQueryParam(firstParam(params.amenityEvidence)),
    transportEvidence: parseJsonQueryParam(firstParam(params.transportEvidence)),
    taxEvidence: parseJsonQueryParam(firstParam(params.taxEvidence)),
    mandatoryPropertyChargeEvidence: parseJsonQueryParam(firstParam(params.mandatoryPropertyChargeEvidence)),
    requiredChargeCapabilities: parseJsonQueryParam(firstParam(params.requiredChargeCapabilities)),
    climateEvidence: firstParam(params.climateUnsupported) === '1'
      ? createUnsupportedHotelClimateEvidence(
          firstParam(params.offerId),
          firstParam(params.provider),
        )
      : parseJsonQueryParam(firstParam(params.climateEvidence)),
  });
}

export function validateStructuredBookingHotelContext(input: unknown): BookingHotelContext | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const location = typeof value.location === 'object' && value.location !== null && !Array.isArray(value.location)
    ? value.location as Record<string, unknown>
    : undefined;
  const anchor = location && typeof location.anchor === 'object' && location.anchor !== null && !Array.isArray(location.anchor)
    ? location.anchor as Record<string, unknown>
    : undefined;
  const distance = location && typeof location.distance === 'object' && location.distance !== null && !Array.isArray(location.distance)
    ? location.distance as Record<string, unknown>
    : undefined;

  return validateBookingHotelContext({
    ...value,
    locationPrecision: location?.precision,
    locationLabel: location?.label,
    locationAddress: location?.address,
    locationLat: location?.lat,
    locationLng: location?.lng,
    locationArea: location?.area,
    locationSource: location?.source,
    locationAnchorKind: anchor?.kind,
    locationAnchorId: anchor?.id,
    locationAnchorName: anchor?.name,
    locationAnchorLat: anchor?.lat,
    locationAnchorLng: anchor?.lng,
    locationAnchorSource: anchor?.source,
    locationDistanceValue: distance?.value,
    locationDistanceUnit: distance?.unit,
    locationDistanceMethod: distance?.method,
    locationDistanceSource: distance?.source,
    locationProviderName: location?.providerLocationName,
  });
}

function parseJsonQueryParam(value: string): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
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

export type BookingHotelContinuity = Partial<Pick<
  BookingHotelContext,
  'entrySource' | 'returnUrl' | 'checkIn' | 'checkOut' | 'nightCount' | 'dealScore' | 'priceCheckedAt' | 'hotelClass' | 'guestRating' | 'reviewEvidence'
>>;

export function buildBookingHotelContext(hotel: HotelOffer, continuity?: BookingHotelContinuity): BookingHotelContext {
  const documentReadiness = normalizeHotelDocumentReadiness(hotel.documentReadiness, providerEvidenceLabel(hotel.source));
  const requiredChargeCapabilities = normalizeHotelRequiredChargeCapabilities(hotel.requiredChargeCapabilities);
  const priceComposition = buildHotelPriceComposition({
    offerId: hotel.id,
    supplier: hotel.source,
    stayCostState: 'nightly_only',
    taxEvidence: hotel.taxEvidence,
    mandatoryPropertyChargeEvidence: hotel.mandatoryPropertyChargeEvidence,
    capabilities: requiredChargeCapabilities,
  });
  return {
    kind: 'hotel',
    offerId: hotel.id,
    provider: hotel.source,
    name: hotel.name,
    area: hotel.area,
    location: hotel.location,
    priceCents: hotel.pricePerNight.priceCents,
    currency: hotel.pricePerNight.currency,
    priceBasis: hotel.priceBasis ?? 'per_night_before_taxes_fees',
    providerUrl: hotel.deeplink,
    documentReadiness,
    fundsPolicy: normalizeHotelFundsPolicyEvidence(hotel.fundsPolicy, hotel.source),
    smokingPolicy: hotel.smokingPolicy === undefined
      ? unavailableHotelSmokingPolicy()
      : normalizeHotelSmokingPolicy(hotel.smokingPolicy, hotel.source),
    ...(hotel.rateEligibility !== undefined ? { rateEligibility: hotel.rateEligibility } : {}),
    ...(hotel.rateEligibilityCapability !== undefined ? { rateEligibilityCapability: hotel.rateEligibilityCapability } : {}),
    ...(hotel.admissionPolicy !== undefined ? { admissionPolicy: hotel.admissionPolicy } : {}),
    ...(hotel.admissionPolicyCapability !== undefined ? { admissionPolicyCapability: hotel.admissionPolicyCapability } : {}),
    ...(hotel.paymentAcceptance !== undefined ? { paymentAcceptance: hotel.paymentAcceptance } : {}),
    ...(hotel.paymentAcceptanceCapability !== undefined ? { paymentAcceptanceCapability: hotel.paymentAcceptanceCapability } : {}),
    ...(hotel.amenityEvidence !== undefined ? { amenityEvidence: hotel.amenityEvidence } : {}),
    ...(hotel.transportEvidence !== undefined ? { transportEvidence: hotel.transportEvidence } : {}),
    taxEvidence: priceComposition.taxes,
    mandatoryPropertyChargeEvidence: priceComposition.mandatoryPropertyCharges,
    requiredChargeCapabilities,
    priceDisclosureState: priceComposition.priceDisclosureState,
    climateEvidence: validateHotelClimateEvidence(hotel.climateEvidence, { offerId: hotel.id })
      ?? createUnsupportedHotelClimateEvidence(hotel.id, hotel.source),
    ...(continuity?.entrySource !== undefined ? { entrySource: continuity.entrySource } : {}),
    ...(continuity?.returnUrl !== undefined ? { returnUrl: continuity.returnUrl } : {}),
    ...(continuity?.checkIn !== undefined ? { checkIn: continuity.checkIn } : {}),
    ...(continuity?.checkOut !== undefined ? { checkOut: continuity.checkOut } : {}),
    ...(continuity?.nightCount !== undefined ? { nightCount: continuity.nightCount } : {}),
    ...(continuity?.dealScore !== undefined ? { dealScore: continuity.dealScore } : {}),
    ...(continuity?.priceCheckedAt !== undefined ? { priceCheckedAt: continuity.priceCheckedAt } : {}),
    ...(continuity?.hotelClass !== undefined ? { hotelClass: continuity.hotelClass } : {}),
    ...(continuity?.guestRating !== undefined ? { guestRating: continuity.guestRating } : {}),
    ...(hotel.reviewEvidence !== undefined ? { reviewEvidence: hotel.reviewEvidence } : {}),
    ...(continuity?.reviewEvidence !== undefined ? { reviewEvidence: continuity.reviewEvidence } : {}),
  };
}

function buildInlineHotelBookingHref(context: BookingHotelContext): string {
  const defaultDocumentReadiness = notProvidedHotelDocumentReadiness(context.documentReadiness.source.label);
  const params = new URLSearchParams({
    kind: 'hotel',
    offerId: context.offerId,
    provider: context.provider,
    name: context.name,
    priceCents: String(context.priceCents),
    currency: context.currency,
    priceBasis: context.priceBasis,
    providerUrl: context.providerUrl,
    fundsPolicy: JSON.stringify(context.fundsPolicy),
    documentStatus: context.documentReadiness.status,
    documentScope: context.documentReadiness.scope,
    documentTypes: context.documentReadiness.documentTypes.join(','),
    documentBillingDetailsStep: context.documentReadiness.billingDetailsStep,
    documentSourceLabel: context.documentReadiness.source.label,
  });
  if (JSON.stringify(context.documentReadiness.taxIdentifierEligibility) !== JSON.stringify(defaultDocumentReadiness.taxIdentifierEligibility)) {
    params.set('documentTaxIdentifierEligibility', JSON.stringify(context.documentReadiness.taxIdentifierEligibility));
  }
  if (JSON.stringify(context.documentReadiness.documentNameEligibility) !== JSON.stringify(defaultDocumentReadiness.documentNameEligibility)) {
    params.set('documentNameEligibility', JSON.stringify(context.documentReadiness.documentNameEligibility));
  }

  if (context.area) params.set('area', context.area);
  if (context.location?.precision) params.set('locationPrecision', context.location.precision);
  if (context.location?.label) params.set('locationLabel', context.location.label);
  if (context.location?.address) params.set('locationAddress', context.location.address);
  if (context.location?.area) params.set('locationArea', context.location.area);
  if (context.location?.source) params.set('locationSource', context.location.source);
  if (context.location && hasValidCoordinates(context.location)) {
    params.set('locationLat', String(context.location.lat));
    params.set('locationLng', String(context.location.lng));
  }
  if (hasVerifiedHotelLocationComparison(context.location)) {
    params.set('locationAnchorKind', context.location.anchor.kind);
    params.set('locationAnchorId', context.location.anchor.id);
    params.set('locationAnchorName', context.location.anchor.name);
    params.set('locationAnchorLat', String(context.location.anchor.lat));
    params.set('locationAnchorLng', String(context.location.anchor.lng));
    params.set('locationAnchorSource', context.location.anchor.source);
    params.set('locationDistanceValue', String(context.location.distance.value));
    params.set('locationDistanceUnit', context.location.distance.unit);
    params.set('locationDistanceMethod', context.location.distance.method);
    params.set('locationDistanceSource', context.location.distance.source);
  }
  if (context.location?.providerLocationName) params.set('locationProviderName', context.location.providerLocationName);
  if (context.entrySource) params.set('entrySource', context.entrySource);
  if (context.returnUrl) params.set('returnUrl', context.returnUrl);
  if (context.checkIn) params.set('checkIn', context.checkIn);
  if (context.checkOut) params.set('checkOut', context.checkOut);
  if (context.nightCount !== undefined) params.set('nightCount', String(context.nightCount));
  if (context.priceCheckedAt) params.set('priceCheckedAt', context.priceCheckedAt);
  if (context.dealScore) params.set('dealScore', JSON.stringify(context.dealScore));
  if (context.hotelClass) params.set('hotelClass', JSON.stringify(context.hotelClass));
  if (context.guestRating) params.set('guestRating', JSON.stringify(context.guestRating));
  if (context.reviewEvidence) params.set('reviewEvidence', JSON.stringify(context.reviewEvidence));
  if (context.rateEligibility) params.set('rateEligibility', JSON.stringify(context.rateEligibility));
  if (context.rateEligibilityCapability) params.set('rateEligibilityCapability', JSON.stringify(context.rateEligibilityCapability));
  if (context.admissionPolicy) params.set('admissionPolicy', JSON.stringify(context.admissionPolicy));
  if (context.admissionPolicyCapability) params.set('admissionPolicyCapability', JSON.stringify(context.admissionPolicyCapability));
  if (context.paymentAcceptance) params.set('paymentAcceptance', JSON.stringify(context.paymentAcceptance));
  if (context.paymentAcceptanceCapability) params.set('paymentAcceptanceCapability', JSON.stringify(context.paymentAcceptanceCapability));
  if (context.amenityEvidence) params.set('amenityEvidence', JSON.stringify(context.amenityEvidence));
  if (context.transportEvidence) params.set('transportEvidence', JSON.stringify(context.transportEvidence));
  if (context.taxEvidence) params.set('taxEvidence', JSON.stringify(context.taxEvidence));
  if (context.mandatoryPropertyChargeEvidence) params.set('mandatoryPropertyChargeEvidence', JSON.stringify(context.mandatoryPropertyChargeEvidence));
  if (context.requiredChargeCapabilities) params.set('requiredChargeCapabilities', JSON.stringify(context.requiredChargeCapabilities));
  // Unsupported is the default adapter fallback and carries no offer-specific facts.
  // Encode a marker and reconstruct it from the offer/provider contract instead of
  // spending the inline URL budget on three identical empty rows.
  if (context.climateEvidence?.capability === 'unsupported') params.set('climateUnsupported', '1');
  else if (context.climateEvidence) params.set('climateEvidence', JSON.stringify(context.climateEvidence));
  const issuerParams = [
    ['invoice', 'documentInvoiceIssuerRole', 'documentInvoiceIssuerName'],
    ['receipt', 'documentReceiptIssuerRole', 'documentReceiptIssuerName'],
    ['booking_confirmation', 'documentConfirmationIssuerRole', 'documentConfirmationIssuerName'],
  ] as const;
  for (const [type, roleParam, nameParam] of issuerParams) {
    const documentIssuer = context.documentReadiness.issuerByDocument[type];
    if (!documentIssuer) continue;
    params.set(roleParam, documentIssuer.role);
    if (documentIssuer.displayName) params.set(nameParam, documentIssuer.displayName);
  }
  if (context.documentReadiness.condition) params.set('documentCondition', context.documentReadiness.condition);
  if (context.documentReadiness.source.policyId) params.set('documentSourcePolicyId', context.documentReadiness.source.policyId);
  if (context.documentReadiness.source.observedAt) params.set('documentSourceObservedAt', context.documentReadiness.source.observedAt);
  context.documentReadiness.conflictStatements?.forEach((statement, index) => {
    params.set(`documentConflict${index + 1}Source`, statement.sourceLabel);
    params.set(`documentConflict${index + 1}Statement`, statement.statement);
  });
  if (context.documentReadiness.verificationTarget) {
    params.set('documentVerificationRole', context.documentReadiness.verificationTarget.role);
    if (context.documentReadiness.verificationTarget.url) {
      // URLSearchParams encodes but does not alter the original affiliate URL value.
      params.set('documentVerificationUrl', context.documentReadiness.verificationTarget.url);
    }
  }
  serializeSmokingPolicy(params, context.smokingPolicy ?? unavailableHotelSmokingPolicy());

  return `/book?${params.toString()}`;
}

export function buildHotelBookingHref(hotel: HotelOffer): string {
  const href = buildInlineHotelBookingHref(buildBookingHotelContext(hotel));
  if (href.length <= MAX_INLINE_HOTEL_BOOKING_HREF_LENGTH) return href;
  return `/book?kind=hotel&hotelContextRef=${HOTEL_CONTEXT_REFERENCE_REQUIRED}`;
}

export function hotelBookingHrefRequiresReference(href: string): boolean {
  const query = href.split('?', 2)[1] ?? '';
  return new URLSearchParams(query).get('hotelContextRef') === HOTEL_CONTEXT_REFERENCE_REQUIRED;
}

function serializeSmokingDimension<T extends RoomSmokingPolicyValue | PropertySmokingPolicyValue>(
  params: URLSearchParams,
  kind: 'Room' | 'Property',
  dimension: HotelSmokingDimension<T>,
): void {
  const prefix = `smoking${kind}`;
  params.set(`${prefix}State`, dimension.state);
  if (dimension.value) params.set(`${prefix}Value`, dimension.value);
  if (dimension.scope) params.set(`${prefix}Scope`, dimension.scope);
  if (dimension.isStale) params.set(`${prefix}Stale`, '1');
  params.set(`${prefix}StatementCount`, String(dimension.statements.length));

  dimension.statements.forEach((statement: SupplierSmokingStatement, index: number) => {
    for (const field of SMOKING_STATEMENT_FIELDS) {
      const value = statement[field];
      if (value !== undefined) {
        params.set(`${prefix}Statement${index}${field[0].toUpperCase()}${field.slice(1)}`, value);
      }
    }
  });
}

function serializeSmokingPolicy(params: URLSearchParams, policy: HotelSmokingPolicy): void {
  params.set('smokingPolicyVersion', '1');
  params.set('smokingLoadState', policy.loadState);
  if (policy.refreshFailed) params.set('smokingRefreshFailed', '1');
  serializeSmokingDimension(params, 'Room', policy.room);
  serializeSmokingDimension(params, 'Property', policy.property);
}
