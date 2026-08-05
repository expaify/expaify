import type { ReactElement } from 'react'
import type { NormalizedFare } from '@/lib/types'
import { appendBookingReturnTo } from '@/lib/booking/config'

// REPAIR-BOOKING-RETURN-CONTEXT-01: the internal `/book` CTA link on a Duffel
// flight card should carry a `returnTo` back to the current results URL.
// That value is only known client-side (`window.location`), so `FlightCard`
// computes it synchronously during render, guarded by `typeof window ===
// 'undefined'` — no extra hook is introduced for this. That guard matters
// for two reasons: (1) it keeps the server-render/no-window path byte-for-
// byte identical to pre-repair behavior (falls back to `fare.deeplink`), and
// (2) `FlightCard` is exercised directly (as a plain function call, no real
// React render) by this repo's shared `scorePresentation.test.tsx` harness,
// which mocks only `useState` — an earlier version of this repair added a
// `useEffect` call here and broke 11 of that file's tests (`useEffect`
// resolved to `null` outside a real render). Reading `window` directly
// during render avoids depending on any hook this repo's no-jsdom test
// harnesses don't already support.
//
// This file follows the repo's existing hand-rolled, no-jsdom harness (see
// `HotelDestinationCombobox.test.tsx`): components are invoked directly as
// plain functions, with `react`'s `useState` mocked so calling it outside a
// real render doesn't throw.

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

function findElements(node: unknown, predicate: (element: TestElement) => boolean): TestElement[] {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(child => findElements(child, predicate))

  const element = node as TestElement
  return [
    ...(predicate(element) ? [element] : []),
    ...childrenOf(element).flatMap(child => findElements(child, predicate)),
  ]
}

const duffelFare: NormalizedFare = {
  id: 'off_123',
  fareType: 'cash',
  origin: 'JFK',
  destination: 'LAX',
  depart: '2026-09-22T08:00:00.000Z',
  cabin: 'economy',
  stops: 0,
  carrier: 'AA',
  price: { priceCents: 45001, currency: 'USD' },
  passengerCount: 1,
  priceScope: 'party_total',
  deeplink: '/book?offerId=off_123&provider=duffel&origin=JFK&destination=LAX',
  source: 'duffel',
  fetchedAt: '2026-06-30T00:00:00.000Z',
}

function ctaLink(tree: unknown): TestElement {
  return findElements(tree, element => element.type === 'a')[0]
}

describe('FlightCard internal booking link returnTo continuity (REPAIR-BOOKING-RETURN-CONTEXT-01)', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window
  })

  it('falls back to the plain internal booking link when window is unavailable (server render parity)', () => {
    expect(typeof window).toBe('undefined')

    const tree = FlightCard({ fare: duffelFare, score: null, loading: false })

    expect(ctaLink(tree).props.href).toBe(duffelFare.deeplink)
  })

  it('appends a returnTo built from the current results URL once window is available', () => {
    ;(globalThis as { window?: unknown }).window = {
      location: { pathname: '/deals', search: '?city=Lisbon' },
    }

    const tree = FlightCard({ fare: duffelFare, score: null, loading: false })
    const expectedHref = appendBookingReturnTo(duffelFare.deeplink, '/deals?city=Lisbon')

    expect(ctaLink(tree).props.href).toBe(expectedHref)
    expect(expectedHref).not.toBe(duffelFare.deeplink)
    expect(expectedHref).toContain('returnTo=')
  })

  it('never applies the internal returnTo link to an external provider deeplink', () => {
    ;(globalThis as { window?: unknown }).window = {
      location: { pathname: '/deals', search: '?city=Lisbon' },
    }
    const externalFare: NormalizedFare = {
      ...duffelFare,
      source: 'amadeus',
      deeplink: 'https://provider.example/checkout?id=abc',
    }

    const tree = FlightCard({ fare: externalFare, score: null, loading: false })

    expect(ctaLink(tree).props.href).toBe(externalFare.deeplink)
    expect(ctaLink(tree).props.target).toBe('_blank')
  })

  it('drops returnTo when the current results path fails the open-redirect allowlist (defense in depth)', () => {
    // `appendBookingReturnTo` re-validates internally, so even a same-origin
    // page outside `/`, `/deals`, `/destinations/*` (e.g. an admin route)
    // never gets forwarded as returnTo.
    ;(globalThis as { window?: unknown }).window = {
      location: { pathname: '/admin/users', search: '' },
    }

    const tree = FlightCard({ fare: duffelFare, score: null, loading: false })

    expect(ctaLink(tree).props.href).toBe(duffelFare.deeplink)
  })
})
