import { getActiveMarkets, getAnchorCheckInDate, runSnapshotsForMarket, RateLimitError } from '../snapshot'
import { query } from '../../db/client'

jest.mock('../../db/client', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
}))

const MIA = { id: 1, city: 'Miami', country: 'US', iata: 'MIA' }

describe('getAnchorCheckInDate per-market snapshot-depth scheduling (REPAIR-DEAL-PIPELINE-ANCHOR-ROTATION-01)', () => {
  beforeEach(() => {
    ;(query as jest.Mock).mockClear()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('builds the 6-candidate pool as the next six 1st/15th dates strictly after today', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T12:00:00Z'))
    ;(query as jest.Mock).mockResolvedValueOnce({ rows: [] })

    await getAnchorCheckInDate(1)

    const [, params] = (query as jest.Mock).mock.calls[0]
    expect(params[1]).toEqual([
      '2026-09-15', '2026-10-01', '2026-10-15', '2026-11-01', '2026-11-15', '2026-12-01',
    ])
  })

  it('excludes today itself when today is exactly an anchor date', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-15T12:00:00Z'))
    ;(query as jest.Mock).mockResolvedValueOnce({ rows: [] })

    await getAnchorCheckInDate(1)

    const [, params] = (query as jest.Mock).mock.calls[0]
    expect(params[1]).toEqual([
      '2026-10-01', '2026-10-15', '2026-11-01', '2026-11-15', '2026-12-01', '2026-12-15',
    ])
  })

  it('rolls correctly across a year boundary', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-12-20T12:00:00Z'))
    ;(query as jest.Mock).mockResolvedValueOnce({ rows: [] })

    await getAnchorCheckInDate(1)

    const [, params] = (query as jest.Mock).mock.calls[0]
    expect(params[1]).toEqual([
      '2027-01-01', '2027-01-15', '2027-02-01', '2027-02-15', '2027-03-01', '2027-03-15',
    ])
  })

  // Regression guard for a real incident (2026-09-16): a first attempt at
  // widening this pool used relative day-offsets from `today` (e.g.
  // today+14) instead of fixed calendar dates. That passed every
  // point-in-time test above, but failed exactly this invariant: because
  // the whole pool shifts by one day every night, no check_in is ever
  // queried on two consecutive nights, so per-hotel snapshot depth can
  // never exceed 1 -- permanently, for every market. Caught by independent
  // review, not by tests, because no existing test simulated more than one
  // "today". This test simulates two consecutive nights and asserts the
  // pool has real overlap, which a relative-offset scheme would fail.
  it('keeps candidate dates stable across consecutive nights so depth can accumulate', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T12:00:00Z'))
    ;(query as jest.Mock).mockResolvedValueOnce({ rows: [] })
    await getAnchorCheckInDate(1)
    const nightOne = (query as jest.Mock).mock.calls[0][1][1] as string[]

    jest.useFakeTimers().setSystemTime(new Date('2026-09-05T12:00:00Z'))
    ;(query as jest.Mock).mockResolvedValueOnce({ rows: [] })
    await getAnchorCheckInDate(1)
    const nightTwo = (query as jest.Mock).mock.calls[1][1][1] as string[]

    const overlap = nightOne.filter((d) => nightTwo.includes(d))
    expect(overlap.length).toBeGreaterThan(0)
  })

  it('picks the nearest candidate when nothing has reached MIN_SNAPSHOTS yet', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T12:00:00Z'))
    ;(query as jest.Mock).mockResolvedValueOnce({ rows: [] })

    await expect(getAnchorCheckInDate(1)).resolves.toBe('2026-09-15')
  })

  // Regression guard for a second real incident (2026-09-30): the previous
  // version of this function abandoned a date the instant its depth crossed
  // MIN_SNAPSHOTS and moved on to the next candidate -- which silently froze
  // "latest price" forever, since the nightly refresh call never touched
  // that date again. Confirmed live: every mature hotel across all 36
  // markets sat at exactly depth 8, never higher; real Booking prices
  // fetched independently for the frozen Las Vegas batch showed hotels
  // sitting 22-24% below median in real time that the site had no way of
  // knowing about, because the pipeline had stopped checking five nights
  // earlier. A mature anchor must keep being selected -- never skipped --
  // so its latest price keeps refreshing for as long as it's the soonest
  // still-valid candidate.
  it('keeps refreshing the nearest anchor even after it clears MIN_SNAPSHOTS, instead of abandoning it for the next candidate', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T12:00:00Z'))
    ;(query as jest.Mock).mockResolvedValueOnce({
      rows: [
        { check_in: '2026-09-15', cnt: 16 },
        { check_in: '2026-10-01', cnt: 5 },
      ],
    })

    await expect(getAnchorCheckInDate(1)).resolves.toBe('2026-09-15')
  })

  it('keeps selecting the same date across many consecutive nights even as its depth climbs well past MIN_SNAPSHOTS', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T12:00:00Z'))
    for (const depth of [1, 8, 9, 15, 30]) {
      ;(query as jest.Mock).mockResolvedValueOnce({
        rows: [{ check_in: '2026-09-15', cnt: depth }],
      })
      await expect(getAnchorCheckInDate(1)).resolves.toBe('2026-09-15')
    }
  })

  it('logs the selected market, check-in, and current depth exactly once', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T12:00:00Z'))
    ;(query as jest.Mock).mockResolvedValueOnce({
      rows: [{ check_in: '2026-09-15', cnt: 3 }],
    })

    await expect(getAnchorCheckInDate(7)).resolves.toBe('2026-09-15')

    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][0]).toContain('marketId=7')
    expect(log.mock.calls[0][0]).toContain('checkIn=2026-09-15')
    expect(log.mock.calls[0][0]).toContain('depth=3')
    log.mockRestore()
  })

  it('logs depth 0 when the selected date has no snapshot rows', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T12:00:00Z'))
    ;(query as jest.Mock).mockResolvedValueOnce({ rows: [] })

    await expect(getAnchorCheckInDate(1)).resolves.toBe('2026-09-15')

    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][0]).toContain('depth=0')
    log.mockRestore()
  })

  it('measures maturity per hotel, not per market-wide touched day', async () => {
    // Regression guard (real production audit finding): fetchWithRotation
    // returns only ONE provider's hotels per night (first success wins, no
    // merge across providers), and each provider writes a disjoint hotel_id
    // prefix (bk_/ta_/pl_/ag_). A market-wide "was this date touched today"
    // count would read as mature the moment ANY provider's hotels reach 8
    // combined scan-days — even if the hotels that actually matter (the
    // primary provider's, which is what's shown/flagged) are still stuck at
    // 5 because a couple of nights fell back to a different provider after a
    // 429. The query must aggregate distinct snapshot_date PER hotel_id
    // first, then take the max across hotels for that check-in — never a
    // single market-wide day count.
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T12:00:00Z'))
    ;(query as jest.Mock).mockResolvedValueOnce({
      rows: [{ check_in: '2026-09-15', cnt: 5 }],
    })

    await expect(getAnchorCheckInDate(1)).resolves.toBe('2026-09-15')

    const [sql] = (query as jest.Mock).mock.calls[0]
    expect(sql).toMatch(/GROUP BY check_in,\s*hotel_id/)
    expect(sql).toMatch(/MAX\(per_hotel\)/)
    expect(sql).toMatch(/COUNT\(DISTINCT snapshot_date\)/)
  })

  it('excludes mock snapshots from the maturity count', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T12:00:00Z'))
    ;(query as jest.Mock).mockResolvedValueOnce({ rows: [] })

    await getAnchorCheckInDate(1)

    const [sql] = (query as jest.Mock).mock.calls[0]
    expect(sql).toMatch(/is_mock = false/)
  })

  it('still selects the nearest candidate even when every candidate has long cleared MIN_SNAPSHOTS', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T12:00:00Z'))
    ;(query as jest.Mock).mockResolvedValueOnce({
      rows: [
        { check_in: '2026-09-15', cnt: 20 },
        { check_in: '2026-10-01', cnt: 18 },
        { check_in: '2026-10-15', cnt: 16 },
        { check_in: '2026-11-01', cnt: 14 },
        { check_in: '2026-11-15', cnt: 12 },
        { check_in: '2026-12-01', cnt: 10 },
      ],
    })

    await expect(getAnchorCheckInDate(1)).resolves.toBe('2026-09-15')
  })

  it('queries snapshot history scoped to the given market only', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T12:00:00Z'))
    ;(query as jest.Mock).mockResolvedValueOnce({ rows: [] })

    await getAnchorCheckInDate(42)

    const [, params] = (query as jest.Mock).mock.calls[0]
    expect(params[0]).toBe(42)
  })
})

