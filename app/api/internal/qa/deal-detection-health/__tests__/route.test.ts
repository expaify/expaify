import { NextRequest } from 'next/server'
import { GET } from '../route'
import { getActiveMarkets } from '@/lib/pipeline/snapshot'
import { getMarketSnapshotStats, type SnapshotRow } from '@/lib/pipeline/dealDetection'
import { MIN_SNAPSHOTS, DEAL_THRESHOLD, EXPIRE_THRESHOLD } from '@/lib/pipeline/dealRules'

jest.mock('@/lib/pipeline/snapshot', () => ({ getActiveMarkets: jest.fn() }))
jest.mock('@/lib/pipeline/dealDetection', () => ({ getMarketSnapshotStats: jest.fn() }))
const mockMarkets = getActiveMarkets as jest.MockedFunction<typeof getActiveMarkets>
const mockStats = getMarketSnapshotStats as jest.MockedFunction<typeof getMarketSnapshotStats>
const market = { id: 7, iata: 'LAX', city: 'Los Angeles', country: 'US' }
const request = (iata = '', auth = 'Bearer test-secret') => new NextRequest(
  `https://expaify.test/api/internal/qa/deal-detection-health${iata ? `?iata=${iata}` : ''}`,
  { headers: auth ? { authorization: auth } : {} },
)
const row = (overrides: Partial<SnapshotRow> = {}): SnapshotRow => ({
  hotel_id: 'hotel', hotel_name: 'Hotel', stars: 4, photo_url: null, photo_urls: null,
  check_in: new Date('2026-11-01T00:00:00Z'), currency: 'USD', avg_price_cents: 10000,
  median_price_cents: 10000, latest_price_cents: 7000, snapshot_count: MIN_SNAPSHOTS,
  is_mock: false, ...overrides,
})
const qr = (rows: SnapshotRow[]) => ({ rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] })

describe('GET /api/internal/qa/deal-detection-health', () => {
  const originalSecret = process.env.PIPELINE_SECRET
  beforeEach(() => {
    jest.resetAllMocks()
    process.env.PIPELINE_SECRET = 'test-secret'
    mockMarkets.mockResolvedValue([market])
    mockStats.mockResolvedValue(qr([]))
  })
  afterAll(() => {
    if (originalSecret === undefined) delete process.env.PIPELINE_SECRET
    else process.env.PIPELINE_SECRET = originalSecret
  })

  it.each(['', 'Bearer wrong-secret'])('rejects unauthorized requests (%s)', async auth => {
    expect((await GET(request('', auth))).status).toBe(401)
    expect(mockMarkets).not.toHaveBeenCalled()
    expect(mockStats).not.toHaveBeenCalled()
  })

  it('fails closed without a configured secret', async () => {
    delete process.env.PIPELINE_SECRET
    expect((await GET(request())).status).toBe(401)
    expect(mockMarkets).not.toHaveBeenCalled()
  })

  it('reports thin and mature histories using the real decision thresholds', async () => {
    mockStats.mockResolvedValue(qr([
      row({ hotel_id: 'thin', snapshot_count: MIN_SNAPSHOTS - 1, latest_price_cents: 5000 }),
      row({ hotel_id: 'mature', snapshot_count: MIN_SNAPSHOTS + 1 }),
    ]))
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, marketsChecked: ['LAX'], results: { LAX: {
      totalStayGroups: 2, comparableAfterCurrencyFilter: 2, multiCurrencyExcluded: 0,
      depthBuckets: { belowMinSnapshots: 1, atOrAboveMinSnapshots: 1 },
      decisionBuckets: { flag: 1, hold: 0, expire: 1 },
      thresholds: { MIN_SNAPSHOTS, DEAL_THRESHOLD, EXPIRE_THRESHOLD },
      examples: [
        { hotel_id: 'thin', check_in: '2026-11-01', snapshot_count: 7, median_price_cents: 10000, latest_price_cents: 5000, ratio: 0.5 },
        { hotel_id: 'mature', check_in: '2026-11-01', snapshot_count: 9, median_price_cents: 10000, latest_price_cents: 7000, ratio: 0.7 },
      ],
    } } })
  })

  it('excludes both currencies before counting depth, decisions, and examples', async () => {
    mockStats.mockResolvedValue(qr([
      row({ hotel_id: 'mixed' }), row({ hotel_id: 'mixed', currency: 'EUR', snapshot_count: 2 }),
      row({ hotel_id: 'mixed', check_in: new Date('2026-11-02T00:00:00Z'), latest_price_cents: 8500 }),
      row({ hotel_id: 'recovered', latest_price_cents: 8501 }),
      row({ hotel_id: 'invalid', median_price_cents: 0 }),
    ]))
    const body = await (await GET(request())).json()
    expect(body.results.LAX).toMatchObject({
      totalStayGroups: 5, comparableAfterCurrencyFilter: 3, multiCurrencyExcluded: 2,
      depthBuckets: { belowMinSnapshots: 0, atOrAboveMinSnapshots: 3 },
      decisionBuckets: { flag: 0, hold: 1, expire: 2 },
    })
    expect(body.results.LAX.examples).toHaveLength(3)
    expect(body.results.LAX.examples[2].ratio).toBeNull()
  })

  it('scopes lowercase IATA and caps examples at five', async () => {
    mockMarkets.mockResolvedValue([market, { ...market, id: 8, iata: 'JFK' }])
    mockStats.mockResolvedValue(qr(Array.from({ length: 6 }, (_, i) => row({ hotel_id: String(i) }))))
    const body = await (await GET(request('lax'))).json()
    expect(body.marketsChecked).toEqual(['LAX'])
    expect(body.results.LAX.examples).toHaveLength(5)
    expect(mockStats).toHaveBeenCalledTimes(1)
    expect(mockStats).toHaveBeenCalledWith(7)
  })

  it('includes empty active markets and returns no matches for unknown IATA', async () => {
    const body = await (await GET(request())).json()
    expect(body.results.LAX).toMatchObject({ totalStayGroups: 0, examples: [], decisionBuckets: { flag: 0, hold: 0, expire: 0 } })
    mockStats.mockClear()
    expect(await (await GET(request('XYZ'))).json()).toEqual({ ok: true, marketsChecked: [], results: {} })
    expect(mockStats).not.toHaveBeenCalled()
  })
})
