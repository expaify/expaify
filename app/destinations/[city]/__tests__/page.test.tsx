import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { auth } from '@/auth'
import { getFreeUnlockedDealIds, getPaywallContext } from '@/lib/paywall'
import { getActiveDeals, getTrackedHotels } from '@/lib/pipeline/dealDetection'
import { query } from '@/lib/db/client'
import CityPage from '../page'
import { DealFeed } from '@/app/deals/DealFeed'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/paywall', () => ({ getPaywallContext: jest.fn(), getFreeUnlockedDealIds: jest.fn() }))
jest.mock('@/lib/pipeline/dealDetection', () => ({ getActiveDeals: jest.fn(), getTrackedHotels: jest.fn() }))
jest.mock('@/lib/db/client', () => ({ query: jest.fn() }))
jest.mock('@/lib/subscription', () => ({ getSubscription: jest.fn(), isPremium: jest.fn(() => false) }))
jest.mock('@/app/deals/DealFeed', () => ({ DealFeed: jest.fn(() => <div data-testid="deal-feed" />) }))

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockGetPaywallContext = getPaywallContext as jest.MockedFunction<typeof getPaywallContext>
const mockGetFreeUnlockedDealIds = getFreeUnlockedDealIds as jest.MockedFunction<typeof getFreeUnlockedDealIds>
const mockGetActiveDeals = getActiveDeals as jest.MockedFunction<typeof getActiveDeals>
const mockGetTrackedHotels = getTrackedHotels as jest.MockedFunction<typeof getTrackedHotels>
const mockQuery = query as jest.MockedFunction<typeof query>

function walk(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (!node || typeof node !== 'object') return []
  const element = node as ReactElement<Record<string, unknown>>
  const children = element.props?.children
  return [element, ...(Array.isArray(children) ? children : [children]).flatMap(walk)]
}

