import type { ReactElement } from 'react'
import type { DealScore, HotelOffer, NormalizedFare } from '@/lib/types'

type TestElement = ReactElement<Record<string, unknown>>

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')

  return {
    ...actual,
    useEffect: jest.fn(),
    useMemo: jest.fn((factory: () => unknown) => factory()),
    useRef: jest.fn((initialValue: unknown) => ({ current: initialValue })),
    useState: jest.fn((initialValue: unknown) => [initialValue, jest.fn()]),
  }
})

jest.mock('../hotelFundsPolicyAnalytics', () => ({
  trackHotelFundsPolicyDetailsOpened: jest.fn(),
  useHotelFundsPolicyExposure: jest.fn(() => ({ current: null })),
}))

jest.mock('../hotelAdmissionPolicyAnalytics', () => ({
  useHotelAdmissionPolicyViewed: jest.fn(),
  trackHotelHandoffWithAdmissionRestriction: jest.fn(),
}))

const { default: DealBadge } = jest.requireActual('../DealBadge') as typeof import('../DealBadge')
const { default: DealScorePanel } = jest.requireActual('../DealScorePanel') as typeof import('../DealScorePanel')
const { default: FlightCard } = jest.requireActual('../FlightCard') as typeof import('../FlightCard')
const { default: HotelCard } = jest.requireActual('../HotelCard') as typeof import('../HotelCard')
const { DealCard } = jest.requireActual('../ui/DealCard') as typeof import('../ui/DealCard')
const { LockedDealCard } = jest.requireActual('../ui/LockedDealCard') as typeof import('../ui/LockedDealCard')
const { PropertyPhoto } = jest.requireActual('../ui/PropertyPhoto') as typeof import('../ui/PropertyPhoto')

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

function findFirstElement(node: unknown, type: string): TestElement | undefined {
  if (node === null || node === undefined || typeof node === 'boolean') return undefined
  if (typeof node === 'string' || typeof node === 'number') return undefined
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findFirstElement(child, type)
      if (match) return match
    }
    return undefined
  }
  if (typeof node === 'object') {
    const resolved = resolveFunctionElement(node as TestElement)
    if (!resolved || typeof resolved !== 'object') return undefined
    const element = resolved as TestElement
    if (element.type === type) return element

    for (const child of childrenOf(element)) {
      const match = findFirstElement(child, type)
      if (match) return match
    }
  }
  return undefined
}

