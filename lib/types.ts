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

export type HotelLocationPrecision = 'exact' | 'coordinates' | 'area' | 'search_area' | 'missing';

export interface HotelLocationDistance {
  value: number;
  unit: 'mi' | 'km';
  referencePoint: string;
}

export interface HotelLocation {
  label?: string;
  precision?: HotelLocationPrecision;
  address?: string;
  lat?: number;
  lng?: number;
  distance?: HotelLocationDistance;
  providerLocationName?: string;
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
    range: { checkin: string; checkout: string }
  ): Promise<Result<HotelOffer[]>>;
}

export type Result<T> = { ok: true; data: T } | { ok: false; reason: string };

export type ProviderIssueStatus = 'unavailable' | 'no_supply' | 'malformed_response';

export interface ProviderNotice {
  provider: string;
  status: ProviderIssueStatus;
  message: string;
}
