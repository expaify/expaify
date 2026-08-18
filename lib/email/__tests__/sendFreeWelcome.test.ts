import { query } from '../../db/client'
import { getResend } from '../resend'
import { sendFreeWelcome } from '../sendFreeWelcome'

jest.mock('../../db/client', () => ({ query: jest.fn() }))

jest.mock('../resend', () => ({
  FROM: 'alerts@test.expaify',
  getResend: jest.fn(),
}))

jest.mock('@react-email/components', () => ({
  render: jest.fn(async () => '<html>welcome</html>'),
}))

jest.mock('../templates/FreeWelcome', () => ({
  FreeWelcome: jest.fn(() => null),
}))

const mockQuery = query as jest.MockedFunction<typeof query>
const mockGetResend = getResend as jest.Mock

function qr<T>(rows: T[]) {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] }
}

describe('sendFreeWelcome', () => {
  const originalKey = process.env.RESEND_API_KEY

  beforeEach(() => {
    process.env.RESEND_API_KEY = 'resend-test'
    mockQuery.mockReset()
    mockQuery.mockResolvedValue(qr([]))
    mockGetResend.mockReturnValue({
      emails: { send: jest.fn().mockResolvedValue({ data: { id: '<welcome-1@email.amazonses.com>' }, error: null }) },
    })
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = originalKey
  })

  it('records the Resend message ID and city after a successful send', async () => {
    await sendFreeWelcome({ email: 'free@example.com', city: 'Paris', unsubscribeToken: 'token-1' })
    await Promise.resolve()

    expect(mockQuery.mock.calls[1][0]).toContain("'welcome_sent'")
    expect(mockQuery.mock.calls[1][1]?.[2]).toBe('/api/onboarding')
    expect(JSON.parse(String(mockQuery.mock.calls[1][1]?.[3]))).toEqual({
      resend_message_id: '<welcome-1@email.amazonses.com>',
      city: 'Paris',
    })
  })

  it('does not reject the welcome send when analytics persistence fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    mockQuery.mockResolvedValueOnce(qr([])).mockRejectedValueOnce(new Error('database unavailable'))

    await expect(sendFreeWelcome({ email: 'free@example.com', city: 'Everywhere', unsubscribeToken: 'token-1' })).resolves.toBeUndefined()
    await Promise.resolve()

    expect(warn).toHaveBeenCalledWith('Free welcome analytics unavailable', expect.any(Error))
    warn.mockRestore()
  })
})
