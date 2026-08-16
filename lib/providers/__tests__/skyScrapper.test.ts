import { cache } from '../../cache/redis';
import { SkyScrapperProvider } from '../skyScrapper';

jest.mock('../../cache/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

const REAL_SHAPED_FIXTURE = {
  data: {
    itineraries: [{
      id: '12712-2609152130--32677-0-10413-2609161110',
      price: { raw: 328.5, formatted: '$329', pricingOptionId: 'Q9YXGS4GouEC' },
      legs: [
        {
          origin: { id: 'JFK', displayCode: 'JFK', city: 'New York', country: 'United States' },
          destination: { id: 'CDG', displayCode: 'CDG', city: 'Paris', country: 'France' },
          durationInMinutes: 460,
          stopCount: 0,
          departure: '2026-09-15T21:30:00',
          arrival: '2026-09-16T11:10:00',
          carriers: { marketing: [{ alternateId: 'AF', name: 'Air France' }] },
          segments: [{
            origin: { displayCode: 'JFK' },
            destination: { displayCode: 'CDG' },
            departure: '2026-09-15T21:30:00',
            arrival: '2026-09-16T11:10:00',
            flightNumber: '7',
            marketingCarrier: { alternateId: 'AF', name: 'Air France' },
          }],
        },
        {
          origin: { displayCode: 'CDG' },
          destination: { displayCode: 'JFK' },
          durationInMinutes: 720,
          stopCount: 2,
          departure: '2026-09-22T10:00:00',
          arrival: '2026-09-22T22:00:00',
          carriers: { marketing: [{ alternateId: 'AF', name: 'Air France' }] },
          segments: [],
        },
      ],
      farePolicy: { isChangeAllowed: false, isCancellationAllowed: false },
      score: 0.999,
    }],
  },
};

function mockFetch(body: unknown, status = 200): void {
  const airportResponse = (skyId: string, entityId: string) => ({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({
      status: true,
      data: [{
        navigation: {
          entityId,
          entityType: 'AIRPORT',
          relevantFlightParams: { skyId, entityId },
        },
      }],
    }),
  } as unknown as Response);
  global.fetch = jest.fn()
    .mockResolvedValueOnce(airportResponse('JFK', '95565058'))
    .mockResolvedValueOnce(airportResponse('CDG', '95565041'))
    .mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response);
}

