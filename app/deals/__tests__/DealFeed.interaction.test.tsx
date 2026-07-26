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
  HotelSearchCriteriaSummary: () => null,
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

  intersect() {
    this.callback([{ isIntersecting: true }])
  }
}

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

function deal(id: string): ApiDeal {
  return {
    id,
    hotelId: `hotel-${id}`,
    hotelName: `Hotel ${id}`,
    stars: 4,
    photoUrl: null,
    city: 'Miami',
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

function responseFor(
  requestUrl: string,
  deals: ApiDeal[],
  coverage: 'more_available' | 'confirmed_end',
  nextOffset: number | null,
) {
  const url = new URL(requestUrl, 'https://expaify.test')
  return {
    ok: true,
    json: async () => ({
      deals,
      total: deals.length,
      premium: true,
      criteriaVersion: url.searchParams.get('criteriaVersion'),
      coverage,
      page: {
        hasMore: coverage === 'more_available',
        nextOffset,
      },
    }),
  } as Response
}

function buttonNamed(name: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll('button')).find(node => node.textContent?.trim() === name)
  if (!(button instanceof HTMLElement)) throw new Error(`Button not found: ${name}`)
  return button as HTMLButtonElement
}

function textContent() {
  return document.body.textContent ?? ''
}

function liveRegionContaining(text: string): Element {
  const region = Array.from(document.querySelectorAll('[aria-live="polite"]'))
    .find(node => node.textContent?.includes(text))
  if (!region) throw new Error(`Live region not found: ${text}`)
  return region
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

async function activate(button: HTMLButtonElement, method: 'click' | 'Enter' | 'Space') {
  const { act } = require('react') as typeof import('react')
  await act(async () => {
    if (method !== 'click') {
      const key = method === 'Enter' ? 'Enter' : ' '
      const keyDown = new Event('keydown', { bubbles: true })
      const keyUp = new Event('keyup', { bubbles: true })
      Object.defineProperty(keyDown, 'key', { value: key })
      Object.defineProperty(keyUp, 'key', { value: key })
      button.dispatchEvent(keyDown)
      button.dispatchEvent(keyUp)
    }
    // Native browsers synthesize this click for both Enter and Space on a
    // button. Calling click here models that default activation behavior.
    button.click()
  })
}

async function intersect(observer: IntersectionObserverDouble, times = 1) {
  const { act } = require('react') as typeof import('react')
  await act(async () => {
    for (let attempt = 0; attempt < times; attempt += 1) observer.intersect()
  })
}

describe('DealFeed continuation interactions', () => {
  let container: HTMLDivElement
  let root: import('react-dom/client').Root
  let renderDealFeed: (props?: Record<string, unknown>) => Promise<void>

  beforeAll(() => {
    const { parseHTML } = require('linkedom') as {
      parseHTML: (html: string) => { window: Window }
    }
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
    const domWindow = window as unknown as typeof globalThis
    const location = new URL('https://expaify.test/deals')
    Object.defineProperty(window, 'location', { configurable: true, value: location })
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
            initialDeals={[deal('first')]}
            initialCoverage={{ state: 'more_available', nextOffset: 12 }}
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

  it.each(['click', 'Enter', 'Space'] as const)(
    'uses native %s activation and returns focus after a successful manual continuation',
    async method => {
      const pending = deferred<Response>()
      global.fetch = jest.fn(() => pending.promise)
      await renderDealFeed()

      const control = buttonNamed('Load more deals')
      expect(control.tagName).toBe('BUTTON')
      expect(control.getAttribute('type')).toBe('button')
      expect(control.onkeydown).toBeNull()
      const focus = jest.fn()
      control.focus = focus

      await activate(control, method)

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('offset=12')
      expect(document.querySelector('[aria-labelledby="hotel-results-heading"]')?.getAttribute('aria-busy')).toBe('true')
      expect(liveRegionContaining('Loading more deals.').getAttribute('aria-atomic')).toBe('true')
      expect(textContent()).toContain('Hotel first')

      pending.resolve(responseFor((global.fetch as jest.Mock).mock.calls[0][0], [deal('second')], 'more_available', 24))
      await waitFor(() => expect(textContent()).toContain('Hotel second'))
      await flush()
      await flush()

      expect(liveRegionContaining('1 more deal loaded. 2 shown.')).toBeDefined()
      expect(focus).toHaveBeenCalled()
      expect(buttonNamed('Load more deals')).toBe(control)
    },
  )

  it('automatically continues once, preserves cards, announces progress, and shuts down at a confirmed end', async () => {
    const pending = deferred<Response>()
    global.fetch = jest.fn(() => pending.promise)
    await renderDealFeed()

    const observer = IntersectionObserverDouble.instances.find(instance => instance.options?.rootMargin === '600px 0px')
    expect(observer).toBeDefined()
    await intersect(observer as IntersectionObserverDouble, 2)
    await flush()

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(textContent()).toContain('Hotel first')
    expect(liveRegionContaining('Loading more deals.')).toBeDefined()
    expect(document.querySelector('[aria-labelledby="hotel-results-heading"]')?.getAttribute('aria-busy')).toBe('true')

    pending.resolve(responseFor((global.fetch as jest.Mock).mock.calls[0][0], [deal('second')], 'confirmed_end', null))
    await waitFor(() => expect(textContent()).toContain('reached the end of current expaify deals'))

    expect(textContent()).toContain('Hotel first')
    expect(textContent()).toContain('Hotel second')
    expect(document.querySelector('[aria-labelledby="hotel-results-heading"]')?.getAttribute('aria-busy')).toBe('false')
    expect(observer?.disconnect).toHaveBeenCalled()
    expect(() => buttonNamed('Load more deals')).toThrow()
  })

  it('keeps existing cards and focus on failure, then retries the same server-authored offset once', async () => {
    const first = deferred<Response>()
    const retry = deferred<Response>()
    global.fetch = jest.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => retry.promise)
    await renderDealFeed()

    await activate(buttonNamed('Load more deals'), 'click')
    const initialControl = buttonNamed('Loading more deals…')
    const focus = jest.fn()
    initialControl.focus = focus
    first.reject(new Error('network unavailable'))
    await waitFor(() => expect(textContent()).toContain('We couldn’t load more deals'))
    await flush()
    await flush()

    expect(textContent()).toContain('Hotel first')
    expect(textContent()).toContain('deals already shown are still available to compare')
    const retryControl = buttonNamed('Try loading more again')
    expect(focus).toHaveBeenCalled()
    expect(retryControl).toBe(initialControl)
    const boundary = retryControl.closest('section') as HTMLElement
    const boundaryFocus = jest.fn()
    boundary.focus = boundaryFocus

    await activate(retryControl, 'click')
    await activate(retryControl, 'click')

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('offset=12')
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('offset=12')

    retry.resolve(responseFor((global.fetch as jest.Mock).mock.calls[1][0], [deal('second')], 'confirmed_end', null))
    await waitFor(() => expect(textContent()).toContain('Hotel second'))
    await flush()
    await flush()
    expect(boundaryFocus).toHaveBeenCalled()
  })

  it('stops a zero-new automatic loop and retries its attempted offset instead of the response offset', async () => {
    global.fetch = jest.fn()
      .mockImplementationOnce((url: string) => Promise.resolve(responseFor(url, [deal('first')], 'more_available', 24)))
      .mockImplementationOnce((url: string) => Promise.resolve(responseFor(url, [deal('second')], 'confirmed_end', null)))
    await renderDealFeed()

    const observer = IntersectionObserverDouble.instances.find(instance => instance.options?.rootMargin === '600px 0px')
    await intersect(observer as IntersectionObserverDouble)
    await waitFor(() => expect(textContent()).toContain('No additional unique deals were returned'))

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(observer?.disconnect).toHaveBeenCalled()
    expect(textContent()).toContain('Hotel first')
    expect(textContent()).not.toContain('Hotel second')

    await activate(buttonNamed('Try loading more again'), 'click')
    await waitFor(() => expect(textContent()).toContain('Hotel second'))

    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('offset=12')
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('offset=12')
    expect(textContent()).toContain('reached the end of current expaify deals')
  })
})
