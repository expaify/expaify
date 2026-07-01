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
          location: { name: 'New York' },
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
        stars: 4,
        rating: 4,
        pricePerNight: { priceCents: 12999, currency: 'USD' },
        deeplink: 'https://tp.media/r?marker=hotel-marker42&trs=233847&p=4536&u=https://hotellook.com/hotels/12345',
        photoUrl: 'https://example.com/hotel.jpg',
        source: 'hotellook',
      },
    ]);
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

  it('uses cached hotel results when present', async () => {
    const cached = [
      {
        id: 'cached-1',
        name: 'Cached Hotel',
        area: 'Chicago',
        pricePerNight: { priceCents: 9999, currency: 'USD' },
        deeplink: 'https://example.com/cached',
        source: 'hotellook',
      },
    ];
    cacheGetMock.mockResolvedValueOnce(cached);

    const provider = new HotellookProvider();
    const result = await provider.searchHotels('ORD', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result).toEqual({ ok: true, data: cached });
    expect(global.fetch).not.toHaveBeenCalled();
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
