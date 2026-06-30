import {
  buildBookingHref,
  parseBookingFareContext,
  validateBookingFareContext,
} from '../config';
import type { NormalizedFare } from '@/lib/types';

const fare: NormalizedFare = {
  id: 'off_123',
  fareType: 'cash',
  origin: 'JFK',
  destination: 'LAX',
  depart: '2026-09-22T08:00:00.000Z',
  return: '2026-09-29T17:30:00.000Z',
  cabin: 'economy',
  stops: 1,
  carrier: 'American Airlines',
  price: { priceCents: 45001, currency: 'USD' },
  passengerCount: 3,
  priceScope: 'party_total',
  deeplink: '#',
  source: 'duffel',
  fetchedAt: '2026-06-30T00:00:00.000Z',
};

describe('booking fare context continuity', () => {
  it('builds booking hrefs with the selected fare price, route, provider, and passengers', () => {
    const href = buildBookingHref(fare);
    const url = new URL(href, 'https://expaify.test');

    expect(url.pathname).toBe('/book');
    expect(url.searchParams.get('offerId')).toBe(fare.id);
    expect(url.searchParams.get('provider')).toBe(fare.source);
    expect(url.searchParams.get('origin')).toBe(fare.origin);
    expect(url.searchParams.get('destination')).toBe(fare.destination);
    expect(url.searchParams.get('carrier')).toBe(fare.carrier);
    expect(url.searchParams.get('priceCents')).toBe(String(fare.price.priceCents));
    expect(url.searchParams.get('currency')).toBe(fare.price.currency);
    expect(url.searchParams.get('passengerCount')).toBe(String(fare.passengerCount));
    expect(url.searchParams.get('priceScope')).toBe(fare.priceScope);
  });

  it('parses valid booking context without changing selected display values', () => {
    const parsed = parseBookingFareContext({
      offerId: 'off_123',
      provider: 'duffel',
      origin: 'JFK',
      destination: 'LAX',
      depart: '2026-09-22T08:00:00.000Z',
      return: '2026-09-29T17:30:00.000Z',
      carrier: 'American Airlines',
      stops: '1',
      priceCents: '45001',
      currency: 'USD',
      passengerCount: '3',
      priceScope: 'party_total',
    });

    expect(parsed).toEqual({
      offerId: 'off_123',
      provider: 'duffel',
      origin: 'JFK',
      destination: 'LAX',
      depart: '2026-09-22T08:00:00.000Z',
      return: '2026-09-29T17:30:00.000Z',
      carrier: 'American Airlines',
      stops: 1,
      priceCents: 45001,
      currency: 'USD',
      passengerCount: 3,
      priceScope: 'party_total',
    });
  });

  it('returns null when booking context is missing required selected fare fields', () => {
    expect(parseBookingFareContext({})).toBeNull();
    expect(validateBookingFareContext({ offerId: 'off_123' })).toBeNull();
  });

  it('returns null for malformed price, passenger, or price-basis context', () => {
    const baseContext = {
      offerId: 'off_123',
      provider: 'duffel',
      origin: 'JFK',
      destination: 'LAX',
      depart: '2026-09-22T08:00:00.000Z',
      carrier: 'American Airlines',
      stops: 0,
      priceCents: 45001,
      currency: 'USD',
      passengerCount: 1,
      priceScope: 'party_total',
    } as const;

    expect(validateBookingFareContext({ ...baseContext, priceCents: 450.01 })).toBeNull();
    expect(validateBookingFareContext({ ...baseContext, priceCents: '1e5' })).toBeNull();
    expect(validateBookingFareContext({ ...baseContext, passengerCount: 0 })).toBeNull();
    expect(validateBookingFareContext({ ...baseContext, priceScope: 'total' })).toBeNull();
  });

  it('returns null for malformed route, date, or currency context', () => {
    const baseContext = {
      offerId: 'off_123',
      provider: 'duffel',
      origin: 'JFK',
      destination: 'LAX',
      depart: '2026-09-22T08:00:00.000Z',
      carrier: 'American Airlines',
      stops: 0,
      priceCents: 45001,
      currency: 'USD',
      passengerCount: 1,
      priceScope: 'party_total',
    } as const;

    expect(validateBookingFareContext({ ...baseContext, origin: 'New York' })).toBeNull();
    expect(validateBookingFareContext({ ...baseContext, destination: 'lax' })).toBeNull();
    expect(validateBookingFareContext({ ...baseContext, depart: 'not-a-date' })).toBeNull();
    expect(validateBookingFareContext({ ...baseContext, return: 'not-a-date' })).toBeNull();
    expect(validateBookingFareContext({ ...baseContext, currency: 'US Dollars' })).toBeNull();
  });
});
