// The free-plan paywall must lock by membership in the weekly unlock set,
// never by position in the returned page — positional locking lets a free
// caller rotate every price into view via offset/sort/filter variations.

jest.mock('@/auth', () => ({ auth: jest.fn(() => Promise.resolve(null)) }))

const mockQuery = jest.fn()
jest.mock('@/lib/db/client', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}))

const mockGetSubscription = jest.fn()
jest.mock('@/lib/subscription', () => ({
  getSubscription: (...args: unknown[]) => mockGetSubscription(...args),
  isPremium: (status: string) => status === 'trialing' || status === 'active',
}))

import { auth } from '@/auth'
import { applyPaywall, getFreeUnlockedDealIds, getPaywallContext, PaywallLookupError, type PaywallContext } from '../paywall'

const mockAuth = auth as jest.MockedFunction<typeof auth>

const freeCtx: PaywallContext = { userId: null, premium: false, freeUnlockedThisWeek: 0, freeUnlockLimit: 3 }
const premiumCtx: PaywallContext = { userId: 'u1', premium: true, freeUnlockedThisWeek: 0, freeUnlockLimit: 3 }

function deal(id: string) {
  return {
    id,
    hotelName: `Hotel ${id}`,
    dealPrice: { priceCents: 9900, currency: 'USD' },
    medianPrice: { priceCents: 19900, currency: 'USD' },
    discountPct: 50,
  }
}

describe('applyPaywall', () => {
  it('locks every deal outside the unlock set regardless of position', () => {
    const deals = [deal('a'), deal('b'), deal('c'), deal('d')]
    const masked = applyPaywall(deals, freeCtx, new Set(['c']))

    expect(masked.find((d) => d.id === 'c')).toMatchObject({ locked: false, hotelName: 'Hotel c' })
    for (const id of ['a', 'b', 'd']) {
      expect(masked.find((d) => d.id === id)).toMatchObject({
        locked: true,
        hotelName: 'Members-only deal',
        dealPrice: null,
        medianPrice: null,
      })
    }
  })

  it('locks everything for free users when the unlock set is empty', () => {
    const masked = applyPaywall([deal('a'), deal('b')], freeCtx, new Set())
    expect(masked.every((d) => d.locked && d.dealPrice === null)).toBe(true)
  })

  it('never locks for premium users', () => {
    const masked = applyPaywall([deal('a'), deal('b')], premiumCtx, new Set())
    expect(masked.every((d) => !d.locked && d.hotelName.startsWith('Hotel'))).toBe(true)
  })
})

describe('getFreeUnlockedDealIds', () => {
  beforeEach(() => mockQuery.mockReset())

  it('returns the ids selected by the weekly-unlock query', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'x' }, { id: 'y' }, { id: 'z' }] })
    const ids = await getFreeUnlockedDealIds()
    expect(ids).toEqual(new Set(['x', 'y', 'z']))
    const sql = String(mockQuery.mock.calls[0][0])
    expect(sql).toContain('LIMIT 3')
    expect(sql).toContain("status = 'active'")
  })

  it('fails closed (empty set → everything locked) when the query throws', async () => {
    mockQuery.mockRejectedValue(new Error('db down'))
    await expect(getFreeUnlockedDealIds()).resolves.toEqual(new Set())
  })

  it('selects the signed-in free user personal rows instead of the shared pool', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'personal-deal' }] })
    await expect(getFreeUnlockedDealIds('user-1')).resolves.toEqual(new Set(['personal-deal']))
    expect(mockQuery.mock.calls[0][1]).toEqual(['user-1'])
    expect(String(mockQuery.mock.calls[0][0])).toContain('FROM deal_unlocks')
  })
})

describe('getPaywallContext', () => {
  beforeEach(() => {
    mockQuery.mockReset()
    mockGetSubscription.mockReset()
    mockAuth.mockReset()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns anonymous free-tier context when there is no session', async () => {
    mockAuth.mockResolvedValue(null as never)
    await expect(getPaywallContext()).resolves.toEqual({
      userId: null,
      premium: false,
      freeUnlockedThisWeek: 0,
      freeUnlockLimit: 3,
    })
    expect(mockGetSubscription).not.toHaveBeenCalled()
  })

  it('returns premium context when the subscription lookup reports an active plan', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'premium-user' } } as never)
    mockGetSubscription.mockResolvedValue({ status: 'active' })
    await expect(getPaywallContext()).resolves.toMatchObject({
      userId: 'premium-user',
      premium: true,
    })
  })

  it('returns free-tier context when the user genuinely has no subscription row', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'free-user' } } as never)
    mockGetSubscription.mockResolvedValue(null)
    mockQuery.mockResolvedValue({ rows: [{ count: 1 }] })
    await expect(getPaywallContext()).resolves.toEqual({
      userId: 'free-user',
      premium: false,
      freeUnlockedThisWeek: 1,
      freeUnlockLimit: 3,
    })
  })

  // Regression: a DB timeout / lookup throw used to be .catch(() => null)'d into
  // the same path as "this user has no subscription", silently paywalling a
  // currently-paying member. A lookup failure must not resolve to premium: false.
  it('does not silently return premium: false when getSubscription rejects', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'premium-user' } } as never)
    mockGetSubscription.mockRejectedValue(new Error('db timeout'))
    // If the function still swallows the rejection, it falls through to this
    // count query and returns a free-tier context. Keep it succeeding so a
    // swallowed failure is visible as premium: false rather than a later throw.
    mockQuery.mockResolvedValue({ rows: [{ count: 0 }] })

    let resolved: PaywallContext | undefined
    let thrown: unknown
    await getPaywallContext().then(
      (ctx) => { resolved = ctx },
      (err) => { thrown = err },
    )

    expect(resolved?.premium).not.toBe(false)
    expect(resolved).toBeUndefined()
    expect(thrown).toBeInstanceOf(PaywallLookupError)
    expect(mockGetSubscription).toHaveBeenCalledTimes(2)
  })

  it('retries a failed subscription lookup and returns premium when the retry succeeds', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'premium-user' } } as never)
    mockGetSubscription
      .mockRejectedValueOnce(new Error('db timeout'))
      .mockResolvedValueOnce({ status: 'active' })

    await expect(getPaywallContext()).resolves.toMatchObject({
      userId: 'premium-user',
      premium: true,
    })
    expect(mockGetSubscription).toHaveBeenCalledTimes(2)
  })

  it('does not silently zero the weekly unlock count when the count query rejects', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'free-user' } } as never)
    mockGetSubscription.mockResolvedValue(null)
    mockQuery.mockRejectedValue(new Error('db timeout'))

    let resolved: PaywallContext | undefined
    let thrown: unknown
    await getPaywallContext().then(
      (ctx) => { resolved = ctx },
      (err) => { thrown = err },
    )

    expect(resolved).toBeUndefined()
    expect(thrown).toBeInstanceOf(PaywallLookupError)
  })
})
