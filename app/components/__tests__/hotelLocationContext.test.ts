import {
  getHotelLocationAnalytics,
  getHotelLocationDisplay,
  getHotelLocationImpressionKey,
} from '../hotelLocationContext'

describe('hotel location evidence presentation', () => {
  it.each([
    {
      name: 'address and pin',
      source: {
        area: 'Midtown',
        location: { precision: 'exact' as const, address: '350 5th Ave', lat: 40.7484, lng: -73.9857 },
      },
      state: 'address_pin',
      label: 'Address',
      value: '350 5th Ave',
      hasMap: true,
    },
    {
      name: 'address only',
      source: {
        area: 'Midtown',
        location: { precision: 'exact' as const, address: '350 5th Ave', lat: 40.7484 },
      },
      state: 'address_only',
      label: 'Address',
      value: '350 5th Ave',
      hasMap: false,
    },
    {
      name: 'provider pin',
      source: {
        area: 'Downtown',
        location: { precision: 'coordinates' as const, lat: 0, lng: 0, providerLocationName: 'Civic Center' },
      },
      state: 'provider_pin',
      label: 'Provider map pin',
      value: 'Civic Center',
      hasMap: true,
    },
    {
      name: 'provider area only',
      source: { area: 'Midtown', location: { precision: 'area' as const, providerLocationName: 'Midtown East' } },
      state: 'area_only',
      label: 'Area only',
      value: 'Midtown East',
      hasMap: false,
    },
    {
      name: 'search area only',
      source: { area: 'Los Angeles', location: { precision: 'search_area' as const, label: 'Los Angeles' } },
      state: 'search_area_only',
      label: 'Search area only',
      value: 'Los Angeles',
      hasMap: false,
    },
    {
      name: 'unavailable',
      source: {},
      state: 'unavailable',
      label: 'Location unavailable',
      value: 'Confirm location with provider',
      hasMap: false,
    },
  ])('renders $name without overstating the evidence', ({ source, state, label, value, hasMap }) => {
    const display = getHotelLocationDisplay(source)

    expect(display.evidenceState).toBe(state)
    expect(display.label).toBe(label)
    expect(display.value).toBe(value)
    expect(Boolean(display.mapUrl)).toBe(hasMap)
    expect(display.distanceText).toBeUndefined()
  })

  it('suppresses legacy distance values whose anchor provenance and method are unknown', () => {
    const display = getHotelLocationDisplay({
      area: 'Midtown',
      location: {
        precision: 'exact',
        address: '350 5th Ave',
        lat: 40.7484,
        lng: -73.9857,
        distance: { value: 0.3, unit: 'mi', referencePoint: 'city center' },
      },
    })

    expect(display.distanceText).toBeUndefined()
    expect(JSON.stringify(display)).not.toContain('city center')
  })

  it('omits the map target for invalid, partial, and non-finite coordinates', () => {
    const invalidCoordinates = [
      { lat: 91, lng: 0 },
      { lat: 0, lng: 181 },
      { lat: Number.NaN, lng: 0 },
      { lat: 12 },
    ]

    for (const coordinates of invalidCoordinates) {
      const display = getHotelLocationDisplay({
        area: 'Known area',
        location: { precision: 'coordinates', ...coordinates },
      })
      expect(display.mapUrl).toBeUndefined()
      expect(display.evidenceState).toBe('area_only')
    }
  })

  it('builds an allowlisted coordinate-only map URL and a property-safe analytics payload', () => {
    const display = getHotelLocationDisplay({
      location: { precision: 'coordinates', lat: 40.7484, lng: -73.9857 },
    })
    const mapUrl = new URL(display.mapUrl ?? '')

    expect(mapUrl.protocol).toBe('https:')
    expect(mapUrl.hostname).toBe('www.google.com')
    expect(mapUrl.searchParams.get('query')).toBe('40.7484,-73.9857')
    const analytics = getHotelLocationAnalytics('hotel-123', display)

    expect(analytics).toEqual({
      hotelId: 'hotel-123',
      evidenceState: 'provider_pin',
      anchorKind: 'none',
      anchorId: 'none',
      hasDistance: false,
      distanceBucket: 'none',
    })
    expect(getHotelLocationImpressionKey(analytics)).toBe('hotel-123:provider_pin:none')
  })

  it('does not promote searched-destination coordinates to a property pin', () => {
    const display = getHotelLocationDisplay({
      area: 'Los Angeles',
      location: {
        precision: 'search_area',
        label: 'Los Angeles',
        lat: 34.0522,
        lng: -118.2437,
      },
    })

    expect(display.evidenceState).toBe('search_area_only')
    expect(display.value).toBe('Los Angeles')
    expect(display.mapUrl).toBeUndefined()
  })
})
