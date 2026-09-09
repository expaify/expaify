import type { NormalizedFare } from '../types';

export interface AlertContract {
  currency: string;
  travel_start: string;
  travel_end: string | null;
  trip_type: 'oneway' | 'roundtrip' | 'hotel';
  passenger_count: number;
  hotel_id: string | null;
  hotel_provider: string | null;
}

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function completeAlert(value: AlertContract): boolean {
  if (typeof value.currency !== 'string' || !/^[A-Z]{3}$/.test(value.currency) || !validDate(value.travel_start)) return false;
  if (!Number.isInteger(value.passenger_count) || value.passenger_count < 1 || value.passenger_count > 9) return false;
  if (value.trip_type === 'hotel') {
    return value.hotel_provider === 'booking.com' && /^[1-9]\d*$/.test(value.hotel_id ?? '') &&
      value.passenger_count === 2 && validDate(value.travel_end) && value.travel_end > value.travel_start;
  }
  if (value.hotel_id != null || value.hotel_provider != null) return false;
  return value.trip_type === 'oneway' ? value.travel_end === null :
    value.trip_type === 'roundtrip' && validDate(value.travel_end) && value.travel_end >= value.travel_start;
}

// Unknown pricing scope/party size must not be silently treated as a total.
export function flightAlertTotal(fare: NormalizedFare): number | null {
  if (fare.fareType !== 'cash' || fare.cabin !== 'economy' ||
      !Number.isInteger(fare.passengerCount) || !fare.passengerCount || fare.passengerCount < 1 ||
      !['per_person', 'party_total'].includes(fare.priceScope ?? '') ||
      !Number.isSafeInteger(fare.price.priceCents) || fare.price.priceCents <= 0) return null;
  const cents = fare.price.priceCents * (fare.priceScope === 'per_person' ? fare.passengerCount : 1);
  return Number.isSafeInteger(cents) ? cents : null;
}
