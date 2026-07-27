import { runTrialEndingReminders } from '../sendTrialEnding'
import { query } from '../../db/client'
import { getResend } from '../resend'
import { TrialEndingEmail } from '../templates/TrialEndingEmail'

jest.mock('../../db/client', () => ({
  query: jest.fn(),
}))

jest.mock('../resend', () => ({
  FROM: 'alerts@test.expaify',
  getResend: jest.fn(),
}))

jest.mock('@react-email/components', () => ({
  render: jest.fn(async () => '<html>trial-ending</html>'),
}))

jest.mock('../templates/TrialEndingEmail', () => ({
  TrialEndingEmail: jest.fn(() => null),
}))

const mockQuery = query as jest.MockedFunction<typeof query>
const mockGetResend = getResend as jest.Mock
const mockTrialEndingEmail = TrialEndingEmail as jest.Mock

function qr<T>(rows: T[]) {
  return {
    rows,
    rowCount: rows.length,
    command: 'SELECT',
    oid: 0,
    fields: [],
  }
}

describe('runTrialEndingReminders', () => {
  const originalKey = process.env.RESEND_API_KEY

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'resend-test'
    mockQuery.mockReset()
    mockTrialEndingEmail.mockClear()
    mockGetResend.mockReturnValue({ emails: { send: jest.fn().mockResolvedValue({ id: 'email-1' }) } })
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = originalKey
  })

  it('selects trialing subscriptions nearing trial end that have not been reminded', async () => {
    mockQuery.mockResolvedValueOnce(qr([]))

    await expect(runTrialEndingReminders()).resolves.toEqual({ recipients: 0, skipped: 0 })

    expect(mockQuery.mock.calls[0][0]).toContain("s.status = 'trialing'")
    expect(mockQuery.mock.calls[0][0]).toContain('s.trial_ending_email_sent = false')
    expect(mockQuery.mock.calls[0][0]).toContain("s.trial_ends_at <= NOW() + INTERVAL '2 days'")
  })

  it('sends the reminder and marks it sent so it never repeats', async () => {
    const trialEndsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    mockQuery
      .mockResolvedValueOnce(qr([{ userId: 'user-1', email: 'a@example.com', unsubscribeToken: 'token-1', trialEndsAt }]))
      .mockResolvedValueOnce(qr([]))

    await expect(runTrialEndingReminders()).resolves.toEqual({ recipients: 1, skipped: 0 })

    expect(mockGetResend).toHaveBeenCalled()
    expect(mockQuery.mock.calls[1][0]).toContain('trial_ending_email_sent = true')
    expect(mockQuery.mock.calls[1][1]).toEqual(['user-1'])
    expect(mockTrialEndingEmail).toHaveBeenCalledWith(expect.objectContaining({
      email: 'a@example.com',
      manageUrl: 'https://expaify.com/account',
      unsubscribeUrl: 'https://expaify.com/api/alerts/unsubscribe?token=token-1',
    }))
  })

  it('does nothing when Resend is not configured', async () => {
    delete process.env.RESEND_API_KEY

    await expect(runTrialEndingReminders()).resolves.toEqual({ recipients: 0, skipped: 0 })
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
