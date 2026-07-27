import type { ReactElement } from 'react'
import type { ApiDeal } from '../DealFeed'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={typeof href === 'string' ? href : ''} {...props}>{children}</a>
  ),
}))

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@/app/components/ui/SearchBar', () => ({ SearchBar: () => null }))
jest.mock('@/app/components/HotelSearchCriteria', () => ({
  HotelSearchCriteriaEditor: () => null,
  HotelSearchCriteriaSummary: ({ criteria }: { criteria: { destination: { state: string; city?: string } } }) => (
    <div data-testid="criteria-summary">
      {criteria.destination.state === 'selected' ? criteria.destination.city : 'no destination'}
    </div>
  ),
}))
jest.mock('@/app/components/ui/DealCard', () => ({
  DealCard: ({ deal }: { deal: { id: string; hotelName: string } }) => (
    <article data-testid={`deal-${deal.id}`}>{deal.hotelName}</article>
  ),
}))
jest.mock('@/app/components/ui/LockedDealCard', () => ({
  LockedDealCard: ({ placeholderName }: { placeholderName: string }) => <article>{placeholderName}</article>,
}))
jest.mock('../HotelRecoveryUI', () => ({
  HotelResultStatus: () => null,
}))

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void

class IntersectionObserverDouble {
  static instances: IntersectionObserverDouble[] = []

  callback: ObserverCallback
  observe = jest.fn()
  disconnect = jest.fn()
  unobserve = jest.fn()
  takeRecords = jest.fn(() => [])
  root = null
  rootMargin = ''
  thresholds = [0]
  options?: IntersectionObserverInit

  constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback
    this.options = options
    IntersectionObserverDouble.instances.push(this)
  }
}

function deal(id: string, city: string): ApiDeal {
  return {
    id,
    hotelId: `hotel-${id}`,
    hotelName: `Hotel ${id}`,
    stars: 4,
    photoUrl: null,
    city,
    dealPriceCents: 10_000,
    medianPriceCents: 15_000,
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
}

function responseFor(requestUrl: string, deals: ApiDeal[]) {
  const url = new URL(requestUrl, 'https://expaify.test')
  return {
    ok: true,
    json: async () => ({
      deals,
      total: deals.length,
      premium: true,
      criteriaVersion: url.searchParams.get('criteriaVersion'),
      coverage: { hasMore: false, nextOffset: null },
      page: { hasMore: false, nextOffset: null },
    }),
  } as Response
}

function textContent() {
  return document.body.textContent ?? ''
}

async function flush() {
  const { act } = require('react') as typeof import('react')
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

async function waitFor(assertion: () => void) {
  let caught: unknown
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion()
      return
    } catch (error) {
      caught = error
      await flush()
    }
  }
  throw caught
}

describe('DealFeed Back/forward atomic restore', () => {
  let container: HTMLDivElement
  let root: import('react-dom/client').Root
  let renderDealFeed: (props?: Record<string, unknown>) => Promise<void>
  let setLocation: (url: string) => void

  beforeAll(() => {
    const { parseHTML } = require('linkedom') as {
      parseHTML: (html: string) => { window: Window }
    }
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
    const domWindow = window as unknown as typeof globalThis
    setLocation = (url: string) => {
      Object.defineProperty(window, 'location', { configurable: true, value: new URL(url) })
    }
    setLocation('https://expaify.test/deals?criteriaSchema=1&criteriaVersion=criteria_first&criteriaSource=deals_page&city=Miami&min_discount=20&sort=newest')
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: { replaceState: jest.fn(), pushState: jest.fn() },
    })
    Object.assign(globalThis, {
      window,
      document: window.document,
      navigator: window.navigator,
      HTMLElement: domWindow.HTMLElement,
      Node: domWindow.Node,
      Event: domWindow.Event,
      MouseEvent: domWindow.MouseEvent,
      KeyboardEvent: domWindow.KeyboardEvent,
      DOMException: domWindow.DOMException,
      IntersectionObserver: IntersectionObserverDouble,
      IS_REACT_ACT_ENVIRONMENT: true,
      PopStateEvent: domWindow.Event,
    })
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0),
    })
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: (handle: number) => window.clearTimeout(handle),
    })
  })

  beforeEach(() => {
    jest.clearAllMocks()
    IntersectionObserverDouble.instances = []
    setLocation('https://expaify.test/deals?criteriaSchema=1&criteriaVersion=criteria_first&criteriaSource=deals_page&city=Miami&min_discount=20&sort=newest')
    document.body.innerHTML = '<div id="root"></div>'
    container = document.querySelector('#root') as HTMLDivElement
    const { createRoot } = require('react-dom/client') as typeof import('react-dom/client')
    root = createRoot(container)
    renderDealFeed = async (props = {}) => {
      const { act } = require('react') as typeof import('react')
      const { DealFeed } = require('../DealFeed') as typeof import('../DealFeed')
      await act(async () => {
        root.render((
          <DealFeed
            initialDeals={[deal('miami-1', 'Miami')]}
            initialCriteria={{
              schemaVersion: 1,
              criteriaVersion: 'criteria_first',
              destination: { state: 'selected', city: 'Miami' },
              dates: { semantic: 'missing' },
              occupancy: { state: 'not_captured' },
              source: 'deals_page',
            }}
            premium
            {...props}
          />
        ) as ReactElement)
      })
      await flush()
    }
  })

  afterEach(async () => {
    if (!root) return
    const { act } = require('react') as typeof import('react')
    await act(async () => root.unmount())
  })

  it('restores criteria, filters and cards together when Back fires popstate', async () => {
    await renderDealFeed()
    expect(textContent()).toContain('Miami')
    expect(textContent()).toContain('Hotel miami-1')

    global.fetch = jest.fn((url: RequestInfo | URL) => Promise.resolve(
      responseFor(String(url), [deal('paris-1', 'Paris')]),
    ))
    setLocation('https://expaify.test/deals?criteriaSchema=1&criteriaVersion=criteria_older&criteriaSource=deals_page&city=Paris&min_discount=20&sort=newest')

    const { act } = require('react') as typeof import('react')
    await act(async () => {
      window.dispatchEvent(new (window as unknown as { PopStateEvent: typeof Event }).PopStateEvent('popstate'))
    })
    await waitFor(() => expect(textContent()).toContain('Hotel paris-1'))

    expect(textContent()).toContain('Paris')
    expect(textContent()).not.toContain('Hotel miami-1')
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('criteriaVersion=criteria_older')
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('city=Paris')
  })

  it('leaves cards and criteria unchanged when the popped URL cannot be resolved', async () => {
    await renderDealFeed()
    expect(textContent()).toContain('Miami')

    global.fetch = jest.fn()
    setLocation('https://expaify.test/deals?criteriaSchema=1&criteriaSource=deals_page&min_discount=999')

    const { act } = require('react') as typeof import('react')
    await act(async () => {
      window.dispatchEvent(new (window as unknown as { PopStateEvent: typeof Event }).PopStateEvent('popstate'))
    })
    await flush()

    expect(global.fetch).not.toHaveBeenCalled()
    expect(textContent()).toContain('Miami')
    expect(textContent()).toContain('Hotel miami-1')
  })
})
