/**
 * HotellookProvider tests.
 *
 * The provider calls Travelpayouts HotelLook through engine.hotellook.com.
 * Tests mock fetch and Redis so they never hit the real API.
 */

import { cache } from '../../cache/redis';
import { HotellookProvider, hotellook } from '../hotellook';

jest.mock('../../cache/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

const fetchMock = global.fetch as jest.Mock;
const cacheGetMock = cache.get as jest.Mock;
const cacheSetMock = cache.set as jest.Mock;

const notReturnedEvidence = [
  ['elevator', 'Elevator', 'property'],
  ['on_site_parking', 'On-site parking', 'property'],
  ['step_free_route', 'Step-free route, entrance to room', 'property'],
  ['room_pref_ground_floor', 'Ground-floor room', 'room'],
  ['room_pref_high_floor', 'High-floor room', 'room'],
  ['room_pref_near_elevator', 'Room near the elevator', 'room'],
  ['room_pref_connecting', 'Connecting rooms', 'room'],
].map(([id, label, scope]) => ({
  id,
  label,
  status: 'not_returned',
  scope,
  sourceLabel: 'Hotellook',
}));

beforeEach(() => {
  process.env.TP_TOKEN = 'test-token';
  process.env.HOTEL_AFFILIATE_ID = 'hotel-marker42';
  delete process.env.TP_AFFILIATE_MARKER;
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe('HotellookProvider.searchHotels', () => {
  it('returns a configuration error when TP_TOKEN is missing', async () => {
    delete process.env.TP_TOKEN;

    const provider = new HotellookProvider();
    const result = await provider.searchHotels('JFK', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result).toEqual({ ok: false, reason: 'TP_TOKEN not configured' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns a configuration error when HOTEL_AFFILIATE_ID is missing', async () => {
    delete process.env.HOTEL_AFFILIATE_ID;
    delete process.env.TP_AFFILIATE_MARKER;

    const provider = new HotellookProvider();
    const result = await provider.searchHotels('JFK', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result).toEqual({ ok: false, reason: 'HOTEL_AFFILIATE_ID not configured' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uses HOTEL_AFFILIATE_ID as the primary deeplink marker', async () => {
    process.env.HOTEL_AFFILIATE_ID = 'hotel-primary';
    process.env.TP_AFFILIATE_MARKER = 'legacy-flight-marker';
    const provider = new HotellookProvider();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        {
          hotelId: 12345,
          hotelName: 'Hotel Example',
          priceFrom: 129,
        },
      ]),
    });

    const result = await provider.searchHotels('jfk', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    expect(result.data[0].deeplink).toContain('marker=hotel-primary');
    expect(result.data[0].deeplink).not.toContain('legacy-flight-marker');
  });

  it('calls the engine cache endpoint and maps HotelLook major-unit priceFrom to cents', async () => {
    const provider = new HotellookProvider();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        {
          hotelId: 12345,
          hotelName: 'Hotel Example',
          stars: 4,
          location: { name: 'New York', geo: { lat: '40.7128', lon: '-74.0060' } },
          address: { en: '123 Example Street, New York' },
          distance: 1.24,
          priceFrom: 129.99,
          photoUrl: 'https://example.com/hotel.jpg',
          propertyType: 'Hotel',
        },
      ]),
    });

    const result = await provider.searchHotels('jfk', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://engine.hotellook.com/api/v2/cache.json?location=JFK&checkIn=2026-09-22&checkOut=2026-09-29&currency=USD&token=test-token&limit=20',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result.data).toEqual([
      {
        id: '12345',
        name: 'Hotel Example',
        area: 'New York',
        location: {
          label: '123 Example Street, New York',
          precision: 'exact',
          address: '123 Example Street, New York',
          lat: 40.7128,
          lng: -74.006,
          providerLocationName: 'New York',
          area: 'New York',
          source: 'provider',
        },
        stars: 4,
        pricePerNight: { priceCents: 12999, currency: 'USD' },
        deeplink: 'https://tp.media/r?marker=hotel-marker42&trs=233847&p=4536&u=https://hotellook.com/hotels/12345',
        photoUrl: 'https://example.com/hotel.jpg',
        source: 'hotellook',
        documentReadiness: {
          status: 'not_provided',
          scope: 'rate',
          documentTypes: [],
          issuerByDocument: {},
          billingDetailsStep: 'unknown',
          source: { label: 'Hotellook' },
        },
        hotelClass: {
          kind: 'hotel_class',
          value: 4,
          scaleMax: 5,
          sourceLabel: 'Hotellook',
          fetchedAt: expect.any(String),
          confidence: 'provider_only',
        },
        guestRating: {
          kind: 'unknown',
          sourceLabel: 'Hotellook',
          fetchedAt: expect.any(String),
          confidence: 'unavailable',
        },
        amenityEvidence: notReturnedEvidence,
        accessEvidenceState: 'ready',
      },
    ]);
  });

  it('preserves provider coordinates without promoting them to a street address', async () => {
    const provider = new HotellookProvider();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        {
          hotelId: 54321,
          hotelName: 'Coordinate Hotel',
          stars: 3,
          location: { name: 'Boston', geo: { lat: '42.3601', lon: '-71.0589' } },
          priceFrom: 150,
        },
      ]),
    });

    const result = await provider.searchHotels('bos', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    expect(result.data[0]).toMatchObject({
      id: '54321',
      area: 'Boston',
      location: {
        label: 'Boston',
        precision: 'coordinates',
        lat: 42.3601,
        lng: -71.0589,
        providerLocationName: 'Boston',
        area: 'Boston',
        source: 'provider',
      },
    });
  });

  it('calculates straight-line distance only for a complete search-linked anchor', async () => {
    const provider = new HotellookProvider();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        {
          hotelId: 54321,
          hotelName: 'Coordinate Hotel',
          location: { name: 'Boston', geo: { lat: '42.3601', lon: '-71.0589' } },
          distance: 0.1,
          priceFrom: 150,
        },
      ]),
    });

    const anchor = {
      kind: 'airport' as const,
      id: 'BOS',
      name: 'Logan International (BOS)',
      lat: 42.3656,
      lng: -71.0096,
      source: 'search_linked' as const,
    };
    const result = await provider.searchHotels(
      'bos',
      { checkin: '2026-09-22', checkout: '2026-09-29' },
      { anchor }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data[0].location).toMatchObject({
      anchor,
      distance: {
        unit: 'km',
        method: 'straight_line',
        source: 'expaify_calculated',
      },
    });
    expect(result.data[0].location?.distance?.value).toBeCloseTo(4.1, 1);
    expect(JSON.stringify(result.data[0])).not.toContain('city center');
  });

  it('excludes zero, missing, non-finite, and invalid HotelLook prices', async () => {
    const provider = new HotellookProvider();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        {
          hotelId: 1,
          hotelName: 'Zero Hotel',
          priceFrom: 0,
        },
        {
          hotelId: 2,
          hotelName: 'Missing Hotel',
        },
        {
          hotelId: 3,
          hotelName: 'Infinity Hotel',
          priceFrom: Infinity,
        },
        {
          hotelId: 4,
          hotelName: 'Invalid Hotel',
          priceFrom: 'not-a-price',
        },
        {
          hotelId: 5,
          hotelName: 'Valid Hotel',
          priceFrom: '199.50',
        },
      ]),
    });

    const result = await provider.searchHotels('SFO', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: '5',
      name: 'Valid Hotel',
      pricePerNight: { priceCents: 19950, currency: 'USD' },
    });
  });

  it('returns an empty array when HotelLook returns an empty array', async () => {
    const provider = new HotellookProvider();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([]),
    });

    const result = await provider.searchHotels('LAX', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result).toEqual({ ok: true, data: [] });
  });

  it('returns HTTP status errors without throwing', async () => {
    const provider = new HotellookProvider();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
    });

    const result = await provider.searchHotels('LHR', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result).toEqual({ ok: false, reason: 'HotelLook HTTP 503' });
  });

  it('returns parse failures without throwing', async () => {
    const provider = new HotellookProvider();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockRejectedValue(new Error('invalid json')),
    });

    const result = await provider.searchHotels('CDG', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result).toEqual({ ok: false, reason: 'invalid json' });
  });

  it('returns fetch failures as Result errors without throwing', async () => {
    const provider = new HotellookProvider();
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    const result = await provider.searchHotels('CDG', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result).toEqual({ ok: false, reason: 'network down' });
  });

  it('uses cached hotel results when present', async () => {
    const cached = [
      {
        id: 'cached-1',
        name: 'Cached Hotel',
        area: 'Chicago',
        stars: 4,
        rating: 4,
        location: {
          label: 'Chicago Loop',
          precision: 'area',
          providerLocationName: 'Chicago Loop',
          distance: {
            value: 1.2,
            unit: 'km',
            referencePoint: 'city center',
          },
        },
        pricePerNight: { priceCents: 9999, currency: 'USD' },
        deeplink: 'https://example.com/cached',
        source: 'hotellook',
        displayPrice: 99.99,
      },
    ];
    cacheGetMock.mockResolvedValueOnce(cached);

    const provider = new HotellookProvider();
    const result = await provider.searchHotels('ORD', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: 'cached-1',
          name: 'Cached Hotel',
          area: 'Chicago',
          stars: 4,
          rating: 4,
          location: {
            label: 'Chicago Loop',
            precision: 'area',
            providerLocationName: 'Chicago Loop',
            area: 'Chicago Loop',
            source: 'provider',
          },
          pricePerNight: { priceCents: 9999, currency: 'USD' },
          deeplink: 'https://example.com/cached',
          source: 'hotellook',
          documentReadiness: {
            status: 'not_provided',
            scope: 'rate',
            documentTypes: [],
            issuerByDocument: {},
            billingDetailsStep: 'unknown',
            source: { label: 'Hotellook' },
          },
          photoUrl: undefined,
          hotelClass: {
            kind: 'hotel_class',
            value: 4,
            scaleMax: 5,
            sourceLabel: 'Hotellook',
            fetchedAt: undefined,
            confidence: 'provider_only',
          },
          guestRating: {
            kind: 'inferred',
            value: 4,
            scaleMax: 5,
            sourceLabel: 'Hotellook',
            fetchedAt: undefined,
            confidence: 'inferred',
          },
          amenityEvidence: notReturnedEvidence,
          accessEvidenceState: 'ready',
        },
      ],
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('preserves cached verified guest-rating evidence when present', async () => {
    const cached = [
      {
        id: 'cached-verified',
        name: 'Verified Hotel',
        area: 'Paris',
        stars: 5,
        pricePerNight: { priceCents: 24999, currency: 'USD' },
        deeplink: 'https://example.com/verified',
        source: 'hotellook',
        hotelClass: {
          kind: 'hotel_class',
          value: 5,
          scaleMax: 5,
          sourceLabel: 'Hotellook',
          fetchedAt: '2026-07-02T10:00:00.000Z',
          confidence: 'provider_only',
        },
        guestRating: {
          kind: 'guest_review',
          value: 8.7,
          scaleMax: 10,
          sourceLabel: 'Booking.com',
          reviewCount: 1248,
          fetchedAt: '2026-07-02T10:00:00.000Z',
          confidence: 'verified',
        },
        amenityEvidence: [
          {
            id: 'elevator',
            label: 'Elevator',
            status: 'confirmed',
            scope: 'property',
            sourceLabel: 'Booking.com',
            fetchedAt: '2026-07-02T10:00:00.000Z',
            confidence: 'verified',
            certainty: 'guaranteed',
          },
          ...notReturnedEvidence.slice(1),
        ],
        accessEvidenceState: 'ready',
      },
    ];
    cacheGetMock.mockResolvedValueOnce(cached);

    const provider = new HotellookProvider();
    const result = await provider.searchHotels('PAR', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result).toMatchObject({
      ok: true,
      data: [{
        ...cached[0],
        location: {
          label: 'Paris',
          precision: 'search_area',
          area: 'Paris',
          source: 'search_fallback',
        },
      }],
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not return cached hotel offers with non-integer canonical money', async () => {
    cacheGetMock.mockResolvedValueOnce([
      {
        id: 'cached-float',
        name: 'Float Hotel',
        area: 'Chicago',
        stars: 4,
        pricePerNight: { priceCents: 9999.5, currency: 'USD' },
        deeplink: 'https://example.com/cached',
        source: 'hotellook',
      },
    ]);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        {
          hotelId: 222,
          hotelName: 'Fresh Hotel',
          stars: 3,
          priceFrom: '150.25',
        },
      ]),
    });

    const provider = new HotellookProvider();
    const result = await provider.searchHotels('ORD', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    expect(global.fetch).toHaveBeenCalled();
    expect(result.data).toEqual([
      expect.objectContaining({
        id: '222',
        pricePerNight: { priceCents: 15025, currency: 'USD' },
      }),
    ]);
  });

  it('preserves conservative live access facts and downgrades unsupported claims', async () => {
    const provider = new HotellookProvider();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        {
          hotelId: 333,
          hotelName: 'Evidence Hotel',
          priceFrom: 180,
          amenityEvidence: [
            {
              id: 'elevator',
              label: 'Vendor elevator copy',
              status: 'confirmed',
              scope: 'property',
              sourceLabel: 'Hotellook facilities',
              fetchedAt: '2026-07-22T01:00:00.000Z',
              confidence: 'provider_only',
              certainty: 'guaranteed',
            },
            {
              id: 'on_site_parking',
              label: 'Parking',
              status: 'confirmed',
              scope: 'property',
              sourceLabel: 'Hotellook facilities',
              fee: 'paid',
              certainty: 'requestable',
            },
            {
              id: 'step_free_route',
              label: 'Step free',
              status: 'confirmed',
              scope: 'property',
              sourceLabel: 'Hotellook facilities',
              certainty: 'requestable',
            },
            {
              id: 'room_pref_connecting',
              label: 'Connecting',
              status: 'unavailable',
              scope: 'room',
              sourceLabel: 'Hotellook facilities',
              certainty: 'guaranteed',
            },
          ],
        },
      ]),
    });

    const result = await provider.searchHotels('LAX', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data[0]).toMatchObject({
      accessEvidenceState: 'ready',
      amenityEvidence: [
        {
          id: 'elevator',
          label: 'Elevator',
          status: 'confirmed',
          scope: 'property',
          sourceLabel: 'Hotellook facilities',
          fetchedAt: '2026-07-22T01:00:00.000Z',
          confidence: 'provider_only',
          certainty: 'guaranteed',
        },
        {
          id: 'on_site_parking',
          status: 'confirmed',
          fee: 'paid',
          certainty: 'requestable',
        },
        {
          id: 'step_free_route',
          status: 'unknown',
        },
        expect.objectContaining({ id: 'room_pref_ground_floor', status: 'not_returned' }),
        expect.objectContaining({ id: 'room_pref_high_floor', status: 'not_returned' }),
        expect.objectContaining({ id: 'room_pref_near_elevator', status: 'not_returned' }),
        {
          id: 'room_pref_connecting',
          label: 'Connecting rooms',
          status: 'unavailable',
          scope: 'room',
          sourceLabel: 'Hotellook facilities',
        },
      ],
    });
  });

  it('keeps cached inventory usable when cached access evidence is malformed', async () => {
    cacheGetMock.mockResolvedValueOnce([
      {
        id: 'cached-access-error',
        name: 'Cached Access Error Hotel',
        area: 'Seattle',
        stars: 4,
        pricePerNight: { priceCents: 12900, currency: 'USD' },
        deeplink: 'https://example.com/cached-access-error',
        source: 'hotellook',
        amenityEvidence: 'not-an-evidence-list',
      },
    ]);

    const result = await new HotellookProvider().searchHotels('SEA', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data[0].pricePerNight).toEqual({ priceCents: 12900, currency: 'USD' });
    expect(result.data[0].accessEvidenceState).toBe('error');
    expect(result.data[0].amenityEvidence).toEqual(notReturnedEvidence);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('preserves a cached access error independently from its safe fallback evidence', async () => {
    cacheGetMock.mockResolvedValueOnce([
      {
        id: 'cached-preserved-error',
        name: 'Cached Preserved Error Hotel',
        area: 'Denver',
        stars: 3,
        pricePerNight: { priceCents: 11900, currency: 'USD' },
        deeplink: 'https://example.com/cached-preserved-error',
        source: 'hotellook',
        amenityEvidence: notReturnedEvidence,
        accessEvidenceState: 'error',
      },
    ]);

    const result = await new HotellookProvider().searchHotels('DEN', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data[0].accessEvidenceState).toBe('error');
    expect(result.data[0].amenityEvidence).toEqual(notReturnedEvidence);
  });

  it('caches API results for 6 hours', async () => {
    const provider = new HotellookProvider();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        {
          hotelId: 987,
          hotelName: 'Cache Me',
          stars: '5',
          location: { name: 'Miami' },
          priceFrom: 230.019,
        },
      ]),
    });

    const result = await provider.searchHotels('MIA', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result.ok).toBe(true);
    expect(cacheSetMock).toHaveBeenCalledWith(
      'hotellook:search:MIA:2026-09-22:2026-09-29',
      expect.arrayContaining([
        expect.objectContaining({
          id: '987',
          pricePerNight: { priceCents: 23002, currency: 'USD' },
          hotelClass: expect.objectContaining({
            kind: 'hotel_class',
            value: 5,
            scaleMax: 5,
            sourceLabel: 'Hotellook',
            confidence: 'provider_only',
          }),
          guestRating: expect.objectContaining({
            kind: 'unknown',
            confidence: 'unavailable',
          }),
        }),
      ]),
      21600
    );
  });
});

describe('hotellook singleton', () => {
  it('is an instance of HotellookProvider', () => {
    expect(hotellook).toBeInstanceOf(HotellookProvider);
  });
});
