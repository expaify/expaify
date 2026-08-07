import type { ReactElement } from 'react'
import type { NormalizedFare } from '@/lib/types'

// Same hand-rolled, no-jsdom harness as scorePresentation.test.tsx and
// FlightCard.returnTo.test.tsx: FlightCard is invoked directly as a plain
// function (no real React render), with `useState` mocked so calling it
// outside a real render doesn't throw. `resolveFunctionElement` walks into
// nested function components (LegTimeline, ReturnArrivalRow, NightsDivider,
// RouteTimeline) the same way JSX children are walked.

type TestElement = ReactElement<Record<string, unknown>>

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')

  return {
    ...actual,
    useState: jest.fn((initialValue: unknown) => [initialValue, jest.fn()]),
  }
})

const { default: FlightCard } = jest.requireActual('../FlightCard') as typeof import('../FlightCard')

function childrenOf(node: TestElement): unknown[] {
  const children = node.props?.children
  return Array.isArray(children) ? children : [children].filter(Boolean)
}

function resolveFunctionElement(node: TestElement): unknown {
  if (typeof node.type === 'function') {
    return (node.type as (props: Record<string, unknown>) => unknown)(node.props)
  }
  return node
}

function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(collectText).join('')
  if (typeof node === 'object') {
    const resolved = resolveFunctionElement(node as TestElement)
    if (!resolved || typeof resolved !== 'object') return collectText(resolved)
    return childrenOf(resolved as TestElement).map(collectText).join('')
  }
  return ''
}

function findFirstProp(node: unknown, propName: string, predicate: (value: unknown) => boolean): unknown {
  if (node === null || node === undefined || typeof node === 'boolean') return undefined
  if (typeof node === 'string' || typeof node === 'number') return undefined
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findFirstProp(child, propName, predicate)
      if (match !== undefined) return match
    }
    return undefined
  }
  if (typeof node === 'object') {
    const resolved = resolveFunctionElement(node as TestElement)
    if (!resolved || typeof resolved !== 'object') return undefined
    const element = resolved as TestElement
    const propValue = element.props?.[propName]
    if (predicate(propValue)) return propValue

    for (const child of childrenOf(element)) {
      const match = findFirstProp(child, propName, predicate)
      if (match !== undefined) return match
    }
  }
  return undefined
}

function countText(text: string, value: string): number {
  return text.split(value).length - 1
}

const baseFare: NormalizedFare = {
  id: 'fare-timeline-base',
  fareType: 'cash',
  origin: 'JFK',
  destination: 'LAX',
  depart: '2026-09-01T08:00:00.000Z',
  cabin: 'economy',
  stops: 1,
  carrier: 'AA',
  price: { priceCents: 24700, currency: 'USD' },
  deeplink: 'https://example.com/book',
  source: 'amadeus',
  fetchedAt: '2026-06-30T00:00:00.000Z',
}

