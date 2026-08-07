/**
 * GoogleFlights provider unit tests — recorded fixtures, no live network.
 *
 * Both the `cache` module and global `fetch` are mocked so no Redis or HTTP
 * connections are needed. The success-path fixture below is trimmed from a
 * real recorded `google-flights2` RapidAPI response (LAX -> JFK,
 * 2026-09-10), saved in full at `gflights_sample_response.json` in the repo
 * root.
 */

import { GoogleFlightsProvider } from '../googleFlights';
import type { NormalizedFare } from '../../types';

// ─── Mock the Redis cache so every get() misses (forces a fetch) ─────────────

jest.mock('../../cache/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Recorded-style response from GET /api/v1/searchFlights — real shape */
const SEARCH_FIXTURE = {
  status: true,
  message: 'Success',
  timestamp: 1754500000000,
  data: {
    itineraries: {
      topFlights: [
        {
          departure_time: '10-09-2026 01:55 PM',
          arrival_time: '10-09-2026 10:29 PM',
          duration: { raw: 334, text: '5 hr 34 min' },
          flights: [
            {
              departure_airport: {
                airport_name: 'Los Angeles International Airport',
                airport_code: 'LAX',
                time: '2026-9-10 13:55',
              },
              arrival_airport: {
                airport_name: 'John F. Kennedy International Airport',
                airport_code: 'JFK',
                time: '2026-9-10 22:29',
              },
              duration: { raw: 334, text: '5 hr 34 min' },
              airline: 'JetBlue',
              flight_number: 'B6 624',
              aircraft: 'Airbus A320',
            },
          ],
          layovers: null,
          price: 209,
          stops: 0,
          booking_token: 'W1syLDEsWyIxIiwwLDAsMF0',
        },
      ],
      otherFlights: [
        {
          departure_time: '10-09-2026 08:00 AM',
          arrival_time: '10-09-2026 04:34 PM',
          duration: { raw: 334, text: '5 hr 34 min' },
          flights: [
            {
              departure_airport: { airport_code: 'LAX', time: '2026-9-10 08:00' },
              arrival_airport: { airport_code: 'JFK', time: '2026-9-10 16:34' },
              airline: 'Delta',
              flight_number: 'DL 100',
              aircraft: 'Boeing 737',
            },
          ],
          layovers: null,
          price: 244.5,
          stops: 0,
          booking_token: 'W1syLDIsWyIxIiwwLDAsMF0',
        },
      ],
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
  process.env.RAPIDAPI_KEY_GOOGLE_FLIGHTS = 'gflights_test_abc123';
  jest.clearAllMocks();
  const { cache } = jest.requireMock('../../cache/redis') as {
    cache: { get: jest.Mock; set: jest.Mock };
  };
  cache.get.mockResolvedValue(null);
  cache.set.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.RAPIDAPI_KEY_GOOGLE_FLIGHTS;
  delete process.env.PROVIDER_TIMEOUT_MS;
});

// ─── priceTrends ───────────────────────────────────────────────────────────

describe('GoogleFlightsProvider.priceTrends', () => {
  it('returns { ok: true, data: [] } — this API has no trend data', async () => {
    const provider = new GoogleFlightsProvider();
    const result = await provider.priceTrends('JFK', 'LAX');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
  });

  it('does not call fetch', async () => {
    global.fetch = jest.fn();
    const provider = new GoogleFlightsProvider();
    await provider.priceTrends('JFK', 'LAX');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ─── searchFares — guard clauses ─────────────────────────────────────────────

describe('GoogleFlightsProvider.searchFares guard clauses', () => {
  it('returns { ok: true, data: [] } when dest is empty string', async () => {
    global.fetch = jest.fn();
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', '', { depart: '2026-09-10', passengers: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns { ok: true, data: [] } when depart is not YYYY-MM-DD', async () => {
    global.fetch = jest.fn();
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: 'not-a-date', passengers: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('silently skips (returns { ok: false, reason: "GoogleFlights not configured" }) when the RapidAPI key is unset, without calling fetch', async () => {
    delete process.env.RAPIDAPI_KEY_GOOGLE_FLIGHTS;
    global.fetch = jest.fn();
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toBe('GoogleFlights not configured');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ─── searchFares — success path ──────────────────────────────────────────────

describe('GoogleFlightsProvider.searchFares success', () => {
  it('returns NormalizedFare[] with correct shape for topFlights + otherFlights combined', async () => {
    mockFetchOk(SEARCH_FIXTURE);
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    const fares: NormalizedFare[] = result.data;
    expect(fares).toHaveLength(2);

    fares.forEach((f) => {
      expect(f.fareType).toBe('cash');
      expect(f.origin).toBe('LAX');
      expect(f.destination).toBe('JFK');
      expect(f.source).toBe('googleFlights');
      expect(typeof f.fetchedAt).toBe('string');
      expect(Number.isInteger(f.price.priceCents)).toBe(true);
      expect(f.price.currency).toBe('USD');
    });
  });

  it('converts the bare USD price number to exact integer priceCents (209 -> 20900)', async () => {
    mockFetchOk(SEARCH_FIXTURE);
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });
    if (!result.ok) throw new Error(result.reason);

    expect(result.data[0].price).toEqual({ priceCents: 20900, currency: 'USD' });
  });

  it('converts a fractional-dollar price to exact integer priceCents (244.5 -> 24450)', async () => {
    mockFetchOk(SEARCH_FIXTURE);
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });
    if (!result.ok) throw new Error(result.reason);

    expect(result.data[1].price).toEqual({ priceCents: 24450, currency: 'USD' });
  });

  it('parses "DD-MM-YYYY hh:mm AM/PM" departure_time into an ISO-shaped depart string', async () => {
    mockFetchOk(SEARCH_FIXTURE);
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });
    if (!result.ok) throw new Error(result.reason);

    // "10-09-2026 01:55 PM" -> 2026-09-10T13:55:00
    expect(result.data[0].depart).toBe('2026-09-10T13:55:00');
    // "10-09-2026 08:00 AM" -> 2026-09-10T08:00:00
    expect(result.data[1].depart).toBe('2026-09-10T08:00:00');
  });

  it('builds a partial itinerary with duration and arrive, never confirmed (no timezone offset in source data)', async () => {
    mockFetchOk(SEARCH_FIXTURE);
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });
    if (!result.ok) throw new Error(result.reason);

    expect(result.data[0].itinerary).toMatchObject({
      certainty: 'partial',
      durationMinutes: 334,
      arrive: '2026-09-10T22:29:00',
    });
  });

  it('extracts the IATA carrier code from flight_number, not the display airline name', async () => {
    mockFetchOk(SEARCH_FIXTURE);
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });
    if (!result.ok) throw new Error(result.reason);

    expect(result.data[0].carrier).toBe('B6');
    expect(result.data[1].carrier).toBe('DL');
  });

  it('maps stops from the response', async () => {
    mockFetchOk(SEARCH_FIXTURE);
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });
    if (!result.ok) throw new Error(result.reason);

    expect(result.data[0].stops).toBe(0);
  });

  it('never sets the return field (round-trip response shape is unverified)', async () => {
    mockFetchOk(SEARCH_FIXTURE);
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', {
      depart: '2026-09-10',
      return: '2026-09-20',
      passengers: 1,
    });
    if (!result.ok) throw new Error(result.reason);

    result.data.forEach((f) => {
      expect(f.return).toBeUndefined();
    });
  });

  it('builds an honest Google Flights *search* deeplink (not a booking/checkout claim)', async () => {
    mockFetchOk(SEARCH_FIXTURE);
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });
    if (!result.ok) throw new Error(result.reason);

    const url = new URL(result.data[0].deeplink);
    expect(url.origin).toBe('https://www.google.com');
    expect(url.pathname).toBe('/travel/flights');
    expect(url.searchParams.get('q')).toBe('Flights from LAX to JFK on 2026-09-10');
  });

  it('marks price as party total and records passenger count', async () => {
    mockFetchOk(SEARCH_FIXTURE);
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 3 });
    if (!result.ok) throw new Error(result.reason);

    expect(result.data[0].priceScope).toBe('party_total');
    expect(result.data[0].passengerCount).toBe(3);
  });

  it('sends departure_id/arrival_id/outbound_date and the RapidAPI headers', async () => {
    mockFetchOk(SEARCH_FIXTURE);
    const provider = new GoogleFlightsProvider();
    await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 2 });

    const call = (global.fetch as jest.Mock).mock.calls[0];
    const url = new URL(call[0] as string);
    expect(url.hostname).toBe('google-flights2.p.rapidapi.com');
    expect(url.searchParams.get('departure_id')).toBe('LAX');
    expect(url.searchParams.get('arrival_id')).toBe('JFK');
    expect(url.searchParams.get('outbound_date')).toBe('2026-09-10');
    expect(url.searchParams.get('adults')).toBe('2');
    expect(call[1]).toEqual(
      expect.objectContaining({
        headers: {
          'x-rapidapi-key': 'gflights_test_abc123',
          'x-rapidapi-host': 'google-flights2.p.rapidapi.com',
        },
      })
    );
  });

  it('adds return_date only for round-trip searches', async () => {
    mockFetchOk(SEARCH_FIXTURE);
    const provider = new GoogleFlightsProvider();

    await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });
    const oneWayUrl = new URL((global.fetch as jest.Mock).mock.calls[0][0] as string);
    expect(oneWayUrl.searchParams.has('return_date')).toBe(false);

    await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', return: '2026-09-20', passengers: 1 });
    const roundTripUrl = new URL((global.fetch as jest.Mock).mock.calls[1][0] as string);
    expect(roundTripUrl.searchParams.get('return_date')).toBe('2026-09-20');
  });

  it('caches the result keyed by origin/dest/dates/passengers with a 6-hour TTL', async () => {
    mockFetchOk(SEARCH_FIXTURE);
    const { cache } = jest.requireMock('../../cache/redis') as {
      cache: { set: jest.Mock };
    };

    const provider = new GoogleFlightsProvider();
    await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });

    expect(cache.set).toHaveBeenCalledWith(
      'googleFlights:search:LAX:JFK:2026-09-10::pax:1',
      expect.any(Array),
      21600
    );
  });

  it('returns cached data without fetching when cache hits', async () => {
    const cachedFares: NormalizedFare[] = [
      {
        id: 'cached-fare-1',
        fareType: 'cash',
        origin: 'LAX',
        destination: 'JFK',
        depart: '2026-09-10T13:55:00',
        stops: 0,
        carrier: 'B6',
        price: { priceCents: 20900, currency: 'USD' },
        deeplink: 'https://www.google.com/travel/flights?q=Flights%20from%20LAX%20to%20JFK%20on%202026-09-10',
        source: 'googleFlights',
        fetchedAt: '2026-06-29T00:00:00.000Z',
      },
    ];

    const { cache } = jest.requireMock('../../cache/redis') as {
      cache: { get: jest.Mock; set: jest.Mock };
    };
    cache.get.mockResolvedValue(cachedFares);

    global.fetch = jest.fn();
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual(cachedFares);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ─── searchFares — malformed-response handling ───────────────────────────────

describe('GoogleFlightsProvider.searchFares malformed-response handling', () => {
  it('returns { ok: false, reason } when the response has no `data` key at all', async () => {
    mockFetchOk({ status: true, message: 'Success' });
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toBe('GoogleFlights returned a malformed response');
  });

  it('returns { ok: false, reason } when topFlights is not an array', async () => {
    mockFetchOk({ data: { itineraries: { topFlights: 'not-an-array' } } });
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toBe('GoogleFlights returned a malformed response');
  });

  it('treats an empty itineraries object as zero fares, not malformed', async () => {
    mockFetchOk({ data: { itineraries: {} } });
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
  });
});

// ─── searchFares — skips individually broken itinerary entries ───────────────
//
// A real recorded round-trip response (LAX -> ATH, 2026-08-07) had 73 total
// itinerary entries where 2 had `price: "unavailable"` (a literal string --
// Google's own signal for a mixed-carrier "self transfer" combo it can't
// quote a combined fare for). The old behavior treated any single bad item
// as a fatal parse error for the WHOLE response, discarding all 71 good
// fares along with the 2 unpriced ones -- this is what caused every
// round-trip search to show "GoogleFlights returned a response we could not
// use." These tests lock in the fix: skip just the broken entry.

describe('GoogleFlightsProvider.searchFares skips individually broken itinerary entries', () => {
  const GOOD_ITEM = {
    departure_time: '10-09-2026 01:55 PM',
    arrival_time: '10-09-2026 10:29 PM',
    duration: { raw: 334 },
    flights: [],
    price: 209,
    stops: 0,
  };

  it('skips an item whose price is the literal string "unavailable" (real Google Flights self-transfer signal) and keeps the rest', async () => {
    mockFetchOk({
      data: {
        itineraries: {
          topFlights: [GOOD_ITEM, { ...GOOD_ITEM, price: 'unavailable' }],
        },
      },
    });
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'ATH', { depart: '2026-09-10', passengers: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].price.priceCents).toBe(20900);
  });

  it('skips an item with an unparseable departure_time and keeps the rest', async () => {
    mockFetchOk({
      data: {
        itineraries: {
          topFlights: [GOOD_ITEM, { ...GOOD_ITEM, departure_time: 'not a date' }],
        },
      },
    });
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toHaveLength(1);
  });

  it('skips a non-object entry in the itineraries array and keeps the rest', async () => {
    mockFetchOk({
      data: {
        itineraries: {
          topFlights: [GOOD_ITEM, null, 'not-an-object'],
        },
      },
    });
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toHaveLength(1);
  });

  it('returns ok:true with an empty array (not malformed) when every entry is individually broken', async () => {
    mockFetchOk({
      data: {
        itineraries: {
          topFlights: [{ ...GOOD_ITEM, price: 'unavailable' }],
        },
      },
    });
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
  });
});

// ─── searchFares — error handling ─────────────────────────────────────────────

describe('GoogleFlightsProvider.searchFares error handling', () => {
  it('returns { ok: false, reason } on HTTP 4xx/5xx', async () => {
    mockFetchError(429);
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toMatch(/429/);
  });

  it('returns { ok: false, reason } when fetch throws a network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toBe('ECONNREFUSED');
  });

  it('returns { ok: false, reason } when the provider fetch times out', async () => {
    process.env.PROVIDER_TIMEOUT_MS = '1';
    global.fetch = jest.fn(() => new Promise<Response>(() => {}));
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(result.reason).toBe('GoogleFlights timed out');
  });

  it('never throws — always returns a Result', async () => {
    global.fetch = jest.fn().mockRejectedValue('non-Error thrown value');
    const provider = new GoogleFlightsProvider();
    const result = await provider.searchFares('LAX', 'JFK', { depart: '2026-09-10', passengers: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error');
    expect(typeof result.reason).toBe('string');
  });
});
