import {
  buildBookingHref,
  buildHotelBookingHref,
  parseBookingFareContext,
  parseBookingHotelContext,
  validateBookingFareContext,
  validateBookingHotelContext,
} from '../config';
import type { HotelOffer, NormalizedFare } from '@/lib/types';

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

const hotel: HotelOffer = {
  id: 'hotel_123',
  name: 'The Example Hotel',
  area: 'Midtown',
  location: {
    label: '350 5th Ave, New York, NY',
    precision: 'exact',
    address: '350 5th Ave, New York, NY',
    lat: 40.7484,
    lng: -73.9857,
    distance: {
      value: 0.3,
      unit: 'mi',
      referencePoint: 'Times Square',
    },
    providerLocationName: 'Midtown',
  },
  stars: 4,
  pricePerNight: { priceCents: 18900, currency: 'USD' },
  priceBasis: 'per_night_before_taxes_fees',
  rating: 8.7,
  deeplink: 'https://tp.media/r?marker=hotel-marker&p=4536&u=https%3A%2F%2Fhotellook.com%2Fhotels%2F123',
  source: 'hotellook',
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

describe('booking hotel context continuity', () => {
  it('builds hotel review hrefs with selected offer identity, provider, price, currency, basis, and handoff URL', () => {
    const href = buildHotelBookingHref(hotel);
    const url = new URL(href, 'https://expaify.test');

    expect(url.pathname).toBe('/book');
    expect(url.searchParams.get('kind')).toBe('hotel');
    expect(url.searchParams.get('offerId')).toBe(hotel.id);
    expect(url.searchParams.get('provider')).toBe(hotel.source);
    expect(url.searchParams.get('name')).toBe(hotel.name);
    expect(url.searchParams.get('area')).toBe(hotel.area);
    expect(url.searchParams.get('locationPrecision')).toBe('exact');
    expect(url.searchParams.get('locationAddress')).toBe('350 5th Ave, New York, NY');
    expect(url.searchParams.get('locationLat')).toBe('40.7484');
    expect(url.searchParams.get('locationLng')).toBe('-73.9857');
    expect(url.searchParams.get('locationDistanceValue')).toBe('0.3');
    expect(url.searchParams.get('locationDistanceUnit')).toBe('mi');
    expect(url.searchParams.get('locationDistanceReferencePoint')).toBe('Times Square');
    expect(url.searchParams.get('locationProviderName')).toBe('Midtown');
    expect(url.searchParams.get('priceCents')).toBe(String(hotel.pricePerNight.priceCents));
    expect(url.searchParams.get('currency')).toBe(hotel.pricePerNight.currency);
    expect(url.searchParams.get('priceBasis')).toBe('per_night_before_taxes_fees');
    expect(url.searchParams.get('providerUrl')).toBe(hotel.deeplink);
  });

  it('parses valid hotel review context without changing selected display values', () => {
    const parsed = parseBookingHotelContext({
      kind: 'hotel',
      offerId: 'hotel_123',
      provider: 'hotellook',
      name: 'The Example Hotel',
      area: 'Midtown',
      locationPrecision: 'exact',
      locationLabel: '350 5th Ave, New York, NY',
      locationAddress: '350 5th Ave, New York, NY',
      locationLat: '40.7484',
      locationLng: '-73.9857',
      locationDistanceValue: '0.3',
      locationDistanceUnit: 'mi',
      locationDistanceReferencePoint: 'Times Square',
      locationProviderName: 'Midtown',
      priceCents: '18900',
      currency: 'USD',
      priceBasis: 'per_night_before_taxes_fees',
      providerUrl: 'https://tp.media/r?marker=hotel-marker',
    });

    expect(parsed).toEqual({
      kind: 'hotel',
      offerId: 'hotel_123',
      provider: 'hotellook',
      name: 'The Example Hotel',
      area: 'Midtown',
      location: {
        label: '350 5th Ave, New York, NY',
        precision: 'exact',
        address: '350 5th Ave, New York, NY',
        lat: 40.7484,
        lng: -73.9857,
        distance: {
          value: 0.3,
          unit: 'mi',
          referencePoint: 'Times Square',
        },
        providerLocationName: 'Midtown',
      },
      priceCents: 18900,
      currency: 'USD',
      priceBasis: 'per_night_before_taxes_fees',
      providerUrl: 'https://tp.media/r?marker=hotel-marker',
    });
  });

  it('returns null for malformed hotel price, currency, basis, or provider URL', () => {
    const baseContext = {
      kind: 'hotel',
      offerId: 'hotel_123',
      provider: 'hotellook',
      name: 'The Example Hotel',
      priceCents: 18900,
      currency: 'USD',
      priceBasis: 'per_night_before_taxes_fees',
      providerUrl: 'https://tp.media/r?marker=hotel-marker',
    } as const;

    expect(validateBookingHotelContext({ ...baseContext, priceCents: 189.99 })).toBeNull();
    expect(validateBookingHotelContext({ ...baseContext, currency: 'US Dollars' })).toBeNull();
    expect(validateBookingHotelContext({ ...baseContext, priceBasis: 'total' })).toBeNull();
    expect(validateBookingHotelContext({ ...baseContext, providerUrl: 'javascript:alert(1)' })).toBeNull();
    expect(validateBookingHotelContext({ ...baseContext, locationLat: '91', locationLng: '-73' })).toBeNull();
    expect(validateBookingHotelContext({ ...baseContext, locationLat: 'north', locationLng: '-73' })).toBeNull();
    expect(validateBookingHotelContext({ ...baseContext, locationLat: '40', locationLng: 'west' })).toBeNull();
    expect(validateBookingHotelContext({ ...baseContext, locationDistanceValue: '1', locationDistanceUnit: 'meters', locationDistanceReferencePoint: 'center' })).toBeNull();
    expect(validateBookingHotelContext({ ...baseContext, locationDistanceValue: 'near' })).toBeNull();
  });
});
