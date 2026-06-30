import type { NormalizedFare } from '../types';

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
};

type SearchParams = Record<string, string | string[] | undefined>;
type FareContextInput = Partial<Record<keyof BookingFareContext, unknown>>;

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

export function validateBookingFareContext(input: FareContextInput): BookingFareContext | null {
  const offerId = cleanRequired(input.offerId);
  const provider = cleanRequired(input.provider);
  const origin = cleanRequired(input.origin).toUpperCase();
  const destination = cleanRequired(input.destination).toUpperCase();
  const depart = cleanRequired(input.depart);
  const carrier = cleanRequired(input.carrier).toUpperCase();
  const currency = cleanRequired(input.currency).toUpperCase();
  const priceCents = Number(input.priceCents);
  const stops = Number(input.stops);

  if (
    !offerId ||
    !provider ||
    !origin ||
    !destination ||
    !depart ||
    !carrier ||
    !currency ||
    !Number.isInteger(priceCents) ||
    priceCents <= 0 ||
    !Number.isInteger(stops) ||
    stops < 0
  ) {
    return null;
  }

  return {
    offerId,
    provider,
    origin,
    destination,
    depart,
    return: cleanOptional(input.return),
    carrier,
    stops,
    priceCents,
    currency,
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
  });

  if (fare.return) params.set('return', fare.return);

  return `/book?${params.toString()}`;
}
