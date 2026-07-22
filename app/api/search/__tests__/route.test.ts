import { NextRequest } from 'next/server';
import { GET } from '../route';
import type { HotelOffer, NormalizedFare } from '@/lib/types';
import { travelpayouts } from '../../../../lib/providers/travelpayouts';
import { duffel } from '../../../../lib/providers/duffel';
import { amadeus } from '../../../../lib/providers/amadeus';
import { kiwi } from '../../../../lib/providers/kiwi';
import { hotellook } from '../../../../lib/providers/hotellook';
import { query } from '../../../../lib/db/client';

jest.mock('../../../../lib/providers/travelpayouts', () => ({
  travelpayouts: { searchFares: jest.fn() },
}));

jest.mock('../../../../lib/providers/duffel', () => ({
  duffel: { searchFares: jest.fn() },
}));

jest.mock('../../../../lib/providers/amadeus', () => ({
  amadeus: { searchFares: jest.fn() },
}));

jest.mock('../../../../lib/providers/kiwi', () => ({
  kiwi: { searchFares: jest.fn() },
}));

jest.mock('../../../../lib/providers/hotellook', () => ({
  hotellook: { searchHotels: jest.fn() },
}));

jest.mock('../../../../lib/db/client', () => ({
  query: jest.fn(),
}));

const flightProviders = [travelpayouts, duffel, amadeus, kiwi] as unknown as Array<{
  searchFares: jest.Mock;
}>;
const mockHotelSearch = hotellook.searchHotels as jest.Mock;
const mockQuery = query as jest.MockedFunction<typeof query>;

const fare: NormalizedFare = {
  id: 'tp-1',
  fareType: 'cash',
  origin: 'JFK',
  destination: 'LAX',
  depart: '2099-09-22',
  stops: 0,
  carrier: 'AA',
  price: { priceCents: 19900, currency: 'USD' },
  passengerCount: 1,
  priceScope: 'per_person',
  deeplink: 'https://example.com/book?marker=test',
  source: 'travelpayouts',
  fetchedAt: '2026-06-30T00:00:00.000Z',
};

function fareWithDateRelation(input: NormalizedFare, selectedDepart = '2099-09-22'): NormalizedFare {
  const fareDepart = input.depart.slice(0, 10);
  return {
    ...input,
    dateRelation: {
      selectedDepart,
      fareDepart,
      relation: fareDepart === selectedDepart ? 'selected' : 'nearby',
    },
  };
}

const hotelOffer: HotelOffer = {
  id: 'hotel-1',
  name: 'Contract Hotel',
  area: 'Los Angeles',
  stars: 4,
  rating: 4,
  pricePerNight: { priceCents: 18999, currency: 'USD' },
  deeplink: 'https://example.com/hotel?marker=test',
  source: 'hotellook',
  amenityEvidence: [
    {
      id: 'elevator',
      label: 'Elevator',
      status: 'confirmed',
      scope: 'property',
      sourceLabel: 'Hotellook',
      fetchedAt: '2026-07-22T01:00:00.000Z',
      confidence: 'provider_only',
      certainty: 'guaranteed',
    },
  ],
  accessEvidenceState: 'ready',
};

function searchRequest(queryString: string): NextRequest {
  return new NextRequest(`https://expaify.test/api/search?${queryString}`);
}

async function readNdjson(response: Response): Promise<string> {
  return await response.text();
}

function parseNdjson(body: string): Array<Record<string, unknown>> {
  return body
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as Record<string, unknown>);
}

