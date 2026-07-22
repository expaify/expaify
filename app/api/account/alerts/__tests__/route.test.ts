import { PATCH } from '../route'
import { auth } from '@/auth'
import { getSubscription, upsertSubscription } from '@/lib/subscription'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/subscription', () => ({
  getSubscription: jest.fn(),
  isPremium: jest.fn((status: string) => status === 'active' || status === 'trialing'),
  upsertSubscription: jest.fn(),
}))

const mockAuth = auth as jest.Mock
const mockGetSubscription = getSubscription as jest.Mock
const mockUpsert = upsertSubscription as jest.Mock

function request(body: unknown) {
  return new Request('https://expaify.test/api/account/alerts', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/account/alerts', () => {
  beforeEach(() => {
    mockAuth.mockReset()
    mockGetSubscription.mockReset()
    mockUpsert.mockReset().mockResolvedValue(undefined)
  })

  it('requires authentication and premium', async () => {
    mockAuth.mockResolvedValueOnce(null)
    expect((await PATCH(request({ alertPreference: 'daily' }) as never)).status).toBe(401)

    mockAuth.mockResolvedValueOnce({ user: { id: 'user-1' } })
    mockGetSubscription.mockResolvedValueOnce({ status: 'free' })
    expect((await PATCH(request({ alertPreference: 'daily' }) as never)).status).toBe(403)
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('accepts each supported partial patch and combined patches', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockGetSubscription.mockResolvedValue({ status: 'active' })

    expect((await PATCH(request({ alertPreference: 'daily' }) as never)).status).toBe(200)
    expect((await PATCH(request({ alertMinDiscount: 50 }) as never)).status).toBe(200)
    expect((await PATCH(request({ alertPreference: 'instant', alertMinDiscount: 30 }) as never)).status).toBe(200)

    expect(mockUpsert).toHaveBeenNthCalledWith(1, 'user-1', { alertPreference: 'daily' })
    expect(mockUpsert).toHaveBeenNthCalledWith(2, 'user-1', { alertMinDiscount: 50 })
    expect(mockUpsert).toHaveBeenNthCalledWith(3, 'user-1', { alertPreference: 'instant', alertMinDiscount: 30 })
  })

  it('rejects invalid or empty patches', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockGetSubscription.mockResolvedValue({ status: 'active' })

    expect((await PATCH(request({ alertPreference: 'weekly' }) as never)).status).toBe(400)
    expect((await PATCH(request({ alertMinDiscount: 91 }) as never)).status).toBe(400)
    expect((await PATCH(request({}) as never)).status).toBe(400)
    expect(mockUpsert).not.toHaveBeenCalled()
  })
})
