import { query } from '../../db/client'
import { getActiveDeals } from '../dealDetection'

jest.mock('../../db/client', () => ({
  query: jest.fn(),
}))

const mockQuery = query as jest.MockedFunction<typeof query>

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
      'd.deal_price_cents <= $5',
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