describe('getActiveMarkets daily rotation', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('rotates the stable id-ordered markets by the UTC day of year', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-02T23:30:00-08:00'))
    ;(query as jest.Mock).mockResolvedValueOnce({
      rows: [
        MIA,
        { id: 2, city: 'New York', country: 'US', iata: 'NYC' },
        { id: 3, city: 'Paris', country: 'FR', iata: 'PAR' },
        { id: 4, city: 'London', country: 'GB', iata: 'LON' },
      ],
    })

    await expect(getActiveMarkets()).resolves.toEqual([
      { id: 4, city: 'London', country: 'GB', iata: 'LON' },
      MIA,
      { id: 2, city: 'New York', country: 'US', iata: 'NYC' },
      { id: 3, city: 'Paris', country: 'FR', iata: 'PAR' },
    ])
  })

  it('returns an empty market set without attempting modulo by zero', async () => {
    ;(query as jest.Mock).mockResolvedValueOnce({ rows: [] })

    await expect(getActiveMarkets()).resolves.toEqual([])
  })
})

describe('runSnapshotsForMarket provider-failure visibility (REPAIR-PIPELINE-SILENT-FAILURE-VISIBILITY-01)', () => {
  const originalKey = process.env.RAPIDAPI_KEY
  const originalKey3 = process.env.RAPIDAPI_KEY_3

  beforeEach(() => {
    process.env.RAPIDAPI_KEY = 'test-key'
    process.env.RAPIDAPI_KEY_3 = 'test-key-3'
    global.fetch = jest.fn()
    ;(query as jest.Mock).mockClear()
  })

  afterAll(() => {
    process.env.RAPIDAPI_KEY = originalKey
    process.env.RAPIDAPI_KEY_3 = originalKey3
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
    expect(result.providerErrors).toHaveLength(4)
    expect(result.providerErrors?.some(e => e.includes('500 Internal Server Error'))).toBe(true)
    expect(result.providerErrors?.some(e => e.includes('ECONNRESET'))).toBe(true)
    expect(result.providerErrors?.some(e => e.includes('403 Forbidden'))).toBe(true)
  })

  it('records an empty-result reason (not a thrown error) when a provider responds ok but with nothing', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { hotels: [] } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ result: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { data: [] } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { citySearch: { properties: [] } } }) })

    const [result] = await runSnapshotsForMarket(MIA, 0)

    expect(result.hotelsProcessed).toBe(0)
    expect(result.providerErrors).toHaveLength(4)
    expect(result.providerErrors?.filter(e => e.includes('returned 0 results'))).toHaveLength(4)
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
    // storeSnapshot's param order: 0=hotel_id,1=hotel_name,2=stars,
    // 3=review_evidence,4=photo_url,5=photo_urls,6=market_id,7=check_in,
    // 8=nights,9=price_cents,10=is_mock -- price_cents moved from index 8 to
    // 9 when photo_urls was added at index 5 (2026-10-02).
    const priceCents = insertCall?.[1]?.[9]
    expect(priceCents).toBe(19456) // $194.56/night ($389.12 / 2), not the undivided $389.12 (38912 cents)
  })

  // 2026-10-02 (UXD/UXR-HOTEL-VIEW-RICHER-MEDIA-01): booking-com15 already
  // returns multiple real photos and a real review score/count in the same
  // response this pipeline already fetches nightly -- only photoUrls[0] was
  // ever kept, and no review data was captured for this provider at all.
  it('captures every real photo booking-com15 returns, not just the first', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: { hotels: [{
          property: {
            id: '555', name: 'Multi Photo Hotel', propertyClass: 4,
            photoUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg', 'https://example.com/c.jpg'],
            priceBreakdown: { grossPrice: { value: 200 } },
          },
        }] },
      }),
    })

    await runSnapshotsForMarket(MIA, 0)

    const insertCall = (query as jest.Mock).mock.calls.find(([sql]) => sql.includes('INSERT INTO price_snapshots'))
    expect(insertCall?.[1]?.[4]).toBe('https://example.com/a.jpg') // photo_url unchanged: still the first
    expect(insertCall?.[1]?.[5]).toEqual([
      'https://example.com/a.jpg', 'https://example.com/b.jpg', 'https://example.com/c.jpg',
    ])
  })

  it('caps photo_urls at MAX_PHOTOS_PER_HOTEL rather than storing an unbounded array', async () => {
    const manyPhotos = Array.from({ length: 20 }, (_, i) => `https://example.com/${i}.jpg`)
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: { hotels: [{
          property: {
            id: '555', name: 'Many Photos Hotel', propertyClass: 4,
            photoUrls: manyPhotos,
            priceBreakdown: { grossPrice: { value: 200 } },
          },
        }] },
      }),
    })

    await runSnapshotsForMarket(MIA, 0)

    const insertCall = (query as jest.Mock).mock.calls.find(([sql]) => sql.includes('INSERT INTO price_snapshots'))
    const storedPhotos = insertCall?.[1]?.[5] as string[]
    expect(storedPhotos).toHaveLength(8)
    expect(storedPhotos).toEqual(manyPhotos.slice(0, 8))
  })

  it('stores a real booking-com15 review score and count as review_evidence, on its own /10 scale', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: { hotels: [{
          property: {
            id: '555', name: 'Reviewed Hotel', propertyClass: 4,
            photoUrls: ['https://example.com/a.jpg'],
            priceBreakdown: { grossPrice: { value: 200 } },
            reviewScore: 8.6, reviewCount: 1204, reviewScoreWord: 'Excellent',
          },
        }] },
      }),
    })

    await runSnapshotsForMarket(MIA, 0)

    const insertCall = (query as jest.Mock).mock.calls.find(([sql]) => sql.includes('INSERT INTO price_snapshots'))
    const reviewEvidence = JSON.parse(insertCall?.[1]?.[3] as string)
    expect(reviewEvidence).toMatchObject({
      state: 'ready',
      providerPropertyId: 'bk_555',
      providerId: 'booking-com15',
      provenance: 'provider_only',
      score: { value: 8.6, scaleMax: 10 },
      overallReviewCount: 1204,
    })
  })

  it('never fabricates a booking-com15 review score when the provider sends none', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: { hotels: [{
          property: {
            id: '555', name: 'Unreviewed Hotel', propertyClass: 4,
            photoUrls: ['https://example.com/a.jpg'],
            priceBreakdown: { grossPrice: { value: 200 } },
            // no reviewScore field at all
          },
        }] },
      }),
    })

    await runSnapshotsForMarket(MIA, 0)

    const insertCall = (query as jest.Mock).mock.calls.find(([sql]) => sql.includes('INSERT INTO price_snapshots'))
    expect(insertCall?.[1]?.[3]).toBeNull()
  })

  // 2026-10-02: widened to also fetch page 2, to grow the real pool of
  // hotels each market can ever flag a deal from. These three tests cover
  // the actual new behavior directly, rather than relying on incidental
  // pass/fail of the unrelated tests above (which happen to still pass
  // either because page 1 throws before page 2 is ever attempted, or
  // because an exhausted mock queue on page 2 degrades to [] via the
  // page-2 catch handler -- neither of those exercises real merging).
  it('merges hotels from both page 1 and page 2 of booking-com15', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { hotels: [{
            property: { id: '111', name: 'Page One Hotel', propertyClass: 4, photoUrls: [], priceBreakdown: { grossPrice: { value: 200 } } },
          }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { hotels: [{
            property: { id: '222', name: 'Page Two Hotel', propertyClass: 3, photoUrls: [], priceBreakdown: { grossPrice: { value: 160 } } },
          }] },
        }),
      })

    const [result] = await runSnapshotsForMarket(MIA, 0)

    expect(result.hotelsProcessed).toBe(2)
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(global.fetch).toHaveBeenNthCalledWith(1, expect.stringContaining('page_number=1'), expect.anything())
    expect(global.fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('page_number=2'), expect.anything())
  })

  it('dedupes a hotel id that appears on both page 1 and page 2', async () => {
    const sameHotel = {
      property: { id: '111', name: 'Same Hotel', propertyClass: 4, photoUrls: [], priceBreakdown: { grossPrice: { value: 200 } } },
    }
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { hotels: [sameHotel] } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { hotels: [sameHotel] } }) })

    const [result] = await runSnapshotsForMarket(MIA, 0)

    expect(result.hotelsProcessed).toBe(1)
  })

  it('keeps page 1 real results when page 2 throws, instead of losing the whole call', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { hotels: [{
            property: { id: '111', name: 'Page One Hotel', propertyClass: 4, photoUrls: [], priceBreakdown: { grossPrice: { value: 200 } } },
          }] },
        }),
      })
      .mockRejectedValueOnce(new Error('page 2: ECONNRESET'))

    const [result] = await runSnapshotsForMarket(MIA, 0)

    expect(result.hotelsProcessed).toBe(1)
    expect(result.providerErrors).toBeUndefined()
  })

  // Regression guard for a real bug caught via self-review before shipping
  // (2026-10-02): the first version of the page-2 catch handler re-threw a
  // RateLimitError instead of swallowing it, which meant a 429 on page 2
  // specifically discarded page 1's already-successful real results and
  // made the whole provider attempt look rate-limited. Page 1 is a
  // separate, already-completed HTTP call by the time page 2 runs -- its
  // real data must survive regardless of what happens to page 2.
  it('keeps page 1 real results when page 2 is rate-limited (429), not just on a generic error', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { hotels: [{
            property: { id: '111', name: 'Page One Hotel', propertyClass: 4, photoUrls: [], priceBreakdown: { grossPrice: { value: 200 } } },
          }] },
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })

    const [result] = await runSnapshotsForMarket(MIA, 0)

    expect(result.hotelsProcessed).toBe(1)
    expect(result.providerErrors).toBeUndefined()
    expect(result.rateLimitedCount).toBeUndefined()
  })

  it('does not attempt page 2 when page 1 itself is rate-limited', async () => {
    const originalPricelineKey = process.env.RAPIDAPI_KEY_PRICELINE
    process.env.RAPIDAPI_KEY_PRICELINE = 'test-key-priceline'

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: [{ hotel_id: '456', hotel_name: 'Fallback Hotel', class: 4, min_total_price: 200 }] }),
      })

    const [result] = await runSnapshotsForMarket(MIA, 0)

    process.env.RAPIDAPI_KEY_PRICELINE = originalPricelineKey

    // Exactly 2 real fetch calls total: booking-com15 page 1 (429, no page
    // 2 attempted) then the next provider in rotation succeeding -- proves
    // the 429 short-circuits before page 2, it doesn't silently eat a slot.
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(result.rateLimitedCount).toBe(1)
    expect(result.hotelsProcessed).toBe(1)
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

  it('captures every real photo TripAdvisor returns, not just the first', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          data: [{
            id: '123',
            title: 'Multi Photo Hotel',
            bubbleRating: { rating: 4.5, count: '(600)' },
            priceForDisplay: '$125',
            cardPhotos: [
              { sizes: { urlTemplate: 'https://example.com/{width}x{height}/a.jpg' } },
              { sizes: { urlTemplate: 'https://example.com/{width}x{height}/b.jpg' } },
            ],
          }],
        },
      }),
    })

    await runSnapshotsForMarket(MIA, 2)

    const insertCall = (query as jest.Mock).mock.calls.find(([sql]) => sql.includes('INSERT INTO price_snapshots'))
    expect(insertCall?.[1]?.[4]).toBe('https://example.com/600x400/a.jpg')
    expect(insertCall?.[1]?.[5]).toEqual([
      'https://example.com/600x400/a.jpg',
      'https://example.com/600x400/b.jpg',
    ])
  })

  it('records a provider 429 and continues rotation until another provider succeeds', async () => {
    // fetchBookingComCoords (the 2nd provider tried here) reads its own
    // RAPIDAPI_KEY_PRICELINE rather than the shared key -- needs a value so
    // it actually fetches instead of silently skipping.
    const originalPricelineKey = process.env.RAPIDAPI_KEY_PRICELINE
    process.env.RAPIDAPI_KEY_PRICELINE = 'test-key-priceline'

    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: [{
          hotel_id: '456', hotel_name: 'Fallback Hotel', class: 4,
          min_total_price: 200,
        }] }),
      })

    const [result] = await runSnapshotsForMarket(MIA, 0)

    process.env.RAPIDAPI_KEY_PRICELINE = originalPricelineKey

    expect(result.hotelsProcessed).toBe(1)
    expect(result.rateLimitedCount).toBe(1)
    expect(result.providerErrors).toContain('fetchBookingCom15: rate limited (429)')
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('authenticates TripAdvisor with the primary RAPIDAPI_KEY (same account as booking-com15)', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { data: [{ id: '123', title: 'Test Hotel', priceForDisplay: '$125' }] } }),
    })

    const [result] = await runSnapshotsForMarket(MIA, 2)

    expect(result.hotelsProcessed).toBe(1)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('tripadvisor16.p.rapidapi.com'),
      expect.objectContaining({ headers: expect.objectContaining({ 'X-RapidAPI-Key': 'test-key' }) }),
    )
  })
})

describe('RateLimitError', () => {
  it('is a real Error subclass carrying a stable message', () => {
    const err = new RateLimitError()
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toMatch(/quota exhausted/i)
  })
})
