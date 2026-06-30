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
});
