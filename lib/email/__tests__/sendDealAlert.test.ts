import { sendInstantAlerts } from '../sendDealAlert'
import { query } from '../../db/client'
import { getResend } from '../resend'

jest.mock('../../db/client', () => ({
  query: jest.fn(),
}))

jest.mock('../resend', () => ({
  FROM: 'alerts@test.expaify',
  getResend: jest.fn(),
}))

jest.mock('@react-email/components', () => ({
  render: jest.fn(async () => '<html>deal</html>'),
}))

const mockQuery = query as jest.MockedFunction<typeof query>
const mockGetResend = getResend as jest.Mock

function qr<T>(rows: T[]) {
  return {
    rows,
    rowCount: rows.length,
    command: 'SELECT',
    oid: 0,
    fields: [],
  }
}

const deal = {
  id: '11111111-1111-1111-1111-111111111111',
  hotelName: 'Harbor Hotel',
  city: 'Lisbon',
  stars: 4,
  photoUrl: 'https://images.example/hotel.jpg',
  checkInWindow: 'Aug 1 - Aug 3',
  discountPct: 44,
  dealPriceCents: 18000,
  medianPriceCents: 32000,
  snapshotCount: 12,
}

describe('sendInstantAlerts', () => {
  const originalKey = process.env.RESEND_API_KEY

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'resend-test'
    mockQuery.mockReset()
    mockGetResend.mockReturnValue({ emails: { send: jest.fn().mockResolvedValue({ id: 'email-1' }) } })
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = originalKey
  })

  it('does not send when the deal is expired at send time', async () => {
    mockQuery.mockResolvedValueOnce(qr([]))

    await expect(sendInstantAlerts(deal)).resolves.toBe(0)

    expect(mockGetResend).not.toHaveBeenCalled()
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('expires_at'), [deal.id])
  })

  it('filters recipients by premium status, watchlist, threshold, duplicates, and daily cap', async () => {
    mockQuery
      .mockResolvedValueOnce(qr([{ id: deal.id }]))
      .mockResolvedValueOnce(qr([{ userId: 'user-1', email: 'a@example.com', unsubscribeToken: 'token-1' }]))
      .mockResolvedValueOnce(qr([]))
      .mockResolvedValueOnce(qr([]))

    await expect(sendInstantAlerts(deal)).resolves.toBe(1)

    expect(mockQuery.mock.calls[1][0]).toContain("s.status IN ('trialing', 'active')")
    expect(mockQuery.mock.calls[1][0]).toContain('$4 = ANY(s.watchlist)')
    expect(mockQuery.mock.calls[1][0]).toContain('deal_alert_deliveries')
    expect(mockQuery.mock.calls[1][0]).toContain("dad.delivery_type = 'instant'")
    expect(mockQuery.mock.calls[1][1]).toEqual([deal.id, deal.discountPct, 40, deal.city, 3])
    expect(mockQuery.mock.calls[2][0]).toContain('INSERT INTO deal_alert_deliveries')
  })
})
