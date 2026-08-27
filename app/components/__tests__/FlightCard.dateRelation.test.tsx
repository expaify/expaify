import type { ReactElement } from 'react'
import type { NormalizedFare } from '@/lib/types'

type TestElement = ReactElement<Record<string, unknown>>

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')
  return { ...actual, useState: jest.fn((initialValue: unknown) => [initialValue, jest.fn()]) }
})

const { default: FlightCard } = jest.requireActual('../FlightCard') as typeof import('../FlightCard')

function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(collectText).join('')
  if (typeof node === 'object') {
    const element = node as TestElement
    const resolved = typeof element.type === 'function'
      ? (element.type as (props: Record<string, unknown>) => unknown)(element.props)
      : element
    if (!resolved || typeof resolved !== 'object') return collectText(resolved)
    const children = (resolved as TestElement).props?.children
    return collectText(children)
  }
  return ''
}

const fare: NormalizedFare = {
  id: 'nearby-fare',
  fareType: 'cash',
  origin: 'JFK',
  destination: 'IST',
  depart: '2026-09-25',
  stops: 0,
  carrier: 'TK',
  price: { priceCents: 45000, currency: 'USD' },
  deeplink: 'https://example.com/book',
  source: 'travelpayouts',
  fetchedAt: '2026-08-27T00:00:00.000Z',
  dateRelation: {
    selectedDepart: '2026-09-15',
    fareDepart: '2026-09-25',
    relation: 'nearby',
  },
}

describe('FlightCard nearby-date disclosure', () => {
  it('shows the actual fare date and distance from the requested date', () => {
    const text = collectText(FlightCard({ fare, score: null, loading: false }))
    expect(text).toContain('Sep 25 · 10 days after your search')
  })

  it('does not add a nearby-date label to a selected-date fare', () => {
    const selectedFare: NormalizedFare = {
      ...fare,
      depart: '2026-09-15',
      dateRelation: {
        selectedDepart: '2026-09-15',
        fareDepart: '2026-09-15',
        relation: 'selected',
      },
    }
    const text = collectText(FlightCard({ fare: selectedFare, score: null, loading: false }))
    expect(text).not.toContain('your search')
  })
})
