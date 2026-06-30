/**
 * Travelpayouts provider integration tests — recorded fixtures, no live network.
 *
 * Both the `cache` module and global `fetch` are mocked so no Redis or HTTP
 * connections are needed.
 */

import { TravelpayoutsProvider } from '../travelpayouts';
import type { NormalizedFare, PricePoint } from '../../types';

// ─── Mock the Redis cache so every get() misses (forces a fetch) ─────────────

jest.mock('../../cache/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Recorded response from GET /prices/monthly — prices in USD (currency=usd) */
const MONTHLY_FIXTURE = {
  success: true,
  data: {
    '2024-03-01': { price: 350, airline: 'SU', flight_number: 101, transfers: 0 },
    '2024-04-01': { price: 280, airline: 'SU', flight_number: 102, transfers: 0 },
    '2024-05-01': { price: 225, airline: 'TK', flight_number: 201, transfers: 1 },
  },
};

/** v2/prices/latest response — prices in USD, multiple booking gates */
const LATEST_FIXTURE = {
  success: true,
  data: [
    {
      origin: 'MOW',
      destination: 'AMS',
      depart_date: '2024-06-15',
      return_date: '2024-06-22',
      gate: 'Aviasales',
      value: 220,
      number_of_changes: 0,
      found_at: '2024-06-01T12:00:00',
    },
    {
      origin: 'MOW',
      destination: 'AMS',
      depart_date: '2024-06-17',
      return_date: undefined,
      gate: 'Farera',
      value: 185,
      number_of_changes: 1,
      found_at: '2024-06-01T13:00:00',
    },
  ],
};

/** v1/prices/cheap response — keyed by dest code, entry has airline field */
const CHEAP_FIXTURE = {
  success: true,
  data: {
    AMS: {
      '1': {
        price: 220,
        airline: 'SU',
        flight_number: 103,
        departure_at: '2024-06-15T09:00:00Z',
        return_at: '2024-06-22T18:00:00Z',
        transfers: 0,
        duration: 210,
      },
      '2': {
        price: 185,
        airline: 'TK',
        flight_number: 301,
        departure_at: '2024-06-17T06:30:00Z',
        return_at: undefined,
        transfers: 1,
        duration: 360,
      },
    },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockFetchOk(body: unknown): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  } as Response);
}

/** Returns LATEST_FIXTURE → empty calendar → CHEAP_FIXTURE for the three search calls */
function mockFetchSearchSequence(): void {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => LATEST_FIXTURE } as Response)
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, data: {} }) } as Response)
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => CHEAP_FIXTURE } as Response);
}

function mockFetchError(status: number): void {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: 'Error',
    json: async () => ({}),
  } as Response);
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.TP_TOKEN = 'test-token-abc123';
  process.env.TP_AFFILIATE_MARKER = 'marker99';
  jest.clearAllMocks();
  // Reset cache mock so every test starts with a cache miss
  const { cache } = jest.requireMock('../../cache/redis') as {
    cache: { get: jest.Mock; set: jest.Mock };
  };
  cache.get.mockResolvedValue(null);
  cache.set.mockResolvedValue(undefined);
});

// ─── priceTrends tests ───────────────────────────────────────────────────────

describe('TravelpayoutsProvider.priceTrends', () => {
  it('returns PricePoint[] with integer priceCents and currency USD', async () => {
    mockFetchOk(MONTHLY_FIXTURE);
    const provider = new TravelpayoutsProvider();
    const result = await provider.priceTrends('MOW', 'AMS');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok');

    const points: PricePoint[] = result.data;

    expect(points).toHaveLength(3);

    // All currency fields must be 'USD'
    points.forEach((p) => expect(p.currency).toBe('USD'));

    // priceCents must be integers
    points.forEach((p) => expect(Number.isInteger(p.priceCents)).toBe(true));

    // Prices come back as USD whole dollars (currency=usd param) → ×100 for cents
    const march = points.find((p) => p.date === '2024-03-01');
    expect(march).toBeDefined();
    expect(march!.priceCents).toBe(35000); // $350 USD → 35000 cents

    const april = points.find((p) => p.date === '2024-04-01');
    expect(april!.priceCents).toBe(28000); // $280 USD → 28000 cents
  });

  it('date field matches the key from the API response', async () => {
    mockFetchOk(MONTHLY_FIXTURE);
    const provider = new TravelpayoutsProvider();
    const result = await provider.priceTrends('MOW', 'AMS');
    if (!result.ok) throw new Error(result.reason);

    const dates = result.data.map((p) => p.date);
    expect(dates).toContain('2024-03-01');
    expect(dates).toContain('2024-04-01');
    expect(dates).toContain('2024-05-01');
  });

  it('caches the result with 6-hour TTL', async () => {
    mockFetchOk(MONTHLY_FIXTURE);
    const { cache } = jest.requireMock('../../cache/redis') as {
      cache: { get: jest.Mock; set: jest.Mock };
    };

    const provider = new TravelpayoutsProvider();
    await provider.priceTrends('MOW', 'AMS');

    expect(cache.set).toHaveBeenCalledWith(
      'tp:priceTrends:MOW:AMS:monthly',
      expect.any(Array),
      21600
    );
  });

  it('returns cached data without fetching when cache hits', async () => {
    const cached: PricePoint[] = [{ date: '2024-01-01', priceCents: 5000, currency: 'USD' }];
    const { cache } = jest.requireMock('../../cache/redis') as {
      cache: { get: jest.Mock; set: jest.Mock };
    };
    cache.get.mockResolvedValue(cached);

    global.fetch = jest.fn();
    const provider = new TravelpayoutsProvider();
    const result = await provider.priceTrends('MOW', 'AMS');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual(cached);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns { ok: false, reason: ... } on HTTP error', async () => {
    mockFetchError(503);
    const provider = new TravelpayoutsProvider();
    const result = await provider.priceTrends('MOW', 'AMS');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('returns { ok: false, reason: ... } when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network failure'));
    const provider = new TravelpayoutsProvider();
    const result = await provider.priceTrends('MOW', 'AMS');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toBe('Network failure');
  });
});

