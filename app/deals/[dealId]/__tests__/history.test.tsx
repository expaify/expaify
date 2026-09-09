import type { ReactElement } from 'react'
import DealDetailPage from '../page'
import { getDealById, getPriceHistory, type DealRow } from '@/lib/pipeline/dealDetection'
import { getPaywallContext, getFreeUnlockedDealIds } from '@/lib/paywall'
import { query } from '@/lib/db/client'

jest.mock('@/lib/pipeline/dealDetection', () => ({ getDealById: jest.fn(), getPriceHistory: jest.fn() }))
jest.mock('@/lib/paywall', () => ({ getPaywallContext: jest.fn(), getFreeUnlockedDealIds: jest.fn() }))
jest.mock('@/lib/db/client', () => ({ query: jest.fn() }))
jest.mock('@/lib/subscription', () => ({ getSubscription: jest.fn() }))

type SectionProps = { deal: DealRow; loadHistory: () => Promise<unknown> }
type Section = ReactElement<SectionProps> & { type: (props: SectionProps) => Promise<unknown> }

function historySections(node: unknown): Section[] {
  if (Array.isArray(node)) return node.flatMap(historySections)
  if (!node || typeof node !== 'object' || !('props' in node)) return []
  const element = node as ReactElement<{ children?: unknown; loadHistory?: unknown }>
  if (typeof element.props.loadHistory === 'function') return [node as Section]
  return historySections(element.props.children)
}

const history = [1, 2, 3].map(day => ({ date: `2026-09-0${day}`, price_cents: 10000 }))
const deal: DealRow = {
  id: 'deal-1', hotel_id: 'hotel-1', hotel_name: 'Hotel', city: 'Miami',
  stars: 4, photo_url: null, currency: 'USD', deal_price_cents: 6000,
  median_price_cents: 10000, discount_pct: 40, check_in_window: 'Oct 1–3',
  check_in_date: '2026-10-01', nights: 2, snapshot_count: 10, ota_links: {},
  headline: null, description: null, is_mock: false, first_seen: null,
  updated_at: null, expires_at: null,
}
const renderPage = () => DealDetailPage({ params: Promise.resolve({ dealId: deal.id }), searchParams: Promise.resolve({}) })

describe('deal detail shared history reads', () => {
  const previousIa = process.env.NEXT_PUBLIC_DEAL_DETAIL_IA
  beforeEach(() => {
    jest.resetAllMocks()
    jest.mocked(getDealById).mockResolvedValue(deal)
    jest.mocked(getPaywallContext).mockResolvedValue({ userId: null, premium: true, freeUnlockLimit: 3, freeUnlockedThisWeek: 0 })
    jest.mocked(query).mockResolvedValue({ rows: [{ id: 7 }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] })
    jest.mocked(getPriceHistory).mockResolvedValue(history)
  })
  afterAll(() => {
    if (previousIa === undefined) delete process.env.NEXT_PUBLIC_DEAL_DETAIL_IA
    else process.env.NEXT_PUBLIC_DEAL_DETAIL_IA = previousIa
  })

  it.each(['0', '1'])('makes one lazy market/history query pair across both sections (IA %s)', async ia => {
    process.env.NEXT_PUBLIC_DEAL_DETAIL_IA = ia
    const sections = historySections(await renderPage())
    expect(sections).toHaveLength(2)
    expect(query).not.toHaveBeenCalled()
    expect(sections[0].props.loadHistory).toBe(sections[1].props.loadHistory)
    await Promise.all(sections.map(section => section.type(section.props)))
    expect(query).toHaveBeenCalledTimes(1)
    expect(getPriceHistory).toHaveBeenCalledTimes(1)
    expect(getPriceHistory).toHaveBeenCalledWith('hotel-1', 7, 'USD')

    const nextRequest = historySections(await renderPage())
    await nextRequest[0].props.loadHistory()
    expect(query).toHaveBeenCalledTimes(2)
    expect(getPriceHistory).toHaveBeenCalledTimes(2)
  })

  it('shares the empty fallback when history fails', async () => {
    jest.mocked(getPriceHistory).mockRejectedValue(new Error('unavailable'))
    const sections = historySections(await renderPage())
    expect(await Promise.all(sections.map(section => section.props.loadHistory()))).toEqual([[], []])
    expect(getPriceHistory).toHaveBeenCalledTimes(1)
  })

  it('preserves the market lookup fallback', async () => {
    jest.mocked(query).mockRejectedValue(new Error('unavailable'))
    const sections = historySections(await renderPage())
    await Promise.all(sections.map(section => section.props.loadHistory()))
    expect(query).toHaveBeenCalledTimes(1)
    expect(getPriceHistory).toHaveBeenCalledWith('hotel-1', undefined, 'USD')
  })

  it('does not start history reads for locked deals', async () => {
    jest.mocked(getPaywallContext).mockResolvedValue({ userId: null, premium: false, freeUnlockLimit: 3, freeUnlockedThisWeek: 0 })
    jest.mocked(getFreeUnlockedDealIds).mockResolvedValue(new Set())
    expect(historySections(await renderPage())).toHaveLength(0)
    expect(query).not.toHaveBeenCalled()
    expect(getPriceHistory).not.toHaveBeenCalled()
  })
})