describe('FlightCard route timeline (confirmed itinerary)', () => {
  it('shows a nonstop one-way route timeline with real depart/arrive times and duration, replacing the old duplicate text', () => {
    const nonstopFare: NormalizedFare = {
      ...baseFare,
      stops: 0,
      itinerary: {
        certainty: 'confirmed',
        durationMinutes: 330,
        arrive: '2026-09-01T13:30:00.000Z',
        segments: [
          {
            origin: 'JFK',
            destination: 'LAX',
            depart: '2026-09-01T08:00:00.000Z',
            arrive: '2026-09-01T13:30:00.000Z',
            carrier: 'AA',
            flightNumber: 'AA100',
          },
        ],
      },
    }

    const text = collectText(FlightCard({ fare: nonstopFare, score: null, loading: false }))

    expect(text).toContain('8:00 AM')
    expect(text).toContain('1:30 PM')
    expect(text).toContain('5h 30m')
    expect(text).toContain('Nonstop')
    // The old collapsed "Total Xh Ym" text is suppressed once the rich
    // timeline covers the same duration, so it must not be duplicated.
    expect(text).not.toContain('Total 5h 30m')
  })

  it('shows a 1-stop route timeline with the real layover airport\'s city, sourced from itinerary.layovers, not fare.stops', () => {
    const oneStopFare: NormalizedFare = {
      ...baseFare,
      stops: 1,
      itinerary: {
        certainty: 'confirmed',
        durationMinutes: 388,
        arrive: '2026-09-01T14:28:00.000Z',
        segments: [
          { origin: 'JFK', destination: 'IAH', depart: '2026-09-01T08:00:00.000Z', arrive: '2026-09-01T11:00:00.000Z', carrier: 'AA', flightNumber: 'AA10' },
          { origin: 'IAH', destination: 'LAX', depart: '2026-09-01T12:30:00.000Z', arrive: '2026-09-01T14:28:00.000Z', carrier: 'AA', flightNumber: 'AA20' },
        ],
        layovers: [
          { airport: 'IAH', durationMinutes: 90 },
        ],
      },
    }

    const text = collectText(FlightCard({ fare: oneStopFare, score: null, loading: false }))

    expect(text).toContain('8:00 AM')
    expect(text).toContain('2:28 PM')
    expect(text).toContain('6h 28m')
    expect(text).toContain('1 stop · Houston')
  })

  it('shows both legs of a confirmed round trip with a real, computed nights divider and an honestly-limited return row', () => {
    const roundTripFare: NormalizedFare = {
      ...baseFare,
      stops: 0,
      return: '2026-09-08T20:15:00.000Z',
      itinerary: {
        certainty: 'confirmed',
        durationMinutes: 330,
        arrive: '2026-09-01T13:30:00.000Z',
        segments: [
          {
            origin: 'JFK',
            destination: 'LAX',
            depart: '2026-09-01T08:00:00.000Z',
            arrive: '2026-09-01T13:30:00.000Z',
            carrier: 'AA',
            flightNumber: 'AA100',
          },
        ],
      },
    }

    const card = FlightCard({ fare: roundTripFare, score: null, loading: false })
    const text = collectText(card)

    // Outbound leg: full rich timeline.
    expect(text).toContain('8:00 AM')
    expect(text).toContain('1:30 PM')
    expect(text).toContain('5h 30m')
    expect(text).toContain('Nonstop')

    // Real, computed nights divider (Sep 1 -> Sep 8 = 7 nights), not a
    // hardcoded value, using the real destination city.
    expect(text).toContain('7 nights in Los Angeles')

    // Return leg: only what's honestly known (arrival back at JFK).
    // Duffel/Amadeus/Kiwi only ever confirm the return flight's arrival —
    // never its departure time, duration, or stops — so this row must not
    // fabricate any of those.
    expect(text).toContain('8:15 PM')
    expect(text).toContain('Lands')
    expect(text).toContain('Sep 8')
    expect(text).toContain('Departure time unavailable')
    expect(text).not.toMatch(/Return.{0,20}\d{1,2}:\d{2}\s*(AM|PM).{0,20}stop/i)

    const groupLabel = findFirstProp(
      card,
      'aria-label',
      value => typeof value === 'string' && value.includes('7 night')
    )
    expect(groupLabel).toContain('Outbound')
    expect(groupLabel).toContain('7 night')
  })

  it('computes a different, real night count for a shorter real round trip instead of reusing a hardcoded value', () => {
    const shortTripFare: NormalizedFare = {
      ...baseFare,
      stops: 0,
      depart: '2026-09-01T08:00:00.000Z',
      return: '2026-09-04T18:00:00.000Z',
      itinerary: {
        certainty: 'confirmed',
        durationMinutes: 330,
        arrive: '2026-09-01T13:30:00.000Z',
        segments: [
          {
            origin: 'JFK',
            destination: 'LAX',
            depart: '2026-09-01T08:00:00.000Z',
            arrive: '2026-09-01T13:30:00.000Z',
            carrier: 'AA',
            flightNumber: 'AA100',
          },
        ],
      },
    }

    const text = collectText(FlightCard({ fare: shortTripFare, score: null, loading: false }))

    expect(text).toContain('3 nights in Los Angeles')
    expect(text).not.toContain('7 nights')
  })
})

describe('FlightCard route timeline — honest fallback for partial/unavailable certainty', () => {
  it('keeps the existing sparse collapsed treatment for a partial-certainty round trip (the realistic real-provider case) instead of a fabricated rich timeline', () => {
    // Mirrors what Duffel/Amadeus actually return for a real round-trip
    // fare: itinerary only ever reaches 'partial' certainty, with just an
    // outbound arrival timestamp and no confirmed duration or segments.
    const partialRoundTripFare: NormalizedFare = {
      ...baseFare,
      stops: 1,
      return: '2026-09-08T20:15:00.000Z',
      itinerary: {
        certainty: 'partial',
        arrive: '2026-09-01T13:30:00.000Z',
      },
    }

    const text = collectText(FlightCard({ fare: partialRoundTripFare, score: null, loading: false }))

    expect(text).toContain('Departs 8:00 AM')
    expect(text).toContain('1 stop')
    // None of the new confirmed-only visual timeline markers should appear —
    // this fare's certainty does not support them.
    expect(text).not.toContain('nights in')
    expect(text).not.toContain('Departure time unavailable')
    expect(text).not.toContain('Lands')
    expect(text).not.toContain('1:30 PM')
  })

  it('keeps the existing sparse collapsed treatment for unavailable-certainty fares (no itinerary at all)', () => {
    const unavailableFare: NormalizedFare = {
      ...baseFare,
      stops: 2,
    }

    const text = collectText(FlightCard({ fare: unavailableFare, score: null, loading: false }))

    expect(text).toContain('Departs 8:00 AM')
    expect(text).toContain('2 stops')
    expect(text).not.toContain('Total ')
    expect(text).not.toContain('nights in')
    expect(text).not.toContain('Departure time unavailable')
  })

  it('keeps the honest fallback even when a partial itinerary has neither arrive nor duration', () => {
    const bareUnavailableFare: NormalizedFare = {
      ...baseFare,
      stops: 0,
      itinerary: { certainty: 'unavailable' },
    }

    const text = collectText(FlightCard({ fare: bareUnavailableFare, score: null, loading: false }))

    expect(text).toContain('Departs 8:00 AM')
    expect(text).toContain('Nonstop')
    expect(text).not.toContain('nights in')
  })
})

describe('countText sanity', () => {
  it('counts overlapping-free occurrences as expected', () => {
    expect(countText('a-a-a', 'a')).toBe(3)
  })
})
