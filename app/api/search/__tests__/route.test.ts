import { NextRequest } from 'next/server';
import { GET } from '../route';
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

const fare = {
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

describe('GET /api/search date guardrails', () => {
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

    expect(response.status).toBe(200);
    expect(body).toContain('"type":"hotel-status"');
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
      data: [fare],
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
      data: [fare],
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
      type: 'notice',
      provider: 'Travelpayouts',
      status: 'unavailable',
      message: 'Travelpayouts flexible-date coverage is incomplete for this search.',
    });
  });

  it('converts an unexpected hotel provider throw into a bounded hotel status', async () => {
    mockHotelSearch.mockRejectedValueOnce(new Error('hotel upstream timeout'));

    const response = await GET(searchRequest('origin=JFK&dest=LAX&depart=2099-09-22&return=2099-09-29&trip=roundtrip&passengers=1'));
    const messages = parseNdjson(await readNdjson(response));

    expect(response.status).toBe(200);
    expect(messages).toContainEqual({
      type: 'hotel-status',
      status: 'unavailable',
      providerStatus: 'unavailable',
      message: 'The hotel provider is unavailable right now.',
    });
    expect(messages).not.toContainEqual(expect.objectContaining({
      message: expect.stringContaining('hotel upstream timeout'),
    }));
  });
});
