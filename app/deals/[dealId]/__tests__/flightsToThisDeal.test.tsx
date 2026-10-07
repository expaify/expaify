import type { ReactElement, ReactNode } from 'react'
import DealDetailPage from '../page'
import { getDealById, getPriceHistory, type DealRow } from '@/lib/pipeline/dealDetection'
import { getPaywallContext, getFreeUnlockedDealIds } from '@/lib/paywall'
import { query } from '@/lib/db/client'
import { FlightsToThisDeal } from '@/app/components/FlightsToThisDeal'

jest.mock('@/lib/pipeline/dealDetection', () => ({ getDealById: jest.fn(), getPriceHistory: jest.fn() }))
jest.mock('@/lib/paywall', () => ({ getPaywallContext: jest.fn(), getFreeUnlockedDealIds: jest.fn() }))
jest.mock('@/lib/db/client', () => ({ query: jest.fn() }))
jest.mock('@/lib/subscription', () => ({ getSubscription: jest.fn() }))

function findElements(node: unknown, predicate: (el: ReactElement) => boolean, found: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    node.forEach(child => findElements(child, predicate, found))
    return found
  }
  if (!node || typeof node !== 'object' || !('props' in node)) return found
  const element = node as ReactElement<{ children?: ReactNode }>
  if (predicate(element)) found.push(element)
  findElements(element.props?.children, predicate, found)
  return found
}

function collectHrefs(node: unknown, hrefs: string[] = []): string[] {
  if (Array.isArray(node)) {
    node.forEach(child => collectHrefs(child, hrefs))
    return hrefs
  }
  if (!node || typeof node !== 'object' || !('props' in node)) return hrefs
  const element = node as ReactElement<{ href?: string; children?: ReactNode }>
  if (typeof element.props?.href === 'string') hrefs.push(element.props.href)
  collectHrefs(element.props?.children, hrefs)
  return hrefs
}

// Matches the production-serving branch: NEXT_PUBLIC_DEAL_DETAIL_IA is on
// live right now, confirmed by reading expaify.com's own RSC payload
// (detail_ia:true) while investigating the real "/flights?destination=BNA"
// dead-end a user reported.
const deal: DealRow = {
  id: 'deal-1', hotel_id: 'hotel-1', hotel_name: 'Hotel', city: 'Miami',
  stars: 4, photo_url: null, currency: 'USD', deal_price_cents: 6000,
  median_price_cents: 10000, discount_pct: 40, check_in_window: 'Oct 1–3',
  check_in_date: '2026-10-01', nights: 2, snapshot_count: 10, ota_links: {},
  headline: null, description: null, is_mock: false, first_seen: null,
  updated_at: null, expires_at: null,
}
const renderPage = () => DealDetailPage({ params: Promise.resolve({ dealId: deal.id }), searchParams: Promise.resolve({}) })

describe('deal detail flight CTA (live dealDetailIa branch)', () => {
  const previousIa = process.env.NEXT_PUBLIC_DEAL_DETAIL_IA

  beforeEach(() => {
    jest.resetAllMocks()
    jest.mocked(getDealById).mockResolvedValue(deal)
    jest.mocked(getPaywallContext).mockResolvedValue({ userId: null, premium: true, freeUnlockLimit: 3, freeUnlockedThisWeek: 0 })
    jest.mocked(getFreeUnlockedDealIds).mockResolvedValue(new Set())
    jest.mocked(query).mockResolvedValue({ rows: [{ id: 7 }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] })
    jest.mocked(getPriceHistory).mockResolvedValue([])
    process.env.NEXT_PUBLIC_DEAL_DETAIL_IA = '1'
  })

  afterAll(() => {
    if (previousIa === undefined) delete process.env.NEXT_PUBLIC_DEAL_DETAIL_IA
    else process.env.NEXT_PUBLIC_DEAL_DETAIL_IA = previousIa
  })

  it('renders the real FlightsToThisDeal widget for a confirmed, unexpired, tracked-market deal', async () => {
    const page = await renderPage()
    const widgets = findElements(page, el => el.type === FlightsToThisDeal)
    expect(widgets).toHaveLength(1)
    expect(widgets[0].props).toMatchObject({ destinationIata: 'MIA', checkInDate: '2026-10-01', nights: 2 })
  })

  it('never links out to the dead /flights?destination= deep link', async () => {
    const page = await renderPage()
    const hrefs = collectHrefs(page)
    expect(hrefs.some(href => href.includes('/flights?destination='))).toBe(false)
  })

  it('does not render the widget for an expired deal', async () => {
    jest.mocked(getDealById).mockResolvedValue({ ...deal, expires_at: '2020-01-01T00:00:00Z' })
    const page = await renderPage()
    const widgets = findElements(page, el => el.type === FlightsToThisDeal)
    expect(widgets).toHaveLength(0)
  })

  it('does not render the widget when check-in/nights are incomplete', async () => {
    jest.mocked(getDealById).mockResolvedValue({ ...deal, nights: 0 })
    const page = await renderPage()
    const widgets = findElements(page, el => el.type === FlightsToThisDeal)
    expect(widgets).toHaveLength(0)
  })
})
