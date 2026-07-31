export type Money = { priceCents: number; currency: string };

export type FareType = 'cash' | 'award';
export type FarePriceScope = 'per_person' | 'party_total';

export interface FlightSearchRange {
  depart: string;
  return?: string;
  passengers: number;
}

export type DateCoverageStatus = 'not_requested' | 'complete' | 'partial' | 'unavailable';

export interface FlightDateCoverage {
  requested: boolean;
  status: DateCoverageStatus;
  selectedDepart: string;
  windowStart?: string;
  windowEnd?: string;
  expectedDates: string[];
  checkedDates: string[];
  failedDates: string[];
  provider: string;
  message?: string;
}

export interface FlightDateRelation {
  selectedDepart: string;
  fareDepart: string;
  relation: 'selected' | 'nearby';
}

export type ItineraryCertainty = 'confirmed' | 'partial' | 'unavailable';

export interface NormalizedFlightSegment {
  origin: string;
  destination: string;
  depart: string;
  arrive: string;
  carrier?: string;
  flightNumber?: string;
}

export interface NormalizedLayover {
  airport: string;
  durationMinutes: number;
  overnight?: boolean;
  airportChange?: boolean;
}

export interface NormalizedItinerary {
  certainty: ItineraryCertainty;
  durationMinutes?: number;
  arrive?: string;
  segments?: NormalizedFlightSegment[];
  layovers?: NormalizedLayover[];
}

export interface NormalizedFare {
  id: string;
  fareType: FareType;
  origin: string;
  destination: string;
  depart: string;
  return?: string;
  cabin?: 'economy' | 'premium_economy' | 'business' | 'first';
  stops: number;
  carrier: string;
  price: Money;
  passengerCount?: number;
  priceScope?: FarePriceScope;
  miles?: number;
  deeplink: string;
  source: string;
  fetchedAt: string;
  dateRelation?: FlightDateRelation;
  itinerary?: NormalizedItinerary;
}

export interface PricePoint {
  date: string;
  priceCents: number;
  currency: string;
}

export interface DealScore {
  percentile: number;
  pctVsMedian: number;
  medianCents: number;
  currency: string;
  verdict: 'Great' | 'Good' | 'Typical';
  confidence: 'high' | 'low';
  explanation: string;
  sampleSize?: number;
}

export type HotelQualityKind =
  | 'hotel_class'
  | 'guest_review'
  | 'provider_quality'
  | 'inferred'
  | 'unknown';

export type HotelQualityConfidence =
  | 'verified'
  | 'provider_only'
  | 'inferred'
  | 'unavailable';

export interface HotelRatingEvidence {
  kind: HotelQualityKind;
  value?: number;
  scaleMax?: number;
  sourceLabel?: string;
  reviewCount?: number;
  fetchedAt?: string;
  confidence: HotelQualityConfidence;
}

export type HotelEvidenceStatus =
  | 'confirmed'
  | 'unavailable'
  | 'not_returned'
  | 'unknown';

export type HotelEvidenceScope =
  | 'property'
  | 'room'
  | 'rate'
  | 'selected_stay';

export type HotelEvidenceFee = 'included' | 'paid' | 'unknown';

export type HotelAmenityConfidence = HotelQualityConfidence;

export type HotelEvidenceCertainty = 'guaranteed' | 'requestable';

export interface HotelAmenityEvidence {
  id: string;
  label: string;
  status: HotelEvidenceStatus;
  scope: HotelEvidenceScope;
  sourceLabel: string;
  fee?: HotelEvidenceFee;
  fetchedAt?: string;
  confidence?: HotelAmenityConfidence;
  certainty?: HotelEvidenceCertainty;
}

export type HotelAccessEvidenceState = 'loading' | 'ready' | 'error';

export type ParkingLocationKind = 'on_site' | 'nearby_off_site' | 'street' | 'unknown';

