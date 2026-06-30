export type Money = { priceCents: number; currency: string };

export type FareType = 'cash' | 'award';
export type FarePriceScope = 'per_person' | 'party_total';

export interface FlightSearchRange {
  depart: string;
  return?: string;
  passengers: number;
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

export interface HotelOffer {
  id: string;
  name: string;
  area: string;
  stars: number;
  pricePerNight: Money;
  rating?: number;
  photoUrl?: string;
  deeplink: string;
  source: string;
}

export type NormalizedHotelOffer = HotelOffer;

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
