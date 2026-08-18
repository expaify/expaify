import { NextRequest } from 'next/server'
import { POST } from '../route'
import { query } from '@/lib/db/client'
import { getSubscription } from '@/lib/subscription'
import { recordDigestSkipped, sendDigest } from '@/lib/email/sendDailyDigest'

jest.mock('@/lib/db/client', () => ({ query: jest.fn() }))
jest.mock('@/lib/subscription', () => ({ getSubscription: jest.fn() }))
jest.mock('@/lib/email/sendDailyDigest', () => ({
  recordDigestSkipped: jest.fn(),
  sendDigest: jest.fn(),
  maxDigestDeals: jest.fn(() => 2),
}))

const mockQuery = query as jest.MockedFunction<typeof query>
const mockGetSubscription = getSubscription as jest.Mock
const mockRecordSkipped = recordDigestSkipped as jest.Mock
const mockSendDigest = sendDigest as jest.Mock

function request(email = 'qa@example.com', secret = 'test-secret') {
  return new NextRequest('https://expaify.test/api/internal/qa/force-digest', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}

function qr<T>(rows: T[]) {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] }
}

const subscription = {
  status: 'free', watchlist: ['Paris'], alertUnsubscribeToken: 'unsubscribe-token',
}

describe('POST /api/internal/qa/force-digest', () => {
  const originalSecret = process.env.PIPELINE_SECRET
  beforeEach(() => {
    process.env.PIPELINE_SECRET = 'test-secret'
    mockQuery.mockReset()
    mockGetSubscription.mockReset()
    mockRecordSkipped.mockReset()
    mockSendDigest.mockReset()
  })
  afterAll(() => {
    if (originalSecret === undefined) delete process.env.PIPELINE_SECRET
    else process.env.PIPELINE_SECRET = originalSecret
  })

  it('rejects a missing or incorrect pipeline secret', async () => {
    expect((await POST(request('qa@example.com', 'wrong'))).status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('sends real qualifying rows without freshness or delivery-dedup gates', async () => {
    const deal = {
      id: '22222222-2222-2222-2222-222222222222', hotel_name: 'Central Stay', city: 'Paris',
      stars: 4, photo_url: null, discount_pct: 50, deal_price_cents: 20000,
      median_price_cents: 40000, check_in_window: 'Sep 1 - Sep 3', snapshot_count: 12,
    }
    mockQuery.mockResolvedValueOnce(qr([{ id: 'user-1', email: 'qa@example.com' }]) as never)
      .mockResolvedValueOnce(qr([deal]) as never)
    mockGetSubscription.mockResolvedValue(subscription)

    const response = await POST(request())

    expect(await response.json()).toEqual({ sent: true, city: 'Paris', dealCount: 1, dealIds: [deal.id] })
    expect(mockQuery.mock.calls[1][0]).toContain('d.snapshot_count >= 8')
    expect(mockQuery.mock.calls[1][0]).not.toContain('first_seen >=')
    expect(mockQuery.mock.calls[1][0]).not.toContain('deal_alert_deliveries')
    expect(mockQuery.mock.calls[1][1]).toEqual([['Paris'], 2])
    expect(mockSendDigest).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', deals: [deal] }))
  })

  it('records a queryable skip and does not send when no deals qualify', async () => {
    mockQuery.mockResolvedValueOnce(qr([{ id: 'user-1', email: 'qa@example.com' }]) as never)
      .mockResolvedValueOnce(qr([]) as never)
    mockGetSubscription.mockResolvedValue(subscription)

    const response = await POST(request())

    expect(await response.json()).toEqual({ sent: false, reason: 'no_deals', city: 'Paris' })
    expect(mockRecordSkipped).toHaveBeenCalledWith(expect.objectContaining({ cities: ['Paris'] }))
    expect(mockSendDigest).not.toHaveBeenCalled()
  })
})