export type ParkingSpaceState =
  | 'confirmed_for_selected_stay'
  | 'unavailable_for_selected_stay'
  | 'not_returned'
  | 'unknown';

export type ParkingReservationRule =
  | 'required'
  | 'not_required'
  | 'not_possible'
  | 'available_on_request'
  | 'first_come_first_served'
  | 'unknown';

export type ParkingOperator = 'hotel_operated' | 'third_party' | 'unknown';
export type ParkingCostState = 'included' | 'paid' | 'unknown';
export type ParkingCostBasis = 'per_night' | 'per_stay' | 'per_entry' | 'per_hour' | 'unknown';

export interface HotelParkingOptionEvidence {
  id: string;
  facilityStatus: HotelEvidenceStatus;
  facilityScope: 'property';
  selectedStaySpace: ParkingSpaceState;
  location: {
    kind: ParkingLocationKind;
    distance?: HotelLocationDistance;
    address?: string;
  };
  cost: {
    state: ParkingCostState;
    amount?: Money;
    basis: ParkingCostBasis;
  };
  reservation: ParkingReservationRule;
  operator: ParkingOperator;
  sourceLabel: string;
  fetchedAt?: string;
  confidence?: HotelAmenityConfidence;
}

export interface HotelParkingEvidence {
  state: 'loading' | 'ready' | 'error';
  options: HotelParkingOptionEvidence[];
  evidenceRevision: string;
  conflict: boolean;
}

export type HotelDocumentStatus =
  | 'confirmed'
  | 'conditional'
  | 'unavailable'
  | 'not_provided'
  | 'conflicting';

export type HotelDocumentType = 'invoice' | 'receipt' | 'booking_confirmation';
export type HotelDocumentIssuerRole = 'booking_provider' | 'property' | 'split' | 'unknown';
export type HotelBillingDetailsStep =
  | 'during_partner_booking'
  | 'after_booking_contact_provider'
  | 'after_booking_contact_property'
  | 'at_checkout'
  | 'not_required'
  | 'unknown';
export type HotelDocumentScope = 'rate' | 'selected_stay';

export interface HotelDocumentIssuer {
  role: HotelDocumentIssuerRole;
  displayName?: string;
}

export interface HotelDocumentReadiness {
  status: HotelDocumentStatus;
  scope: HotelDocumentScope;
  documentTypes: HotelDocumentType[];
  issuerByDocument: Partial<Record<HotelDocumentType, HotelDocumentIssuer>>;
  billingDetailsStep: HotelBillingDetailsStep;
  condition?: string;
  source: {
    label: string;
    policyId?: string;
    observedAt?: string;
  };
  conflictStatements?: Array<{
    sourceLabel: string;
    statement: string;
  }>;
  verificationTarget?: {
    role: 'booking_provider' | 'property';
    url?: string;
  };
}

export type HotelDocumentCheckState = 'idle' | 'loading' | 'ready' | 'error';

export type HotelParkingConflictDimension =
  | 'location'
  | 'cost'
  | 'reservation rule'
  | 'operator'
  | 'space for your stay';

export type HotelFundsPolicyState =
  | 'complete'
  | 'partial'
  | 'explicit_none'
  | 'not_returned'
  | 'conflicting';

export type HotelFundsObligationType =
  | 'authorization_hold'
  | 'refundable_deposit'
  | 'other_refundable_obligation';

export type HotelFundsAmount =
  | { kind: 'exact'; money: Money }
  | { kind: 'range'; min: Money; max: Money }
  | {
      kind: 'percentage';
      percent: number;
      appliesTo: 'stay_price' | 'other_documented_basis';
      appliesToWording?: string;
    }
  | { kind: 'variable'; providerWording: string }
  | { kind: 'not_returned' };

export type HotelFundsBasis =
  | 'per_stay'
  | 'per_night'
  | 'per_room'
  | 'per_person'
  | 'provider_defined'
  | 'not_returned';

export type HotelFundsEvidenceScope = HotelEvidenceScope | 'not_returned';

