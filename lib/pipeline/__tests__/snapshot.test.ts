import { runSnapshotsForMarket, RateLimitError } from '../snapshot'
import { query } from '../../db/client'

jest.mock('../../db/client', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
}))

const MIA = { id: 1, city: 'Miami', country: 'US', iata: 'MIA' }

describe('runSnapshotsForMarket provider-failure visibility (REPAIR-PIPELINE-SILENT-FAILURE-VISIBILITY-01)', () => {
  const originalKey = process.env.RAPIDAPI_KEY

  beforeEach(() => {
    process.env.RAPIDAPI_KEY = 'test-key'
    global.fetch = jest.fn()
    ;(query as jest.Mock).mockClear()
  })

  afterAll(() => {
    process.env.RAPIDAPI_KEY = originalKey
  })

  it('surfaces providerErrors when every provider fails, instead of silently reporting hotelsProcessed: 0 with no explanation', async () => {
    ;(global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('booking-com15: 500 Internal Server Error'))
      .mockRejectedValueOnce(new Error('booking-com v1: ECONNRESET'))
      .mockRejectedValueOnce(new Error('tripadvisor16: 403 Forbidden'))
    // priceline-com2 has its own separate key (RAPIDAPI_KEY_PRICELINE), unset
    // here -- it never calls fetch, just contributes its own "0 results" entry.

    const [result] = await runSnapshotsForMarket(MIA, 0)

    expect(result.hotelsProcessed).toBe(0)
    // This is the actual regression this ticket exists to fix: a silent zero
    // used to be indistinguishable from "the pipeline is broken." Now the
    // reason for each provider's failure must be visible.
    expect(result.providerErrors).toBeDefined()
    expect(result.providerErrors).toHaveLength(5)
    expect(result.providerErrors?.some(e => e.includes('500 Internal Server Error'))).toBe(true)
    expect(result.providerErrors?.some(e => e.includes('ECONNRESET'))).toBe(true)
    expect(result.providerErrors?.some(e => e.includes('403 Forbidden'))).toBe(true)
    expect(result.providerErrors?.some(e => e.includes('fetchPricelineCom'))).toBe(true)
  })

  it('records an empty-result reason (not a thrown error) when a provider responds ok but with nothing', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { hotels: [] } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ result: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { data: [] } }) })

    const [result] = await runSnapshotsForMarket(MIA, 0)

    expect(result.hotelsProcessed).toBe(0)
    expect(result.providerErrors).toHaveLength(5)
    expect(result.providerErrors?.filter(e => e.includes('returned 0 results'))).toHaveLength(5)
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

  // Confirmed live (2026-08-06): booking-com15's grossPrice is the TOTAL for
  // the whole stay, not a nightly rate -- querying the same hotel/dates for
  // 1 night vs 2 nights returned $207.26 vs $389.12, not a flat value. This
  // provider stored prices ~2x too high (undivided by NIGHTS) since its
  // first commit, unlike fetchBookingComCoords, which already divided.
  it('stores grossPrice divided by NIGHTS, not the raw total-for-stay value', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          hotels: [{
            property: {
              id: '2822154', name: 'Motel One Barcelona-Ciutadella', propertyClass: 3,
              photoUrls: ['https://example.com/a.jpg'],
              priceBreakdown: { grossPrice: { value: 389.12 } }, // 2-night total, per the live check above
            },
          }],
        },
      }),
    })

    const [result] = await runSnapshotsForMarket(MIA, 0)
    expect(result.hotelsProcessed).toBe(1)

    const insertCall = (query as jest.Mock).mock.calls.find(([sql]) => sql.includes('INSERT INTO price_snapshots'))
    expect(insertCall).toBeDefined()
    const priceCents = insertCall?.[1]?.[8]
    expect(priceCents).toBe(19456) // $194.56/night ($389.12 / 2), not the undivided $389.12 (38912 cents)
  })

  it('stores TripAdvisor bubbles as review evidence and never as property-class stars', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          data: [{
            id: '123',
            title: '1. Test Hotel',
            bubbleRating: { rating: 4.5, count: '(600)' },
            priceForDisplay: '$125',
          }],
        },
      }),
    })

    const [result] = await runSnapshotsForMarket(MIA, 2)
    expect(result.hotelsProcessed).toBe(1)

    const insertCall = (query as jest.Mock).mock.calls.find(([sql]) => sql.includes('INSERT INTO price_snapshots'))
    expect(insertCall?.[1]?.[2]).toBeNull()
    expect(JSON.parse(insertCall?.[1]?.[3])).toMatchObject({
      state: 'ready',
      providerPropertyId: 'ta_123',
      provenance: 'provider_only',
      score: { value: 4.5, scaleMax: 5 },
      overallReviewCount: 600,
    })
  })

  it('still re-throws RateLimitError out of runSnapshotsForMarket unchanged (the route handler, not this function, decides what to do with it)', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })

    await expect(runSnapshotsForMarket(MIA, 0)).rejects.toThrow(RateLimitError)
    // Only one call: rate limit must stop rotation immediately, not try all 4.
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})

