import { GET } from '../route'
import { query } from '../../../../../lib/db/client'

jest.mock('../../../../../lib/db/client', () => ({
  query: jest.fn(),
}))

const mockQuery = query as jest.MockedFunction<typeof query>

function req(token: string): Request {
  return new Request(`https://expaify.test/api/alerts/unsubscribe?token=${token}`)
}

function qr(rowCount: number) {
  return {
    rows: [],
    rowCount,
    command: 'UPDATE',
    oid: 0,
    fields: [],
  }
}

describe('GET /api/alerts/unsubscribe', () => {
  beforeEach(() => {
    mockQuery.mockReset()
  })

  it('turns off alerts without requiring a session', async () => {
    mockQuery.mockResolvedValueOnce(qr(1))

    const response = await GET(req('33333333-3333-3333-3333-333333333333') as never)
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Deal alerts are off')
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("alert_preference = 'off'"), [
      '33333333-3333-3333-3333-333333333333',
    ])
  })

  it('rejects invalid tokens before database writes', async () => {
    const response = await GET(req('not-a-token') as never)

    expect(response.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
