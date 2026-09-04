import { sendInstantAlerts } from '../sendDealAlert'
import { query } from '../../db/client'
import { getResend } from '../resend'
import { DealAlert } from '../templates/DealAlert'

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

jest.mock('../templates/DealAlert', () => ({
  DealAlert: jest.fn(() => null),
}))

const mockQuery = query as jest.MockedFunction<typeof query>
const mockGetResend = getResend as jest.Mock
const mockDealAlert = DealAlert as jest.Mock

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
    mockDealAlert.mockClear()
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

  it('excludes mock deals from the active-deal check, defense-in-depth against a caller forgetting to filter', async () => {
    mockQuery.mockResolvedValueOnce(qr([]))

    await sendInstantAlerts(deal)

    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('is_mock = false'), [deal.id])
  })

  it('filters recipients by premium status, watchlist, threshold, duplicates, and daily cap', async () => {
    mockQuery
      .mockResolvedValueOnce(qr([{ id: deal.id }]))
      .mockResolvedValueOnce(qr([{ userId: 'user-1', email: 'a@example.com', unsubscribeToken: 'token-1', watchlist: ['Lisbon'] }]))
      .mockResolvedValueOnce(qr([]))
      .mockResolvedValueOnce(qr([]))

    await expect(sendInstantAlerts(deal)).resolves.toBe(1)

    expect(mockQuery.mock.calls[1][0]).toContain("s.status IN ('trialing', 'active')")
    expect(mockQuery.mock.calls[1][0]).toContain('s.watchlist')
    expect(mockQuery.mock.calls[1][0]).toContain('$4 = ANY(s.watchlist)')
    expect(mockQuery.mock.calls[1][0]).toContain('deal_alert_deliveries')
    expect(mockQuery.mock.calls[1][0]).toContain("dad.delivery_type = 'instant'")
    expect(mockQuery.mock.calls[1][1]).toEqual([deal.id, deal.discountPct, 40, deal.city, 3])
    expect(mockQuery.mock.calls[2][0]).toContain('INSERT INTO deal_alert_deliveries')
    expect(mockDealAlert).toHaveBeenCalledWith(expect.objectContaining({
      manageUrl: 'https://expaify.com/account#alerts',
      stopCityUrl: 'https://expaify.com/alerts/manage?token=token-1&action=stop-city&city=lisbon',
      switchDailyUrl: 'https://expaify.com/alerts/manage?token=token-1&action=daily',
      unsubscribeUrl: 'https://expaify.com/api/alerts/unsubscribe?token=token-1',
    }))
  })

  it('omits the stop-city action for everywhere-mode recipients', async () => {
    mockQuery
      .mockResolvedValueOnce(qr([{ id: deal.id }]))
      .mockResolvedValueOnce(qr([{ userId: 'user-1', email: 'a@example.com', unsubscribeToken: 'token-1', watchlist: [] }]))
      .mockResolvedValueOnce(qr([]))

    await expect(sendInstantAlerts(deal)).resolves.toBe(1)

    expect(mockDealAlert).toHaveBeenCalledWith(expect.objectContaining({
      stopCityUrl: null,
      switchDailyUrl: 'https://expaify.com/alerts/manage?token=token-1&action=daily',
    }))
  })

  it('does not record delivery or count as sent when Resend returns an error in the response body', async () => {
    // Regression guard: Resend reports failures in the response body rather
    // than throwing. An unchecked result previously recorded a failed send
    // as delivered -- and since (user_id, deal_id) is a lifetime-unique
    // delivery row, that recipient would never be retried for this deal.
    mockGetResend.mockReturnValue({
      emails: { send: jest.fn().mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'Invalid `to` field' } }) },
    })
    mockQuery
      .mockResolvedValueOnce(qr([{ id: deal.id }]))
      .mockResolvedValueOnce(qr([{ userId: 'user-1', email: 'bad', unsubscribeToken: 'token-1', watchlist: [] }]))

    await expect(sendInstantAlerts(deal)).resolves.toBe(0)

    expect(mockQuery).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO deal_alert_deliveries'), expect.anything())
  })
})