export type HotelFundsMissingField =
  | 'mechanism'
  | 'amount'
  | 'basis'
  | 'application_timing'
  | 'payment_method'
  | 'return_or_release'
  | 'scope'
  | 'source';

export interface HotelFundsEvidenceRecord {
  type?: HotelFundsObligationType;
  amount?: HotelFundsAmount;
  basis?: HotelFundsBasis;
  applicationWording?: string;
  paymentMethodWording?: string;
  returnOrRelease?: {
    action: 'refund' | 'release';
    providerWording?: string;
    issuerProcessingWording?: string;
  };
  sourceLabel: string;
  scope: HotelFundsEvidenceScope;
}

export interface HotelFundsPolicyEvidence {
  state: HotelFundsPolicyState;
  obligations: HotelFundsEvidenceRecord[];
  sourceLabel: string;
  scope: HotelFundsEvidenceScope;
  fetchedAt?: string;
  missingFields?: HotelFundsMissingField[];
  conflictingRecords?: HotelFundsEvidenceRecord[];
}

export type HotelFundsPolicyLoadState = 'loading' | 'ready' | 'error';

export interface HotelFundsPolicyCapability {
  /** True only when the provider adapter can return deposit/hold evidence. */
  policy: boolean;
}

export type HotelSmokingEvidenceState =
  | 'confirmed'
  | 'ambiguous'
  | 'conflicting'
  | 'not_provided'
  | 'unavailable';

export type HotelSmokingPolicyLoadState = 'loading' | 'ready' | 'refreshing' | 'error';

export type RoomSmokingPolicyValue =
  | 'all_rooms_non_smoking'
  | 'smoking_rooms_offered'
  | 'selected_room_non_smoking'
  | 'selected_room_smoking';

export type PropertySmokingPolicyValue =
  | 'smoke_free_property'
  | 'indoor_common_areas_smoke_free'
  | 'designated_smoking_areas'
  | 'smoking_permitted_in_stated_areas';

export type HotelSmokingScope =
  | 'property_room_inventory'
  | 'property_room_capability'
  | 'selected_room_rate'
  | 'entire_property'
  | 'indoor_common_areas'
  | 'designated_areas'
  | 'stated_areas'
  | 'unclear';

export interface SupplierSmokingStatement {
  id: string;
  value?: RoomSmokingPolicyValue | PropertySmokingPolicyValue;
  scope: HotelSmokingScope;
  sourceLabel: string;
  sourceText: string;
  fetchedAt: string;
  checkin?: string;
  checkout?: string;
  roomId?: string;
  rateId?: string;
}

export interface HotelSmokingDimension<T> {
  state: HotelSmokingEvidenceState;
  value?: T;
  scope?: HotelSmokingScope;
  statements: SupplierSmokingStatement[];
  /** Retained provenance that is excluded from current claims and filters. */
  isStale?: boolean;
}

export interface HotelSmokingPolicy {
  loadState: HotelSmokingPolicyLoadState;
  room: HotelSmokingDimension<RoomSmokingPolicyValue>;
  property: HotelSmokingDimension<PropertySmokingPolicyValue>;
  /** Set only when a refresh failed and stale evidence remains visible. */
  refreshFailed?: boolean;
}

export type HotelLocationPrecision = 'exact' | 'coordinates' | 'area' | 'search_area' | 'missing';

export type HotelLocationEvidenceSource = 'provider' | 'search_fallback' | 'unavailable';
export type HotelLocationAnchorKind = 'airport' | 'venue' | 'landmark' | 'city_center';
export type HotelLocationAnchorSource = 'user_selected' | 'search_linked' | 'provider_declared';

export interface HotelLocationAnchor {
  kind: HotelLocationAnchorKind;
  id: string;
  name: string;
  lat: number;
  lng: number;
  source: HotelLocationAnchorSource;
}

export interface HotelLocationDistance {
  value: number;
  unit: 'mi' | 'km';
  method: 'straight_line';
  source: 'expaify_calculated' | 'provider_documented';
}

