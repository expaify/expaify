import { Children, type ReactElement, type ReactNode } from 'react'
import { auth } from '@/auth'
import { getSubscription } from '@/lib/subscription'
import { getFreeUnlockedDealIds, getPaywallContext } from '@/lib/paywall'
import { getActiveDeals } from '@/lib/pipeline/dealDetection'
import { query } from '@/lib/db/client'
import DealsPage from '../page'
import { DealFeed } from '../DealFeed'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/subscription', () => ({ getSubscription: jest.fn() }))
jest.mock('@/lib/paywall', () => ({ getPaywallContext: jest.fn(), getFreeUnlockedDealIds: jest.fn() }))
jest.mock('@/lib/pipeline/dealDetection', () => ({ getActiveDeals: jest.fn(), getTrackedHotels: jest.fn(() => Promise.resolve([])) }))
jest.mock('@/lib/db/client', () => ({ query: jest.fn() }))
jest.mock('@/app/components/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('../DealFeed', () => ({ DealFeed: () => null }))

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockGetSubscription = getSubscription as jest.MockedFunction<typeof getSubscription>
const mockGetPaywallContext = getPaywallContext as jest.MockedFunction<typeof getPaywallContext>
const mockGetFreeUnlockedDealIds = getFreeUnlockedDealIds as jest.MockedFunction<typeof getFreeUnlockedDealIds>
const mockGetActiveDeals = getActiveDeals as jest.MockedFunction<typeof getActiveDeals>
const mockQuery = query as jest.MockedFunction<typeof query>

function redirectTarget(error: unknown): string {
  const digest = (error as { digest?: string })?.digest ?? ''
  const parts = digest.split(';')
  if (parts[0] !== 'NEXT_REDIRECT') throw new Error(`not a redirect error: ${digest || String(error)}`)
  return parts.slice(2, -2).join(';')
}

function dealFeedProps(tree: ReactElement<Record<string, unknown>>): Record<string, unknown> {
  const rootChildren = Children.toArray(tree.props.children as ReactNode) as ReactElement<Record<string, unknown>>[]
  const main = rootChildren.find(child => child.type === 'main')
  if (!main) throw new Error('DealFeed not found')
  const mainChildren = Children.toArray(main.props.children as ReactNode) as ReactElement<Record<string, unknown>>[]
  const dealFeed = mainChildren.find(child => child.type === DealFeed)
  if (!dealFeed) throw new Error('DealFeed not found')
  return dealFeed.props
}

describe('/deals server reconstruction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue(null as never)
    mockGetPaywallContext.mockResolvedValue({ userId: 'premium-user', premium: true, freeUnlockedThisWeek: 0, freeUnlockLimit: 3 })
    mockGetFreeUnlockedDealIds.mockResolvedValue(new Set())
    mockQuery.mockResolvedValue({ rows: [{ id: 7 }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] })
  })

  it('preserves valid requested criteria but renders an initial retry state when loading fails', async () => {
    mockGetActiveDeals.mockRejectedValue(new Error('database unavailable'))
    const version = '785d80de-8954-46c7-90f7-a4a04f719e5f'
    const tree = await DealsPage({
      searchParams: Promise.resolve({
        criteriaSchema: '1',
        criteriaVersion: version,
        criteriaSource: 'restored',
        city: 'Miami',
        date_from: '2026-08-01',
      }),
    }) as ReactElement<Record<string, unknown>>
    const props = dealFeedProps(tree)

    expect(props.initialError).toBe(true)
    expect(props.initialDeals).toEqual([])
    expect(props.initialCriteria).toEqual(expect.objectContaining({ criteriaVersion: version }))
  })

  it('distinguishes a successful empty response from a load failure', async () => {
    mockGetActiveDeals.mockResolvedValue([])
    const tree = await DealsPage({
      searchParams: Promise.resolve({
        criteriaSchema: '1',
        criteriaVersion: '785d80de-8954-46c7-90f7-a4a04f719e5f',
        criteriaSource: 'restored',
        city: 'Miami',
      }),
    }) as ReactElement<Record<string, unknown>>

    expect(dealFeedProps(tree).initialError).toBe(false)
  })

  it('passes the first-page continuation boundary from the server to the feed', async () => {
    mockGetActiveDeals.mockResolvedValue(Array.from({ length: 13 }, (_, index) => ({
      id: `deal-${index}`,
      hotel_id: `hotel-${index}`,
      hotel_name: `Hotel ${index}`,
      stars: 4,
      photo_url: null,
      city: 'Miami',
      deal_price_cents: 10_000 + index,
      median_price_cents: 15_000,
      currency: 'USD',
      discount_pct: 30,
      check_in_window: 'Aug 1–3',
      check_in_date: '2026-08-01',
      nights: 2,
      snapshot_count: 20,
      ota_links: {},
      headline: null,
      description: null,
      is_mock: false,
      first_seen: null,
      expires_at: null,
      updated_at: null,
    })))
    const tree = await DealsPage({ searchParams: Promise.resolve({}) }) as ReactElement<Record<string, unknown>>
    const props = dealFeedProps(tree)

    expect(mockGetActiveDeals).toHaveBeenCalledWith(expect.objectContaining({ limit: 13, offset: 0 }))
    expect((props.initialDeals as unknown[])).toHaveLength(12)
    expect(props.initialCoverage).toEqual({ state: 'more_available', nextOffset: 12 })
  })

  it('mints a stable criteriaVersion for a clean visit instead of a new one on every refresh', async () => {
    mockGetActiveDeals.mockResolvedValue([])
    const first = await DealsPage({ searchParams: Promise.resolve({}) }) as ReactElement<Record<string, unknown>>
    const second = await DealsPage({ searchParams: Promise.resolve({}) }) as ReactElement<Record<string, unknown>>

    const firstVersion = (dealFeedProps(first).initialCriteria as { criteriaVersion: string }).criteriaVersion
    const secondVersion = (dealFeedProps(second).initialCriteria as { criteriaVersion: string }).criteriaVersion
    expect(firstVersion).toBe(secondVersion)
  })

  describe('watchlist personalization for a signed-in, onboarded user', () => {
    const SUB = {
      onboardingDone: true,
      watchlist: ['Nashville', 'Miami'],
      alertMinDiscount: 50,
      alertPreference: 'instant' as const,
      status: 'free' as const,
    }

    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never)
      mockGetSubscription.mockResolvedValue(SUB as never)
      mockGetActiveDeals.mockResolvedValue([])
      // Single-city lookup (requestedCity, when given) returns id 7; the
      // watchlist's own ANY() lookup (resolveWatchlistMarketIds) returns
      // ids 3 and 9 -- distinct values so each call site's result is
      // unambiguous in the assertions below.
      mockQuery.mockImplementation((sql: string) => {
        if (String(sql).includes('ANY')) {
          return Promise.resolve({ rows: [{ id: 3 }, { id: 9 }], rowCount: 2, command: 'SELECT', oid: 0, fields: [] })
        }
        return Promise.resolve({ rows: [{ id: 7 }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] })
      })
    })

    it('is active on a clean visit, and filters getActiveDeals by the watchlist\'s market ids', async () => {
      const tree = await DealsPage({ searchParams: Promise.resolve({}) }) as ReactElement<Record<string, unknown>>

      expect(dealFeedProps(tree).personalization).toEqual({
        active: true, watchlist: ['Nashville', 'Miami'], minDiscountPct: 50, alertPreference: 'instant',
      })
      expect(mockGetActiveDeals).toHaveBeenCalledWith(expect.objectContaining({ marketIds: [3, 9], marketId: undefined }))
    })

    it('is present but inactive when an explicit city/date search is requested, and does not apply the watchlist filter', async () => {
      const version = '785d80de-8954-46c7-90f7-a4a04f719e5f'
      const tree = await DealsPage({
        searchParams: Promise.resolve({ criteriaSchema: '1', criteriaVersion: version, criteriaSource: 'restored', city: 'Miami' }),
      }) as ReactElement<Record<string, unknown>>

      expect((dealFeedProps(tree).personalization as { active: boolean }).active).toBe(false)
      expect(mockGetActiveDeals).toHaveBeenCalledWith(expect.objectContaining({ marketId: 7, marketIds: undefined }))
    })

    it('is inactive when the "Show all deals" override (?all=1) is given, even on an otherwise clean visit', async () => {
      const tree = await DealsPage({ searchParams: Promise.resolve({ all: '1' }) }) as ReactElement<Record<string, unknown>>

      expect((dealFeedProps(tree).personalization as { active: boolean }).active).toBe(false)
      expect(mockGetActiveDeals).toHaveBeenCalledWith(expect.objectContaining({ marketIds: undefined }))
    })

    it('stays active with no market filter at all when the watchlist is empty ("watching everywhere")', async () => {
      mockGetSubscription.mockResolvedValue({ ...SUB, watchlist: [] } as never)

      const tree = await DealsPage({ searchParams: Promise.resolve({}) }) as ReactElement<Record<string, unknown>>

      expect((dealFeedProps(tree).personalization as { active: boolean; watchlist: string[] })).toEqual(
        expect.objectContaining({ active: true, watchlist: [] })
      )
      expect(mockGetActiveDeals).toHaveBeenCalledWith(expect.objectContaining({ marketIds: undefined }))
    })

    // The real bug this closes: DealFeed.tsx's own PersonalizedEmpty/
    // PersonalizedEmptyActions components already existed but were
    // unreachable, because this fallback unconditionally filled
    // initialDeals with unrelated global tracked-hotel data whenever the
    // real query came back empty -- masking the personalized empty state
    // for every personalized user with zero matching deals.
    it('does not fall back to global tracked-hotel/mock teasers when personalization is active and the real query is empty', async () => {
      const tree = await DealsPage({ searchParams: Promise.resolve({}) }) as ReactElement<Record<string, unknown>>

      expect(dealFeedProps(tree).initialDeals).toEqual([])
    })
  })

  it('does not personalize an anonymous visitor (personalization prop is undefined)', async () => {
    mockGetActiveDeals.mockResolvedValue([])
    const tree = await DealsPage({ searchParams: Promise.resolve({}) }) as ReactElement<Record<string, unknown>>

    expect(dealFeedProps(tree).personalization).toBeUndefined()
  })

  describe('onboarding redirect for a signed-in user who has not set preferences', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never)
      mockGetSubscription.mockResolvedValue({ onboardingDone: false } as never)
    })

    // Real bug: a user who clicked "Get free alerts for {city}" on a deal
    // page, signed in via /login?city=X, and landed back here authenticated
    // had that city silently dropped -- this redirect forwarded nothing to
    // /onboarding, which then showed a blank destination grid.
    it('forwards the city query param to /onboarding', async () => {
      const error = await DealsPage({ searchParams: Promise.resolve({ city: 'Nashville' }) }).catch(e => e)
      expect(redirectTarget(error)).toBe('/onboarding?city=Nashville')
    })

    it('redirects to bare /onboarding when no city was given', async () => {
      const error = await DealsPage({ searchParams: Promise.resolve({}) }).catch(e => e)
      expect(redirectTarget(error)).toBe('/onboarding')
    })
  })
})
