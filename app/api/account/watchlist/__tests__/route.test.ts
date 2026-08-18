import { PATCH } from '../route'
import { auth } from '@/auth'
import { query } from '@/lib/db/client'
import { getSubscription } from '@/lib/subscription'
import { updateFreeSubscriberCity } from '@/lib/mailchimp'

jest.mock('next/server', () => {
  const actual = jest.requireActual('next/server')
  return { ...actual, after: jest.fn((callback: () => unknown) => callback()) }
})

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db/client', () => ({ query: jest.fn() }))
jest.mock('@/lib/subscription', () => ({
  getSubscription: jest.fn(),
  isPremium: jest.fn((status: string) => status === 'active' || status === 'trialing'),
}))
jest.mock('@/lib/mailchimp', () => ({ updateFreeSubscriberCity: jest.fn() }))

const mockAuth = auth as jest.Mock
const mockQuery = query as jest.MockedFunction<typeof query>
const mockGetSubscription = getSubscription as jest.Mock
const mockSyncFreeSubscriber = updateFreeSubscriberCity as jest.Mock

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
    mockSyncFreeSubscriber.mockReset()
  })

  it('requires authentication and an existing subscription', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await PATCH(request({ op: 'add', city: 'Paris' }) as never)).status).toBe(401)

    mockAuth.mockResolvedValueOnce({ user: { id: 'user-1' } })
    mockGetSubscription.mockResolvedValueOnce(null)
    expect((await PATCH(request({ op: 'add', city: 'Paris' }) as never)).status).toBe(404)
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
    expect(mockQuery.mock.calls[0][1]).toEqual(['Paris', 'user-1', 10])

    const removed = await PATCH(request({ op: 'remove', city: 'Paris' }) as never)
    expect(await removed.json()).toEqual({ ok: true, watchlist: [] })
    expect(mockQuery.mock.calls[1][0]).toContain('array_remove')
  })

  it('allows free users with a one-city cap', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-free', email: 'free@example.com' } })
    mockGetSubscription.mockResolvedValue({ status: 'free' })
    mockQuery.mockResolvedValueOnce(result(['Paris']) as never)

    const response = await PATCH(request({ op: 'add', city: 'Paris' }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, watchlist: ['Paris'] })
    expect(mockQuery.mock.calls[0][1]).toEqual(['Paris', 'user-free', 1])
    expect(mockSyncFreeSubscriber).toHaveBeenCalledWith({ email: 'free@example.com', city: 'paris', source: 'watchlist' })
  })

  it('does not fail a successful free watchlist save when Mailchimp rejects', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-free', email: 'free@example.com' } })
    mockGetSubscription.mockResolvedValue({ status: 'free' })
    mockQuery.mockResolvedValueOnce(result([]) as never)
    mockSyncFreeSubscriber.mockRejectedValueOnce(new Error('Mailchimp unavailable'))

    const response = await PATCH(request({ watchlist: [] }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, watchlist: [] })
    expect(mockSyncFreeSubscriber).toHaveBeenCalledWith({ email: 'free@example.com', city: null, source: 'watchlist' })
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

  it('rejects a free bulk replacement above one city', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-free' } })
    mockGetSubscription.mockResolvedValue({ status: 'free' })

    const response = await PATCH(request({ watchlist: ['Paris', 'London'] }) as never)

    expect(response.status).toBe(400)
    expect(mockQuery).not.toHaveBeenCalled()
  })
})
