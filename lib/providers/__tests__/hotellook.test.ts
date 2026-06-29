/**
 * HotellookProvider tests — mocked fetch + Redis, no live network.
 *
 * Two-step API flow:
 *   1. available_locations → location ID
 *   2. prices_by_dates     → HotelPrice[]
 */

import { HotellookProvider } from '../hotellook';
import type { HotelOffer } from '../../types';

// ─── Mock Redis cache (all gets miss by default) ──────────────────────────────

jest.mock('../../cache/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const LOCATIONS_FIXTURE = [
  { id: 895, cityName: 'New York', countryCode: 'US' },
];

const PRICES_FIXTURE = [
  {
    hotelId: 1111,
    hotelName: 'Grand Plaza',
    stars: 4,
    priceFrom: 149.99,
    priceAvg: 175.0,
  },
  {
    hotelId: 2222,
    hotelName: 'Budget Inn',
    stars: 2,
    priceAvg: 59.5,
    // priceFrom absent — should fall back to priceAvg
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

type FetchResponse = { ok: boolean; status: number; statusText: string; json: () => Promise<unknown> };

/** Set up fetch to return two sequential responses (locations, then prices). */
function mockFetchSequence(responses: FetchResponse[]): void {
  let call = 0;
  global.fetch = jest.fn().mockImplementation(() => {
    const res = responses[call] ?? responses[responses.length - 1];
    call += 1;
    return Promise.resolve(res);
  });
}

function okResponse(body: unknown): FetchResponse {
  return { ok: true, status: 200, statusText: 'OK', json: async () => body };
}

function errResponse(status: number): FetchResponse {
  return { ok: false, status, statusText: 'Error', json: async () => ({}) };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.TP_TOKEN = 'test-token';
  process.env.TP_AFFILIATE_MARKER = 'marker42';
  jest.clearAllMocks();

  const { cache } = jest.requireMock('../../cache/redis') as {
    cache: { get: jest.Mock; set: jest.Mock };
  };
  cache.get.mockResolvedValue(null);
  cache.set.mockResolvedValue(undefined);
});

// ─── IATA mapping ─────────────────────────────────────────────────────────────

describe('IATA → city resolution', () => {
  it('maps JFK to New York', async () => {
    mockFetchSequence([okResponse(LOCATIONS_FIXTURE), okResponse(PRICES_FIXTURE)]);
    const provider = new HotellookProvider();
    await provider.searchHotels('JFK', { checkin: '2025-08-01', checkout: '2025-08-05' });

    // The first fetch call should query for "New York", not "JFK"
    const firstUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(firstUrl).toContain('New%20York');
    expect(firstUrl).not.toContain('JFK');
  });

  it('maps LAX to Los Angeles', async () => {
    mockFetchSequence([okResponse(LOCATIONS_FIXTURE), okResponse(PRICES_FIXTURE)]);
    const provider = new HotellookProvider();
    await provider.searchHotels('LAX', { checkin: '2025-08-01', checkout: '2025-08-05' });

    const firstUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(firstUrl).toContain('Los%20Angeles');
  });

  it('passes a plain city name through unchanged', async () => {
    mockFetchSequence([okResponse(LOCATIONS_FIXTURE), okResponse(PRICES_FIXTURE)]);
    const provider = new HotellookProvider();
    await provider.searchHotels('Miami', { checkin: '2025-08-01', checkout: '2025-08-05' });

    const firstUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(firstUrl).toContain('Miami');
  });
});

// ─── Happy-path result shape ──────────────────────────────────────────────────

describe('HotellookProvider.searchHotels — success', () => {
  it('returns HotelOffer[] with integer priceCents in USD', async () => {
    mockFetchSequence([okResponse(LOCATIONS_FIXTURE), okResponse(PRICES_FIXTURE)]);
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('JFK', {
      checkin: '2025-08-01',
      checkout: '2025-08-05',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    const offers: HotelOffer[] = result.data;
    expect(offers).toHaveLength(2);

    offers.forEach((o) => {
      expect(o.source).toBe('hotellook');
      expect(o.pricePerNight.currency).toBe('USD');
      expect(Number.isInteger(o.pricePerNight.priceCents)).toBe(true);
      expect(typeof o.id).toBe('string');
    });
  });

  it('uses priceFrom when available, priceAvg otherwise', async () => {
    mockFetchSequence([okResponse(LOCATIONS_FIXTURE), okResponse(PRICES_FIXTURE)]);
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('JFK', {
      checkin: '2025-08-01',
      checkout: '2025-08-05',
    });

    if (!result.ok) throw new Error(result.reason);

    const grand = result.data.find((o) => o.id === '1111');
    expect(grand?.pricePerNight.priceCents).toBe(Math.round(149.99 * 100)); // 14999

    const budget = result.data.find((o) => o.id === '2222');
    expect(budget?.pricePerNight.priceCents).toBe(Math.round(59.5 * 100)); // 5950
  });

  it('includes affiliate marker in every deeplink', async () => {
    mockFetchSequence([okResponse(LOCATIONS_FIXTURE), okResponse(PRICES_FIXTURE)]);
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('JFK', {
      checkin: '2025-08-01',
      checkout: '2025-08-05',
    });

    if (!result.ok) throw new Error(result.reason);
    result.data.forEach((o) => {
      expect(o.deeplink).toContain('marker42');
      expect(o.deeplink).toMatch(/hotellook\.com\/hotels\/\d+/);
    });
  });

  it('sets area to the resolved city name, not the IATA code', async () => {
    mockFetchSequence([okResponse(LOCATIONS_FIXTURE), okResponse(PRICES_FIXTURE)]);
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('JFK', {
      checkin: '2025-08-01',
      checkout: '2025-08-05',
    });

    if (!result.ok) throw new Error(result.reason);
    result.data.forEach((o) => expect(o.area).toBe('New York'));
  });
});

// ─── Empty / no-result paths ──────────────────────────────────────────────────

describe('HotellookProvider.searchHotels — empty results (not errors)', () => {
  it('returns empty array when no location is found', async () => {
    mockFetchSequence([okResponse([]), okResponse(PRICES_FIXTURE)]);
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('UnknownCity', {
      checkin: '2025-08-01',
      checkout: '2025-08-05',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
  });

  it('returns empty array when checkin is missing', async () => {
    global.fetch = jest.fn();
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('JFK', { checkin: '', checkout: '2025-08-05' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns empty array when checkout is missing', async () => {
    global.fetch = jest.fn();
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('JFK', { checkin: '2025-08-01', checkout: '' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns empty array when prices API returns empty list', async () => {
    mockFetchSequence([okResponse(LOCATIONS_FIXTURE), okResponse([])]);
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('JFK', {
      checkin: '2025-08-01',
      checkout: '2025-08-05',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
  });
});

// ─── Caching ──────────────────────────────────────────────────────────────────

describe('HotellookProvider.searchHotels — caching', () => {
  it('stores results in cache with 6-hour TTL', async () => {
    mockFetchSequence([okResponse(LOCATIONS_FIXTURE), okResponse(PRICES_FIXTURE)]);
    const { cache } = jest.requireMock('../../cache/redis') as {
      cache: { get: jest.Mock; set: jest.Mock };
    };

    const provider = new HotellookProvider();
    await provider.searchHotels('JFK', { checkin: '2025-08-01', checkout: '2025-08-05' });

    // cache.set called at least once for the final offers array
    const offersCall = cache.set.mock.calls.find(
      ([key]: [string]) => key.startsWith('tp:hotels:v2:')
    );
    expect(offersCall).toBeDefined();
    expect(offersCall![2]).toBe(21600);
  });

  it('returns cached data without hitting the network when cache hits', async () => {
    const cachedOffers: HotelOffer[] = [
      {
        id: '9999',
        name: 'Cached Hotel',
        area: 'New York',
        pricePerNight: { priceCents: 12000, currency: 'USD' },
        rating: 3,
        deeplink: 'https://www.hotellook.com/hotels/9999?marker=marker42',
        source: 'hotellook',
      },
    ];

    const { cache } = jest.requireMock('../../cache/redis') as {
      cache: { get: jest.Mock; set: jest.Mock };
    };
    // First get (offers cache key) hits; location get is not called because
    // the outer cache returns early.
    cache.get.mockResolvedValue(cachedOffers);

    global.fetch = jest.fn();
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('JFK', {
      checkin: '2025-08-01',
      checkout: '2025-08-05',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual(cachedOffers);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ─── Error paths ──────────────────────────────────────────────────────────────

describe('HotellookProvider.searchHotels — errors', () => {
  it('returns { ok: false } when available_locations returns HTTP error', async () => {
    mockFetchSequence([errResponse(503)]);
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('JFK', {
      checkin: '2025-08-01',
      checkout: '2025-08-05',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toContain('503');
  });

  it('returns { ok: false } when prices_by_dates returns HTTP error', async () => {
    mockFetchSequence([okResponse(LOCATIONS_FIXTURE), errResponse(429)]);
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('JFK', {
      checkin: '2025-08-01',
      checkout: '2025-08-05',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toContain('429');
  });

  it('returns { ok: false } when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network failure'));
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('JFK', {
      checkin: '2025-08-01',
      checkout: '2025-08-05',
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toBe('Network failure');
  });
});
