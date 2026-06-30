import type { ReactElement } from 'react'
import type { DealScore, HotelOffer, NormalizedFare } from '@/lib/types'

type TestElement = ReactElement<Record<string, unknown>>

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')

  return {
    ...actual,
    useState: jest.fn((initialValue: unknown) => [initialValue, jest.fn()]),
  }
})

const { default: DealBadge } = jest.requireActual('../DealBadge') as typeof import('../DealBadge')
const { default: FlightCard } = jest.requireActual('../FlightCard') as typeof import('../FlightCard')
const { default: HotelCard } = jest.requireActual('../HotelCard') as typeof import('../HotelCard')

function childrenOf(node: TestElement): unknown[] {
  const children = node.props?.children
  return Array.isArray(children) ? children : [children].filter(Boolean)
}

function resolveFunctionElement(node: TestElement): TestElement {
  if (typeof node.type === 'function') {
    return (node.type as (props: Record<string, unknown>) => TestElement)(node.props)
  }

  return node
}

function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(collectText).join('')
  if (typeof node === 'object') {
    return childrenOf(resolveFunctionElement(node as TestElement)).map(collectText).join('')
  }
  return ''
}

const fare: NormalizedFare = {
  id: 'fare-1',
  fareType: 'cash',
  origin: 'JFK',
  destination: 'LAX',
  depart: '2026-09-01T09:00:00.000Z',
  return: '2026-09-08T16:00:00.000Z',
  cabin: 'economy',
  stops: 0,
  carrier: 'AA',
  price: { priceCents: 24700, currency: 'USD' },
  deeplink: 'https://example.com/book',
  source: 'travelpayouts',
  fetchedAt: '2026-06-30T00:00:00.000Z',
}

const hotel: HotelOffer = {
  id: 'hotel-1',
  name: 'The Example Hotel',
  area: 'Midtown',
  stars: 4,
  pricePerNight: { priceCents: 18900, currency: 'USD' },
  rating: 8.7,
  deeplink: 'https://example.com/hotel',
  source: 'hotellook',
}

describe('Deal score presentation', () => {
  it('shows Typical scores and the score explanation on flight cards', () => {
    const score: DealScore = {
      percentile: 58,
      pctVsMedian: 4,
      medianCents: 23700,
      currency: 'USD',
      verdict: 'Typical',
      confidence: 'high',
      explanation: '$247 - about 4% above the usual $237 for this route over the last 90 days.',
    }

    const text = collectText(FlightCard({ fare, score, loading: false }))

    expect(text).toContain('Deal Score')
    expect(text).toContain('Typical')
    expect(text).toContain('58th percentile')
    expect(text).toContain(score.explanation)
    expect(text).not.toContain('30-day trend')
  })

  it('labels low-confidence scores as limited history instead of confirmed deals', () => {
    const badgeText = collectText(DealBadge({ verdict: 'Great', confidence: 'low' }))

    expect(badgeText).toContain('Limited history')
    expect(badgeText).not.toContain('Great')
  })

  it('explains limited route history on low-confidence flight cards', () => {
    const score: DealScore = {
      percentile: 50,
      pctVsMedian: 0,
      medianCents: 0,
      currency: 'USD',
      verdict: 'Typical',
      confidence: 'low',
      explanation: 'No price history available for this route.',
    }

    const text = collectText(FlightCard({ fare, score, loading: false }))

    expect(text).toContain('Limited history')
    expect(text).toContain('Not enough route history for a confirmed deal rating')
    expect(text).toContain(score.explanation)
  })

  it('shows hotel score details, nightly price context, and a provider handoff link', () => {
    const score: DealScore = {
      percentile: 22,
      pctVsMedian: -18,
      medianCents: 23100,
      currency: 'USD',
      verdict: 'Good',
      confidence: 'high',
      explanation: '$189 - about 18% below the usual $231 for this hotel over the last 90 days.',
    }

    const text = collectText(HotelCard({ hotel, score, loading: false }))

    expect(text).toContain('Hotel class')
    expect(text).toContain('Guest rating')
    expect(text).toContain('Deal Score')
    expect(text).toContain('22nd percentile')
    expect(text).toContain('Usual')
    expect(text).toContain('$231')
    expect(text).toContain('18% below usual')
    expect(text).toContain(score.explanation)
    expect(text).toContain('$189 USD')
    expect(text).toContain('per night before taxes and fees')
    expect(text).toContain('Check with HotelLook')
    expect(text).toContain('Opens provider site. Prices can change.')
  })

  it('shows flight price currency and trip scope from structured money', () => {
    const totalFare: NormalizedFare = {
      ...fare,
      price: { priceCents: 45001, currency: 'USD' },
      passengerCount: 2,
      priceScope: 'party_total',
    }

    const text = collectText(FlightCard({ fare: totalFare, score: null, loading: false }))

    expect(text).toContain('$450.01 USD')
    expect(text).toContain('Passenger total')
    expect(text).toContain('total trip price for 2 adults')
  })

  it('renders an explicit Deal Score unavailable state when score is not available', () => {
    const text = collectText(FlightCard({ fare, score: null, loading: false }))

    expect(text).toContain('Deal Score')
    expect(text).toContain('Unavailable right now')
    expect(text).toContain('could not compare this fare against route history yet')
    expect(text).not.toContain('Loading deal score')
  })

  it('renders missing flight price as unavailable without a provider CTA', () => {
    const missingPriceFare = {
      ...fare,
      price: { priceCents: 0, currency: 'USD' },
    } as NormalizedFare

    const text = collectText(FlightCard({ fare: missingPriceFare, score: null, loading: false }))

    expect(text).toContain('Price unavailable')
    expect(text).toContain('No confirmed fare price was returned.')
    expect(text).not.toContain('Check with travelpayouts')
    expect(text).not.toContain('$0')
  })

  it('renders missing hotel price or deeplink as an honest unavailable state', () => {
    const unavailableHotel: HotelOffer = {
      ...hotel,
      pricePerNight: { priceCents: 0, currency: 'USD' },
      deeplink: '',
    }

    const text = collectText(HotelCard({ hotel: unavailableHotel, score: null, loading: false }))

    expect(text).toContain('Price unavailable')
    expect(text).toContain('Booking unavailable')
    expect(text).toContain('No confirmed nightly price or valid booking link was returned.')
    expect(text).not.toContain('Check with HotelLook')
  })

  it('does not format invalid hotel currency as money', () => {
    const unavailableHotel = {
      ...hotel,
      pricePerNight: { priceCents: 18900, currency: '' },
    } as HotelOffer

    const text = collectText(HotelCard({ hotel: unavailableHotel, score: null, loading: false }))

    expect(text).toContain('Price unavailable')
    expect(text).toContain('No confirmed nightly price was returned.')
    expect(text).not.toContain('$189')
  })

  it('uses an honest no-photo state without fake hotel imagery', () => {
    const text = collectText(HotelCard({ hotel, score: null, loading: false }))

    expect(text).toContain('Hotel photo unavailable')
    expect(text).not.toContain('🏨')
  })
})
