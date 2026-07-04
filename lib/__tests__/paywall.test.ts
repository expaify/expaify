// The free-plan paywall must lock by membership in the weekly unlock set,
// never by position in the returned page — positional locking lets a free
// caller rotate every price into view via offset/sort/filter variations.

jest.mock('@/auth', () => ({ auth: jest.fn(() => Promise.resolve(null)) }))

const mockQuery = jest.fn()
jest.mock('@/lib/db/client', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}))

import { applyPaywall, getFreeUnlockedDealIds, type PaywallContext } from '../paywall'

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
})
