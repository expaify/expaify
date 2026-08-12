import { Children, type ReactElement, type ReactNode } from 'react'
import { auth } from '@/auth'
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
jest.mock('@/app/components/LandingNav', () => ({ LandingNav: () => null }))
jest.mock('../DealFeed', () => ({ DealFeed: () => null }))

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockGetPaywallContext = getPaywallContext as jest.MockedFunction<typeof getPaywallContext>
const mockGetFreeUnlockedDealIds = getFreeUnlockedDealIds as jest.MockedFunction<typeof getFreeUnlockedDealIds>
const mockGetActiveDeals = getActiveDeals as jest.MockedFunction<typeof getActiveDeals>
const mockQuery = query as jest.MockedFunction<typeof query>

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
})
