import { GET, POST } from '../route'
import { query } from '../../../../../lib/db/client'

jest.mock('../../../../../lib/db/client', () => ({
  query: jest.fn(),
}))

const mockQuery = query as jest.MockedFunction<typeof query>

const TOKEN = '33333333-3333-3333-3333-333333333333'

function getReq(token: string): Request {
  return new Request(`https://expaify.test/api/alerts/unsubscribe?token=${token}`)
}

function postReq(token: string): Request {
  const body = new URLSearchParams({ token })
  return new Request('https://expaify.test/api/alerts/unsubscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
}

function selectResult(rows: Array<{ alert_preference: string }>) {
  return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] }
}

function updateResult(rowCount: number) {
  return { rows: [], rowCount, command: 'UPDATE', oid: 0, fields: [] }
}

describe('GET /api/alerts/unsubscribe (confirm page, no mutation)', () => {
  beforeEach(() => {
    mockQuery.mockReset()
  })

  it('renders a confirmation page and does NOT unsubscribe on a bare GET', async () => {
    // Regression guard: a plain GET that mutated on load was unsafe against
    // automated link prefetching (email security scanners, Apple Mail
    // Privacy Protection) silently unsubscribing real users who never
    // clicked anything. GET must only ever read.
    mockQuery.mockResolvedValueOnce(selectResult([{ alert_preference: 'instant' }]))

    const response = await GET(getReq(TOKEN) as never)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Turn off deal alerts?')
    expect(body).toContain('<form method="post" action="/api/alerts/unsubscribe"')
    expect(body).toContain(`value="${TOKEN}"`)
    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(String(mockQuery.mock.calls[0][0])).toMatch(/^SELECT/)
    expect(String(mockQuery.mock.calls[0][0])).not.toContain('UPDATE')
  })

  it('shows an "already off" page without a form when alerts are already off', async () => {
    mockQuery.mockResolvedValueOnce(selectResult([{ alert_preference: 'off' }]))

    const response = await GET(getReq(TOKEN) as never)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Alerts are already off')
    expect(body).not.toContain('<form')
  })

  it('rejects invalid tokens before any database read', async () => {
    const response = await GET(getReq('not-a-token') as never)

    expect(response.status).toBe(400)
    expect(await response.text()).toContain('href="https://expaify.com/account#alerts"')
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('links an expired/unknown token back to alert settings', async () => {
    mockQuery.mockResolvedValueOnce(selectResult([]))

    const response = await GET(getReq('44444444-4444-4444-4444-444444444444') as never)
    const body = await response.text()

    expect(response.status).toBe(404)
    expect(body).toContain('href="https://expaify.com/account#alerts"')
  })
})

describe('POST /api/alerts/unsubscribe (the real mutation)', () => {
  beforeEach(() => {
    mockQuery.mockReset()
  })

  it('turns off alerts without requiring a session, once the form is actually submitted', async () => {
    mockQuery.mockResolvedValueOnce(updateResult(1))

    const response = await POST(postReq(TOKEN) as never)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Deal alerts are off')
    expect(body).toContain('Get one daily email instead')
    expect(body).toContain(`/alerts/manage?token=${TOKEN}&amp;action=daily`)
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("alert_preference = 'off'"), [TOKEN])
  })

  it('rejects invalid tokens before database writes', async () => {
    const response = await POST(postReq('not-a-token') as never)

    expect(response.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('links an expired token back to alert settings', async () => {
    mockQuery.mockResolvedValueOnce(updateResult(0))

    const response = await POST(postReq('44444444-4444-4444-4444-444444444444') as never)
    const body = await response.text()

    expect(response.status).toBe(404)
    expect(body).toContain('href="https://expaify.com/account#alerts"')
  })
})
