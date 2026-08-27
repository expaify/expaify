import { NextRequest } from 'next/server'
import { getActiveMarkets, runSnapshotsForMarket } from '@/lib/pipeline/snapshot'
import { detectDealsForMarket, getActiveDeals } from '@/lib/pipeline/dealDetection'
import { POST } from '../route'

jest.mock('@/lib/pipeline/snapshot', () => {
  const actual = jest.requireActual('@/lib/pipeline/snapshot')
  return {
    ...actual,
    getActiveMarkets: jest.fn(),
    runSnapshotsForMarket: jest.fn(),
  }
})

jest.mock('@/lib/pipeline/dealDetection', () => ({
  detectDealsForMarket: jest.fn(),
  getActiveDeals: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/lib/email/sendDealAlert', () => ({ sendInstantAlerts: jest.fn() }))
jest.mock('@/lib/ai/generateHeadline', () => ({ generateHeadlines: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/lib/indexNow', () => ({ pingIndexNow: jest.fn().mockResolvedValue(undefined) }))

const mockGetActiveMarkets = getActiveMarkets as jest.MockedFunction<typeof getActiveMarkets>
const mockRunSnapshots = runSnapshotsForMarket as jest.MockedFunction<typeof runSnapshotsForMarket>
const mockDetectDeals = detectDealsForMarket as jest.MockedFunction<typeof detectDealsForMarket>
const mockGetActiveDeals = getActiveDeals as jest.MockedFunction<typeof getActiveDeals>

function pipelineRequest(): NextRequest {
  return new NextRequest('https://expaify.test/api/pipeline/run', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-secret', 'Content-Type': 'application/json' },
    body: '{}',
  })
}

const MARKETS = [
  { id: 1, city: 'Miami', country: 'US', iata: 'MIA' },
  { id: 2, city: 'New York', country: 'US', iata: 'NYC' },
  { id: 3, city: 'Paris', country: 'FR', iata: 'PAR' },
]

describe('POST /api/pipeline/run pipeline-health aggregation (REPAIR-PIPELINE-SILENT-FAILURE-VISIBILITY-01)', () => {
  const originalSecret = process.env.PIPELINE_SECRET

  beforeEach(() => {
    process.env.PIPELINE_SECRET = 'test-secret'
    mockGetActiveMarkets.mockReset().mockResolvedValue(MARKETS)
    mockRunSnapshots.mockReset()
    mockDetectDeals.mockReset().mockResolvedValue(0)
    mockGetActiveDeals.mockReset().mockResolvedValue([])
  })

  afterAll(() => {
    process.env.PIPELINE_SECRET = originalSecret
  })

  it('flags pipelineDegraded when most markets come back empty, even though the run itself succeeds', async () => {
    mockRunSnapshots
      .mockResolvedValueOnce([{ market: 'MIA', checkIn: '2026-09-01', hotelsProcessed: 0, providerErrors: ['all providers failed'] }])
      .mockResolvedValueOnce([{ market: 'NYC', checkIn: '2026-09-01', hotelsProcessed: 0, providerErrors: ['all providers failed'] }])
      .mockResolvedValueOnce([{ market: 'PAR', checkIn: '2026-09-01', hotelsProcessed: 20 }])

    const response = await POST(pipelineRequest())
    const body = await response.json()

    expect(body.ok).toBe(true)
    expect(body.emptyMarketCount).toBe(2)
    expect(body.marketsAttempted).toBe(3)
    // This is the actual point of the ticket: 2/3 empty must be loudly
    // flagged, not silently indistinguishable from a normal run.
    expect(body.pipelineDegraded).toBe(true)
  })

  it('does not flag pipelineDegraded on a normal night where most markets return real hotels', async () => {
    mockRunSnapshots
      .mockResolvedValueOnce([{ market: 'MIA', checkIn: '2026-09-01', hotelsProcessed: 20 }])
      .mockResolvedValueOnce([{ market: 'NYC', checkIn: '2026-09-01', hotelsProcessed: 20 }])
      .mockResolvedValueOnce([{ market: 'PAR', checkIn: '2026-09-01', hotelsProcessed: 0, providerErrors: ['returned 0 results'] }])

    const response = await POST(pipelineRequest())
    const body = await response.json()

    expect(body.emptyMarketCount).toBe(1)
    expect(body.pipelineDegraded).toBe(false)
  })

  it('counts a thrown per-market error as empty too, not just an explicit zero-hotels result', async () => {
    mockRunSnapshots
      .mockRejectedValueOnce(new Error('DB write failed'))
      .mockResolvedValueOnce([{ market: 'NYC', checkIn: '2026-09-01', hotelsProcessed: 0 }])
      .mockResolvedValueOnce([{ market: 'PAR', checkIn: '2026-09-01', hotelsProcessed: 0 }])

    const response = await POST(pipelineRequest())
    const body = await response.json()

    expect(body.emptyMarketCount).toBe(3)
    expect(body.pipelineDegraded).toBe(true)
  })

  it('processes markets concurrently with no more than six in flight', async () => {
    const markets = Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      city: `City ${index + 1}`,
      country: 'US',
      iata: `M${index + 1}`,
    }))
    let active = 0
    let peakActive = 0
    mockGetActiveMarkets.mockResolvedValue(markets)
    mockRunSnapshots.mockImplementation(async market => {
      active += 1
      peakActive = Math.max(peakActive, active)
      await new Promise<void>(resolve => setImmediate(resolve))
      active -= 1
      return [{ market: market.iata, checkIn: '2026-09-01', hotelsProcessed: 20 }]
    })

    const response = await POST(pipelineRequest())
    const body = await response.json()

    expect(peakActive).toBe(6)
    expect(mockRunSnapshots).toHaveBeenCalledTimes(8)
    expect(body.marketsAttempted).toBe(8)
  })

  it('reports provider rate limits without skipping later market batches', async () => {
    const markets = Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      city: `City ${index + 1}`,
      country: 'US',
      iata: `M${index + 1}`,
    }))
    mockGetActiveMarkets.mockResolvedValue(markets)
    mockRunSnapshots.mockImplementation(async (market, marketIndex) => {
      if (marketIndex === 1) {
        return [{ market: market.iata, checkIn: '2026-09-01', hotelsProcessed: 20, rateLimitedCount: 1 }]
      }
      return [{ market: market.iata, checkIn: '2026-09-01', hotelsProcessed: 20 }]
    })

    const response = await POST(pipelineRequest())
    const body = await response.json()

    expect(body.rateLimitedCount).toBe(1)
    expect(body.marketsAttempted).toBe(8)
    expect(mockRunSnapshots).toHaveBeenCalledTimes(8)
    expect(mockRunSnapshots).toHaveBeenCalledWith(markets[6], 6)
    expect(body.results.M7).toBeDefined()
    expect(body.results.M8).toBeDefined()
  })
})
