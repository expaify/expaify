import type { HotelLocation, HotelLocationPrecision } from '@/lib/types'

export type { HotelLocation, HotelLocationPrecision } from '@/lib/types'

export type HotelLocationSource = {
  area?: string
  location?: HotelLocation
}

export type HotelLocationEvidenceState =
  | 'address_pin'
  | 'address_only'
  | 'provider_pin'
  | 'area_only'
  | 'search_area_only'
  | 'unavailable'

export type HotelLocationAnalytics = {
  hotelId: string
  evidenceState: HotelLocationEvidenceState
  anchorKind: 'none'
  anchorId: 'none'
  hasDistance: false
  distanceBucket: 'none'
}

export type HotelLocationDisplay = {
  evidenceState: HotelLocationEvidenceState
  label: string
  value: string
  note: string
  precision: HotelLocationPrecision
  isWarning: boolean
  mapUrl?: string
  distanceText?: string
  distanceCaveat?: string
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function hasValidCoordinates(location: HotelLocation | undefined): location is HotelLocation & { lat: number; lng: number } {
  return typeof location?.lat === 'number'
    && Number.isFinite(location.lat)
    && location.lat >= -90
    && location.lat <= 90
    && typeof location.lng === 'number'
    && Number.isFinite(location.lng)
    && location.lng >= -180
    && location.lng <= 180
}

function buildCoordinateMapUrl(location: HotelLocation | undefined): string | undefined {
  if (!hasValidCoordinates(location)) return undefined

  try {
    const url = new URL('https://www.google.com/maps/search/')
    url.searchParams.set('api', '1')
    url.searchParams.set('query', `${location.lat},${location.lng}`)
    return url.protocol === 'https:' && url.hostname === 'www.google.com' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export function getHotelLocationAnalytics(hotelId: string, display: HotelLocationDisplay): HotelLocationAnalytics {
  return {
    hotelId,
    evidenceState: display.evidenceState,
    anchorKind: 'none',
    anchorId: 'none',
    hasDistance: false,
    distanceBucket: 'none',
  }
}

export function getHotelLocationImpressionKey(properties: HotelLocationAnalytics): string {
  return `${properties.hotelId}:${properties.evidenceState}:${properties.anchorId}`
}

export function getHotelLocationDisplay(source: HotelLocationSource): HotelLocationDisplay {
  const area = clean(source.area)
  const location = source.location
  const providerLocationName = clean(location?.providerLocationName)
  const locationLabel = clean(location?.label)
  const address = clean(location?.address)
  const mapUrl = buildCoordinateMapUrl(location)

  // The legacy distance has no anchor kind, provenance, coordinates, source, or
  // measurement method. It is deliberately suppressed until DEV supplies the
  // provenance-bearing contract required by the design specification.

  if (address && mapUrl) {
    return {
      evidenceState: 'address_pin',
      label: 'Address',
      value: address,
      note: 'Provider-supplied address and map pin. Confirm the entrance and final address before payment.',
      precision: location?.precision ?? 'exact',
      isWarning: false,
      mapUrl,
    }
  }

  if (address) {
    return {
      evidenceState: 'address_only',
      label: 'Address',
      value: address,
      note: 'Provider-supplied address. A property map pin is not available.',
      precision: location?.precision ?? 'exact',
      isWarning: false,
    }
  }

  if (mapUrl) {
    const providerPinLabel = providerLocationName
      || (location?.precision === 'search_area' ? '' : locationLabel)
      || (location?.precision === 'search_area' ? '' : area)
      || 'Map position provided'

    return {
      evidenceState: 'provider_pin',
      label: 'Provider map pin',
      value: providerPinLabel,
      note: 'Provider-supplied map pin. Confirm the entrance and final address before payment.',
      precision: 'coordinates',
      isWarning: false,
      mapUrl,
    }
  }

  const providerArea = providerLocationName || (location?.precision === 'search_area' ? '' : locationLabel) || area
  if (providerArea && location?.precision !== 'search_area') {
    return {
      evidenceState: 'area_only',
      label: 'Area only',
      value: providerArea,
      note: 'Provider supplied an area, not a property address or map pin.',
      precision: 'area',
      isWarning: false,
    }
  }

  if (location?.precision === 'search_area') {
    return {
      evidenceState: 'search_area_only',
      label: 'Search area only',
      value: locationLabel || providerLocationName || area || 'Confirm location with provider',
      note: 'Only the searched destination is available. Confirm the property location with the provider.',
      precision: 'search_area',
      isWarning: true,
    }
  }

  return {
    evidenceState: 'unavailable',
    label: 'Location unavailable',
    value: 'Confirm location with provider',
    note: 'No property location details were returned. Confirm the location with the provider.',
    precision: 'missing',
    isWarning: true,
  }
}
