import { query } from '../../db/client'
import { getActiveDeals, getDealById, getTrackedDealById, detectDealsForMarket } from '../dealDetection'

jest.mock('../../db/client', () => ({
  query: jest.fn(),
}))

const mockQuery = query as jest.MockedFunction<typeof query>

function trackedRow(overrides: Partial<{
  hotel_id: string
  hotel_name: string
  stars: number | null
  photo_url: string | null
  check_in: Date
  market_id: number
  city: string
  median_price_cents: number
  latest_price_cents: number
  latest_captured_at: Date
  snapshot_count: number
}> = {}) {
  return {
    hotel_id: 'bk_15386643',
    hotel_name: 'Hotel Grande Athina',
    stars: 4,
    photo_url: 'https://example.com/photo.jpg',
    check_in: new Date('2026-09-01T00:00:00.000Z'),
    market_id: 17,
    city: 'Athens',
    median_price_cents: 12000,
    latest_price_cents: 9000,
    latest_captured_at: new Date('2026-08-05T12:00:00.000Z'),
    snapshot_count: 5,
    ...overrides,
  }
}

describe('detectDealsForMarket history grouping (2026-09-04 fragmentation fix)', () => {
  beforeEach(() => {
    mockQuery.mockReset()
  })

  it('groups snapshot history by identity only (hotel_id, check_in, currency), never by display fields', async () => {
    // Regression guard: grouping by hotel_name/stars/photo_url (in addition
    // to identity) previously let a provider's routine photo/name refresh
    // silently split one hotel's real price history into thin sibling
    // groups -- confirmed live in production (a Miami hotel's real 10-night
    // history fragmented into an 8-row and a 2-row group over one photo_url
    // change), corrupting the median and, worse, letting the thin sibling's
    // forced 'expire' clobber the active deal the fat sibling had just
    // flagged, in undefined row order. Nobody should be able to
    // "simplify" this query back to grouping on display fields again.
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [] })

    await detectDealsForMarket({ id: 1, city: 'Miami', country: 'US', iata: 'MIA' })

    const sql = String(mockQuery.mock.calls[0][0])
    expect(sql).toMatch(/GROUP BY hotel_id, check_in, currency/)
    expect(sql).toContain('JOIN LATERAL')
    expect(sql).not.toMatch(/GROUP BY[^)]*photo_url/)
    expect(sql).not.toMatch(/GROUP BY[^)]*hotel_name/)
    expect(sql).not.toMatch(/GROUP BY[^)]*stars/)
  })
})

describe('getTrackedDealById', () => {
  beforeEach(() => {
    mockQuery.mockReset()
  })

  it('parses the hotel id and check-in date out of a tracked- synthetic id and queries by them', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [trackedRow()],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    })

    const deal = await getTrackedDealById('tracked-bk_15386643-2026-09-01')

    expect(deal).not.toBeNull()
    expect(deal?.hotel_id).toBe('bk_15386643')
    expect(deal?.check_in_date).toBe('2026-09-01')
    expect(deal?.city).toBe('Athens')
    expect(deal?.id).toBe('tracked-bk_15386643-2026-09-01')

    const [sql, params] = mockQuery.mock.calls[0]
    expect(String(sql)).toContain('g.hotel_id = $1 AND g.check_in = $2::date')
    expect(params).toEqual(['bk_15386643', '2026-09-01'])
  })

  it('returns null without querying when the id is not a tracked- id', async () => {
    const deal = await getTrackedDealById('deal_real_123')

    expect(deal).toBeNull()
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns null without querying when the id has no parseable trailing date', async () => {
    const deal = await getTrackedDealById('tracked-bk_15386643')

    expect(deal).toBeNull()
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('returns null when the underlying snapshot data is gone (e.g. check-in has passed)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: [],
    })

    const deal = await getTrackedDealById('tracked-bk_15386643-2026-09-01')

    expect(deal).toBeNull()
  })

  it('never fabricates a discount from fewer than 3 real observations', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [trackedRow({ snapshot_count: 2, median_price_cents: 20000, latest_price_cents: 9000 })],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    })

    const deal = await getTrackedDealById('tracked-bk_15386643-2026-09-01')

    expect(deal?.discount_pct).toBe(0)
    expect(deal?.median_price_cents).toBe(deal?.deal_price_cents)
  })
})

describe('getDealById routing', () => {
  beforeEach(() => {
    mockQuery.mockReset()
  })

  it('delegates tracked- ids to the price_snapshots lookup instead of querying the deals table', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [trackedRow()],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    })

    const deal = await getDealById('tracked-bk_15386643-2026-09-01')

    expect(deal?.hotel_id).toBe('bk_15386643')
    const [sql] = mockQuery.mock.calls[0]
    expect(String(sql)).not.toContain('FROM deals d')
  })

  it('still queries the deals table directly for a normal deal id', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: [],
    })

    await getDealById('deal_real_123')

    const [sql, params] = mockQuery.mock.calls[0]
    expect(String(sql)).toContain('FROM deals d')
    expect(params).toEqual(['deal_real_123'])
  })
})

describe('getActiveDeals ordering', () => {
  beforeEach(() => {
    mockQuery.mockReset()
    mockQuery.mockResolvedValue({
      rows: [],
      rowCount: 0,
      command: 'SELECT',
      oid: 0,
      fields: [],
    })
  })

  it.each([
    ['newest', 'd.first_seen DESC, d.id ASC'],
    ['discount', 'd.discount_pct DESC, d.first_seen DESC, d.id ASC'],
    ['price', 'd.deal_price_cents ASC, d.first_seen DESC, d.id ASC'],
  ] as const)('uses deterministic %s ordering before pagination', async (sort, expectedOrder) => {
    await getActiveDeals({ sort, limit: 12, offset: 24 })

    const sql = String(mockQuery.mock.calls[0][0])
    expect(sql).toContain(`ORDER BY ${expectedOrder}`)
    expect(sql.indexOf(`ORDER BY ${expectedOrder}`)).toBeLessThan(sql.indexOf('LIMIT $1 OFFSET $2'))
    expect(mockQuery.mock.calls[0][1]).toEqual([12, 24, 0])
  })

  it('applies every active filter before price ordering and pagination', async () => {
    await getActiveDeals({
      sort: 'price',
      limit: 12,
      offset: 0,
      minDiscount: 30,
      marketId: 7,
      maxPriceCents: 25_000,
      minStars: 4,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      includeMock: false,
    })

    const sql = String(mockQuery.mock.calls[0][0])
    const orderIndex = sql.indexOf('ORDER BY d.deal_price_cents ASC, d.first_seen DESC, d.id ASC')
    for (const filter of [
      'd.discount_pct >= $3',
      'd.market_id = $4',
      "d.currency = 'USD' AND d.deal_price_cents <= $5",
      'd.stars >= $6',
      'd.check_in_date >= $7',
      'd.check_in_date <= $8',
      'd.is_mock = false',
    ]) {
      expect(sql).toContain(filter)
      expect(sql.indexOf(filter)).toBeLessThan(orderIndex)
    }
    expect(mockQuery.mock.calls[0][1]).toEqual([
      12,
      0,
      30,
      7,
      25_000,
      4,
      '2026-08-01',
      '2026-08-31',
    ])
  })
})
