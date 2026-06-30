import { KiwiProvider } from '../kiwi';

jest.mock('../../cache/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

beforeEach(() => {
  process.env.KIWI_KEY = 'kiwi_test_key';
  jest.clearAllMocks();
  const { cache } = jest.requireMock('../../cache/redis') as {
    cache: { get: jest.Mock; set: jest.Mock };
  };
  cache.get.mockResolvedValue(null);
  cache.set.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.KIWI_KEY;
});

describe('KiwiProvider.searchFares', () => {
  it('passes selected adults in the query string and marks price as party total', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          {
            id: 'abc123',
            flyFrom: 'JFK',
            flyTo: 'LAX',
            local_departure: '2026-09-22T08:00:00',
            local_arrival: '2026-09-22T11:30:00',
            airlines: ['B6'],
            price: 750,
            route: [{ local_arrival: '2026-09-22T11:30:00' }],
            has_stopover: false,
            transfers: [],
            deep_link: 'https://kiwi.test/deal',
          },
        ],
      }),
    } as Response);

    const provider = new KiwiProvider();
    const result = await provider.searchFares('JFK', 'LAX', {
      depart: '2026-09-22',
      passengers: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    const url = new URL((global.fetch as jest.Mock).mock.calls[0][0] as string);
    expect(url.searchParams.get('adults')).toBe('2');
    expect(result.data[0].passengerCount).toBe(2);
    expect(result.data[0].priceScope).toBe('party_total');
  });

  it('caches fares with passenger count and return date in the key', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    } as Response);
    const { cache } = jest.requireMock('../../cache/redis') as {
      cache: { set: jest.Mock };
    };

    const provider = new KiwiProvider();
    await provider.searchFares('JFK', 'LAX', {
      depart: '2026-09-22',
      return: '2026-09-29',
      passengers: 4,
    });

    expect(cache.set).toHaveBeenCalledWith(
      'kiwi:search:JFK:LAX:2026-09-22:2026-09-29:pax:4',
      expect.any(Array),
      21600
    );
  });
});
