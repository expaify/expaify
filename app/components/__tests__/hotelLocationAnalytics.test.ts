import type { HotelLocationAnalytics } from '../hotelLocationContext'

const trackMock = jest.fn()

jest.mock('@/lib/analytics', () => ({
  track: (...args: unknown[]) => trackMock(...args),
}))

const {
  markHotelLocationInspected,
  trackHotelLocationDetailsOpened,
  trackHotelLocationImpression,
  trackHotelLocationPinOpened,
  trackHotelProviderHandoffAfterLocation,
  trackHotelReviewOpenedAfterLocation,
} = jest.requireActual('../hotelLocationAnalytics') as typeof import('../hotelLocationAnalytics')

const analytics: HotelLocationAnalytics = {
  hotelId: 'location-analytics-hotel',
  evidenceState: 'provider_pin',
  anchorKind: 'airport',
  anchorId: 'LAX',
  hasDistance: true,
  distanceBucket: '10_25',
}

describe('hotel location analytics progression', () => {
  const storage = new Map<string, string>()

  beforeEach(() => {
    trackMock.mockReset()
    storage.clear()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        sessionStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    })
  })

  afterAll(() => {
    Reflect.deleteProperty(globalThis, 'window')
  })

  it('emits the five property-safe progression events and deduplicates impressions', () => {
    trackHotelLocationImpression(analytics)
    trackHotelLocationImpression(analytics)
    trackHotelLocationDetailsOpened(analytics)
    trackHotelLocationPinOpened(analytics)
    trackHotelReviewOpenedAfterLocation(analytics)
    trackHotelProviderHandoffAfterLocation(analytics)

    expect(trackMock.mock.calls.map(([event]) => event)).toEqual([
      'hotel_location_impression',
      'hotel_location_details_opened',
      'hotel_location_pin_opened',
      'hotel_review_opened_after_location',
      'hotel_provider_handoff_after_location',
    ])
    expect(trackMock.mock.calls[2][1]).toEqual({
      ...analytics,
      mapTarget: 'external_coordinate_map',
    })
    expect(trackMock.mock.calls[3][1]).toEqual({ ...analytics, sameProperty: true })
    expect(trackMock.mock.calls[4][1]).toEqual({ ...analytics, sameProperty: true })
    expect(JSON.stringify(trackMock.mock.calls)).not.toMatch(/lat|lng|address|price/i)
  })

  it('does not emit review or handoff progression without same-property inspection', () => {
    trackHotelReviewOpenedAfterLocation(analytics)
    trackHotelProviderHandoffAfterLocation(analytics)

    expect(trackMock).not.toHaveBeenCalled()
  })

  it('keeps analytics and storage failures non-blocking', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        sessionStorage: {
          getItem: () => {
            throw new Error('storage disabled')
          },
          setItem: () => {
            throw new Error('storage disabled')
          },
        },
      },
    })
    trackMock.mockImplementation(() => {
      throw new Error('analytics unavailable')
    })

    expect(() => markHotelLocationInspected(analytics.hotelId)).not.toThrow()
    expect(() => trackHotelLocationDetailsOpened(analytics)).not.toThrow()
    expect(() => trackHotelLocationPinOpened(analytics)).not.toThrow()
    expect(() => trackHotelReviewOpenedAfterLocation(analytics)).not.toThrow()
    expect(() => trackHotelProviderHandoffAfterLocation(analytics)).not.toThrow()
  })
})
