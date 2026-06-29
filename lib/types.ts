export type Money = { priceCents: number; currency: string };

export type FareType = 'cash' | 'award';

export interface NormalizedFare {
  id: string;
  fareType: FareType;
  origin: string;
  destination: string;
  depart: string;
  return?: string;
  stops: number;
  carrier: string;
  price: Money;
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
  pricePerNight: Money;
  rating?: number;
  deeplink: string;
  source: string;
}

export interface FlightProvider {
  searchFares(
    origin: string,
    dest: string,
    range: { depart: string; return?: string }
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
