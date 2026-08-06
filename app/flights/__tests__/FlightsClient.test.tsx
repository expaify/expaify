import type { ComponentProps, ReactElement } from 'react'
import type { SearchPanelSubmitPayload } from '@/components/search/SearchPanel'
import type { NormalizedFare, DealScore } from '@/lib/types'
import type FlightResultsDefault from '@/components/flights/FlightResults'

type FlightResultsProps = ComponentProps<typeof FlightResultsDefault>

// FlightResults and SearchPanel each have their own dedicated test suites
// (components/flights/__tests__/FlightResults.test.tsx and
// components/search/__tests__/TripInspirationRail.test.tsx). This test is
// about the wiring in FlightsClient: does a submitted search reach
// /api/search with the right params, does the NDJSON stream get parsed into
// flights/notices/suggestion, and do per-fare scores reach /api/score.
const capturedSearchPanelProps: { onSubmit?: (search: SearchPanelSubmitPayload) => void } = {}
let capturedFlightResultsProps: FlightResultsProps | null = null

jest.mock('@/components/search/SearchPanel', () => ({
  __esModule: true,
  SearchPanel: (props: { onSubmit?: (search: SearchPanelSubmitPayload) => void }) => {
    capturedSearchPanelProps.onSubmit = props.onSubmit
    const React = require('react') as typeof import('react')
    return React.createElement('div', { 'data-testid': 'search-panel-stub' }, 'SearchPanel')
  },
}))

jest.mock('@/components/flights/FlightResults', () => ({
  __esModule: true,
  default: (props: FlightResultsProps) => {
    capturedFlightResultsProps = props
    const React = require('react') as typeof import('react')
    return React.createElement(
      'div',
      { 'data-testid': 'flight-results-stub' },
      React.createElement('p', { 'data-testid': 'is-searching' }, String(props.isSearching)),
      React.createElement(
        'ul',
        null,
        props.displayFlights.map(fare =>
          React.createElement(
            'li',
            { key: fare.id, 'data-testid': `fare-${fare.id}` },
            `${fare.carrier} ${fare.origin}-${fare.destination} ${fare.price.priceCents} score:${
              props.scores[fare.id] ? props.scores[fare.id]?.verdict : 'none'
            }`
          )
        )
      ),
      React.createElement(
        'p',
        { 'data-testid': 'notices' },
        props.providerNotices.map(n => n.message).join('|')
      ),
      React.createElement('p', { 'data-testid': 'suggestion' }, props.suggestion ?? ''),
      React.createElement(
        'button',
        { type: 'button', 'data-testid': 'retry-button', onClick: props.onRetrySearch },
        'Retry'
      )
    )
  },
}))

const fareA: NormalizedFare = {
  id: 'fare-a',
  fareType: 'cash',
  source: 'travelpayouts',
  carrier: 'AA',
  origin: 'JFK',
  destination: 'LAX',
  depart: '2026-09-01T08:00:00.000Z',
  price: { priceCents: 25000, currency: 'USD' },
  deeplink: 'https://example.com/book',
  stops: 0,
  cabin: 'economy',
  fetchedAt: '2026-06-30T00:00:00.000Z',
}

const dealScore: DealScore = {
  percentile: 8,
  pctVsMedian: -25,
  medianCents: 32000,
  currency: 'USD',
  verdict: 'Great',
  confidence: 'high',
  explanation: 'Well below recent median.',
}

function ndjsonBody(lines: object[]): Uint8Array {
  const encoder = new TextEncoder()
  return encoder.encode(lines.map(line => JSON.stringify(line)).join('\n') + '\n')
}

function makeReader(chunks: Uint8Array[]) {
  let index = 0
  return {
    read: async () => {
      if (index >= chunks.length) return { done: true, value: undefined }
      const value = chunks[index]
      index += 1
      return { done: false, value }
    },
  }
}

