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

export type HotelParkingConflictDimension =
  | 'location'
  | 'cost'
  | 'reservation rule'
  | 'operator'
  | 'space for your stay';

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
  hotelClass?: HotelRatingEvidence;
  guestRating?: HotelRatingEvidence;
  amenityEvidence?: HotelAmenityEvidence[];
  accessEvidenceState?: HotelAccessEvidenceState;
}

export type NormalizedHotelOffer = HotelOffer;

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
  ): Promise<Result<HotelOffer[]>>;
}

export type Result<T> = { ok: true; data: T } | { ok: false; reason: string };

export type ProviderIssueStatus = 'unavailable' | 'no_supply' | 'malformed_response';

export interface ProviderNotice {
  provider: string;
  status: ProviderIssueStatus;
  message: string;
}
