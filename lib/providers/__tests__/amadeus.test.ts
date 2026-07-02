/**
 * Amadeus provider unit tests — recorded-style fixtures, no live network.
 *
 * Both the `cache` module and global `fetch` are mocked so no Redis or HTTP
 * connections are needed.
 */

import { AmadeusProvider } from '../amadeus';
import type { NormalizedFare } from '../../types';

jest.mock('../../cache/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

const TOKEN_FIXTURE = {
  access_token: 'amadeus_access_token_123',
  expires_in: 1799,
};

const ONE_WAY_FIXTURE = {
  data: [
    {
      id: '1',
      validatingAirlineCodes: ['AA'],
      itineraries: [
        {
          segments: [
            {
              departure: { iataCode: 'JFK', at: '2026-09-22T08:00:00' },
              arrival: { iataCode: 'LAX', at: '2026-09-22T11:30:00' },
              carrierCode: 'AA',
              numberOfStops: 0,
            },
          ],
        },
      ],
      price: { grandTotal: '389.50', currency: 'USD' },
    },
    {
      id: '2',
      validatingAirlineCodes: ['DL'],
      itineraries: [
        {
          segments: [
            {
              departure: { iataCode: 'JFK', at: '2026-09-22T14:00:00' },
              arrival: { iataCode: 'ATL', at: '2026-09-22T16:30:00' },
              carrierCode: 'DL',
              numberOfStops: 0,
            },
            {
              departure: { iataCode: 'ATL', at: '2026-09-22T18:00:00' },
              arrival: { iataCode: 'LAX', at: '2026-09-22T20:15:00' },
              carrierCode: 'DL',
              numberOfStops: 0,
            },
          ],
        },
      ],
      price: { grandTotal: '402.00', currency: 'USD' },
    },
  ],
};

const ROUND_TRIP_FIXTURE = {
  data: [
    {
      id: 'rt1',
      validatingAirlineCodes: ['UA'],
      itineraries: [
        {
          segments: [
            {
              departure: { iataCode: 'SFO', at: '2026-10-01T07:00:00' },
              arrival: { iataCode: 'ORD', at: '2026-10-01T13:00:00' },
              carrierCode: 'UA',
              numberOfStops: 0,
            },
          ],
        },
        {
          segments: [
            {
              departure: { iataCode: 'ORD', at: '2026-10-08T15:00:00' },
              arrival: { iataCode: 'SFO', at: '2026-10-08T18:00:00' },
              carrierCode: 'UA',
              numberOfStops: 0,
            },
          ],
        },
      ],
      price: { grandTotal: '820.05', currency: 'USD' },
    },
  ],
};

function mockFetchTokenAndOffers(offers: unknown): void {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => TOKEN_FIXTURE } as Response)
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => offers } as Response);
}

beforeEach(() => {
  process.env.AMADEUS_ID = 'amadeus_id';
  process.env.AMADEUS_SECRET = 'amadeus_secret';
  jest.clearAllMocks();

  const { cache } = jest.requireMock('../../cache/redis') as {
    cache: { get: jest.Mock; set: jest.Mock };
  };
  cache.get.mockResolvedValue(null);
  cache.set.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.AMADEUS_ID;
  delete process.env.AMADEUS_SECRET;
  delete process.env.AMADEUS_CLIENT_ID;
  delete process.env.AMADEUS_CLIENT_SECRET;
});

describe('AmadeusProvider.priceTrends', () => {
  it('returns { ok: true, data: [] } because Amadeus has no trend data', async () => {
    const provider = new AmadeusProvider();
    const result = await provider.priceTrends('JFK', 'LAX');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
  });
});

