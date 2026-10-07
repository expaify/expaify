import { query } from '../../db/client'
import { buildPersonalization, normalizeMinDiscountPct, resolveWatchlistMarketIds } from '../personalization'

jest.mock('../../db/client', () => ({ query: jest.fn() }))

const mockQuery = query as jest.MockedFunction<typeof query>

const SUB = { watchlist: ['Nashville', 'Miami'], alertMinDiscount: 50, alertPreference: 'instant' as const }

describe('normalizeMinDiscountPct', () => {
  it.each([30, 40, 50])('accepts a real value %i unchanged', (value) => {
    expect(normalizeMinDiscountPct(value)).toBe(value)
  })

  it('falls back to 40 for any other stored value', () => {
    expect(normalizeMinDiscountPct(35)).toBe(40)
    expect(normalizeMinDiscountPct(0)).toBe(40)
  })
})

describe('buildPersonalization', () => {
  it('is undefined for a signed-out visitor', () => {
    expect(buildPersonalization(SUB, { signedIn: false, onboardingDone: true, hasExplicitRequest: false, allOverride: false })).toBeUndefined()
  })

  it('is undefined when onboarding was never completed', () => {
    expect(buildPersonalization(SUB, { signedIn: true, onboardingDone: false, hasExplicitRequest: false, allOverride: false })).toBeUndefined()
  })

  it('is undefined when there is no subscription row at all', () => {
    expect(buildPersonalization(null, { signedIn: true, onboardingDone: true, hasExplicitRequest: false, allOverride: false })).toBeUndefined()
  })

  it('is active on a clean visit with no explicit request and no override', () => {
    const result = buildPersonalization(SUB, { signedIn: true, onboardingDone: true, hasExplicitRequest: false, allOverride: false })
    expect(result).toEqual({ active: true, watchlist: ['Nashville', 'Miami'], minDiscountPct: 50, alertPreference: 'instant' })
  })

  it('is inactive (but still present, for the "Use my preferences" copy) when an explicit request was made', () => {
    const result = buildPersonalization(SUB, { signedIn: true, onboardingDone: true, hasExplicitRequest: true, allOverride: false })
    expect(result).toEqual({ active: false, watchlist: ['Nashville', 'Miami'], minDiscountPct: 50, alertPreference: 'instant' })
  })

  it('is inactive when the "Show all deals" override is given', () => {
    const result = buildPersonalization(SUB, { signedIn: true, onboardingDone: true, hasExplicitRequest: false, allOverride: true })
    expect(result?.active).toBe(false)
  })
})

describe('resolveWatchlistMarketIds', () => {
  beforeEach(() => {
    mockQuery.mockReset()
  })

  it('returns an empty array without querying for an empty watchlist', async () => {
    const ids = await resolveWatchlistMarketIds([])
    expect(ids).toEqual([])
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('resolves real city names to their market ids via ANY()', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 3 }, { id: 7 }], rowCount: 2, command: 'SELECT', oid: 0, fields: [] })

    const ids = await resolveWatchlistMarketIds(['Nashville', 'Miami'])

    expect(ids).toEqual([3, 7])
    expect(mockQuery).toHaveBeenCalledWith('SELECT id FROM tracked_markets WHERE city = ANY($1)', [['Nashville', 'Miami']])
  })

  it('silently drops a city that no longer matches a tracked market', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 3 }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] })

    const ids = await resolveWatchlistMarketIds(['Nashville', 'Atlantis'])

    expect(ids).toEqual([3])
  })

  it('returns an empty array, never throws, if the lookup itself fails', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'))

    const ids = await resolveWatchlistMarketIds(['Nashville'])

    expect(ids).toEqual([])
  })
})