beforeEach(() => {
  process.env.RAPIDAPI_KEY_SKYSCRAPPER = 'rapidapi-test-key';
  jest.clearAllMocks();
  (cache.get as jest.Mock).mockResolvedValue(null);
  (cache.set as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.RAPIDAPI_KEY_SKYSCRAPPER;
  delete process.env.PROVIDER_TIMEOUT_MS;
});

describe('SkyScrapperProvider', () => {
  it('maps a real-shaped round-trip response to a normalized fare', async () => {
    mockFetch(REAL_SHAPED_FIXTURE);

    const result = await new SkyScrapperProvider().searchFares('JFK', 'CDG', {
      depart: '2026-09-15',
      return: '2026-09-22',
      passengers: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: 'skyScrapper-12712-2609152130--32677-0-10413-2609161110',
      fareType: 'cash',
      origin: 'JFK',
      destination: 'CDG',
      depart: '2026-09-15T21:30:00',
      return: '2026-09-22T10:00:00',
      cabin: 'economy',
      stops: 2,
      carrier: 'AF',
      price: { priceCents: 32850, currency: 'USD' },
      passengerCount: 2,
      priceScope: 'party_total',
      source: 'skyScrapper',
      itinerary: { certainty: 'partial', durationMinutes: 460, arrive: '2026-09-16T11:10:00' },
    });
    expect(result.data[0].deeplink).toContain('provider=skyScrapper');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://sky-scrapper.p.rapidapi.com/api/v1/flights/searchFlights?'),
      expect.objectContaining({
        headers: {
          'x-rapidapi-key': 'rapidapi-test-key',
          'x-rapidapi-host': 'sky-scrapper.p.rapidapi.com',
        },
        signal: expect.any(AbortSignal),
      }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('originEntityId=95565058'),
      expect.any(Object),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('destinationEntityId=95565041'),
      expect.any(Object),
    );
    expect(cache.set).toHaveBeenCalledWith(
      'skyscrapper:search:origin:JFK:dest:CDG:depart:2026-09-15:return:2026-09-22:pax:2:cabin:economy',
      result.data,
      21600,
    );
  });

  it('returns and caches an empty result set', async () => {
    mockFetch({ data: { itineraries: [] } });

    const result = await new SkyScrapperProvider().searchFares('JFK', 'LAX', {
      depart: '2026-09-15',
      passengers: 1,
    });

    expect(result).toEqual({ ok: true, data: [] });
    expect(cache.set).toHaveBeenCalledWith(expect.any(String), [], 21600);
  });

  it('returns a Result error and writes diagnostics for an HTTP error', async () => {
    mockFetch({}, 429);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await new SkyScrapperProvider().searchFares('JFK', 'LAX', {
      depart: '2026-09-15',
      passengers: 1,
    });

    expect(result).toEqual({ ok: false, reason: 'SkyScrapper HTTP error 429' });
    expect(cache.set).toHaveBeenCalledWith(
      'debug:skyscrapper:last_error',
      expect.objectContaining({ kind: 'http_error', status: 429 }),
      300,
    );
    errorSpy.mockRestore();
  });

  it('rejects a malformed top-level response', async () => {
    mockFetch({ data: { results: [] } });

    const result = await new SkyScrapperProvider().searchFares('JFK', 'LAX', {
      depart: '2026-09-15',
      passengers: 1,
    });

    expect(result).toEqual({
      ok: false,
      reason: 'SkyScrapper response failed schema validation',
    });
    expect(cache.set).not.toHaveBeenCalledWith(expect.any(String), expect.anything(), 21600);
  });

  it('returns an error without caching when validation discards every raw itinerary', async () => {
    mockFetch({
      data: {
        itineraries: [
          { id: 'missing-price', legs: REAL_SHAPED_FIXTURE.data.itineraries[0].legs },
          { id: 'missing-legs', price: { raw: 100 } },
        ],
      },
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await new SkyScrapperProvider().searchFares('JFK', 'LAX', {
      depart: '2026-09-15',
      passengers: 1,
    });

    expect(result).toEqual({
      ok: false,
      reason: 'SkyScrapper parsing validation discarded all results',
    });
    expect(errorSpy).toHaveBeenCalledWith(
      '[SkyScrapper] Parsing validation discarded all results',
      { rawCount: 2 },
    );
    expect(cache.set).not.toHaveBeenCalledWith(expect.any(String), expect.anything(), 21600);
    errorSpy.mockRestore();
  });

  it.each([
    ['price', { id: 'missing-price', legs: REAL_SHAPED_FIXTURE.data.itineraries[0].legs }],
    ['legs', { id: 'missing-legs', price: { raw: 100 } }],
  ])('returns an error when an itinerary has missing %s fields', async (_field, itinerary) => {
    mockFetch({ data: { itineraries: [itinerary] } });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await new SkyScrapperProvider().searchFares('JFK', 'LAX', {
      depart: '2026-09-15',
      passengers: 1,
    });

    expect(result).toEqual({
      ok: false,
      reason: 'SkyScrapper parsing validation discarded all results',
    });
    expect(cache.set).not.toHaveBeenCalledWith(expect.any(String), expect.anything(), 21600);
    errorSpy.mockRestore();
  });

  it('returns a Result error without searching when one entity id cannot be resolved', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ status: true, data: [] }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          status: true,
          data: [{
            navigation: {
              entityType: 'AIRPORT',
              relevantFlightParams: { skyId: 'LAX', entityId: '95565047' },
            },
          }],
        }),
      } as unknown as Response);

    const result = await new SkyScrapperProvider().searchFares('XXX', 'LAX', {
      depart: '2026-09-15',
      passengers: 1,
    });

    expect(result).toEqual({
      ok: false,
      reason: 'SkyScrapper could not resolve airport entity id for XXX',
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/flights/searchFlights?'),
      expect.anything(),
    );
  });
});
