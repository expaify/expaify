import type { HotelLocation, HotelLocationPrecision } from '@/lib/types'

export type { HotelLocation, HotelLocationPrecision } from '@/lib/types'

export type HotelLocationSource = {
  area?: string
  location?: HotelLocation
}

export type HotelLocationDisplay = {
  label: string
  value: string
  note: string
  precision: HotelLocationPrecision
  isWarning: boolean
  distanceText?: string
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function completeDistance(location: HotelLocation | undefined): string | undefined {
  const distance = location?.distance
  if (
    !distance ||
    typeof distance.value !== 'number' ||
    !Number.isFinite(distance.value) ||
    distance.value < 0 ||
    (distance.unit !== 'mi' && distance.unit !== 'km') ||
    !clean(distance.referencePoint)
  ) {
    return undefined
  }

  return `${distance.value} ${distance.unit} from ${clean(distance.referencePoint)}`
}

export function getHotelLocationDisplay(source: HotelLocationSource): HotelLocationDisplay {
  const area = clean(source.area)
  const location = source.location
  const providerLocationName = clean(location?.providerLocationName)
  const locationLabel = clean(location?.label)
  const address = clean(location?.address)
  const distanceText = completeDistance(location)

  if (location?.precision === 'exact') {
    return {
      label: 'Exact location',
      value: address || locationLabel || providerLocationName || area || 'Confirm with provider',
      note: 'Provider-supplied address. Confirm the final address before payment.',
      precision: 'exact',
      isWarning: false,
      distanceText,
    }
  }

  if (location?.precision === 'coordinates') {
    return {
      label: 'Map position',
      value: providerLocationName || locationLabel || area || 'Confirm with provider',
      note: 'Provider-supplied map position. Confirm the final address before payment.',
      precision: 'coordinates',
      isWarning: false,
      distanceText,
    }
  }

  if (location?.precision === 'area' || area) {
    return {
      label: 'Area',
      value: providerLocationName || locationLabel || area || 'Confirm with provider',
      note: 'Provider supplied an area, not a street address.',
      precision: 'area',
      isWarning: false,
      distanceText,
    }
  }

  if (location?.precision === 'search_area') {
    return {
      label: 'Search area',
      value: locationLabel || providerLocationName || 'Confirm with provider',
      note: 'Only the searched destination is available. Confirm the property location with the provider.',
      precision: 'search_area',
      isWarning: true,
      distanceText,
    }
  }

  return {
    label: 'Location not provided',
    value: 'Confirm with provider',
    note: 'No property location details were returned.',
    precision: 'missing',
    isWarning: true,
  }
}
