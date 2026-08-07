import type { ReactElement } from 'react'
import type { NormalizedFare } from '@/lib/types'

// AirportInput and FlightCard each have their own dedicated test suites --
// this test is about the wiring: does a search reach /api/search with the
// right origin/dest/dates, does the NDJSON stream become sorted results,
// and are notices/errors surfaced honestly instead of hidden.
let capturedAirportOnChange: ((iata: string, display: string) => void) | undefined
const capturedFlightCardFares: NormalizedFare[] = []

jest.mock('@/app/components/AirportInput', () => ({
  __esModule: true,
  default: (props: { onChange: (iata: string, display: string) => void; placeholder: string }) => {
    capturedAirportOnChange = props.onChange
    const React = require('react') as typeof import('react')
    return React.createElement('div', { 'data-testid': 'airport-input-stub' }, props.placeholder)
  },
}))

jest.mock('@/app/components/FlightCard', () => ({
  __esModule: true,
  default: (props: { fare: NormalizedFare }) => {
    capturedFlightCardFares.push(props.fare)
    const React = require('react') as typeof import('react')
    return React.createElement('div', { 'data-testid': `flight-card-${props.fare.id}` }, `${props.fare.carrier} ${props.fare.price.priceCents}`)
  },
}))

function makeFare(id: string, priceCents: number): NormalizedFare {
  return {
    id,
    fareType: 'cash',
    source: 'duffel',
    carrier: 'AA',
    origin: 'JFK',
    destination: 'ATH',
    depart: '2026-09-01T08:00:00.000Z',
    price: { priceCents, currency: 'USD' },
    deeplink: `https://example.com/${id}`,
    stops: 0,
    cabin: 'economy',
    fetchedAt: '2026-06-30T00:00:00.000Z',
  }
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

function installFetchMock(searchChunks: Uint8Array[], searchOk = true) {
  const calls: { url: string }[] = []
  global.fetch = jest.fn((input: unknown) => {
    const url = typeof input === 'string' ? input : String(input)
    calls.push({ url })
    if (url.startsWith('/api/search')) {
      if (!searchOk) {
        return Promise.resolve({ ok: false, status: 500, body: null, json: async () => ({}) } as unknown as Response)
      }
      const reader = makeReader(searchChunks)
      return Promise.resolve({ ok: true, status: 200, body: { getReader: () => reader } } as unknown as Response)
    }
    return Promise.reject(new Error(`Unexpected fetch call: ${url}`))
  }) as unknown as typeof fetch
  return calls
}

describe('FlightsToThisDeal', () => {
  let container: HTMLDivElement
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let root: any

  beforeAll(() => {
    const { parseHTML } = require('linkedom') as { parseHTML: (html: string) => { window: Window } }
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
    const domWindow = window as unknown as typeof globalThis
    const location = new URL('https://expaify.test/deals/test-deal')
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
    capturedAirportOnChange = undefined
    capturedFlightCardFares.length = 0
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

  async function render() {
    const { act } = require('react') as typeof import('react')
    const { FlightsToThisDeal } = require('../FlightsToThisDeal') as typeof import('../FlightsToThisDeal')
    const React = require('react') as typeof import('react')
    await act(async () => {
      root.render(React.createElement(FlightsToThisDeal, {
        destinationIata: 'ATH',
        checkInDate: '2026-09-01',
        nights: 2,
      }) as ReactElement)
    })
    await flush()
  }

  function searchButton(): HTMLButtonElement {
    return Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Search flights') as HTMLButtonElement
  }

  it('does not call /api/search until the user picks an origin and searches', async () => {
    global.fetch = jest.fn()
    await render()

    expect(global.fetch).not.toHaveBeenCalled()
    expect(searchButton().disabled).toBe(true)
  })

  it('searches with the destination IATA, computed return date (checkIn + nights), and picked origin', async () => {
    const calls = installFetchMock([ndjsonBody([{ type: 'done' }])])
    await render()

    const { act } = require('react') as typeof import('react')
    await act(async () => capturedAirportOnChange?.('JFK', 'New York (JFK)'))
    await act(async () => searchButton().click())
    await flush()

    expect(calls).toHaveLength(1)
    const url = new URL(calls[0].url, 'https://expaify.test')
    expect(url.searchParams.get('origin')).toBe('JFK')
    expect(url.searchParams.get('dest')).toBe('ATH')
    expect(url.searchParams.get('depart')).toBe('2026-09-01')
    expect(url.searchParams.get('return')).toBe('2026-09-03')
    expect(url.searchParams.get('trip')).toBe('roundtrip')
  })

  it('shows only the 3 cheapest real fares, sorted ascending by price', async () => {
    installFetchMock([
      ndjsonBody([
        { type: 'flights', source: 'duffel', data: [makeFare('expensive', 50000), makeFare('cheapest', 10000), makeFare('mid', 20000), makeFare('fourth', 30000)] },
        { type: 'done' },
      ]),
    ])
    await render()

    const { act } = require('react') as typeof import('react')
    await act(async () => capturedAirportOnChange?.('JFK', 'New York (JFK)'))
    await act(async () => searchButton().click())

    await waitFor(() => expect(capturedFlightCardFares.length).toBe(3))
    expect(capturedFlightCardFares.map(f => f.id)).toEqual(['cheapest', 'mid', 'fourth'])
  })

  it('surfaces a real provider notice instead of hiding it', async () => {
    installFetchMock([
      ndjsonBody([{ type: 'notice', provider: 'Kiwi', status: 'unavailable', message: 'Kiwi is unavailable for this search.' }, { type: 'done' }]),
    ])
    await render()

    const { act } = require('react') as typeof import('react')
    await act(async () => capturedAirportOnChange?.('JFK', 'New York (JFK)'))
    await act(async () => searchButton().click())

    await waitFor(() => expect(container.textContent).toContain('Kiwi is unavailable for this search.'))
  })

  it('shows an honest "no flights found" message rather than a silent empty state', async () => {
    installFetchMock([ndjsonBody([{ type: 'done' }])])
    await render()

    const { act } = require('react') as typeof import('react')
    await act(async () => capturedAirportOnChange?.('JFK', 'New York (JFK)'))
    await act(async () => searchButton().click())

    await waitFor(() => expect(container.textContent).toContain('No flights found for these dates.'))
  })

  it('surfaces a hard HTTP failure instead of a silent empty state', async () => {
    installFetchMock([], false)
    await render()

    const { act } = require('react') as typeof import('react')
    await act(async () => capturedAirportOnChange?.('JFK', 'New York (JFK)'))
    await act(async () => searchButton().click())

    await waitFor(() => expect(container.textContent).toContain('Flight search failed'))
  })
})