export interface HotelLocation {
  label?: string;
  precision?: HotelLocationPrecision;
  address?: string;
  lat?: number;
  lng?: number;
  distance?: HotelLocationDistance;
  providerLocationName?: string;
  area?: string;
  source: HotelLocationEvidenceSource;
  anchor?: HotelLocationAnchor;
}

export interface HotelSearchContext {
  anchor?: HotelLocationAnchor;
}

export type RateRestrictionFamily = 'residency' | 'age' | 'membership' | 'refundability';

export type RateRestrictionCondition = {
  family: RateRestrictionFamily;
  label: string;
};

export type RateEligibilityPresentation =
  | { state: 'restricted'; conditions: readonly RateRestrictionCondition[]; coverageIncomplete?: boolean; fetchedAt?: string }
  | { state: 'clear'; fetchedAt?: string }
  | { state: 'not_provided'; fetchedAt?: string }
  | { state: 'loading' }
  | { state: 'error' };

export type HotelRateFamilyState = 'restricted' | 'clear' | 'not_provided';

/** Structured evidence a supplier attaches to one selected-rate restriction family. */
export interface HotelRateFamilyEvidence {
  state: HotelRateFamilyState;
  /** Present only when membership is restricted; a raw supplier program/group label. */
  membershipLabel?: string;
  /** Present only when residency is restricted; a raw supplier place label. */
  residencyPlace?: string;
  /** Present only when age is restricted; at least one bound must be set. */
  minAge?: number;
  maxAge?: number;
}

export interface HotelRateEligibilityEvidence {
  /** Must match the offer/rate this evidence is attached to; mismatch degrades to not_provided. */
  offerId: string;
  /** Must match HotelOffer.source; mismatch degrades to not_provided. */
  supplier: string;
  fetchedAt?: string;
  membership: HotelRateFamilyEvidence;
  residency: HotelRateFamilyEvidence;
  age: HotelRateFamilyEvidence;
  refundability: HotelRateFamilyEvidence;
}

/** Declares whether an adapter's contract can explicitly return `restricted` and `clear` per family. */
export interface HotelRateEligibilityCapability {
  membership: boolean;
  residency: boolean;
  age: boolean;
  refundability: boolean;
}

/** Property admission: may you OCCUPY. Distinct from rate eligibility: may you BOOK this rate. */
export type HotelAdmissionFamily =
  | 'checkin_age'
  | 'checkin_identity'
  | 'local_guest_restriction'
  | 'occupancy_admission';

export type HotelAdmissionLoadState = 'loading' | 'ready' | 'error';

/** Verbatim supplier prose. Never parsed into flags, numbers, or headcounts. */
export interface SupplierAdmissionStatement {
  id: string;
  sourceLabel: string;
  /** Supplier text, reproduced exactly. Bounded 1–300 chars after trim. */
  sourceText: string;
  observedAt?: string;
}

export interface HotelAdmissionStatementEvidence {
  state: HotelDocumentStatus;
  statements: SupplierAdmissionStatement[];
}

export interface HotelAdmissionAgeEvidence extends HotelAdmissionStatementEvidence {
  /** The only typed value in the taxonomy. Non-negative integer. No maximum. No range. */
  minimumAge?: number;
}

export interface HotelAdmissionPolicyEvidence {
  /** Literal. There is no rate-scoped variant of this type. */
  scope: 'property';
  /** Must match the rendered offer's id; mismatch degrades every family to not_provided. */
  propertyId: string;
  /** Must match HotelOffer.source; mismatch degrades every family to not_provided. */
  supplier: string;
  loadState: HotelAdmissionLoadState;
  fetchedAt?: string;
  families: {
    checkin_age: HotelAdmissionAgeEvidence;
    checkin_identity: HotelAdmissionStatementEvidence;
    local_guest_restriction: HotelAdmissionStatementEvidence;
    occupancy_admission: HotelAdmissionStatementEvidence;
  };
}

