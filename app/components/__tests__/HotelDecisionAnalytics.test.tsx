import type { ReactElement } from 'react'

const trackMock = jest.fn()
const sections = [
  { dataset: { hotelDecisionSection: 'property_stay', hotelDecisionPosition: '1' } },
  { dataset: { hotelDecisionSection: 'provider_handoff', hotelDecisionPosition: '4' } },
] as unknown as Element[]
const root = { querySelectorAll: jest.fn(() => sections) }

jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => trackMock(...args) }))
jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')
  return {
    ...actual,
    useEffect: jest.fn((effect: () => void) => effect()),
    useRef: jest.fn((initialValue: unknown) => ({ current: initialValue === null ? root : initialValue })),
  }
})

const { HotelDecisionAnalytics, priceFreshnessState } = jest.requireActual('../HotelDecisionAnalytics') as typeof import('../HotelDecisionAnalytics')

describe('hotel decision analytics', () => {
  beforeEach(() => trackMock.mockClear())

  it('classifies price freshness at the saved-detail thresholds', () => {
    const now = Date.parse('2026-07-22T12:00:00.000Z')
    expect(priceFreshnessState('2026-07-22T00:00:00.000Z', false, now)).toBe('fresh')
    expect(priceFreshnessState('2026-07-21T06:00:00.000Z', false, now)).toBe('aging')
    expect(priceFreshnessState('2026-07-20T12:00:00.000Z', false, now)).toBe('stale')
    expect(priceFreshnessState(undefined, false, now)).toBe('unknown')
    expect(priceFreshnessState('2026-07-22T00:00:00.000Z', true, now)).toBe('expired')
  })

  it('requires 50% visibility for one second and deduplicates each section', () => {
    jest.useFakeTimers()
    let callback: IntersectionObserverCallback | undefined
    const originalObserver = Object.getOwnPropertyDescriptor(globalThis, 'IntersectionObserver')
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      value: jest.fn((nextCallback: IntersectionObserverCallback) => {
        callback = nextCallback
        return { observe: jest.fn(), disconnect: jest.fn() }
      }),
    })

    try {
      HotelDecisionAnalytics({
        hotelId: 'hotel_123', entrySource: 'saved_deals', hasDates: true,
        hasVerifiedGuestRating: false, scoreState: 'confident', priceFreshnessState: 'fresh',
        children: null,
      }) as ReactElement
      const entry = { target: sections[0], isIntersecting: true, intersectionRatio: 0.5 } as IntersectionObserverEntry
      callback?.([entry], {} as IntersectionObserver)
      jest.advanceTimersByTime(999)
      expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_decision_section_reached')).toHaveLength(0)
      jest.advanceTimersByTime(1)
      callback?.([entry], {} as IntersectionObserver)
      jest.advanceTimersByTime(1_000)

      expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_decision_section_reached')).toEqual([[
        'hotel_decision_section_reached',
        expect.objectContaining({ hotel_id: 'hotel_123', section: 'property_stay', position: 1 }),
      ]])
    } finally {
      jest.useRealTimers()
      if (originalObserver) Object.defineProperty(globalThis, 'IntersectionObserver', originalObserver)
      else delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver
    }
  })
})
