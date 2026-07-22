import { Children, type ReactElement, type ReactNode } from 'react'
import { auth } from '@/auth'
import { getFreeUnlockedDealIds, getPaywallContext } from '@/lib/paywall'
import { getActiveDeals } from '@/lib/pipeline/dealDetection'
import { query } from '@/lib/db/client'
import DealsPage from '../page'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/subscription', () => ({ getSubscription: jest.fn() }))
jest.mock('@/lib/paywall', () => ({ getPaywallContext: jest.fn(), getFreeUnlockedDealIds: jest.fn() }))
jest.mock('@/lib/pipeline/dealDetection', () => ({ getActiveDeals: jest.fn() }))
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
  if (!main || !main.props.children || typeof main.props.children !== 'object') throw new Error('DealFeed not found')
  return (main.props.children as ReactElement<Record<string, unknown>>).props
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
})
