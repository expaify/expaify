import { runSnapshotsForMarket, RateLimitError } from '../snapshot'

jest.mock('../../db/client', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
}))

const MIA = { id: 1, city: 'Miami', country: 'US', iata: 'MIA' }

describe('runSnapshotsForMarket provider-failure visibility (REPAIR-PIPELINE-SILENT-FAILURE-VISIBILITY-01)', () => {
  const originalKey = process.env.RAPIDAPI_KEY

  beforeEach(() => {
    process.env.RAPIDAPI_KEY = 'test-key'
    global.fetch = jest.fn()
  })

  afterAll(() => {
    process.env.RAPIDAPI_KEY = originalKey
  })

  it('surfaces providerErrors when every provider fails, instead of silently reporting hotelsProcessed: 0 with no explanation', async () => {
    ;(global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('booking-com15: 500 Internal Server Error'))
      .mockRejectedValueOnce(new Error('booking-com v1: ECONNRESET'))
      .mockRejectedValueOnce(new Error('tripadvisor16: 403 Forbidden'))

    const [result] = await runSnapshotsForMarket(MIA, 0)

    expect(result.hotelsProcessed).toBe(0)
    // This is the actual regression this ticket exists to fix: a silent zero
    // used to be indistinguishable from "the pipeline is broken." Now the
    // reason for each provider's failure must be visible.
    expect(result.providerErrors).toBeDefined()
    expect(result.providerErrors).toHaveLength(3)
    expect(result.providerErrors?.some(e => e.includes('500 Internal Server Error'))).toBe(true)
    expect(result.providerErrors?.some(e => e.includes('ECONNRESET'))).toBe(true)
    expect(result.providerErrors?.some(e => e.includes('403 Forbidden'))).toBe(true)
  })

  it('records an empty-result reason (not a thrown error) when a provider responds ok but with nothing', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { hotels: [] } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ result: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { data: [] } }) })

    const [result] = await runSnapshotsForMarket(MIA, 0)

    expect(result.hotelsProcessed).toBe(0)
    expect(result.providerErrors).toHaveLength(3)
    expect(result.providerErrors?.every(e => e.includes('returned 0 results'))).toBe(true)
  })

  it('omits providerErrors entirely once any provider succeeds -- a normal night stays quiet', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          hotels: [{
            property: {
              id: '123', name: 'Test Hotel', propertyClass: 4,
              photoUrls: ['https://example.com/a.jpg'],
              priceBreakdown: { grossPrice: { value: 150 } },
            },
          }],
        },
      }),
    })

    const [result] = await runSnapshotsForMarket(MIA, 0)

    expect(result.hotelsProcessed).toBe(1)
    expect(result.providerErrors).toBeUndefined()
  })

  it('still re-throws RateLimitError out of runSnapshotsForMarket unchanged (the route handler, not this function, decides what to do with it)', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })

    await expect(runSnapshotsForMarket(MIA, 0)).rejects.toThrow(RateLimitError)
    // Only one call: rate limit must stop rotation immediately, not try all 3.
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})

describe('RateLimitError', () => {
  it('is a real Error subclass carrying a stable message', () => {
    const err = new RateLimitError()
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toMatch(/quota exhausted/i)
  })
})