// ─── searchFares tests ───────────────────────────────────────────────────────

describe('TravelpayoutsProvider.searchFares', () => {
  it('returns NormalizedFare[] with fareType cash and USD prices', async () => {
    mockFetchSearchSequence();
    const provider = new TravelpayoutsProvider();
    const result = await provider.searchFares('MOW', 'AMS', { depart: '2024-06', return: '2024-06' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    const fares: NormalizedFare[] = result.data;
    expect(fares.length).toBeGreaterThan(0);

    fares.forEach((f) => {
      expect(f.fareType).toBe('cash');
      expect(f.price.currency).toBe('USD');
      expect(Number.isInteger(f.price.priceCents)).toBe(true);
      expect(f.source).toBe('travelpayouts');
      expect(typeof f.fetchedAt).toBe('string');
    });
  });

  it('includes affiliate marker in every deeplink', async () => {
    mockFetchSearchSequence();
    const provider = new TravelpayoutsProvider();
    const result = await provider.searchFares('MOW', 'AMS', { depart: '2024-06' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    result.data.forEach((f) => {
      expect(f.deeplink).toContain('marker99');
    });
  });

  it('maps USD prices to cents correctly (no RUB conversion)', async () => {
    mockFetchSearchSequence();
    const provider = new TravelpayoutsProvider();
    const result = await provider.searchFares('MOW', 'AMS', { depart: '2024-06' });
    if (!result.ok) throw new Error(result.reason);

    // v1/cheap SU fare: $220 USD → 22000 cents
    const suFare = result.data.find((f) => f.carrier === 'SU');
    expect(suFare).toBeDefined();
    expect(suFare!.price.priceCents).toBe(22000);

    // v1/cheap TK fare: $185 USD → 18500 cents
    const tkFare = result.data.find((f) => f.carrier === 'TK');
    expect(tkFare).toBeDefined();
    expect(tkFare!.price.priceCents).toBe(18500);
  });

  it('uses stops=0 when transfers field is absent', async () => {
    const cheapFixture = {
      success: true,
      data: {
        AMS: { '1': { price: 100, airline: 'SU', departure_at: '2024-07-01T10:00:00Z' } },
      },
    };
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, data: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, data: {} }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => cheapFixture } as Response);
    const provider = new TravelpayoutsProvider();
    const result = await provider.searchFares('MOW', 'AMS', { depart: '2024-07' });
    if (!result.ok) throw new Error(result.reason);
    const suFare = result.data.find((f) => f.carrier === 'SU');
    expect(suFare).toBeDefined();
    expect(suFare!.stops).toBe(0);
  });

  it('deeplink does not include marker when TP_AFFILIATE_MARKER is unset', async () => {
    delete process.env.TP_AFFILIATE_MARKER;
    mockFetchSearchSequence();
    const provider = new TravelpayoutsProvider();
    const result = await provider.searchFares('MOW', 'AMS', { depart: '2024-06' });
    if (!result.ok) throw new Error(result.reason);

    result.data.forEach((f) => {
      expect(f.deeplink).not.toContain('marker');
    });
  });

  it('returns { ok: true, data: [] } when all HTTP calls fail', async () => {
    mockFetchError(429);
    const provider = new TravelpayoutsProvider();
    const result = await provider.searchFares('MOW', 'AMS', { depart: '2024-06' });

    // Multi-source fanout: individual provider HTTP errors → empty results, not { ok: false }
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok with empty data');
    expect(result.data).toHaveLength(0);
  });

  it('returns { ok: false, reason: ... } when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const provider = new TravelpayoutsProvider();
    const result = await provider.searchFares('MOW', 'AMS', { depart: '2024-06' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toBe('ECONNREFUSED');
  });
});