/** Declares whether an adapter's contract can return an explicit negative for a family. */
export interface HotelAdmissionPolicyCapability {
  checkin_age: boolean;
  checkin_identity: boolean;
  local_guest_restriction: boolean;
  occupancy_admission: boolean;
}

export type HotelAdmissionRowState = 'restricted' | 'no_rule_reported' | 'unavailable' | 'conflicting';

export interface HotelAdmissionRow {
  family: HotelAdmissionFamily;
  rowState: HotelAdmissionRowState;
  /** Row label, e.g. 'Minimum check-in age'. */
  label: string;
  /** One finished sentence. Never ends in the rate word 'only'. */
  sentence: string;
  /** Verbatim supplier prose, already bounded and capped. */
  statements: readonly SupplierAdmissionStatement[];
  /** Count of statements dropped by the render cap; 0 when none. */
  omittedStatementCount: number;
}

export type HotelAdmissionPresentation =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'not_provided' }
  | {
      state: 'reported';
      rows: readonly HotelAdmissionRow[];
      /** True when at least one family is not_provided while others reported. */
      coverageIncomplete: boolean;
      /** True when at least one row is rowState 'restricted'. Drives the chip only. */
      hasRestriction: boolean;
      fetchedAt?: string;
    };

export interface HotelOffer {
  id: string;
  name: string;
  area: string;
  location?: HotelLocation;
  stars: number;
  pricePerNight: Money;
  priceBasis?: 'per_night_before_taxes_fees';
  rating?: number;
  photoUrl?: string;
  deeplink: string;
  source: string;
  documentReadiness: HotelDocumentReadiness;
  hotelClass?: HotelRatingEvidence;
  guestRating?: HotelRatingEvidence;
  amenityEvidence?: HotelAmenityEvidence[];
  accessEvidenceState?: HotelAccessEvidenceState;
  fundsPolicy: HotelFundsPolicyEvidence;
  fundsPolicyCapability?: HotelFundsPolicyCapability;
  smokingPolicy?: HotelSmokingPolicy;
  rateEligibility?: HotelRateEligibilityEvidence;
  rateEligibilityCapability?: HotelRateEligibilityCapability;
  admissionPolicy?: HotelAdmissionPolicyEvidence;
  admissionPolicyCapability?: HotelAdmissionPolicyCapability;
}

export type NormalizedHotelOffer = HotelOffer;

export type HotelSearchCoverage = 'more_available' | 'confirmed_end' | 'unconfirmed';

export interface HotelSearchPage {
  offers: HotelOffer[];
  coverage: HotelSearchCoverage;
  nextPageToken?: string;
  exactTotal?: number;
}

export interface AirportLookupAirport {
  iata: string;
  name: string;
  city: string;
  country: string;
}

export interface AirportLookupData {
  airports: AirportLookupAirport[];
  query: string;
  status: 'ok' | 'too_short';
  minQueryLength: number;
  limit: number;
}

export interface FlightProvider {
  searchFares(
    origin: string,
    dest: string,
    range: FlightSearchRange
  ): Promise<Result<NormalizedFare[]>>;
  priceTrends(origin: string, dest: string): Promise<Result<PricePoint[]>>;
}

export interface HotelProvider {
  searchHotels(
    area: string,
    range: { checkin: string; checkout: string },
    context?: HotelSearchContext
  ): Promise<Result<HotelSearchPage>>;
  checkDocumentReadiness(
    offer: Pick<HotelOffer, 'id' | 'source' | 'deeplink' | 'documentReadiness'>
  ): Promise<Result<HotelDocumentReadiness>>;
}

export type Result<T> = { ok: true; data: T } | { ok: false; reason: string };

export type ProviderIssueStatus = 'unavailable' | 'no_supply' | 'malformed_response';

export interface ProviderNotice {
  provider: string;
  status: ProviderIssueStatus;
  message: string;
}