describe('AmadeusProvider.searchFares guard clauses', () => {
  it('returns { ok: true, data: [] } when dest is empty string', async () => {
    global.fetch = jest.fn();
    const provider = new AmadeusProvider();
    const result = await provider.searchFares('JFK', '', { depart: '2026-09-22', passengers: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns { ok: false, reason } when credentials are unset', async () => {
    delete process.env.AMADEUS_ID;
    delete process.env.AMADEUS_SECRET;
    delete process.env.AMADEUS_CLIENT_ID;
    delete process.env.AMADEUS_CLIENT_SECRET;
    global.fetch = jest.fn();
    const provider = new AmadeusProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toBe('Amadeus not configured');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('AmadeusProvider.searchFares success', () => {
  it('fetches an OAuth token, posts flight-offers request, and maps fares', async () => {
    mockFetchTokenAndOffers(ONE_WAY_FIXTURE);
    const provider = new AmadeusProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    const fares: NormalizedFare[] = result.data;
    expect(fares).toHaveLength(2);
    expect(fares[0]).toMatchObject({
      id: 'amadeus-1',
      fareType: 'cash',
      origin: 'JFK',
      destination: 'LAX',
      depart: '2026-09-22T08:00:00',
      stops: 0,
      carrier: 'AA',
      price: { priceCents: 38950, currency: 'USD' },
      source: 'amadeus',
    });
    expect(fares[1].stops).toBe(1);
    fares.forEach((fare) => expect(Number.isInteger(fare.price.priceCents)).toBe(true));
    fares.forEach((fare) => expect(fare.deeplink).toBe(''));
  });

  it('keeps offsetless local itinerary timing partial', async () => {
    mockFetchTokenAndOffers(ONE_WAY_FIXTURE);
    const provider = new AmadeusProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });
    if (!result.ok) throw new Error(result.reason);

    expect(result.data[0].itinerary).toMatchObject({
      certainty: 'partial',
      arrive: '2026-09-22T11:30:00',
    });
    expect(result.data[1].itinerary).toMatchObject({
      certainty: 'partial',
      arrive: '2026-09-22T20:15:00',
    });
    expect(result.data[1].itinerary?.layovers).toBeUndefined();
  });

  it('does not claim confirmed layovers for round-trip aggregate fare cards', async () => {
    mockFetchTokenAndOffers(ROUND_TRIP_FIXTURE);
    const provider = new AmadeusProvider();
    const result = await provider.searchFares('SFO', 'ORD', {
      depart: '2026-10-01',
      return: '2026-10-08',
      passengers: 1,
    });
    if (!result.ok) throw new Error(result.reason);

    expect(result.data[0].itinerary).toMatchObject({
      certainty: 'partial',
      arrive: '2026-10-01T13:00:00',
    });
  });

  it('sets return from the final return itinerary segment for round trips', async () => {
    mockFetchTokenAndOffers(ROUND_TRIP_FIXTURE);
    const provider = new AmadeusProvider();
    const result = await provider.searchFares('SFO', 'ORD', {
      depart: '2026-10-01',
      return: '2026-10-08',
      passengers: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data[0].return).toBe('2026-10-08T18:00:00');
    expect(result.data[0].price.priceCents).toBe(82005);
  });

  it('uses AMADEUS_ID and AMADEUS_SECRET for form-encoded token credentials', async () => {
    mockFetchTokenAndOffers(ONE_WAY_FIXTURE);
    const provider = new AmadeusProvider();
    await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://test.api.amadeus.com/v1/security/oauth2/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials&client_id=amadeus_id&client_secret=amadeus_secret',
      })
    );
  });

  it('falls back to legacy AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET when primary names are unset', async () => {
    delete process.env.AMADEUS_ID;
    delete process.env.AMADEUS_SECRET;
    process.env.AMADEUS_CLIENT_ID = 'legacy_client_id';
    process.env.AMADEUS_CLIENT_SECRET = 'legacy_client_secret';

    mockFetchTokenAndOffers(ONE_WAY_FIXTURE);
    const provider = new AmadeusProvider();
    await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://test.api.amadeus.com/v1/security/oauth2/token',
      expect.objectContaining({
        body: 'grant_type=client_credentials&client_id=legacy_client_id&client_secret=legacy_client_secret',
      })
    );
  });

  it('posts to /v2/shopping/flight-offers with request body and bearer token', async () => {
    mockFetchTokenAndOffers(ROUND_TRIP_FIXTURE);
    const provider = new AmadeusProvider();
    await provider.searchFares('SFO', 'ORD', {
      depart: '2026-10-01',
      return: '2026-10-08',
      passengers: 1,
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'https://test.api.amadeus.com/v2/shopping/flight-offers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer amadeus_access_token_123',
          'Content-Type': 'application/json',
        }),
      })
    );

    const call = (global.fetch as jest.Mock).mock.calls[1];
    const body = JSON.parse(call[1].body as string) as {
      originDestinations: Array<{ originLocationCode: string; destinationLocationCode: string }>;
      travelers: Array<{ id: string; travelerType: string }>;
      searchCriteria: { maxFlightOffers: number };
    };

    expect(body.originDestinations).toHaveLength(2);
    expect(body.originDestinations[0]).toMatchObject({
      originLocationCode: 'SFO',
      destinationLocationCode: 'ORD',
    });
    expect(body.originDestinations[1]).toMatchObject({
      originLocationCode: 'ORD',
      destinationLocationCode: 'SFO',
    });
    expect(body.travelers).toEqual([{ id: '1', travelerType: 'ADULT' }]);
    expect(body.searchCriteria.maxFlightOffers).toBe(20);
  });

  it('caches the token and fares with expected TTLs', async () => {
    mockFetchTokenAndOffers(ONE_WAY_FIXTURE);
    const { cache } = jest.requireMock('../../cache/redis') as {
      cache: { get: jest.Mock; set: jest.Mock };
    };

    const provider = new AmadeusProvider();
    await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });

    expect(cache.set).toHaveBeenCalledWith('amadeus:token', 'amadeus_access_token_123', 1739);
    expect(cache.set).toHaveBeenCalledWith(
      'amadeus:search:JFK:LAX:2026-09-22::pax:1',
      expect.any(Array),
      21600
    );
  });

  it('returns cached fares without fetching', async () => {
    const cached: NormalizedFare[] = [
      {
        id: 'amadeus-cached',
        fareType: 'cash',
        origin: 'JFK',
        destination: 'LAX',
        depart: '2026-09-22T08:00:00',
        stops: 0,
        carrier: 'AA',
        price: { priceCents: 38950, currency: 'USD' },
        deeplink: 'https://www.amadeus.com/en/search?from=JFK&to=LAX&departure=2026-09-22T08%3A00%3A00',
        source: 'amadeus',
        fetchedAt: '2026-06-29T00:00:00.000Z',
      },
    ];
    const { cache } = jest.requireMock('../../cache/redis') as {
      cache: { get: jest.Mock; set: jest.Mock };
    };
    cache.get.mockResolvedValue(cached);
    global.fetch = jest.fn();

    const provider = new AmadeusProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual(cached);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('AmadeusProvider.searchFares error handling', () => {
  it('returns { ok: false, reason } when token fetch fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);

    const provider = new AmadeusProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toBe('Amadeus token fetch HTTP 401');
  });

  it('returns { ok: false, reason } when flight-offers fails', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => TOKEN_FIXTURE } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as Response);

    const provider = new AmadeusProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toBe('Amadeus /shopping/flight-offers HTTP 500');
  });

  it('never throws when fetch rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network failure'));

    const provider = new AmadeusProvider();
    const result = await provider.searchFares('JFK', 'LAX', { depart: '2026-09-22', passengers: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toBe('Network failure');
  });
});
