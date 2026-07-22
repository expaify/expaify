import { GET } from '../../../../alerts/manage/route'
import { POST } from '../route'
import { query } from '@/lib/db/client'

jest.mock('@/lib/db/client', () => ({ query: jest.fn() }))

const mockQuery = query as jest.MockedFunction<typeof query>
const token = '55555555-5555-5555-5555-555555555555'

function qr<T>(rows: T[], command = 'SELECT') {
  return { rows, rowCount: rows.length, command, oid: 0, fields: [] }
}

function getRequest(action: string, city?: string) {
  const url = new URL('https://expaify.test/alerts/manage')
  url.searchParams.set('token', token)
  url.searchParams.set('action', action)
  if (city) url.searchParams.set('city', city)
  return new Request(url)
}

function postRequest(action: string, city?: string) {
  const form = new FormData()
  form.set('token', token)
  form.set('action', action)
  if (city) form.set('city', city)
  return new Request('https://expaify.test/api/alerts/manage', { method: 'POST', body: form })
}

describe('token alert management', () => {
  beforeEach(() => mockQuery.mockReset())

  it('renders the daily confirmation on GET without writing', async () => {
    mockQuery.mockResolvedValueOnce(qr([{ alert_preference: 'instant', watchlist: ['Paris'] }]) as never)

    const response = await GET(getRequest('daily'))
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Switch to one daily email?')
    expect(body).toContain('method="post"')
    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(mockQuery.mock.calls[0][0].trimStart()).toMatch(/^SELECT/)
  })

  it('switches to daily on POST and is idempotent for stale links', async () => {
    mockQuery
      .mockResolvedValueOnce(qr([{ alert_preference: 'instant', watchlist: ['Paris'] }]) as never)
      .mockResolvedValueOnce(qr([], 'UPDATE') as never)

    const response = await POST(postRequest('daily'))
    expect(await response.text()).toContain('You&rsquo;re on the daily digest')
    expect(mockQuery.mock.calls[1][0]).toContain("alert_preference = 'daily'")

    mockQuery.mockReset()
    mockQuery.mockResolvedValueOnce(qr([{ alert_preference: 'daily', watchlist: ['Paris'] }]) as never)
    const stale = await POST(postRequest('daily'))
    expect(await stale.text()).toContain('already on the daily digest')
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('removes one city while leaving other city alerts active', async () => {
    mockQuery
      .mockResolvedValueOnce(qr([{ alert_preference: 'instant', watchlist: ['Paris', 'Rome'] }]) as never)
      .mockResolvedValueOnce(qr([{ alert_preference: 'instant', watchlist: ['Rome'] }], 'UPDATE') as never)

    const response = await POST(postRequest('stop-city', 'paris'))
    const body = await response.text()

    expect(body).toContain('Done — no more Paris alerts')
    expect(mockQuery.mock.calls[1][0]).toContain('array_remove')
    expect(mockQuery.mock.calls[1][1]).toEqual([token, 'Paris'])
  })

  it('turns alerts off when removing the last watched city', async () => {
    mockQuery
      .mockResolvedValueOnce(qr([{ alert_preference: 'instant', watchlist: ['Paris'] }]) as never)
      .mockResolvedValueOnce(qr([{ alert_preference: 'off', watchlist: [] }], 'UPDATE') as never)

    const response = await POST(postRequest('stop-city', 'paris'))
    const body = await response.text()

    expect(body).toContain('Deal alerts are off')
    expect(body).toContain('turned off deal alerts')
    expect(mockQuery.mock.calls[1][0]).toContain("THEN 'off'")
  })

  it('renders non-mutating and invalid states', async () => {
    mockQuery.mockResolvedValueOnce(qr([{ alert_preference: 'instant', watchlist: [] }]) as never)
    const notWatching = await GET(getRequest('stop-city', 'paris'))
    expect(await notWatching.text()).toContain('not watching Paris')
    expect(mockQuery).toHaveBeenCalledTimes(1)

    mockQuery.mockReset()
    const invalid = await GET(getRequest('stop-city', 'not-a-city'))
    expect(invalid.status).toBe(400)
    expect(await invalid.text()).toContain('/account#alerts')
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
