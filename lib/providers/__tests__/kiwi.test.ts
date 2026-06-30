import { KiwiProvider, kiwi } from '../kiwi';

jest.mock('../../cache/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

function approvedProvider(): KiwiProvider {
  return new KiwiProvider({
    approved: true,
    apiKey: 'kiwi_test_key',
    deeplinkAttributionParam: 'affilid',
    deeplinkAttributionValue: 'expaify_test',
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.KIWI_KEY;

  const { cache } = jest.requireMock('../../cache/redis') as {
    cache: { get: jest.Mock; set: jest.Mock };
  };
  cache.get.mockResolvedValue(null);
  cache.set.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.KIWI_KEY;
});

describe('KiwiProvider.searchFares guard clauses', () => {
  it('returns { ok: true, data: [] } when dest is empty string', async () => {
    global.fetch = jest.fn();
    const result = await approvedProvider().searchFares('JFK', '', {
      depart: '2026-09-22',
      passengers: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps the shared Kiwi singleton inactive without approved config', async () => {
    global.fetch = jest.fn();
    const result = await kiwi.searchFares('JFK', 'LAX', {
      depart: '2026-09-22',
      passengers: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toBe('Kiwi not approved');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('ignores legacy KIWI_KEY and does not make a live API call', async () => {
    process.env.KIWI_KEY = 'legacy_non_contract_key';
    global.fetch = jest.fn();

    const provider = new KiwiProvider();
    const result = await provider.searchFares('JFK', 'LAX', {
      depart: '2026-09-22',
      passengers: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toBe('Kiwi not approved');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns a Result failure when approved config is missing an API key', async () => {
    global.fetch = jest.fn();

    const provider = new KiwiProvider({
      approved: true,
      deeplinkAttributionParam: 'affilid',
      deeplinkAttributionValue: 'expaify_test',
    });
    const result = await provider.searchFares('JFK', 'LAX', {
      depart: '2026-09-22',
      passengers: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toBe('Kiwi not configured');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('requires deeplink attribution before calling Kiwi', async () => {
    global.fetch = jest.fn();

    const provider = new KiwiProvider({
      approved: true,
      apiKey: 'kiwi_test_key',
    });
    const result = await provider.searchFares('JFK', 'LAX', {
      depart: '2026-09-22',
      passengers: 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toBe('Kiwi affiliate attribution not configured');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('KiwiProvider.searchFares active config', () => {
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
            deep_link: 'https://kiwi.test/deal?existing=1',
          },
        ],
      }),
    } as Response);

    const result = await approvedProvider().searchFares('JFK', 'LAX', {
      depart: '2026-09-22',
      passengers: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    const url = new URL((global.fetch as jest.Mock).mock.calls[0][0] as string);
    expect(url.searchParams.get('adults')).toBe('2');
    expect(result.data[0].passengerCount).toBe(2);
    expect(result.data[0].priceScope).toBe('party_total');
    expect(result.data[0].price).toEqual({ priceCents: 75000, currency: 'USD' });

    const deeplink = new URL(result.data[0].deeplink);
    expect(deeplink.searchParams.get('existing')).toBe('1');
    expect(deeplink.searchParams.get('affilid')).toBe('expaify_test');
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

    await approvedProvider().searchFares('JFK', 'LAX', {
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

  it('sends the approved config API key to Kiwi only after config validation passes', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    } as Response);

    await approvedProvider().searchFares('JFK', 'LAX', {
      depart: '2026-09-22',
      passengers: 1,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api.tequila.kiwi.com/v2/search'),
      expect.objectContaining({
        headers: { apikey: 'kiwi_test_key' },
      })
    );
  });
});
