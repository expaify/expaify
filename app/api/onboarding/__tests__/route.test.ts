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
const mockUpsertSubscription = upsertSubscription as jest.Mock

function request(body: unknown) {
  return new Request('https://expaify.test/api/onboarding', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/onboarding', () => {
  beforeEach(() => {
    mockAuth.mockReset()
    mockGetSubscription.mockReset()
    mockUpsertSubscription.mockReset()
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('forces free users to daily cadence and one watchlist city', async () => {
    mockGetSubscription.mockResolvedValue({ status: 'free' })

    const response = await PATCH(request({
      alertPreference: 'instant',
      minDiscountPct: 40,
      watchlist: ['Paris', 'London'],
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      alertPreference: 'daily',
      minDiscountPct: 40,
      watchlist: ['Paris'],
    })
    expect(mockUpsertSubscription).toHaveBeenCalledWith('user-1', expect.objectContaining({
      alertPreference: 'daily',
      watchlist: ['Paris'],
    }))
  })

  it('keeps premium instant cadence and allows up to ten unique cities', async () => {
    mockGetSubscription.mockResolvedValue({ status: 'active' })

    const response = await PATCH(request({
      alertPreference: 'instant',
      minDiscountPct: 50,
      watchlist: ['Paris', 'London', 'Paris'],
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({
      alertPreference: 'instant',
      watchlist: ['Paris', 'London'],
    }))
  })

  it('preserves everywhere as an unfiltered empty watchlist for free users', async () => {
    mockGetSubscription.mockResolvedValue({ status: 'free' })

    const response = await PATCH(request({
      alertPreference: 'daily',
      minDiscountPct: 30,
      watchlist: ['Paris'],
      everywhere: true,
    }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({ watchlist: [] }))
  })
})