function countText(text: string, value: string): number {
  return text.split(value).length - 1
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
  documentReadiness: {
    status: 'not_provided', scope: 'rate', documentTypes: [], issuerByDocument: {},
    billingDetailsStep: 'unknown',
    taxIdentifierEligibility: { state: 'not_provided', entryStep: 'not_provided', correction: { rule: 'not_provided' }, source: { label: 'Hotellook', scope: 'rate' } },
    documentNameEligibility: { state: 'not_provided', allowedAddresseeTypes: [], relationships: { guest: 'not_provided', booker: 'not_provided', cardholder: 'not_provided' }, entryStep: 'not_provided', correction: { rule: 'not_provided' }, source: { label: 'Hotellook', scope: 'rate' } },
    source: { label: 'Hotellook' },
  },
  fundsPolicy: { state: 'not_returned', obligations: [], sourceLabel: 'Hotellook', scope: 'not_returned' },
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
    expect(text).toContain('Area')
    expect(text).toContain('Midtown')
    expect(text).toContain('$189 USD')
    expect(text).toContain('per night')
    expect(text).toContain('Taxes: not confirmed · Mandatory property charges: not confirmed')
    expect(text).toContain('Restrictions not provided')
    expect(text).toContain('Review hotel')
    expect(text).toContain('Details')
    expect(text).not.toContain('22nd percentile')
    expect(text).not.toContain(score.explanation)
    expect(text.indexOf('Restrictions not provided')).toBeLessThan(text.indexOf('Good'))
    const ctaAriaLabel = findFirstProp(
      HotelCard({ hotel, score, loading: false }),
      'aria-label',
      value => typeof value === 'string' && value.startsWith('Review The Example Hotel')
    )
    expect(ctaAriaLabel).toEqual(expect.stringContaining(
      'Rate restrictions: Hotellook did not provide complete rate restrictions.'
    ))
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
    expect(text).toContain('Area')
    expect(text).toContain('Details')
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
    expect(text).not.toContain('Property photo')
    expect(text).not.toContain('🏨')
  })

  it('labels HotelCard property photos without asserting hotel or room identity', () => {
    const card = HotelCard({ hotel: { ...hotel, photoUrl: 'https://example.com/property.jpg' }, score: null, loading: false })
    const text = collectText(card)
    const imageAlt = findFirstProp(card, 'alt', value => value === '')

    expect(countText(text, 'Property photo')).toBe(1)
    expect(imageAlt).toBe('')
    expect(text).not.toMatch(/verified photo|recent photo|room photo/i)
  })

  it('reflows the HotelCard rate below identity in containers narrower than 351px', () => {
    const card = HotelCard({ hotel: { ...hotel, photoUrl: 'https://example.com/property.jpg' }, score: null, loading: false })
    const containerClass = findFirstProp(card, 'className', value => typeof value === 'string' && value.includes('@container'))
    const summaryGridClass = findFirstProp(card, 'className', value => typeof value === 'string' && value.includes('@max-[351px]:grid-cols-[5rem_minmax(0,1fr)]'))
    const rateClass = findFirstProp(card, 'className', value => typeof value === 'string' && value.includes('@max-[351px]:col-span-2'))

    expect(containerClass).toEqual(expect.stringContaining('@container'))
    expect(summaryGridClass).toEqual(expect.stringContaining('grid-cols-[5rem_minmax(0,1fr)_minmax(6.75rem,auto)]'))
    expect(summaryGridClass).toEqual(expect.stringContaining('@max-[351px]:grid-cols-[5rem_minmax(0,1fr)]'))
    expect(rateClass).toEqual(expect.stringContaining('@max-[351px]:col-span-2'))
    expect(rateClass).toEqual(expect.stringContaining('@max-[351px]:text-left'))
  })

  it('keeps the expanded HotelCard photo after score and evidence with empty alt text', () => {
    const useStateMock = jest.requireMock('react').useState as jest.Mock
    useStateMock.mockImplementationOnce(() => [true, jest.fn()])

    const card = HotelCard({ hotel: { ...hotel, photoUrl: 'https://example.com/property.jpg' }, score: null, loading: false })
    const text = collectText(card)

    expect(countText(text, 'Property photo')).toBe(2)
    expect(text.indexOf('Score unavailable')).toBeLessThan(text.lastIndexOf('Property photo'))
    expect(findFirstProp(card, 'alt', value => value === '')).toBe('')
  })

  it('does not duplicate the HotelCard no-photo fallback when expanded', () => {
    const useStateMock = jest.requireMock('react').useState as jest.Mock
    useStateMock.mockImplementationOnce(() => [true, jest.fn()])

    const text = collectText(HotelCard({ hotel, score: null, loading: false }))

    expect(countText(text, 'Photo unavailable')).toBe(1)
  })

  it('keeps DealCard price claims and explicit price recency outside its labeled property figure', () => {
    const card = DealCard({
      deal: {
        id: 'deal-1',
        hotelName: 'Example Suites',
        city: 'Lisbon',
        stars: 4,
        photoUrl: 'https://example.com/property.jpg',
        dealPrice: { priceCents: 14000, currency: 'USD' },
        medianPrice: { priceCents: 20000, currency: 'USD' },
        discountPct: 30,
        checkInWindow: 'Sep 1–8',
        snapshotCount: 20,
        links: {},
        updatedAt: '2026-07-02T10:00:00.000Z',
      },
    })
    const text = collectText(card)
    const figure = findFirstElement(card, 'figure')

    expect(text).toContain('Property photo')
    expect(text).toContain('−30% vs usual')
    expect(text).toContain('Price checked 2h ago')
    expect(findFirstProp(card, 'className', value => typeof value === 'string' && value.includes('absolute right-3 top-3'))).toBeUndefined()
    expect(findFirstProp(card, 'alt', value => value === '')).toBe('')
    expect(collectText(figure)).toBe('Property photo')
  })

  it('leads with the property photo, then keeps DealCard identity and rate evidence in source and DOM order', () => {
    const card = DealCard({
      deal: {
        id: 'deal-order',
        hotelName: 'Identity First Hotel',
        city: 'Lisbon',
        stars: 4,
        photoUrl: 'https://example.com/property.jpg',
        dealPrice: { priceCents: 14000, currency: 'USD' },
        medianPrice: { priceCents: 20000, currency: 'USD' },
        discountPct: 30,
        checkInWindow: 'Sep 1–8',
        snapshotCount: 20,
        links: {},
        headline: '43% below usual',
      },
    })
    const text = collectText(card)

    expect(text.indexOf('Property photo')).toBeLessThan(text.indexOf('Identity First Hotel'))
    expect(text.indexOf('Identity First Hotel')).toBeLessThan(text.indexOf('$140 USD'))
    expect(text.indexOf('Lisbon')).toBeLessThan(text.indexOf('$140 USD'))
    expect(text.indexOf('$140 USD')).toBeLessThan(text.indexOf('43% below usual'))
  })

  it('uses the honest DealCard no-photo state without a scope caption', () => {
    const text = collectText(DealCard({
      deal: {
        id: 'deal-2',
        hotelName: 'Example Suites',
        city: 'Lisbon',
        stars: 4,
        dealPrice: { priceCents: 14000, currency: 'USD' },
        medianPrice: { priceCents: 20000, currency: 'USD' },
        discountPct: 30,
        checkInWindow: 'Sep 1–8',
        snapshotCount: 20,
        links: {},
      },
    }))

    expect(text).toContain('Photo unavailable')
    expect(text).not.toContain('Property photo')
  })

  it('keeps locked access context outside the property figure and exposes an honest fallback', () => {
    const withPhoto = LockedDealCard({
      placeholderName: 'Members Hotel',
      placeholderCity: 'Paris',
      stars: 3,
      discountPct: 42,
      photoUrl: 'https://example.com/property.jpg',
    })
    const withPhotoText = collectText(withPhoto)
    const figure = findFirstElement(withPhoto, 'figure')

    expect(withPhotoText).toContain('Members')
    expect(withPhotoText).toContain('Deal found today')
    expect(withPhotoText).toContain('Premium Only')
    expect(withPhotoText).toContain('Save 42%')
    expect(withPhotoText).toContain('★★★☆☆')
    expect(findFirstProp(withPhoto, 'href', value => value === '/join?utm_source=deal_page&utm_medium=card_teaser&discount=42')).toBe('/join?utm_source=deal_page&utm_medium=card_teaser&discount=42')
    expect(findFirstProp(withPhoto, 'alt', value => value === '')).toBe('')
    expect(collectText(figure)).toBe('Property photo')

    const withoutPhotoText = collectText(LockedDealCard({
      placeholderName: 'Members Hotel',
      placeholderCity: 'Paris',
      stars: 5,
      discountPct: 42,
    }))
    expect(withoutPhotoText).toContain('Photo unavailable')
    expect(withoutPhotoText).not.toContain('Property photo')
  })

  it('reserves photo space while loading and switches image errors to an announced fallback', () => {
    const useStateMock = jest.requireMock('react').useState as jest.Mock
    const setLoaded = jest.fn()
    const setFailed = jest.fn()
    const onFailure = jest.fn()
    useStateMock
      .mockImplementationOnce(() => [false, setLoaded])
      .mockImplementationOnce(() => [false, setFailed])

    const loadingPhoto = PropertyPhoto({
      src: 'https://example.com/property.jpg',
      size: 'card',
      onFailure,
    })
    const onError = findFirstProp(loadingPhoto, 'onError', value => typeof value === 'function') as (() => void) | undefined

    expect(collectText(loadingPhoto)).toBe('Property photo')
    expect(findFirstProp(loadingPhoto, 'aria-busy', value => value === true)).toBe(true)
    expect(findFirstProp(loadingPhoto, 'alt', value => value === '')).toBe('')
    onError?.()
    expect(setFailed).toHaveBeenCalledWith(true)
    expect(onFailure).toHaveBeenCalledTimes(1)

    useStateMock
      .mockImplementationOnce(() => [false, jest.fn()])
      .mockImplementationOnce(() => [true, jest.fn()])

    const failedPhoto = PropertyPhoto({
      src: 'https://example.com/property.jpg',
      size: 'card',
    })

    expect(collectText(failedPhoto)).toBe('Photo unavailable')
    expect(findFirstProp(failedPhoto, 'role', value => value === 'status')).toBe('status')
    expect(findFirstProp(failedPhoto, 'alt', value => value === '')).toBeUndefined()
  })

  it('keeps deal-detail price claims outside the figure and supporting imagery after the provider handoff', () => {
    const fs = jest.requireActual('node:fs') as typeof import('node:fs')
    const source = fs.readFileSync('app/deals/[dealId]/page.tsx', 'utf8')
    const titleIndex = source.indexOf('<h1 id="saved-hotel-title"')
    const priceIndex = source.indexOf('<section aria-labelledby="saved-price-score-title"')
    const scoreIndex = source.lastIndexOf('<DealScoreSection deal={deal}')
    const photoIndex = source.indexOf('<PropertyPhoto src={deal.photo_url}')
    const actionIndex = source.indexOf('<section aria-labelledby="saved-provider-title"')

    expect(source).toContain('PropertyPhoto src={deal.photo_url}')
    expect(source).toContain('Deal found {foundAgo}')
    expect(source).not.toContain('bg-gradient-to-t')
    expect(titleIndex).toBeLessThan(priceIndex)
    expect(priceIndex).toBeLessThan(scoreIndex)
    expect(scoreIndex).toBeLessThan(actionIndex)
    expect(actionIndex).toBeLessThan(photoIndex)
  })
})