describe('fetchPricelineCom (4th rotation provider, separate RAPIDAPI_KEY_PRICELINE)', () => {
  const originalKey = process.env.RAPIDAPI_KEY
  const originalPricelineKey = process.env.RAPIDAPI_KEY_PRICELINE

  beforeEach(() => {
    process.env.RAPIDAPI_KEY = 'test-key'
    process.env.RAPIDAPI_KEY_PRICELINE = 'test-priceline-key'
    global.fetch = jest.fn()
    ;(query as jest.Mock).mockClear()
  })

  afterAll(() => {
    process.env.RAPIDAPI_KEY = originalKey
    process.env.RAPIDAPI_KEY_PRICELINE = originalPricelineKey
  })

  // marketIndex 3 makes priceline (index 3 in PROVIDERS) the rotation's
  // starting provider, so a single mock response is enough to reach it.
  it('parses a real priceline-com2 /hotels/search response into HotelEntry shape', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          hotels: [{
            hotelId: '1915603',
            name: 'INNSiDE by Melia Barcelona Aeropuerto',
            starRating: 4,
            images: [{ fastlyUrl: 'https://assets.pclncdn.com/example.jpg' }],
            ratesSummary: { nightlyRateIncludingTaxesAndFees: '153.14', minCurrencyCode: 'USD' },
          }],
        },
      }),
    })

    const [result] = await runSnapshotsForMarket(MIA, 3)

    expect(result.hotelsProcessed).toBe(1)
    expect(result.providerErrors).toBeUndefined()
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('priceline-com2.p.rapidapi.com/hotels/search')
    expect(url).toContain('locationId=3000003311') // MIA's Priceline city id
  })

  // Confirmed live against real Vegas listings (2026-08-06): ratesSummary.minPrice
  // is a pre-tax/fee teaser figure that understated real prices by 8-13x (e.g.
  // Flamingo Las Vegas: minPrice "6.00" vs the real nightlyRateIncludingTaxesAndFees
  // "62.99"). Using minPrice would have stored fabricated near-zero "deals".
  it('stores the fee-inclusive nightly price, not the pre-fee teaser minPrice', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          hotels: [{
            hotelId: '999',
            name: 'Flamingo Las Vegas',
            starRating: 3,
            images: [{ fastlyUrl: 'https://assets.pclncdn.com/flamingo.jpg' }],
            ratesSummary: {
              minPrice: '6.00', // the misleading pre-fee figure -- must NOT be used
              nightlyRateIncludingTaxesAndFees: '62.99',
              grandTotal: '125.98',
            },
          }],
        },
      }),
    })

    const [result] = await runSnapshotsForMarket(MIA, 3)
    expect(result.hotelsProcessed).toBe(1)

    const insertCall = (query as jest.Mock).mock.calls.find(([sql]) => sql.includes('INSERT INTO price_snapshots'))
    expect(insertCall).toBeDefined()
    const priceCents = insertCall?.[1]?.[8]
    expect(priceCents).toBe(6299) // $62.99, not the fake $6.00 teaser (600 cents)
  })

  it('is silently skipped (no network call) when RAPIDAPI_KEY_PRICELINE is unset, but still reports a providerErrors reason', async () => {
    delete process.env.RAPIDAPI_KEY_PRICELINE
    // Rotation tries the other 3 providers next since none of them succeed either.
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

    const [result] = await runSnapshotsForMarket(MIA, 3)

    // priceline's own attempt (first in this rotation, marketIndex 3) never
    // hits fetch -- confirm none of the real network calls targeted it.
    const calledUrls = (global.fetch as jest.Mock).mock.calls.map(([url]) => url)
    expect(calledUrls.every(url => !url.includes('priceline-com2'))).toBe(true)
    expect(result.providerErrors?.some(e => e.startsWith('fetchPricelineCom:'))).toBe(true)
  })
})

describe('RateLimitError', () => {
  it('is a real Error subclass carrying a stable message', () => {
    const err = new RateLimitError()
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toMatch(/quota exhausted/i)
  })
})
