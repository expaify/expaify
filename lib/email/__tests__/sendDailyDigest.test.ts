import { runDailyDigest } from '../sendDailyDigest'
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
  render: jest.fn(async () => '<html>digest</html>'),
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

describe('runDailyDigest', () => {
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

  it('selects due premium recipients at 9 AM local time from users', async () => {
    mockQuery.mockResolvedValueOnce(qr([]))

    await expect(runDailyDigest()).resolves.toEqual({ recipients: 0, skipped: 0 })

    expect(mockQuery.mock.calls[0][0]).toContain('JOIN users u ON u.id = s.user_id')
    expect(mockQuery.mock.calls[0][0]).toContain("s.alert_preference IN ('daily', 'instant')")
    expect(mockQuery.mock.calls[0][0]).toContain('EXTRACT(HOUR')
    expect(mockQuery.mock.calls[0][0]).toContain("s.status IN ('trialing', 'active')")
  })

  it('sends only matching, active, undelivered digest deals and records delivery', async () => {
    mockQuery
      .mockResolvedValueOnce(qr([{ userId: 'user-1', email: 'a@example.com', unsubscribeToken: 'token-1' }]))
      .mockResolvedValueOnce(qr([{
        id: '22222222-2222-2222-2222-222222222222',
        hotel_name: 'Central Stay',
        city: 'Paris',
        stars: 4,
        photo_url: null,
        discount_pct: 51,
        deal_price_cents: 21000,
        median_price_cents: 43000,
        check_in_window: 'Sep 1 - Sep 3',
        snapshot_count: 18,
      }]))
      .mockResolvedValueOnce(qr([]))
      .mockResolvedValueOnce(qr([]))

    await expect(runDailyDigest()).resolves.toEqual({ recipients: 1, skipped: 0 })

    expect(mockQuery.mock.calls[1][0]).toContain("d.first_seen >= NOW() - INTERVAL '24 hours'")
    expect(mockQuery.mock.calls[1][0]).toContain('d.expires_at IS NULL OR d.expires_at > NOW()')
    expect(mockQuery.mock.calls[1][0]).toContain('m.city = ANY(s.watchlist)')
    expect(mockQuery.mock.calls[1][0]).toContain('NOT EXISTS')
    expect(mockQuery.mock.calls[1][0]).toContain('LIMIT $3')
    expect(mockQuery.mock.calls[1][1]).toEqual(['user-1', 40, 8])
    expect(mockQuery.mock.calls[2][0]).toContain('INSERT INTO deal_alert_deliveries')
    expect(mockQuery.mock.calls[2][1]).toEqual(['user-1', ['22222222-2222-2222-2222-222222222222']])
  })
})
