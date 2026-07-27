import type { ReactElement } from 'react'

const stateSlots: unknown[] = []
const refSlots: Array<{ current: unknown }> = []
let stateCursor = 0
let refCursor = 0
let popstateHandler: (() => void) | undefined
const refresh = jest.fn()
const mockTrack = jest.fn()

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')
  return {
    ...actual,
    useState: jest.fn((initial: unknown) => {
      const index = stateCursor++
      if (!(index in stateSlots)) stateSlots[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial
      return [stateSlots[index], (value: unknown) => {
        stateSlots[index] = typeof value === 'function' ? (value as (current: unknown) => unknown)(stateSlots[index]) : value
      }]
    }),
    useRef: jest.fn((initial: unknown) => {
      const index = refCursor++
      if (!(index in refSlots)) refSlots[index] = { current: initial }
      return refSlots[index]
    }),
    useCallback: jest.fn((callback: unknown) => callback),
    useEffect: jest.fn((effect: () => void | (() => void)) => {
      effect()
    }),
  }
})

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), refresh }),
}))
jest.mock('@/lib/analytics', () => ({ track: mockTrack }))

const { DealFeed } = jest.requireActual('../DealFeed') as typeof import('../DealFeed')
const { HotelSearchCriteriaSummary } = jest.requireActual('../../components/HotelSearchCriteria') as typeof import('../../components/HotelSearchCriteria')

const newCriteria = {
  schemaVersion: 1 as const,
  criteriaVersion: 'criteria_newer',
  destination: { state: 'selected' as const, city: 'Paris' },
  dates: { semantic: 'missing' as const },
  occupancy: { state: 'not_captured' as const },
  source: 'edit' as const,
}

const initialDeal = {
  id: 'deal_paris',
  hotelId: 'hotel_paris',
  hotelName: 'Paris Hotel',
  stars: 4,
  photoUrl: null,
  city: 'Paris',
  dealPriceCents: 12000,
  medianPriceCents: 18000,
  discountPct: 33,
  checkInWindow: 'Aug 1–3',
  checkInDate: '2026-08-01',
  nights: 2,
  snapshotCount: 20,
  otaLinks: {},
  headline: null,
  isMock: false,
  firstSeen: null,
  updatedAt: null,
  locked: false,
}

function renderFeed(overrides: Partial<Parameters<typeof DealFeed>[0]> = {}) {
  stateCursor = 0
  refCursor = 0
  return DealFeed({
    initialDeals: [initialDeal],
    initialCriteria: newCriteria,
    initialView: { minDiscount: 20, maxPriceCents: null, minStars: 0, sort: 'newest' },
    premium: true,
    ...overrides,
  })
}

function walk(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (!node || typeof node !== 'object') return []
  const element = node as ReactElement<Record<string, unknown>>
  const children = element.props?.children
  return [element, ...(Array.isArray(children) ? children : [children]).flatMap(walk)]
}

describe('DealFeed browser history restoration', () => {
  beforeEach(() => {
    stateSlots.length = 0
    refSlots.length = 0
    popstateHandler = undefined
    refresh.mockClear()
    mockTrack.mockClear()
    const location = { pathname: '/deals', search: '?criteriaSchema=1&criteriaVersion=criteria_newer&criteriaSource=edit&city=Paris' }
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: {
        location,
        history: { replaceState: jest.fn() },
        addEventListener: jest.fn((type: string, listener: () => void) => {
          if (type === 'popstate') popstateHandler = listener
        }),
        removeEventListener: jest.fn(),
        requestAnimationFrame: (callback: () => void) => callback(),
        performance: { now: () => 1 },
        innerWidth: 1280,
      },
    })
    Object.defineProperty(global, 'fetch', { configurable: true, value: jest.fn() })
  })

  it('restores summary criteria and cards when Back emits popstate', async () => {
    renderFeed()
    expect(popstateHandler).toBeDefined()

    const oldVersion = 'criteria_older'
    ;(window.location as unknown as { search: string }).search =
      `?criteriaSchema=1&criteriaVersion=${oldVersion}&criteriaSource=restored&city=Miami&date_from=2026-09-10`
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        criteriaVersion: oldVersion,
        deals: [{ ...initialDeal, id: 'deal_miami', hotelId: 'hotel_miami', hotelName: 'Miami Hotel', city: 'Miami' }],
        total: 1,
        premium: true,
        coverage: 'confirmed_end',
        page: { nextOffset: null, hasMore: false, exactTotal: 1 },
      }),
    })

    popstateHandler!()
    await new Promise(resolve => setImmediate(resolve))
    await new Promise(resolve => setImmediate(resolve))

    const restoredTree = renderFeed()
    const summary = walk(restoredTree).find(element => element.type === HotelSearchCriteriaSummary)
    expect((summary?.props.criteria as typeof newCriteria).criteriaVersion).toBe(oldVersion)
    expect((summary?.props.criteria as typeof newCriteria).destination).toEqual({ state: 'selected', city: 'Miami' })
    expect(stateSlots[0]).toEqual([
      expect.objectContaining({ id: 'deal_miami', city: 'Miami', hotelName: 'Miami Hotel' }),
    ])
    expect(refresh).not.toHaveBeenCalled()
  })

  it('renders the initial-load Retry state without emitting results viewed', () => {
    const tree = renderFeed({ initialDeals: [], initialError: true })

    expect(JSON.stringify(tree)).toContain("Couldn't load hotel deals.")
    expect(JSON.stringify(tree)).toContain('Check your connection and try again.')
    expect(mockTrack).not.toHaveBeenCalledWith('hotel_results_viewed', expect.anything())
  })
})
