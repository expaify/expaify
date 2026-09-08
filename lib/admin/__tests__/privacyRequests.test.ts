jest.mock('@/lib/db/client', () => ({ query: jest.fn(), withTransaction: jest.fn() }))
jest.mock('@/lib/subscription', () => ({ getSubscription: jest.fn() }))
jest.mock('@/lib/email/sendAccountDataExport', () => ({ sendAccountDataExport: jest.fn() }))

import { query, withTransaction } from '@/lib/db/client'
import { getSubscription } from '@/lib/subscription'
import { sendAccountDataExport } from '@/lib/email/sendAccountDataExport'
import { fulfillDueExportRequests } from '../privacyRequests'

const mockQuery = query as jest.MockedFunction<typeof query>
const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>
const mockGetSubscription = getSubscription as jest.MockedFunction<typeof getSubscription>
const mockSendAccountDataExport = sendAccountDataExport as jest.MockedFunction<typeof sendAccountDataExport>

function subscriptionFixture() {
  return {
    id: 'sub-1', userId: 'user-1', stripeCustomerId: null, stripeSubscriptionId: null,
    status: 'free' as const, plan: null, trialEndsAt: null, currentPeriodEnd: null,
    alertPreference: 'daily' as const, watchlist: ['Paris'], alertMinDiscount: 40,
    alertTimezone: 'America/New_York', alertUnsubscribeToken: 'token-1',
    minDiscountPct: 40 as const, onboardingDone: true,
  }
}

describe('fulfillDueExportRequests', () => {
  beforeEach(() => {
    mockQuery.mockReset()
    mockWithTransaction.mockReset()
    mockGetSubscription.mockReset()
    mockSendAccountDataExport.mockReset()
  })

  it('fulfills a requested row: sends the export email and flips status to completed', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'req-1', user_id: 'user-1', requested_email: 'user@example.com' }] } as never)
      .mockResolvedValueOnce({ rows: [{ name: 'Jamie', email: 'user@example.com' }] } as never)
      .mockResolvedValueOnce({ rows: [{ created_at: new Date('2026-01-01T00:00:00Z') }] } as never)
      .mockResolvedValueOnce({ rows: [{ hotel_name: 'Hotel Nice', city: 'Nice', unlocked_at: new Date('2026-08-01T00:00:00Z') }] } as never)
    mockGetSubscription.mockResolvedValue(subscriptionFixture())
    mockSendAccountDataExport.mockResolvedValue(true)
    const txQuery = jest.fn().mockResolvedValue({ rows: [] })
    mockWithTransaction.mockImplementation(async fn => fn({ query: txQuery } as never))

    const result = await fulfillDueExportRequests()

    expect(result).toEqual({ fulfilled: 1, failed: 0 })
    expect(mockSendAccountDataExport).toHaveBeenCalledWith(expect.objectContaining({
      email: 'user@example.com',
      name: 'Jamie',
      watchlist: ['Paris'],
      unlocks: [{ hotelName: 'Hotel Nice', city: 'Nice', unlockedAt: 'August 1, 2026' }],
    }))
    expect(txQuery).toHaveBeenCalledWith(
      expect.stringContaining("status = 'completed'"),
      ['req-1'],
    )
  })

  it('leaves the row as requested (does not mark completed) when the send fails', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'req-2', user_id: 'user-2', requested_email: 'user2@example.com' }] } as never)
      .mockResolvedValueOnce({ rows: [{ name: null, email: 'user2@example.com' }] } as never)
      .mockResolvedValueOnce({ rows: [{ created_at: new Date('2026-01-01T00:00:00Z') }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
    mockGetSubscription.mockResolvedValue(subscriptionFixture())
    mockSendAccountDataExport.mockResolvedValue(false)

    const result = await fulfillDueExportRequests()

    expect(result).toEqual({ fulfilled: 0, failed: 1 })
    expect(mockWithTransaction).not.toHaveBeenCalled()
  })

  it('counts a row with no linked user as failed without throwing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'req-3', user_id: null, requested_email: 'gone@example.com' }] } as never)

    const result = await fulfillDueExportRequests()

    expect(result).toEqual({ fulfilled: 0, failed: 1 })
    expect(mockSendAccountDataExport).not.toHaveBeenCalled()
  })
})
