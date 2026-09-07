import { runFreeTierTeaser } from '../sendFreeTierTeaser'
import { query } from '../../db/client'
import { getFreeUnlockedDealIds } from '../../paywall'
import { getResend } from '../resend'
import { render } from '@react-email/components'

jest.mock('../../db/client', () => ({ query: jest.fn() }))
jest.mock('../../paywall', () => ({ getFreeUnlockedDealIds: jest.fn() }))
jest.mock('@react-email/components', () => ({ render: jest.fn().mockResolvedValue('<html></html>') }))
jest.mock('../templates/FreeTierTeaser', () => ({ FreeTierTeaser: jest.fn() }))
jest.mock('../resend', () => ({
  getResend: jest.fn(),
  FROM: 'dev@expaify.test',
}))

const mockQuery = query as jest.MockedFunction<typeof query>
const mockGetFreeUnlockedDealIds = getFreeUnlockedDealIds as jest.Mock
const mockSend = jest.fn().mockResolvedValue({ data: { id: 'sent' } })

function dealRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    hotel_name: 'Central Stay',
    city: 'Paris',
    photo_url: null,
    discount_pct: 40,
    locked_deal_count: 5,
    ...overrides,
  }
}

describe('runFreeTierTeaser', () => {
  const originalKey = process.env.RESEND_API_KEY
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key'
    mockQuery.mockReset()
    mockGetFreeUnlockedDealIds.mockReset()
    mockSend.mockClear()
    ;(getResend as jest.Mock).mockReturnValue({ emails: { send: mockSend } })
  })
  afterAll(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = originalKey
  })

  // The bug: getFreeUnlockedDealIds() was called once, with no userId, above
  // the recipient loop -- that's a completely different query branch (the
  // sitewide anonymous default set) from a specific user's real weekly
  // unlocks, and the same wrong/shared set was reused for every recipient.
  it("looks up each recipient's own unlocked-deal set individually, not a shared no-argument call", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          { userId: 'user-1', email: 'a@example.com', unsubscribeToken: 'tok-1' },
          { userId: 'user-2', email: 'b@example.com', unsubscribeToken: 'tok-2' },
        ],
      } as never)
      .mockResolvedValueOnce({ rows: [dealRow()] } as never)
      .mockResolvedValueOnce({ rows: [] } as never) // UPDATE last_teaser_sent_at for user-1
      .mockResolvedValueOnce({ rows: [dealRow()] } as never)
      .mockResolvedValueOnce({ rows: [] } as never) // UPDATE last_teaser_sent_at for user-2
    mockGetFreeUnlockedDealIds.mockResolvedValue(new Set(['deal-1']))

    const result = await runFreeTierTeaser()

    expect(mockGetFreeUnlockedDealIds).toHaveBeenCalledTimes(2)
    expect(mockGetFreeUnlockedDealIds).toHaveBeenNthCalledWith(1, 'user-1')
    expect(mockGetFreeUnlockedDealIds).toHaveBeenNthCalledWith(2, 'user-2')
    expect(mockGetFreeUnlockedDealIds).not.toHaveBeenCalledWith()
    expect(result).toEqual({ recipients: 2, skipped: 0 })
  })
})
