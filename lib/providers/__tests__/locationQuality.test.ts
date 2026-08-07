import { getLocationQuality } from '../locationQuality';

jest.mock('../../cache/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

const { cache } = jest.requireMock('../../cache/redis') as {
  cache: { get: jest.Mock; set: jest.Mock };
};

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

const realPlacesResponse = {
  places: [{ location: { latitude: 41.4038398, longitude: 2.1911943 } }],
};

function nearbyResponse(pois: Array<{ name: string; rating: number; types?: string[] }>) {
  return {
    places: pois.map(p => ({
      displayName: { text: p.name },
      rating: p.rating,
      types: p.types ?? ['restaurant'],
    })),
  };
}

const qualifyingPois = [
  { name: 'Trattoria Roma', rating: 4.6 },
  { name: 'City Museum', rating: 4.3 },
  { name: 'Central Metro Station', rating: 4.1 },
];

beforeEach(() => {
  jest.clearAllMocks();
  cache.get.mockResolvedValue(null);
  cache.set.mockResolvedValue(undefined);
  process.env.GOOGLE_PLACES_API_KEY = 'places_test_key';
  process.env.IONET_API_KEY = 'ionet_test_key';
});

afterEach(() => {
  delete process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.IONET_API_KEY;
});

describe('getLocationQuality', () => {
  it('returns not-configured when GOOGLE_PLACES_API_KEY is unset, without calling fetch', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    global.fetch = jest.fn();

    const result = await getLocationQuality('Hotel Test', 'Barcelona');

    expect(result.ok).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns not-configured when IONET_API_KEY is unset, without calling the classifier', async () => {
    delete process.env.IONET_API_KEY;
    global.fetch = jest.fn();

    const result = await getLocationQuality('Hotel Test', 'Barcelona');

    expect(result.ok).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns a cached result without calling fetch at all', async () => {
    cache.get.mockResolvedValueOnce({ ok: true, data: { vibeTag: 'Cached vibe', summary: 'Cached.', poiCount: 5 } });
    global.fetch = jest.fn();

    const result = await getLocationQuality('Hotel Test', 'Barcelona');

    expect(result).toEqual({ ok: true, data: { vibeTag: 'Cached vibe', summary: 'Cached.', poiCount: 5 } });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reports failure when Places text search finds no matching hotel', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(jsonResponse(200, { places: [] }));

    const result = await getLocationQuality('Nonexistent Hotel', 'Nowhere');

    expect(result.ok).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('reports failure and does not cache on a Places text search HTTP error', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(jsonResponse(500, {}));

    const result = await getLocationQuality('Hotel Test', 'Barcelona');

    expect(result.ok).toBe(false);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('reports and caches "not enough POIs" when fewer than 3 qualifying places are found nearby', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, realPlacesResponse))
      .mockResolvedValueOnce(jsonResponse(200, nearbyResponse([{ name: 'Only Cafe', rating: 4.2 }])));

    const result = await getLocationQuality('Hotel Test', 'Barcelona');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toContain('Not enough nearby points of interest');
    expect(cache.set).toHaveBeenCalledWith(expect.any(String), result, expect.any(Number));
  });

  it('filters out nearby places below the 4.0 rating floor before counting them', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, realPlacesResponse))
      .mockResolvedValueOnce(
        jsonResponse(
          200,
          nearbyResponse([
            { name: 'Good Place', rating: 4.5 },
            { name: 'Mediocre Place', rating: 3.2 },
            { name: 'Another Mediocre Place', rating: 3.9 },
          ]),
        ),
      );

    const result = await getLocationQuality('Hotel Test', 'Barcelona');

    // Only 1 of the 3 returned places clears the 4.0 floor -- below the
    // minimum-of-3 qualifying bar, so this must fail rather than fabricate.
    expect(result.ok).toBe(false);
  });

  it('parses a real successful classification and reports the correct poiCount', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, realPlacesResponse))
      .mockResolvedValueOnce(jsonResponse(200, nearbyResponse(qualifyingPois)))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          choices: [{ message: { content: '{"vibeTag":"Walkable foodie hub","summary":"A short walk from 3 highly-rated spots."}' } }],
        }),
      );

    const result = await getLocationQuality('Hotel Test', 'Barcelona');

    expect(result).toEqual({
      ok: true,
      data: { vibeTag: 'Walkable foodie hub', summary: 'A short walk from 3 highly-rated spots.', poiCount: 3 },
    });
    expect(cache.set).toHaveBeenCalledWith(expect.any(String), result, expect.any(Number));
  });

  it('parses a classification response wrapped in a ```json fence', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, realPlacesResponse))
      .mockResolvedValueOnce(jsonResponse(200, nearbyResponse(qualifyingPois)))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          choices: [{ message: { content: '```json\n{"vibeTag":"Quiet residential","summary":"Close to a museum and a metro stop."}\n```' } }],
        }),
      );

    const result = await getLocationQuality('Hotel Test', 'Barcelona');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data.vibeTag).toBe('Quiet residential');
  });

  it('reports failure without caching when the classifier returns malformed JSON', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, realPlacesResponse))
      .mockResolvedValueOnce(jsonResponse(200, nearbyResponse(qualifyingPois)))
      .mockResolvedValueOnce(jsonResponse(200, { choices: [{ message: { content: 'not json at all' } }] }));

    const result = await getLocationQuality('Hotel Test', 'Barcelona');

    expect(result.ok).toBe(false);
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('reports failure when the classifier JSON is missing required fields', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, realPlacesResponse))
      .mockResolvedValueOnce(jsonResponse(200, nearbyResponse(qualifyingPois)))
      .mockResolvedValueOnce(jsonResponse(200, { choices: [{ message: { content: '{"vibeTag":"Only a tag"}' } }] }));

    const result = await getLocationQuality('Hotel Test', 'Barcelona');

    expect(result.ok).toBe(false);
  });

  it('never calls the classifier at all when there are not enough qualifying POIs', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, realPlacesResponse))
      .mockResolvedValueOnce(jsonResponse(200, nearbyResponse([{ name: 'Only One', rating: 4.5 }])));
    global.fetch = fetchMock;

    await getLocationQuality('Hotel Test', 'Barcelona');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
