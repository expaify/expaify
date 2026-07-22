import {
  buildBookingHref,
  buildBookingHotelContext,
  buildHotelBookingHref,
  HOTEL_CONTEXT_REFERENCE_REQUIRED,
  MAX_INLINE_HOTEL_BOOKING_HREF_LENGTH,
  parseBookingFareContext,
  parseBookingHotelContext,
  validateBookingFareContext,
  validateBookingHotelContext,
  validateStructuredBookingHotelContext,
} from '../config';
import type { HotelOffer, NormalizedFare } from '@/lib/types';
import { calculateStraightLineDistanceKm } from '@/lib/hotels/locationEvidence';

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

const hotelAnchor = {
  kind: 'airport' as const,
  id: 'JFK',
  name: 'John F. Kennedy International (JFK)',
  lat: 40.6413,
  lng: -73.7781,
  source: 'search_linked' as const,
};
const hotelDistanceKm = calculateStraightLineDistanceKm(
  { lat: 40.7484, lng: -73.9857 },
  hotelAnchor
)!;

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
    area: 'Midtown',
    source: 'provider',
    anchor: hotelAnchor,
    distance: {
      value: hotelDistanceKm,
      unit: 'km',
      method: 'straight_line',
      source: 'expaify_calculated',
    },
    providerLocationName: 'Midtown',
  },
  stars: 4,
  pricePerNight: { priceCents: 18900, currency: 'USD' },
  priceBasis: 'per_night_before_taxes_fees',
  rating: 8.7,
  deeplink: 'https://tp.media/r?marker=hotel-marker&p=4536&u=https%3A%2F%2Fhotellook.com%2Fhotels%2F123',
  source: 'hotellook',
  fundsPolicy: { state: 'not_returned', obligations: [], sourceLabel: 'Hotellook', scope: 'not_returned' },
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
    expect(url.searchParams.get('locationArea')).toBe('Midtown');
    expect(url.searchParams.get('locationSource')).toBe('provider');
    expect(url.searchParams.get('locationAnchorKind')).toBe('airport');
    expect(url.searchParams.get('locationAnchorId')).toBe('JFK');
    expect(url.searchParams.get('locationAnchorName')).toBe('John F. Kennedy International (JFK)');
    expect(url.searchParams.get('locationAnchorLat')).toBe('40.6413');
    expect(url.searchParams.get('locationAnchorLng')).toBe('-73.7781');
    expect(url.searchParams.get('locationAnchorSource')).toBe('search_linked');
    expect(url.searchParams.get('locationDistanceValue')).toBe(String(hotelDistanceKm));
    expect(url.searchParams.get('locationDistanceUnit')).toBe('km');
    expect(url.searchParams.get('locationDistanceMethod')).toBe('straight_line');
    expect(url.searchParams.get('locationDistanceSource')).toBe('expaify_calculated');
    expect(url.searchParams.get('locationDistanceReferencePoint')).toBeNull();
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
      locationArea: 'Midtown',
      locationSource: 'provider',
      locationAnchorKind: 'airport',
      locationAnchorId: 'JFK',
      locationAnchorName: 'John F. Kennedy International (JFK)',
      locationAnchorLat: '40.6413',
      locationAnchorLng: '-73.7781',
      locationAnchorSource: 'search_linked',
      locationDistanceValue: String(hotelDistanceKm),
      locationDistanceUnit: 'km',
      locationDistanceMethod: 'straight_line',
      locationDistanceSource: 'expaify_calculated',
      locationProviderName: 'Midtown',
      priceCents: '18900',
      currency: 'USD',
      priceBasis: 'per_night_before_taxes_fees',
      providerUrl: 'https://tp.media/r?marker=hotel-marker',
      fundsPolicy: JSON.stringify({ state: 'not_returned', obligations: [], sourceLabel: 'hotellook', scope: 'not_returned' }),
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
        area: 'Midtown',
        source: 'provider',
        anchor: hotelAnchor,
        distance: {
          value: hotelDistanceKm,
          unit: 'km',
          method: 'straight_line',
          source: 'expaify_calculated',
        },
        providerLocationName: 'Midtown',
      },
      priceCents: 18900,
      currency: 'USD',
      priceBasis: 'per_night_before_taxes_fees',
      providerUrl: 'https://tp.media/r?marker=hotel-marker',
      fundsPolicy: { state: 'not_returned', obligations: [], sourceLabel: 'hotellook', scope: 'not_returned' },
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
  });

  it('drops invalid optional location evidence without blocking the hotel handoff', () => {
    const baseContext = {
      kind: 'hotel',
      offerId: 'hotel_123',
      provider: 'hotellook',
      name: 'The Example Hotel',
      area: 'New York',
      locationPrecision: 'exact',
      locationAddress: '350 5th Ave, New York, NY',
      locationSource: 'provider',
      priceCents: 18900,
      currency: 'USD',
      priceBasis: 'per_night_before_taxes_fees',
      providerUrl: 'https://tp.media/r?marker=hotel-marker',
    } as const;

    const invalidCoordinates = validateBookingHotelContext({
      ...baseContext,
      locationLat: '91',
      locationLng: '-73',
    });
    expect(invalidCoordinates).toMatchObject({
      location: {
        address: '350 5th Ave, New York, NY',
        source: 'provider',
      },
    });
    expect(invalidCoordinates?.location).not.toHaveProperty('lat');
    expect(invalidCoordinates?.location).not.toHaveProperty('lng');

    const unverifiedComparison = validateBookingHotelContext({
      ...baseContext,
      locationLat: '40.7484',
      locationLng: '-73.9857',
      locationAnchorKind: 'airport',
      locationAnchorId: 'JFK',
      locationAnchorName: 'John F. Kennedy International (JFK)',
      locationAnchorLat: '40.6413',
      locationAnchorLng: '-73.7781',
      locationAnchorSource: 'search_linked',
      locationDistanceValue: '1',
      locationDistanceUnit: 'km',
      locationDistanceMethod: 'straight_line',
      locationDistanceSource: 'expaify_calculated',
    });
    expect(unverifiedComparison).not.toBeNull();
    expect(unverifiedComparison?.location).not.toHaveProperty('anchor');
    expect(unverifiedComparison?.location).not.toHaveProperty('distance');
  });

  it('does not serialize an unverified legacy-style distance', () => {
    const unverifiedHotel = {
      ...hotel,
      location: {
        ...hotel.location!,
        anchor: undefined,
        distance: undefined,
      },
    };
    const url = new URL(buildHotelBookingHref(unverifiedHotel), 'https://expaify.test');

    expect(url.searchParams.get('locationDistanceValue')).toBeNull();
    expect(url.searchParams.get('locationAnchorId')).toBeNull();
    expect(url.searchParams.get('locationDistanceReferencePoint')).toBeNull();
  });

  it('preserves structured funds evidence through the booking URL without truncating provider wording', () => {
    const providerWording = `after checkout ${'under the documented property conditions '.repeat(20)}`.trim();
    const fundsPolicy = {
      state: 'complete' as const,
      obligations: [{
        type: 'authorization_hold' as const,
        amount: { kind: 'exact' as const, money: { priceCents: 25000, currency: 'USD' } },
        basis: 'per_stay' as const,
        applicationWording: 'At check-in',
        paymentMethodWording: 'Credit or debit card',
        returnOrRelease: { action: 'release' as const, providerWording },
        sourceLabel: 'Property policy',
        scope: 'selected_stay' as const,
      }],
      sourceLabel: 'Property policy',
      scope: 'selected_stay' as const,
      fetchedAt: '2026-07-22T03:00:00.000Z',
    };
    const href = buildHotelBookingHref({ ...hotel, fundsPolicy });
    const url = new URL(href, 'https://expaify.test');
    const parsed = parseBookingHotelContext(Object.fromEntries(url.searchParams.entries()));

    expect(parsed?.fundsPolicy).toEqual(fundsPolicy);
    expect(parsed?.fundsPolicy.obligations[0].returnOrRelease?.providerWording).toBe(providerWording);
  });

  it('normalizes malformed and legacy booking evidence to sourced not-returned', () => {
    const baseParams = Object.fromEntries(new URL(buildHotelBookingHref(hotel), 'https://expaify.test').searchParams.entries());
    expect(parseBookingHotelContext({ ...baseParams, fundsPolicy: '{bad json' })?.fundsPolicy).toEqual({
      state: 'not_returned', obligations: [], sourceLabel: 'hotellook', scope: 'not_returned',
    });
    delete baseParams.fundsPolicy;
    expect(parseBookingHotelContext(baseParams)?.fundsPolicy.state).toBe('not_returned');
  });

  it('uses an opaque-reference handoff instead of emitting an unsafe policy URL', () => {
    const longWording = Array.from({ length: 1_000 }, (_, index) => String(index % 10)).join('');
    const obligations = Array.from({ length: 10 }, (_, index) => ({
      type: 'authorization_hold' as const,
      amount: { kind: 'exact' as const, money: { priceCents: 20_000 + index, currency: 'USD' } },
      basis: 'per_stay' as const,
      applicationWording: longWording,
      paymentMethodWording: longWording,
      returnOrRelease: { action: 'release' as const, providerWording: longWording, issuerProcessingWording: longWording },
      sourceLabel: 'Property policy',
      scope: 'selected_stay' as const,
    }));
    const href = buildHotelBookingHref({
      ...hotel,
      fundsPolicy: {
        state: 'complete',
        obligations,
        sourceLabel: 'Property policy',
        scope: 'selected_stay',
      },
    });
    const url = new URL(href, 'https://expaify.test');

    expect(href.length).toBeLessThanOrEqual(MAX_INLINE_HOTEL_BOOKING_HREF_LENGTH);
    expect(url.searchParams.get('hotelContextRef')).toBe(HOTEL_CONTEXT_REFERENCE_REQUIRED);
    expect(url.searchParams.get('fundsPolicy')).toBeNull();
  });

  it('validates a structured booking context without losing nested location or policy evidence', () => {
    const context = buildBookingHotelContext(hotel);
    expect(validateStructuredBookingHotelContext(JSON.parse(JSON.stringify(context)))).toEqual(context);
  });
});