describe('destination criteria continuity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue(null as never)
    mockGetPaywallContext.mockResolvedValue({ userId: null, premium: false, freeUnlockedThisWeek: 0, freeUnlockLimit: 3 })
    mockGetFreeUnlockedDealIds.mockResolvedValue(new Set())
    mockGetActiveDeals.mockResolvedValue([])
    mockGetTrackedHotels.mockResolvedValue([])
    mockQuery.mockResolvedValue({ rows: [{ id: 7 }], command: 'SELECT', rowCount: 1, oid: 0, fields: [] })
  })

  it('reuses the same default criteria version across clean-url refreshes', async () => {
    const props = { params: Promise.resolve({ city: 'miami' }), searchParams: Promise.resolve({}) }
    const first = await CityPage(props)
    const refreshed = await CityPage(props)
    const firstFeed = walk(first).find(element => element.type === DealFeed)
    const refreshedFeed = walk(refreshed).find(element => element.type === DealFeed)

    expect(firstFeed).toBeDefined()
    expect(refreshedFeed).toBeDefined()
    expect((refreshedFeed!.props.initialCriteria as { criteriaVersion: string }).criteriaVersion)
      .toBe((firstFeed!.props.initialCriteria as { criteriaVersion: string }).criteriaVersion)
    expect((firstFeed!.props.initialCriteria as { source: string }).source).toBe('destination_page')
  })

  it('renders a restore-failure state when the requested criteria targets a different city', async () => {
    const props = {
      params: Promise.resolve({ city: 'miami' }),
      searchParams: Promise.resolve({
        criteriaSchema: '1',
        criteriaVersion: '785d80de-8954-46c7-90f7-a4a04f719e5f',
        criteriaSource: 'restored',
        city: 'Paris',
      }),
    }
    const tree = await CityPage(props)
    const feed = walk(tree).find(element => element.type === DealFeed)

    expect(feed).toBeUndefined()
    expect(mockGetActiveDeals).not.toHaveBeenCalled()
  })

  it('renders Wave A H1, intro, visible FAQs, and matching FAQPage JSON-LD', async () => {
    const tree = await CityPage({ params: Promise.resolve({ city: 'orlando' }), searchParams: Promise.resolve({}) })
    const html = renderToStaticMarkup(tree)

    expect(html).toContain('Orlando hotel deals below the usual rate')
    expect(html).toContain('In Orlando, &quot;usual&quot; is not the number printed on a package page.')
    expect(html).toContain('What makes a room an Orlando deal here?')
    expect(html).toContain('The listed nightly rate has to fall to 30% or more below that same hotel')

    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)
    expect(jsonLdMatch).not.toBeNull()
    const jsonLd = JSON.parse(jsonLdMatch![1]) as { '@graph': Array<{ '@type': string; mainEntity?: Array<{ name: string; acceptedAnswer: { text: string } }> }> }
    const faqPage = jsonLd['@graph'].find((entry) => entry['@type'] === 'FAQPage')
    expect(faqPage?.mainEntity?.[0]).toEqual({
      '@type': 'Question',
      name: 'What makes a room an Orlando deal here?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The listed nightly rate has to fall to 30% or more below that same hotel\'s own 60-day median, with at least eight price checks recorded so a single odd snapshot cannot invent a bargain.',
      },
    })
  })

  it('renders full SEO hub content and JSON-LD for a Wave B/C destination', async () => {
    const tree = await CityPage({ params: Promise.resolve({ city: 'barcelona' }), searchParams: Promise.resolve({}) })
    const html = renderToStaticMarkup(tree)

    expect(html).toContain('Barcelona hotel deals below the usual rate')
    expect(html).toContain('In Barcelona, “usual” cannot be a citywide average.')
    expect(html).toContain('application/ld+json')
  })

  it('falls back to real tracked hotels (no discount, locked past the free limit) when there are zero confirmed deals', async () => {
    const trackedRow = {
      id: 'tracked-1', hotel_id: 'h-1', hotel_name: 'Hotel Real', stars: 4,
      photo_url: '/photo.jpg', city: 'Miami', deal_price_cents: 20000, median_price_cents: 20000,
      currency: 'USD', discount_pct: 0, check_in_window: 'flexible', check_in_date: '2026-11-01',
      nights: 2, snapshot_count: 3, ota_links: {}, headline: null, description: null,
      is_mock: false, first_seen: null, expires_at: null, updated_at: null,
    }
    mockGetTrackedHotels.mockResolvedValue([trackedRow, { ...trackedRow, id: 'tracked-2' }, { ...trackedRow, id: 'tracked-3' }, { ...trackedRow, id: 'tracked-4' }])

    const tree = await CityPage({ params: Promise.resolve({ city: 'miami' }), searchParams: Promise.resolve({}) })
    const html = renderToStaticMarkup(tree)
    const feed = walk(tree).find(element => element.type === DealFeed)

    expect(mockGetTrackedHotels).toHaveBeenCalledWith({ limit: expect.any(Number), marketId: 7 })
    expect(html).toContain('Checked daily — nothing confirmed yet, here&#x27;s what we&#x27;re tracking')
    expect(html).not.toContain('no active deals right now')
    const initialDeals = feed!.props.initialDeals as Array<{ locked: boolean; discountPct: number; hotelName: string }>
    expect(initialDeals).toHaveLength(4)
    // free-tier default (freeUnlockLimit: 3): first 3 unlocked, 4th locked
    expect(initialDeals.map(d => d.locked)).toEqual([false, false, false, true])
    expect(initialDeals.every(d => d.discountPct === 0)).toBe(true)
    expect(initialDeals[3].hotelName).toBe('Members-only deal')
  })

  it('keeps the existing fully-empty state when both confirmed and tracked queries return zero rows', async () => {
    mockGetTrackedHotels.mockResolvedValue([])

    const tree = await CityPage({ params: Promise.resolve({ city: 'miami' }), searchParams: Promise.resolve({}) })
    const html = renderToStaticMarkup(tree)

    expect(mockGetTrackedHotels).toHaveBeenCalled()
    expect(html).toContain('Checked daily — no active deals right now')
    expect(html).toContain('Get free alerts for Miami')
  })
})
