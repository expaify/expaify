import type { ReactElement } from 'react'
import type { DealScore, HotelOffer, NormalizedFare } from '@/lib/types'

type TestElement = ReactElement<Record<string, unknown>>

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')

  return {
    ...actual,
    useEffect: jest.fn((effect: () => void) => effect()),
    useRef: jest.fn(() => ({ current: false })),
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
    const propValue = resolved.props?.[propName]
    if (predicate(propValue)) return propValue

    for (const child of childrenOf(resolved)) {
      const match = findFirstProp(child, propName, predicate)
      if (match !== undefined) return match
    }
  }
  return undefined
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
  beforeAll(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-07-02T12:00:00.000Z'))
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  it('shows Typical score chips on collapsed flight cards', () => {
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

    expect(text).toContain('Typical')
    expect(text).toContain('Details')
    expect(text).toContain('Continue to provider')
    expect(text).not.toContain('58th percentile')
    expect(text).not.toContain(score.explanation)
    expect(text).not.toContain('30-day trend')
  })

  it('labels low-confidence scores as limited history instead of confirmed deals', () => {
    const badgeText = collectText(DealBadge({ verdict: 'Great', confidence: 'low' }))

    expect(badgeText).toContain('Limited history')
    expect(badgeText).not.toContain('Great')
  })

  it('labels low-confidence flight cards as limited history when collapsed', () => {
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
    expect(text).toContain('Details')
    expect(text).not.toContain('50th percentile')
    expect(text).not.toContain('Great')
  })

  it('shows hotel score chips, nightly price context, and a provider handoff link when collapsed', () => {
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

    expect(text).toContain('Good')
    expect(text).toContain('Area only')
    expect(text).toContain('Midtown')
    expect(text).toContain('$189 USD')
    expect(text).toContain('per night before taxes and fees')
    expect(text).toContain('Review hotel')
    expect(text).toContain('Details')
    expect(text).not.toContain('22nd percentile')
    expect(text).not.toContain(score.explanation)
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

  it('shows flight schedule context and includes provider handoff context in the CTA name', () => {
    const card = FlightCard({ fare, score: null, loading: false })
    const text = collectText(card)
    const ctaAriaLabel = findFirstProp(
      card,
      'aria-label',
      value => typeof value === 'string' && value.startsWith('Continue to provider for JFK to LAX')
    )

    expect(text).toContain('Departs')
    expect(text).toContain('9:00 AM')
    expect(text).not.toContain('Tue, Sep 1')
    expect(text).not.toContain('Tue, Sep 8')
    expect(ctaAriaLabel).toBe(
      'Continue to provider for JFK to LAX. Current fare $247 USD, per person fare for this trip. Checked 2 days ago by Travelpayouts. Opens provider site in a new tab. Final price, availability, baggage fees, and provider terms can change.'
    )
  })

  it('renders date-only flight schedule values without midnight placeholders', () => {
    const dateOnlyFare: NormalizedFare = {
      ...fare,
      depart: '2026-09-01',
      return: undefined,
    }

    const text = collectText(FlightCard({ fare: dateOnlyFare, score: null, loading: false }))

    expect(text).not.toContain('Depart')
    expect(text).not.toContain('Tue, Sep 1')
    expect(text).not.toContain('12:00 AM')
    expect(text).toContain('One way')
    expect(text).not.toContain('Return')
  })

  it('renders an explicit collapsed Deal Score unavailable state when score is not available', () => {
    const text = collectText(FlightCard({ fare, score: null, loading: false }))

    expect(text).toContain('Score unavailable')
    expect(text).toContain('Details')
    expect(text).not.toContain('Loading deal score')
  })

  it('renders an explicit collapsed hotel Deal Score unavailable state when score is not available', () => {
    const text = collectText(HotelCard({ hotel, score: null, loading: false }))

    expect(text).toContain('Score unavailable')
    expect(text).toContain('Area only')
    expect(text).toContain('Details')
  })

  it('keeps pin inspection out of a collapsed coordinate-backed hotel card', () => {
    const text = collectText(HotelCard({
      hotel: {
        ...hotel,
        location: {
          precision: 'coordinates',
          lat: 40.7484,
          lng: -73.9857,
          providerLocationName: 'Midtown',
        },
      },
      score: null,
      loading: false,
    }))

    expect(text).toContain('Provider map pin')
    expect(text).not.toContain('View property pin')
  })

  it('keeps invalid median money hidden in collapsed score state', () => {
    const score: DealScore = {
      percentile: 12,
      pctVsMedian: Number.NaN,
      medianCents: 0,
      currency: 'USD',
      verdict: 'Great',
      confidence: 'high',
      explanation: 'Current price history is incomplete.',
    }

    const text = collectText(FlightCard({ fare, score, loading: false }))

    expect(text).toContain('Great')
    expect(text).not.toContain('$0')
    expect(text).not.toContain('NaN%')
  })

  it('renders missing flight price as unavailable without a provider CTA', () => {
    const missingPriceFare = {
      ...fare,
      price: { priceCents: 0, currency: 'USD' },
    } as NormalizedFare

    const text = collectText(FlightCard({ fare: missingPriceFare, score: null, loading: false }))

    expect(text).toContain('Price unavailable')
    expect(text).toContain('No confirmed price was returned for this result.')
    expect(text).not.toContain('Check with travelpayouts')
    expect(text).not.toContain('$0')
  })

  it('renders unsafe flight deeplinks as unavailable instead of clickable provider CTAs', () => {
    const unsafeFare = {
      ...fare,
      deeplink: 'javascript:alert(1)',
    } as NormalizedFare

    const text = collectText(FlightCard({ fare: unsafeFare, score: null, loading: false }))

    expect(text).toContain('Provider link unavailable')
    expect(text).not.toContain('Check with travelpayouts')
  })

  it('keeps safe attributed flight deeplinks bookable', () => {
    const attributedFare = {
      ...fare,
      deeplink: 'https://www.aviasales.com/search/JFK0901LAX1?marker=marker99',
    } as NormalizedFare

    const text = collectText(FlightCard({ fare: attributedFare, score: null, loading: false }))

    expect(text).toContain('Continue to provider')
    expect(text).toContain('Details')
  })

  it('renders missing hotel price or deeplink as an honest unavailable state', () => {
    const unavailableHotel: HotelOffer = {
      ...hotel,
      pricePerNight: { priceCents: 0, currency: 'USD' },
      deeplink: '',
    }

    const text = collectText(HotelCard({ hotel: unavailableHotel, score: null, loading: false }))

    expect(text).toContain('Price unavailable')
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

    expect(text).toContain('Photo unavailable')
    expect(text).not.toContain('🏨')
  })
})
