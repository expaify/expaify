import { PATCH } from '../route'
import { auth } from '@/auth'
import { query } from '@/lib/db/client'
import { getSubscription } from '@/lib/subscription'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db/client', () => ({ query: jest.fn() }))
jest.mock('@/lib/subscription', () => ({
  getSubscription: jest.fn(),
  isPremium: jest.fn((status: string) => status === 'active' || status === 'trialing'),
}))

const mockAuth = auth as jest.Mock
const mockQuery = query as jest.MockedFunction<typeof query>
const mockGetSubscription = getSubscription as jest.Mock

function request(body: unknown) {
  return new Request('https://expaify.test/api/account/watchlist', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function result(watchlist?: string[]) {
  return {
    rows: watchlist ? [{ watchlist }] : [],
    rowCount: watchlist ? 1 : 0,
    command: 'UPDATE', oid: 0, fields: [],
  }
}

describe('PATCH /api/account/watchlist', () => {
  beforeEach(() => {
    mockAuth.mockReset()
    mockQuery.mockReset()
    mockGetSubscription.mockReset()
  })

  it('requires authentication and premium', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await PATCH(request({ op: 'add', city: 'Paris' }) as never)).status).toBe(401)

    mockAuth.mockResolvedValueOnce({ user: { id: 'user-1' } })
    mockGetSubscription.mockResolvedValueOnce({ status: 'free' })
    expect((await PATCH(request({ op: 'add', city: 'Paris' }) as never)).status).toBe(403)
  })

  it('atomically adds and removes tracked cities', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockGetSubscription.mockResolvedValue({ status: 'active' })
    mockQuery
      .mockResolvedValueOnce(result(['Paris']) as never)
      .mockResolvedValueOnce(result([]) as never)

    const added = await PATCH(request({ op: 'add', city: 'Paris' }) as never)
    expect(await added.json()).toEqual({ ok: true, watchlist: ['Paris'] })
    expect(mockQuery.mock.calls[0][0]).toContain('array_append')

    const removed = await PATCH(request({ op: 'remove', city: 'Paris' }) as never)
    expect(await removed.json()).toEqual({ ok: true, watchlist: [] })
    expect(mockQuery.mock.calls[1][0]).toContain('array_remove')
  })

  it('reports the cap without changing the row', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'user-1' } })
    mockGetSubscription.mockResolvedValueOnce({ status: 'active' })
    mockQuery.mockResolvedValueOnce(result() as never)

    const response = await PATCH(request({ op: 'add', city: 'Paris' }) as never)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'watchlist_full' })
  })

  it('rejects invalid replacements instead of silently filtering them', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockGetSubscription.mockResolvedValue({ status: 'active' })

    expect((await PATCH(request({ watchlist: ['Atlantis'] }) as never)).status).toBe(400)
    expect((await PATCH(request({ watchlist: Array(11).fill('Paris') }) as never)).status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
