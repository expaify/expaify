/**
 * Duffel provider unit tests — recorded fixtures, no live network.
 *
 * Both the `cache` module and global `fetch` are mocked so no Redis or HTTP
 * connections are needed.
 */

import { DuffelProvider } from '../duffel';
import type { NormalizedFare } from '../../types';

// ─── Mock the Redis cache so every get() misses (forces a fetch) ─────────────

jest.mock('../../cache/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Recorded-style response from POST /air/offer_requests — one-way itinerary */
const ONE_WAY_FIXTURE = {
  data: {
    id: 'orq_0000A5KFKQ7gkAhP09IjdmA',
    offers: [
      {
        id: 'off_0000A5KFKQaBC123',
        owner: { iata_code: 'AA' },
        total_amount: '450.00',
        total_currency: 'USD',
        slices: [
          {
            origin: { iata_code: 'JFK' },
            destination: { iata_code: 'LAX' },
            departing_at: '2026-09-22T08:00:00Z',
            arriving_at: '2026-09-22T11:30:00Z',
            segments: [
              { id: 'seg_001' }, // 1 segment → 0 stops
            ],
          },
        ],
      },
      {
        id: 'off_0000A5KFKQaBC456',
        owner: { iata_code: 'DL' },
        total_amount: '389.50',
        total_currency: 'USD',
        slices: [
          {
            origin: { iata_code: 'JFK' },
            destination: { iata_code: 'LAX' },
            departing_at: '2026-09-22T14:00:00Z',
            arriving_at: '2026-09-22T20:15:00Z',
            segments: [
              { id: 'seg_002' },
              { id: 'seg_003' }, // 2 segments → 1 stop
            ],
          },
        ],
      },
    ],
  },
};

/** Round-trip fixture — two slices per offer */
const ROUND_TRIP_FIXTURE = {
  data: {
    id: 'orq_roundtrip_001',
    offers: [
      {
        id: 'off_roundtrip_001',
        owner: { iata_code: 'UA' },
        total_amount: '820.00',
        total_currency: 'USD',
        slices: [
          {
            origin: { iata_code: 'SFO' },
            destination: { iata_code: 'ORD' },
            departing_at: '2026-10-01T07:00:00Z',
            arriving_at: '2026-10-01T13:00:00Z',
            segments: [{ id: 'seg_out_1' }],
          },
          {
            origin: { iata_code: 'ORD' },
            destination: { iata_code: 'SFO' },
            departing_at: '2026-10-08T15:00:00Z',
            arriving_at: '2026-10-08T18:00:00Z',
            segments: [{ id: 'seg_ret_1' }],
          },
        ],
      },
    ],
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
  process.env.DUFFEL_KEY = 'duffel_test_abc123';
  jest.clearAllMocks();
  // Reset cache mock so every test starts with a cache miss
  const { cache } = jest.requireMock('../../cache/redis') as {
    cache: { get: jest.Mock; set: jest.Mock };
  };
  cache.get.mockResolvedValue(null);
  cache.set.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.DUFFEL_KEY;
});

// ─── priceTrends tests ───────────────────────────────────────────────────────

describe('DuffelProvider.priceTrends', () => {
  it('returns { ok: true, data: [] } — Duffel has no trend data', async () => {
    const provider = new DuffelProvider();
    const result = await provider.priceTrends('JFK', 'LAX');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
  });

  it('does not call fetch', async () => {
    global.fetch = jest.fn();
    const provider = new DuffelProvider();
    await provider.priceTrends('JFK', 'LAX');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ─── searchFares — guard clause tests ────────────────────────────────────────

describe('DuffelProvider.searchFares guard clauses', () => {
  it('returns { ok: true, data: [] } when dest is empty string', async () => {
    global.fetch = jest.fn();
    const provider = new DuffelProvider();
    const result = await provider.searchFares('JFK', '', { depart: '2026-09-22', passengers: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns { ok: false, reason: "Duffel not configured" } when DUFFEL_KEY is unset', async () => {
    delete process.env.DUFFEL_KEY;
    global.fetch = jest.fn();
    const provider = new DuffelProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toBe('Duffel not configured');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ─── searchFares — success path ───────────────────────────────────────────────

describe('DuffelProvider.searchFares success', () => {
  it('returns NormalizedFare[] with correct shape for each offer', async () => {
    mockFetchOk(ONE_WAY_FIXTURE);
    const provider = new DuffelProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    const fares: NormalizedFare[] = result.data;
    expect(fares).toHaveLength(2);

    fares.forEach((f) => {
      expect(f.fareType).toBe('cash');
      expect(f.origin).toBe('JFK');
      expect(f.destination).toBe('LAX');
      expect(f.source).toBe('duffel');
      expect(typeof f.fetchedAt).toBe('string');
      expect(f.deeplink).toMatch(/^\/book\?offerId=/);
      expect(Number.isInteger(f.price.priceCents)).toBe(true);
    });
  });

  it('maps offer id to fare id', async () => {
    mockFetchOk(ONE_WAY_FIXTURE);
    const provider = new DuffelProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });
    if (!result.ok) throw new Error(result.reason);

    expect(result.data[0].id).toBe('off_0000A5KFKQaBC123');
    expect(result.data[1].id).toBe('off_0000A5KFKQaBC456');
  });

  it('maps owner.iata_code to carrier', async () => {
    mockFetchOk(ONE_WAY_FIXTURE);
    const provider = new DuffelProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });
    if (!result.ok) throw new Error(result.reason);

    expect(result.data[0].carrier).toBe('AA');
    expect(result.data[1].carrier).toBe('DL');
  });

  it('converts total_amount string to integer priceCents correctly', async () => {
    mockFetchOk(ONE_WAY_FIXTURE);
    const provider = new DuffelProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });
    if (!result.ok) throw new Error(result.reason);

    // "450.00" → 45000 cents
    expect(result.data[0].price.priceCents).toBe(45000);
    expect(result.data[0].price.currency).toBe('USD');

    // "389.50" → 38950 cents
    expect(result.data[1].price.priceCents).toBe(38950);
  });

  it('priceCents is always an integer (no floating-point)', async () => {
    mockFetchOk(ONE_WAY_FIXTURE);
    const provider = new DuffelProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });
    if (!result.ok) throw new Error(result.reason);

    result.data.forEach((f) => {
      expect(Number.isInteger(f.price.priceCents)).toBe(true);
    });
  });

  it('counts stops as segments.length - 1 per slice', async () => {
    mockFetchOk(ONE_WAY_FIXTURE);
    const provider = new DuffelProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });
    if (!result.ok) throw new Error(result.reason);

    // First offer: 1 segment → 0 stops
    expect(result.data[0].stops).toBe(0);
    // Second offer: 2 segments → 1 stop
    expect(result.data[1].stops).toBe(1);
  });

  it('sets depart from first slice departing_at', async () => {
    mockFetchOk(ONE_WAY_FIXTURE);
    const provider = new DuffelProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });
    if (!result.ok) throw new Error(result.reason);

    expect(result.data[0].depart).toBe('2026-09-22T08:00:00Z');
  });

  it('does not set return field for one-way itineraries', async () => {
    mockFetchOk(ONE_WAY_FIXTURE);
    const provider = new DuffelProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });
    if (!result.ok) throw new Error(result.reason);

    result.data.forEach((f) => {
      expect(f.return).toBeUndefined();
    });
  });

  it('sets return field from last slice arriving_at for round-trip itineraries', async () => {
    mockFetchOk(ROUND_TRIP_FIXTURE);
    const provider = new DuffelProvider();
    const result = await provider.searchFares('SFO', 'ORD', {
      depart: '2026-10-01',
      return: '2026-10-08',
      passengers: 1,
    });
    if (!result.ok) throw new Error(result.reason);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].return).toBe('2026-10-08T18:00:00Z');
  });

  it('builds deeplink with fare context for the booking page', async () => {
    mockFetchOk(ONE_WAY_FIXTURE);
    const provider = new DuffelProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });
    if (!result.ok) throw new Error(result.reason);

    const url = new URL(result.data[0].deeplink, 'https://expaify.test');
    expect(url.pathname).toBe('/book');
    expect(url.searchParams.get('offerId')).toBe('off_0000A5KFKQaBC123');
    expect(url.searchParams.get('provider')).toBe('duffel');
    expect(url.searchParams.get('origin')).toBe('JFK');
    expect(url.searchParams.get('destination')).toBe('LAX');
    expect(url.searchParams.get('carrier')).toBe('AA');
    expect(url.searchParams.get('stops')).toBe('0');
    expect(url.searchParams.get('priceCents')).toBe('45000');
    expect(url.searchParams.get('currency')).toBe('USD');
    expect(url.searchParams.get('depart')).toBe('2026-09-22T08:00:00Z');
    expect(url.searchParams.get('passengerCount')).toBe('1');
    expect(url.searchParams.get('priceScope')).toBe('party_total');
  });

  it('caches the result with passenger count and 6-hour TTL', async () => {
    mockFetchOk(ONE_WAY_FIXTURE);
    const { cache } = jest.requireMock('../../cache/redis') as {
      cache: { get: jest.Mock; set: jest.Mock };
    };

    const provider = new DuffelProvider();
    await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });

    expect(cache.set).toHaveBeenCalledWith(
      'duffel:search:origin:JFK:dest:LAX:depart:2026-09-22:trip:one-way:pax:1:cabin:economy',
      expect.any(Array),
      21600
    );
  });

  it('uses distinct cache keys for one-way and round-trip searches', async () => {
    mockFetchOk(ONE_WAY_FIXTURE);
    const { cache } = jest.requireMock('../../cache/redis') as {
      cache: { get: jest.Mock; set: jest.Mock };
    };

    const provider = new DuffelProvider();
    await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });

    mockFetchOk(ROUND_TRIP_FIXTURE);
    await provider.searchFares('JFK', 'LAX', {
      depart: '2026-09-22',
      return: '2026-09-29',
      passengers: 1,
    });

    expect(cache.get).toHaveBeenNthCalledWith(
      1,
      'duffel:search:origin:JFK:dest:LAX:depart:2026-09-22:trip:one-way:pax:1:cabin:economy'
    );
    expect(cache.get).toHaveBeenNthCalledWith(
      2,
      'duffel:search:origin:JFK:dest:LAX:depart:2026-09-22:return:2026-09-29:pax:1:cabin:economy'
    );
  });

  it('uses distinct cache keys for different passenger counts', async () => {
    mockFetchOk(ONE_WAY_FIXTURE);
    const { cache } = jest.requireMock('../../cache/redis') as {
      cache: { get: jest.Mock; set: jest.Mock };
    };

    const provider = new DuffelProvider();
    await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });
    await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 2 });

    expect(cache.get).toHaveBeenNthCalledWith(
      1,
      'duffel:search:origin:JFK:dest:LAX:depart:2026-09-22:trip:one-way:pax:1:cabin:economy'
    );
    expect(cache.get).toHaveBeenNthCalledWith(
      2,
      'duffel:search:origin:JFK:dest:LAX:depart:2026-09-22:trip:one-way:pax:2:cabin:economy'
    );
  });

  it('requests the selected adult passenger count and marks price as party total', async () => {
    mockFetchOk(ONE_WAY_FIXTURE);
    const provider = new DuffelProvider();
    const result = await provider.searchFares('JFK', 'LAX', {
      depart: '2026-09-22',
      passengers: 3,
    });
    if (!result.ok) throw new Error(result.reason);

    const call = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(call[1].body as string) as {
      data: { passengers: Array<{ type: string }> };
    };

    expect(body.data.passengers).toEqual([
      { type: 'adult' },
      { type: 'adult' },
      { type: 'adult' },
    ]);
    expect(result.data[0].passengerCount).toBe(3);
    expect(result.data[0].priceScope).toBe('party_total');
    expect(result.data[0].deeplink).toContain('passengerCount=3');
  });

  it('returns cached data without fetching when cache hits', async () => {
    const cachedFares: NormalizedFare[] = [
      {
        id: 'cached-fare-1',
        fareType: 'cash',
        origin: 'JFK',
        destination: 'LAX',
        depart: '2026-09-22T08:00:00Z',
        stops: 0,
        carrier: 'AA',
        price: { priceCents: 45000, currency: 'USD' },
        deeplink: 'https://app.duffel.com/offers/cached-fare-1',
        source: 'duffel',
        fetchedAt: '2026-06-29T00:00:00.000Z',
      },
    ];

    const { cache } = jest.requireMock('../../cache/redis') as {
      cache: { get: jest.Mock; set: jest.Mock };
    };
    cache.get.mockResolvedValue(cachedFares);

    global.fetch = jest.fn();
    const provider = new DuffelProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual(cachedFares);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends correct Authorization and Duffel-Version headers', async () => {
    mockFetchOk(ONE_WAY_FIXTURE);
    const provider = new DuffelProvider();
    await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.duffel.com/air/offer_requests',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer duffel_test_abc123',
          'Duffel-Version': 'v2',
          'Content-Type': 'application/json',
        }),
      })
    );
  });
});

// ─── searchFares — error handling ─────────────────────────────────────────────

describe('DuffelProvider.searchFares error handling', () => {
  it('returns { ok: false, reason } on HTTP 4xx/5xx', async () => {
    mockFetchError(422);
    const provider = new DuffelProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toMatch(/422/);
  });

  it('returns { ok: false, reason } when fetch throws a network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const provider = new DuffelProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toBe('ECONNREFUSED');
  });

  it('never throws — always returns a Result', async () => {
    global.fetch = jest.fn().mockRejectedValue('non-Error thrown value');
    const provider = new DuffelProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(typeof result.reason).toBe('string');
  });
});