function installFetchMock(options: {
  searchChunks: Uint8Array[]
  searchOk?: boolean
  searchStatus?: number
  searchErrorBody?: object
}) {
  const calls: { url: string; init?: RequestInit }[] = []
  const searchOk = options.searchOk ?? true

  global.fetch = jest.fn((input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input)
    calls.push({ url, init })

    if (url.startsWith('/api/search')) {
      if (!searchOk) {
        return Promise.resolve({
          ok: false,
          status: options.searchStatus ?? 400,
          body: null,
          json: async () => options.searchErrorBody ?? { error: 'Search failed' },
        } as unknown as Response)
      }
      const reader = makeReader(options.searchChunks)
      return Promise.resolve({
        ok: true,
        status: 200,
        body: { getReader: () => reader },
        json: async () => ({}),
      } as unknown as Response)
    }

    if (url.startsWith('/api/score')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => dealScore,
      } as unknown as Response)
    }

    return Promise.reject(new Error(`Unexpected fetch call: ${url}`))
  }) as unknown as typeof fetch

  return calls
}

describe('FlightsClient', () => {
  let container: HTMLDivElement
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let root: any

  beforeAll(() => {
    const { parseHTML } = require('linkedom') as {
      parseHTML: (html: string) => { window: Window }
    }
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
    const domWindow = window as unknown as typeof globalThis
    const location = new URL('https://expaify.test/flights')
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
      DOMException: domWindow.DOMException,
      IS_REACT_ACT_ENVIRONMENT: true,
    })
  })

  beforeEach(() => {
    jest.resetModules()
    capturedFlightResultsProps = null
    capturedSearchPanelProps.onSubmit = undefined
    document.body.innerHTML = '<div id="root"></div>'
    container = document.querySelector('#root') as HTMLDivElement
    const { createRoot } = require('react-dom/client') as typeof import('react-dom/client')
    root = createRoot(container)
  })

  afterEach(async () => {
    const { act } = require('react') as typeof import('react')
    await act(async () => root.unmount())
  })

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

  async function renderFlightsClient() {
    const { act } = require('react') as typeof import('react')
    const { FlightsClient } = require('../FlightsClient') as typeof import('../FlightsClient')
    const React = require('react') as typeof import('react')
    await act(async () => {
      root.render(React.createElement(FlightsClient) as ReactElement)
    })
    await flush()
  }

  async function submitSearch(search: SearchPanelSubmitPayload) {
    const { act } = require('react') as typeof import('react')
    await act(async () => {
      capturedSearchPanelProps.onSubmit?.(search)
    })
  }

  const payload: SearchPanelSubmitPayload = {
    originIata: 'JFK',
    destinationIata: 'LAX',
    departDate: '2026-09-01',
    returnDate: '2026-09-08',
    flexible: false,
    tripType: 'roundtrip',
  }

  it('submits a search to /api/search with the right query params and streams flights into FlightResults', async () => {
    const calls = installFetchMock({
      searchChunks: [
        ndjsonBody([{ type: 'flights', source: 'travelpayouts', data: [fareA] }]),
        ndjsonBody([{ type: 'done' }]),
      ],
    })

    await renderFlightsClient()
    await submitSearch(payload)

    const searchCall = calls.find(c => c.url.startsWith('/api/search'))
    expect(searchCall).toBeDefined()
    const url = new URL(searchCall!.url, 'https://expaify.test')
    expect(url.searchParams.get('origin')).toBe('JFK')
    expect(url.searchParams.get('dest')).toBe('LAX')
    expect(url.searchParams.get('depart')).toBe('2026-09-01')
    expect(url.searchParams.get('return')).toBe('2026-09-08')
    expect(url.searchParams.get('trip')).toBe('roundtrip')
    expect(url.searchParams.has('flex')).toBe(false)

    await waitFor(() => {
      expect(capturedFlightResultsProps?.flights.map(f => f.id)).toEqual(['fare-a'])
    })

    const fareLi = container.querySelector('[data-testid="fare-fare-a"]')
    expect(fareLi?.textContent).toContain('AA JFK-LAX 25000')

    await waitFor(() => {
      expect(capturedFlightResultsProps?.isSearching).toBe(false)
    })
  })

  it('fetches a deal score for each fare that arrives and reflects it in scores', async () => {
    installFetchMock({
      searchChunks: [
        ndjsonBody([
          { type: 'flights', source: 'travelpayouts', data: [fareA] },
          { type: 'done' },
        ]),
      ],
    })

    await renderFlightsClient()
    await submitSearch(payload)

    await waitFor(() => {
      expect(capturedFlightResultsProps?.scores['fare-a']?.verdict).toBe('Great')
    })

    const fareLi = container.querySelector('[data-testid="fare-fare-a"]')
    expect(fareLi?.textContent).toContain('score:Great')
  })

  it('sends the flex=1 param when tripType and flexible are set', async () => {
    const calls = installFetchMock({
      searchChunks: [ndjsonBody([{ type: 'done' }])],
    })

    await renderFlightsClient()
    await submitSearch({ ...payload, flexible: true })

    const searchCall = calls.find(c => c.url.startsWith('/api/search'))
    const url = new URL(searchCall!.url, 'https://expaify.test')
    expect(url.searchParams.get('flex')).toBe('1')
  })

  it('omits the return param for one-way trips', async () => {
    const calls = installFetchMock({
      searchChunks: [ndjsonBody([{ type: 'done' }])],
    })

    await renderFlightsClient()
    await submitSearch({ ...payload, tripType: 'oneway', returnDate: '' })

    const searchCall = calls.find(c => c.url.startsWith('/api/search'))
    const url = new URL(searchCall!.url, 'https://expaify.test')
    expect(url.searchParams.has('return')).toBe(false)
    expect(url.searchParams.get('trip')).toBe('oneway')
  })

  it('surfaces provider notices from notice events without hiding them', async () => {
    installFetchMock({
      searchChunks: [
        ndjsonBody([
          { type: 'notice', provider: 'Kiwi', status: 'unavailable', message: 'Kiwi is unavailable for this search.' },
          { type: 'done' },
        ]),
      ],
    })

    await renderFlightsClient()
    await submitSearch(payload)

    await waitFor(() => {
      const notices = container.querySelector('[data-testid="notices"]')
      expect(notices?.textContent).toContain('Kiwi is unavailable for this search.')
    })
  })

  it('surfaces a hard search failure (non-OK response) as a provider notice instead of a silent empty state', async () => {
    installFetchMock({
      searchChunks: [],
      searchOk: false,
      searchStatus: 400,
      searchErrorBody: { error: 'Departure date is required. Choose a departure date before searching.' },
    })

    await renderFlightsClient()
    await submitSearch({ ...payload, departDate: '' })

    await waitFor(() => {
      const notices = container.querySelector('[data-testid="notices"]')
      expect(notices?.textContent).toContain('Departure date is required. Choose a departure date before searching.')
    })

    await waitFor(() => {
      expect(capturedFlightResultsProps?.isSearching).toBe(false)
    })
  })

  it('re-runs the last search when onRetrySearch is invoked', async () => {
    const calls = installFetchMock({
      searchChunks: [ndjsonBody([{ type: 'done' }])],
    })

    await renderFlightsClient()
    await submitSearch(payload)

    const searchCallsBefore = calls.filter(c => c.url.startsWith('/api/search')).length
    expect(searchCallsBefore).toBe(1)

    const retryButton = container.querySelector('[data-testid="retry-button"]') as HTMLButtonElement
    const { act } = require('react') as typeof import('react')
    await act(async () => {
      retryButton.click()
    })
    await flush()

    const searchCallsAfter = calls.filter(c => c.url.startsWith('/api/search')).length
    expect(searchCallsAfter).toBe(2)
  })
})
