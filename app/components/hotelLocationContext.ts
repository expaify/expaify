import type {
  HotelLocation,
  HotelLocationAnchorKind,
  HotelLocationPrecision,
} from '@/lib/types'
import {
  hasValidCoordinates,
  hasVerifiedHotelLocationComparison,
} from '@/lib/hotels/locationEvidence'

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

export type HotelLocationDistanceBucket =
  | 'lt_1'
  | '1_5'
  | '5_10'
  | '10_25'
  | 'gte_25'
  | 'none'

export type HotelLocationAnalytics = {
  hotelId: string
  evidenceState: HotelLocationEvidenceState
  anchorKind: HotelLocationAnchorKind | 'none'
  anchorId: string
  hasDistance: boolean
  distanceBucket: HotelLocationDistanceBucket
}

export type HotelLocationDisplay = {
  label: string
  value: string
  note: string
  precision: HotelLocationPrecision
  evidenceState: HotelLocationEvidenceState
  isWarning: boolean
  distanceText?: string
  distanceBucket: HotelLocationDistanceBucket
  anchorKind: HotelLocationAnchorKind | 'none'
  anchorId: string
  mapUrl?: string
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function distanceInMiles(location: HotelLocation | undefined): number | undefined {
  if (!hasVerifiedHotelLocationComparison(location)) return undefined
  return location.distance.unit === 'mi'
    ? location.distance.value
    : location.distance.value * 0.621371192237334
}

function formatDistance(location: HotelLocation | undefined): string | undefined {
  const miles = distanceInMiles(location)
  if (miles === undefined) return undefined

  const formatted = miles < 0.1
    ? '<0.1'
    : String(miles < 10 ? Math.round(miles * 10) / 10 : Math.round(miles))

  return `${formatted} mi from ${location!.anchor!.name.trim()}`
}

function getDistanceBucket(location: HotelLocation | undefined): HotelLocationDistanceBucket {
  const miles = distanceInMiles(location)
  if (miles === undefined) return 'none'
  if (miles < 1) return 'lt_1'
  if (miles < 5) return '1_5'
  if (miles < 10) return '5_10'
  if (miles < 25) return '10_25'
  return 'gte_25'
}

export function buildPropertyMapUrl(location: HotelLocation | undefined): string | undefined {
  if (!location || location.source !== 'provider' || !hasValidCoordinates(location)) return undefined

  const url = new URL('https://www.google.com/maps/search/')
  url.searchParams.set('api', '1')
  url.searchParams.set('query', `${location.lat},${location.lng}`)
  return url.protocol === 'https:' && url.hostname === 'www.google.com' ? url.toString() : undefined
}

export function getHotelLocationDisplay(source: HotelLocationSource): HotelLocationDisplay {
  const fallbackArea = clean(source.area)
  const location = source.location
  const providerLocationName = clean(location?.providerLocationName)
  const locationLabel = clean(location?.label)
  const providerArea = clean(location?.area) || fallbackArea
  const address = clean(location?.address)
  const hasPin = location?.source === 'provider' && hasValidCoordinates(location)
  const distanceText = formatDistance(location)
  const distanceBucket = getDistanceBucket(location)
  const anchorKind: HotelLocationAnchorKind | 'none' = distanceText ? location!.anchor!.kind : 'none'
  const anchorId = distanceText ? location!.anchor!.id.trim() : 'none'
  const comparison = { distanceText, distanceBucket, anchorKind, anchorId }

  if (address) {
    return {
      label: 'Address',
      value: address,
      note: hasPin
        ? 'Provider-supplied address and map pin. Confirm the entrance and final address before payment.'
        : 'Provider-supplied address. A property map pin is not available.',
      precision: 'exact',
      evidenceState: hasPin ? 'address_pin' : 'address_only',
      isWarning: false,
      mapUrl: hasPin ? buildPropertyMapUrl(location) : undefined,
      ...comparison,
    }
  }

  if (hasPin) {
    return {
      label: 'Provider map pin',
      value: providerLocationName || providerArea || 'Map position provided',
      note: 'Provider-supplied map pin. Confirm the entrance and final address before payment.',
      precision: 'coordinates',
      evidenceState: 'provider_pin',
      isWarning: false,
      mapUrl: buildPropertyMapUrl(location),
      ...comparison,
    }
  }

  if (location?.source === 'search_fallback' || location?.precision === 'search_area') {
    return {
      label: 'Search area only',
      value: locationLabel || providerLocationName || providerArea || 'Confirm location with provider',
      note: 'Only the searched destination is available. Confirm the property location with the provider.',
      precision: 'search_area',
      evidenceState: 'search_area_only',
      isWarning: true,
      distanceBucket: 'none',
      anchorKind: 'none',
      anchorId: 'none',
    }
  }

  if (providerLocationName || providerArea) {
    return {
      label: 'Area only',
      value: providerLocationName || providerArea,
      note: 'Provider supplied an area, not a property address or map pin.',
      precision: 'area',
      evidenceState: 'area_only',
      isWarning: false,
      distanceBucket: 'none',
      anchorKind: 'none',
      anchorId: 'none',
    }
  }

  return {
    label: 'Location unavailable',
    value: 'Confirm location with provider',
    note: 'No property location details were returned. Confirm the location with the provider.',
    precision: 'missing',
    evidenceState: 'unavailable',
    isWarning: true,
    distanceBucket: 'none',
    anchorKind: 'none',
    anchorId: 'none',
  }
}

export function getHotelLocationAnalytics(
  hotelId: string,
  display: HotelLocationDisplay,
): HotelLocationAnalytics {
  return {
    hotelId,
    evidenceState: display.evidenceState,
    anchorKind: display.anchorKind,
    anchorId: display.anchorId,
    hasDistance: display.distanceText !== undefined,
    distanceBucket: display.distanceBucket,
  }
}