describe('GET /api/search guardrails and provider failures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    flightProviders.forEach(provider => {
      provider.searchFares.mockResolvedValue({ ok: true, data: [] });
    });
    mockHotelSearch.mockResolvedValue({ ok: true, data: [] });
    mockQuery.mockResolvedValue({
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });
  });

  it.each([
    [
      'missing departure',
      'origin=JFK&dest=LAX&trip=oneway&passengers=1',
      'Departure date is required. Choose a departure date before searching.',
    ],
    [
      'missing round-trip return',
      'origin=JFK&dest=LAX&depart=2099-09-22&trip=roundtrip&passengers=1',
      'Return date is required for round trips. Choose a return date or switch to one way.',
    ],
    [
      'past departure',
      'origin=JFK&dest=LAX&depart=2020-01-01&trip=oneway&passengers=1',
      'Departure date cannot be in the past. Choose today or a future date.',
    ],
    [
      'reversed range',
      'origin=JFK&dest=LAX&depart=2099-09-22&return=2099-09-20&trip=roundtrip&passengers=1',
      'Return date must be on or after departure date.',
    ],
  ])('returns 400 before providers for %s', async (_name, queryString, error) => {
    const response = await GET(searchRequest(queryString));
    const body = await response.json() as { error: string };

    expect(response.status).toBe(400);
    expect(body).toEqual({ error });
    flightProviders.forEach(provider => {
      expect(provider.searchFares).not.toHaveBeenCalled();
    });
    expect(mockHotelSearch).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('allows valid one-way searches to reach flight providers without hotels', async () => {
    const response = await GET(searchRequest('origin=JFK&dest=LAX&depart=2099-09-22&trip=oneway&passengers=1'));
    const body = await readNdjson(response);
    const messages = parseNdjson(body);

    expect(response.status).toBe(200);
    expect(body).toContain('"type":"hotel-status"');
    expect(messages).toContainEqual({
      type: 'flight-date-coverage',
      data: {
        requested: false,
        status: 'not_requested',
        selectedDepart: '2099-09-22',
        expectedDates: ['2099-09-22'],
        checkedDates: [],
        failedDates: [],
        provider: 'Flights',
      },
    });
    flightProviders.forEach(provider => {
      expect(provider.searchFares).toHaveBeenCalledWith('JFK', 'LAX', {
        depart: '2099-09-22',
        return: undefined,
        passengers: 1,
      });
    });
    expect(mockHotelSearch).not.toHaveBeenCalled();
  });

  it('allows valid round-trip searches to reach flight and hotel providers', async () => {
    const response = await GET(searchRequest('origin=JFK&dest=LAX&depart=2099-09-22&return=2099-09-29&trip=roundtrip&passengers=2'));

    expect(response.status).toBe(200);
    await readNdjson(response);
    flightProviders.forEach(provider => {
      expect(provider.searchFares).toHaveBeenCalledWith('JFK', 'LAX', {
        depart: '2099-09-22',
        return: '2099-09-29',
        passengers: 2,
      });
    });
    expect(mockHotelSearch).toHaveBeenCalledWith('LAX', {
      checkin: '2099-09-22',
      checkout: '2099-09-29',
    });
  });

  it('streams successful fares with a bounded notice when another provider returns failure', async () => {
    (travelpayouts.searchFares as jest.Mock).mockResolvedValueOnce({ ok: true, data: [fare] });
    (duffel.searchFares as jest.Mock).mockResolvedValueOnce({ ok: false, reason: 'Duffel /air/offer_requests HTTP 503' });

    const response = await GET(searchRequest('origin=JFK&dest=LAX&depart=2099-09-22&trip=oneway&passengers=1'));
    const messages = parseNdjson(await readNdjson(response));

    expect(response.status).toBe(200);
    expect(messages).toContainEqual({
      type: 'flights',
      source: 'travelpayouts',
      data: [fareWithDateRelation(fare)],
    });
    expect(messages).toContainEqual({
      type: 'notice',
      provider: 'Duffel',
      status: 'unavailable',
      message: 'Duffel is unavailable for this search.',
    });
    expect(messages).not.toContainEqual(expect.objectContaining({
      message: expect.stringContaining('HTTP 503'),
    }));
  });

  it('converts an unexpected provider throw into a user-visible notice without dropping successful fares', async () => {
    (travelpayouts.searchFares as jest.Mock).mockResolvedValueOnce({ ok: true, data: [fare] });
    (duffel.searchFares as jest.Mock).mockRejectedValueOnce(new Error('socket hang up'));

    const response = await GET(searchRequest('origin=JFK&dest=LAX&depart=2099-09-22&trip=oneway&passengers=1'));
    const messages = parseNdjson(await readNdjson(response));

    expect(response.status).toBe(200);
    expect(messages).toContainEqual({
      type: 'flights',
      source: 'travelpayouts',
      data: [fareWithDateRelation(fare)],
    });
    expect(messages).toContainEqual({
      type: 'notice',
      provider: 'Duffel',
      status: 'unavailable',
      message: 'Duffel is unavailable for this search.',
    });
    expect(messages).not.toContainEqual(expect.objectContaining({
      message: expect.stringContaining('socket hang up'),
    }));
  });

  it('uses timeout-specific copy while preserving partial provider results', async () => {
    (travelpayouts.searchFares as jest.Mock).mockResolvedValueOnce({ ok: true, data: [fare] });
    (duffel.searchFares as jest.Mock).mockResolvedValueOnce({ ok: false, reason: 'Duffel timed out' });

    const response = await GET(searchRequest('origin=JFK&dest=LAX&depart=2099-09-22&trip=oneway&passengers=1'));
    const messages = parseNdjson(await readNdjson(response));

    expect(response.status).toBe(200);
    expect(messages).toContainEqual({
      type: 'flights',
      source: 'travelpayouts',
      data: [fareWithDateRelation(fare)],
    });
    expect(messages).toContainEqual({
      type: 'notice',
      provider: 'Duffel',
      status: 'unavailable',
      message: 'Duffel did not respond in time. We could not confirm its inventory for this search.',
    });
  });

  it('returns controlled timeout notices when all flight providers time out', async () => {
    (travelpayouts.searchFares as jest.Mock).mockResolvedValueOnce({ ok: false, reason: 'Travelpayouts timed out' });
    (duffel.searchFares as jest.Mock).mockResolvedValueOnce({ ok: false, reason: 'Duffel timed out' });
    (amadeus.searchFares as jest.Mock).mockResolvedValueOnce({ ok: false, reason: 'Amadeus timed out' });
    (kiwi.searchFares as jest.Mock).mockResolvedValueOnce({ ok: false, reason: 'Kiwi timed out' });

    const response = await GET(searchRequest('origin=JFK&dest=LAX&depart=2099-09-22&trip=oneway&passengers=1'));
    const messages = parseNdjson(await readNdjson(response));

    expect(response.status).toBe(200);
    expect(messages.filter(message => message.type === 'flights')).toHaveLength(0);
    expect(messages.filter(message => message.type === 'notice')).toEqual([
      expect.objectContaining({ provider: 'Travelpayouts', message: expect.stringContaining('did not respond in time') }),
      expect.objectContaining({ provider: 'Duffel', message: expect.stringContaining('did not respond in time') }),
      expect.objectContaining({ provider: 'Amadeus', message: expect.stringContaining('did not respond in time') }),
      expect.objectContaining({ provider: 'Kiwi', message: expect.stringContaining('did not respond in time') }),
    ]);
    expect(messages).toContainEqual(expect.objectContaining({ type: 'done' }));
  });

  it('labels incomplete flexible-date coverage when one Travelpayouts date fails but another returns fares', async () => {
    (travelpayouts.searchFares as jest.Mock)
      .mockResolvedValueOnce({ ok: true, data: [fare] })
      .mockResolvedValueOnce({ ok: false, reason: 'Travelpayouts /prices/latest HTTP 502' });

    const response = await GET(searchRequest('origin=JFK&dest=LAX&depart=2099-09-22&trip=oneway&passengers=1&flex=1'));
    const messages = parseNdjson(await readNdjson(response));

    expect(response.status).toBe(200);
    expect(messages).toContainEqual(expect.objectContaining({
      type: 'flights',
      source: 'travelpayouts',
    }));
    expect(messages).toContainEqual({
      type: 'flight-date-coverage',
      data: {
        requested: true,
        status: 'partial',
        selectedDepart: '2099-09-22',
        windowStart: '2099-09-19',
        windowEnd: '2099-09-25',
        expectedDates: [
          '2099-09-19',
          '2099-09-20',
          '2099-09-21',
          '2099-09-22',
          '2099-09-23',
          '2099-09-24',
          '2099-09-25',
        ],
        checkedDates: [
          '2099-09-19',
          '2099-09-21',
          '2099-09-22',
          '2099-09-23',
          '2099-09-24',
          '2099-09-25',
        ],
        failedDates: ['2099-09-20'],
        provider: 'Travelpayouts',
        message: 'Nearby-date comparison was partial.',
      },
    });
    expect(messages).toContainEqual({
      type: 'notice',
      provider: 'Travelpayouts',
      status: 'unavailable',
      message: 'Travelpayouts flexible-date coverage is incomplete for this search.',
    });
  });

  it('streams complete flexible-date coverage when all nearby date calls return usable responses', async () => {
    const nearbyFare: NormalizedFare = {
      ...fare,
      id: 'tp-nearby',
      depart: '2099-09-20',
    };
    (travelpayouts.searchFares as jest.Mock)
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: [nearbyFare] })
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: [fare] })
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({ ok: true, data: [] });

    const response = await GET(searchRequest('origin=JFK&dest=LAX&depart=2099-09-22&trip=oneway&passengers=1&flex=1'));
    const messages = parseNdjson(await readNdjson(response));

    expect(response.status).toBe(200);
    expect(messages).toContainEqual({
      type: 'flight-date-coverage',
      data: {
        requested: true,
        status: 'complete',
        selectedDepart: '2099-09-22',
        windowStart: '2099-09-19',
        windowEnd: '2099-09-25',
        expectedDates: [
          '2099-09-19',
          '2099-09-20',
          '2099-09-21',
          '2099-09-22',
          '2099-09-23',
          '2099-09-24',
          '2099-09-25',
        ],
        checkedDates: [
          '2099-09-19',
          '2099-09-20',
          '2099-09-21',
          '2099-09-22',
          '2099-09-23',
          '2099-09-24',
          '2099-09-25',
        ],
        failedDates: [],
        provider: 'Travelpayouts',
      },
    });
    expect(messages).toContainEqual({
      type: 'flights',
      source: 'travelpayouts',
      data: [fareWithDateRelation(nearbyFare), fareWithDateRelation(fare)],
    });
  });

  it('streams unavailable flexible-date coverage when no nearby date calls return usable responses', async () => {
    (travelpayouts.searchFares as jest.Mock).mockReset();
    (travelpayouts.searchFares as jest.Mock).mockResolvedValue({ ok: false, reason: 'Travelpayouts timed out' });

    const response = await GET(searchRequest('origin=JFK&dest=LAX&depart=2099-09-22&trip=oneway&passengers=1&flex=1'));
    const messages = parseNdjson(await readNdjson(response));

    expect(response.status).toBe(200);
    expect(messages).toContainEqual({
      type: 'flight-date-coverage',
      data: {
        requested: true,
        status: 'unavailable',
        selectedDepart: '2099-09-22',
        windowStart: '2099-09-19',
        windowEnd: '2099-09-25',
        expectedDates: [
          '2099-09-19',
          '2099-09-20',
          '2099-09-21',
          '2099-09-22',
          '2099-09-23',
          '2099-09-24',
          '2099-09-25',
        ],
        checkedDates: [],
        failedDates: [
          '2099-09-19',
          '2099-09-20',
          '2099-09-21',
          '2099-09-22',
          '2099-09-23',
          '2099-09-24',
          '2099-09-25',
        ],
        provider: 'Travelpayouts',
        message: 'Nearby date comparison unavailable.',
      },
    });
  });

  it('converts an unexpected hotel provider throw into a bounded hotel status', async () => {
    mockHotelSearch.mockRejectedValueOnce(new Error('hotel upstream failure'));

    const response = await GET(searchRequest('origin=JFK&dest=LAX&depart=2099-09-22&return=2099-09-29&trip=roundtrip&passengers=1'));
    const messages = parseNdjson(await readNdjson(response));

    expect(response.status).toBe(200);
    expect(messages).toContainEqual({
      type: 'hotel-status',
      status: 'unavailable',
      provider: 'Hotellook',
      providerStatus: 'unavailable',
      message: 'The hotel provider is unavailable right now.',
    });
    expect(messages).not.toContainEqual(expect.objectContaining({
      message: expect.stringContaining('hotel upstream failure'),
    }));
  });

  it('uses timeout-specific hotel copy without claiming inventory was searched', async () => {
    mockHotelSearch.mockResolvedValueOnce({ ok: false, reason: 'HotelLook timed out' });

    const response = await GET(searchRequest('origin=JFK&dest=LAX&depart=2099-09-22&return=2099-09-29&trip=roundtrip&passengers=1'));
    const messages = parseNdjson(await readNdjson(response));

    expect(response.status).toBe(200);
    expect(messages).toContainEqual({
      type: 'hotel-status',
      status: 'unavailable',
      provider: 'Hotellook',
      providerStatus: 'unavailable',
      message: 'The hotel provider did not respond in time. Hotel inventory was not confirmed for this search.',
    });
  });

  it('keeps empty hotel availability distinct from provider failure', async () => {
    mockHotelSearch.mockResolvedValueOnce({ ok: true, data: [] });

    const response = await GET(searchRequest('origin=JFK&dest=LAX&depart=2099-09-22&return=2099-09-29&trip=roundtrip&passengers=1'));
    const messages = parseNdjson(await readNdjson(response));

    expect(response.status).toBe(200);
    expect(messages).toContainEqual({
      type: 'hotel-status',
      status: 'empty',
      message: 'No hotels were returned for these dates.',
    });
    expect(messages.some(message => message.type === 'hotels')).toBe(false);
  });

  it('streams hotel offers with integer priceCents when availability succeeds', async () => {
    mockHotelSearch.mockResolvedValueOnce({ ok: true, data: [hotelOffer] });

    const response = await GET(searchRequest('origin=JFK&dest=LAX&depart=2099-09-22&return=2099-09-29&trip=roundtrip&passengers=1'));
    const messages = parseNdjson(await readNdjson(response));

    expect(response.status).toBe(200);
    expect(messages).toContainEqual({
      type: 'hotel-status',
      status: 'available',
    });
    expect(messages).toContainEqual({
      type: 'hotels',
      source: 'hotellook',
      data: [hotelOffer],
    });
    expect(messages).toContainEqual({ type: 'hotel-access-status', status: 'loading' });
    expect(messages).toContainEqual({ type: 'hotel-access-status', status: 'ready' });
    expect(Number.isInteger(hotelOffer.pricePerNight.priceCents)).toBe(true);
  });

  it('streams access errors independently while preserving hotel inventory', async () => {
    const hotelWithAccessError: HotelOffer = {
      ...hotelOffer,
      amenityEvidence: [],
      accessEvidenceState: 'error',
    };
    mockHotelSearch.mockResolvedValueOnce({ ok: true, data: [hotelWithAccessError] });

    const response = await GET(searchRequest('origin=JFK&dest=LAX&depart=2099-09-22&return=2099-09-29&trip=roundtrip&passengers=1'));
    const messages = parseNdjson(await readNdjson(response));

    expect(messages).toContainEqual({ type: 'hotel-status', status: 'available' });
    expect(messages).toContainEqual({
      type: 'hotels',
      source: 'hotellook',
      data: [hotelWithAccessError],
    });
    expect(messages).toContainEqual({
      type: 'hotel-access-status',
      status: 'error',
      message: 'Access details could not be checked for one or more hotels.',
    });
  });
});