describe('DealScorePanel — presentation clarity', () => {
  const scoredHigh: DealScore = {
    percentile: 23,
    pctVsMedian: -9,
    medianCents: 41200,
    currency: 'USD',
    verdict: 'Good',
    confidence: 'high',
    explanation: '$375.00 — about 9% below the usual $412.00 for this route over the last 90 days.',
    sampleSize: 43,
  }

  const lowConfidence: DealScore = {
    percentile: 50,
    pctVsMedian: -25,
    medianCents: 18000,
    currency: 'USD',
    verdict: 'Typical',
    confidence: 'low',
    explanation: '$135.00 — limited price history for this hotel, so this is treated as a typical price for now.',
  }

  function panel(score: DealScore | null, overrides?: Partial<{ loading: boolean; scope: 'route' | 'hotel'; priceNoun: 'fare' | 'nightly rate'; unavailableCopy: string }>) {
    return DealScorePanel({
      score,
      loading: false,
      scope: 'route',
      priceNoun: 'fare',
      unavailableCopy: 'unavailable copy',
      ...overrides,
    })
  }

  it('never renders an ordinal percentile in loading, unavailable, low-confidence, or scored states', () => {
    const states = [
      DealScorePanel({ score: null, loading: true, scope: 'route', priceNoun: 'fare', unavailableCopy: 'x' }),
      panel(null),
      panel(lowConfidence),
      panel(scoredHigh),
    ]

    for (const state of states) {
      expect(collectText(state)).not.toMatch(/\d+(st|nd|rd|th)\s+percentile/)
    }
  })

  it('places the explanation sentence before the evidence grid in the scored state', () => {
    const text = collectText(panel(scoredHigh))
    expect(text.indexOf(scoredHigh.explanation)).toBeLessThan(text.indexOf('Usual fare'))
  })

  it('states the price-check count on the scored fact when sampleSize is present, singular when 1, and degrades gracefully when absent', () => {
    const text43 = collectText(panel(scoredHigh))
    expect(text43).toContain('43 price checks')

    const text1 = collectText(panel({ ...scoredHigh, sampleSize: 1 }))
    expect(text1).toContain('1 price check,')
    expect(text1).not.toContain('1 price checks')

    const { sampleSize: _omit, ...withoutSampleSize } = scoredHigh
    const textNone = collectText(panel(withoutSampleSize))
    expect(textNone).toContain('Last 90 days')
    expect(textNone).not.toContain('NaN')
    expect(textNone).not.toContain('undefined')
    expect(textNone).not.toContain('0 price checks')
  })

  it('suppresses the evidence grid entirely for low confidence and never restates the disowned median', () => {
    const text = collectText(panel(lowConfidence, { scope: 'hotel', priceNoun: 'nightly rate' }))
    expect(text).not.toContain('$180.00')
    expect(text).not.toContain('25% below usual')
    expect(text).not.toContain('Usual nightly rate')
  })

  it('states the low-confidence count line precisely for known sample sizes and suppresses it at zero', () => {
    const text4 = collectText(panel({ ...lowConfidence, sampleSize: 4 }))
    expect(text4).toContain('4 recent prices')
    expect(text4).toContain('not enough to confirm a rating')

    const text1 = collectText(panel({ ...lowConfidence, sampleSize: 1 }))
    expect(text1).toContain('1 recent price —')

    const text0 = collectText(panel({ ...lowConfidence, sampleSize: 0 }))
    expect(text0).not.toContain('Compared with')
  })

  it('states limited history at most twice in a rendered low-confidence expanded FlightCard', () => {
    const useStateMock = jest.requireMock('react').useState as jest.Mock
    useStateMock.mockImplementationOnce(() => [true, jest.fn()])

    const text = collectText(FlightCard({ fare, score: lowConfidence, loading: false }))
    expect(countText(text, 'Limited history')).toBeLessThanOrEqual(2)
  })

  it('carries the verdict in the group aria-label for scored and low-confidence states', () => {
    const goodLabel = findFirstProp(
      panel(scoredHigh),
      'aria-label',
      value => typeof value === 'string' && value.includes('Deal Score for this fare')
    )
    expect(goodLabel).toBe('Deal Score for this fare: Good.')

    const lowLabel = findFirstProp(
      panel(lowConfidence),
      'aria-label',
      value => typeof value === 'string' && value.includes('Deal Score for this fare')
    )
    expect(lowLabel).toBe('Deal Score for this fare: limited price history.')
  })

  it('renders loading and unavailable states unchanged', () => {
    const loadingText = collectText(DealScorePanel({ score: null, loading: true, scope: 'route', priceNoun: 'fare', unavailableCopy: 'x' }))
    expect(loadingText).toContain('Deal Score')
    expect(loadingText).toContain('Checking recent price history')

    const unavailableText = collectText(panel(null, { unavailableCopy: 'We could not compare this fare against route history yet. The live price is still shown when available.' }))
    expect(unavailableText).toContain('Deal Score unavailable')
    expect(unavailableText).toContain('We could not compare this fare against route history yet. The live price is still shown when available.')
  })
})

describe('Homepage rule copy stays derived from dealRules.ts', () => {
  it('interpolates MIN_SNAPSHOTS from lib/pipeline/dealRules instead of a hardcoded literal', () => {
    const fs = jest.requireActual('node:fs') as typeof import('node:fs')
    const source = fs.readFileSync('app/page.tsx', 'utf8')

    expect(source).toContain("import { DEAL_THRESHOLD, MIN_SNAPSHOTS } from '@/lib/pipeline/dealRules'")
    expect(source).toContain('${MIN_SNAPSHOTS} price checks behind it')
    expect(source).not.toContain('at least 3 days of price history')
    expect(source).not.toContain('30% below its rolling median')
  })

  it('never restates the invented 30–50% discount range or the average-vs-median mixup', () => {
    const fs = jest.requireActual('node:fs') as typeof import('node:fs')
    const dealsSource = fs.readFileSync('app/deals/page.tsx', 'utf8')
    const destinationSource = fs.readFileSync('app/destinations/[city]/page.tsx', 'utf8')

    for (const source of [dealsSource, destinationSource]) {
      expect(source).not.toMatch(/30[–-]50%/)
      expect(source).not.toContain('60-day average')
      expect(source).toContain('60-day median')
    }
  })
})
