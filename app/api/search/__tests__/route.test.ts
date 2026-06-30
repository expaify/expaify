import { GET } from '../route';
import type { NormalizedFare } from '@/lib/types';

jest.mock('@/lib/db/client', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
}));

jest.mock('@/lib/airports/nearby', () => ({
  getNearby: jest.fn(() => []),
}));

jest.mock('@/lib/providers/travelpayouts', () => ({
  travelpayouts: {
    searchFares: jest.fn(),
  },
}));

jest.mock('@/lib/providers/duffel', () => ({
  duffel: {
    searchFares: jest.fn(),
  },
}));

jest.mock('@/lib/providers/amadeus', () => ({
  amadeus: {
    searchFares: jest.fn(),
  },
}));

jest.mock('@/lib/providers/kiwi', () => ({
  kiwi: {
    searchFares: jest.fn(),
  },
}));

jest.mock('@/lib/providers/hotellook', () => ({
  hotellook: {
    searchHotels: jest.fn(),
  },
}));

const { travelpayouts } = jest.requireMock('@/lib/providers/travelpayouts') as {
  travelpayouts: { searchFares: jest.Mock };
};
const { duffel } = jest.requireMock('@/lib/providers/duffel') as {
  duffel: { searchFares: jest.Mock };
};
const { amadeus } = jest.requireMock('@/lib/providers/amadeus') as {
  amadeus: { searchFares: jest.Mock };
};
const { kiwi } = jest.requireMock('@/lib/providers/kiwi') as {
  kiwi: { searchFares: jest.Mock };
};
const { hotellook } = jest.requireMock('@/lib/providers/hotellook') as {
  hotellook: { searchHotels: jest.Mock };
};

const fare: NormalizedFare = {
  id: 'fare-1',
  fareType: 'cash',
  origin: 'JFK',
  destination: 'LAX',
  depart: '2026-09-22T08:00:00.000Z',
  stops: 0,
  carrier: 'AA',
  price: { priceCents: 25000, currency: 'USD' },
  deeplink: 'https://example.com/book',
  source: 'travelpayouts',
  fetchedAt: '2026-06-30T00:00:00.000Z',
};

function request(url: string) {
  const nextUrl = new URL(url);
  return { nextUrl } as Parameters<typeof GET>[0];
}

async function readNdjson(response: Response): Promise<Array<Record<string, unknown>>> {
  expect(response.body).not.toBeNull();
  const text = await response.text();
  return text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as Record<string, unknown>);
}

beforeEach(() => {
  jest.clearAllMocks();
  travelpayouts.searchFares.mockResolvedValue({ ok: true, data: [] });
  duffel.searchFares.mockResolvedValue({ ok: true, data: [] });
  amadeus.searchFares.mockResolvedValue({ ok: true, data: [] });
  kiwi.searchFares.mockResolvedValue({ ok: true, data: [] });
  hotellook.searchHotels.mockResolvedValue({ ok: true, data: [] });
});

describe('GET /api/search provider timeout handling', () => {
  it('streams successful provider fares and timeout notices together', async () => {
    travelpayouts.searchFares.mockResolvedValue({ ok: true, data: [fare] });
    duffel.searchFares.mockResolvedValue({ ok: false, reason: 'Duffel timed out' });
    amadeus.searchFares.mockResolvedValue({ ok: true, data: [] });
    kiwi.searchFares.mockResolvedValue({ ok: true, data: [] });

    const response = await GET(request('https://expaify.test/api/search?origin=JFK&dest=LAX&depart=2026-09-22&passengers=1'));
    const messages = await readNdjson(response);

    expect(messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'flights', source: 'travelpayouts', data: [fare] }),
      expect.objectContaining({
        type: 'notice',
        provider: 'Duffel',
        status: 'unavailable',
        message: 'Duffel did not respond in time. We could not confirm its inventory for this search.',
      }),
      expect.objectContaining({ type: 'done' }),
    ]));
  });

  it('reports thrown provider failures as notices without dropping other providers', async () => {
    travelpayouts.searchFares.mockRejectedValue(new Error('Travelpayouts timed out'));
    duffel.searchFares.mockResolvedValue({ ok: true, data: [fare] });

    const response = await GET(request('https://expaify.test/api/search?origin=JFK&dest=LAX&depart=2026-09-22&passengers=1'));
    const messages = await readNdjson(response);

    expect(messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'flights', source: 'duffel', data: [fare] }),
      expect.objectContaining({
        type: 'notice',
        provider: 'Travelpayouts',
        status: 'unavailable',
        message: 'Travelpayouts did not respond in time. We could not confirm its inventory for this search.',
      }),
    ]));
  });

  it('returns controlled notices when all flight providers time out', async () => {
    travelpayouts.searchFares.mockResolvedValue({ ok: false, reason: 'Travelpayouts timed out' });
    duffel.searchFares.mockResolvedValue({ ok: false, reason: 'Duffel timed out' });
    amadeus.searchFares.mockResolvedValue({ ok: false, reason: 'Amadeus timed out' });
    kiwi.searchFares.mockResolvedValue({ ok: false, reason: 'Kiwi timed out' });

    const response = await GET(request('https://expaify.test/api/search?origin=JFK&dest=LAX&depart=2026-09-22&passengers=1'));
    const messages = await readNdjson(response);

    expect(messages.filter(message => message.type === 'flights')).toHaveLength(0);
    expect(messages.filter(message => message.type === 'notice')).toEqual([
      expect.objectContaining({ provider: 'Travelpayouts', message: expect.stringContaining('did not respond in time') }),
      expect.objectContaining({ provider: 'Duffel', message: expect.stringContaining('did not respond in time') }),
      expect.objectContaining({ provider: 'Amadeus', message: expect.stringContaining('did not respond in time') }),
      expect.objectContaining({ provider: 'Kiwi', message: expect.stringContaining('did not respond in time') }),
    ]);
    expect(messages).toContainEqual(expect.objectContaining({ type: 'done' }));
  });
});
