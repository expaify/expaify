import { POST } from '../route'
import { auth } from '@/auth'
import { getSubscription } from '@/lib/subscription'
import { withTransaction } from '@/lib/db/client'
import { getDealById } from '@/lib/pipeline/dealDetection'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/subscription', () => ({ getSubscription: jest.fn(), isPremium: (status: string) => ['active', 'trialing'].includes(status) }))
jest.mock('@/lib/pipeline/dealDetection', () => ({ getDealById: jest.fn() }))
jest.mock('@/lib/db/client', () => ({ withTransaction: jest.fn(), query: jest.fn() }))

describe('POST /api/deals/[id]/unlock', () => {
  beforeEach(() => jest.clearAllMocks())

  it('bypasses the quota table for premium users', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(getSubscription as jest.Mock).mockResolvedValue({ status: 'active' })
    const response = await POST(new Request('https://expaify.test'), { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, premium: true, alreadyUnlocked: true })
    expect(withTransaction).not.toHaveBeenCalled()
  })

  it('returns the quota rejection from the transactional enforcer', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(getSubscription as jest.Mock).mockResolvedValue({ status: 'free' })
    ;(getDealById as jest.Mock).mockResolvedValue({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', is_mock: false })
    ;(withTransaction as jest.Mock).mockResolvedValue({ ok: false, reason: 'weekly_limit_reached' })
    const response = await POST(new Request('https://expaify.test'), { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) })
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ error: 'weekly_limit_reached' })
  })

  it('returns an idempotent success for an already-unlocked deal', async () => {
    ;(auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(getSubscription as jest.Mock).mockResolvedValue({ status: 'free' })
    ;(getDealById as jest.Mock).mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', hotel_id: 'h1', hotel_name: 'Hotel', stars: 4,
      photo_url: null, city: 'Paris', deal_price_cents: 10000, median_price_cents: 15000,
      discount_pct: 33, check_in_window: 'Sep 1–3', check_in_date: '2026-09-01', nights: 2,
      snapshot_count: 10, ota_links: {}, headline: null, is_mock: false, first_seen: null, updated_at: null,
    })
    ;(withTransaction as jest.Mock).mockResolvedValue({ ok: true, alreadyUnlocked: true, remaining: 1 })
    const response = await POST(new Request('https://expaify.test'), { params: Promise.resolve({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }) })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, alreadyUnlocked: true, remaining: 1, deal: { hotelName: 'Hotel' } })
  })
})
