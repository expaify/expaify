import type { NormalizedFare } from './types'

const providerLabels: Record<string, string> = {
  travelpayouts: 'Travelpayouts',
  duffel: 'Duffel',
  amadeus: 'Amadeus',
  kiwi: 'Kiwi',
  hotellook: 'Hotellook',
  bookingcomrapidapi: 'Booking.com',
}

export type FareFreshnessSummary = {
  sentence: string
  mobileClause: string
  metric: string
  detail: string
}

export function providerDisplayName(source?: string): string {
  const value = source?.trim() ?? ''
  if (!value) return 'Provider unavailable'

  const knownLabel = providerLabels[value.toLowerCase()]
  if (knownLabel) return knownLabel

  if (/[A-Z]/.test(value.slice(1))) return value

  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ')
}

export function hasProviderName(source?: string): boolean {
  return Boolean(source?.trim())
}

export function validFreshnessDate(value?: string): Date | null {
  if (!value) return null

  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

export function formatRelativeFreshness(date: Date, now: Date = new Date()): string {
  const diffMs = Math.max(0, now.getTime() - date.getTime())
  const minutes = Math.floor(diffMs / 60000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  if (hours < 48) return 'yesterday'

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} days ago`

  return `on ${date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })}`
}

export function formatAbsoluteFreshness(date: Date, now: Date = new Date()): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function flightFreshnessLabel(source?: string, fetchedAt?: string, now: Date = new Date()): string {
  const date = validFreshnessDate(fetchedAt)
  if (!date) return 'Provider freshness unavailable'

  const relative = formatRelativeFreshness(date, now)
  if (!hasProviderName(source)) return `Checked ${relative}; provider unavailable`

  return `Checked ${relative} by ${providerDisplayName(source)}`
}

export function flightPriceCheckCopy(source?: string, fetchedAt?: string, now: Date = new Date()): string {
  const date = validFreshnessDate(fetchedAt)
  const providerAvailable = hasProviderName(source)
  const providerName = providerDisplayName(source)

  if (!date && providerAvailable) {
    return `Last-checked time unavailable for ${providerName}. Final price and availability are confirmed by the provider.`
  }

  if (!date) {
    return 'Last-checked time unavailable. Provider name unavailable. Final price and availability are confirmed by the provider.'
  }

  const absolute = formatAbsoluteFreshness(date, now)
  if (!providerAvailable) {
    return `Last checked on ${absolute}. Provider name unavailable. Final price and availability are confirmed by the provider.`
  }

  return `Last checked by ${providerName} on ${absolute}. Final price and availability are confirmed by the provider.`
}

export function fareFreshnessSummary(fares: NormalizedFare[], now: Date = new Date()): FareFreshnessSummary | null {
  if (fares.length === 0) return null

  const validDates = fares
    .map(fare => validFreshnessDate(fare.fetchedAt))
    .filter((date): date is Date => Boolean(date))

  if (validDates.length === 0) {
    return {
      sentence: 'Fare freshness unavailable.',
      mobileClause: 'Freshness unavailable',
      metric: 'Unavailable',
      detail: 'Provider freshness is missing.',
    }
  }

  if (validDates.length !== fares.length) {
    return {
      sentence: 'Some fare timestamps unavailable.',
      mobileClause: 'Freshness partial',
      metric: 'Partial',
      detail: 'Some fare timestamps unavailable.',
    }
  }

  const freshest = validDates.reduce((latest, date) => date.getTime() > latest.getTime() ? date : latest, validDates[0])
  const relative = formatRelativeFreshness(freshest, now)
  const olderThanSixHours = now.getTime() - freshest.getTime() > 6 * 60 * 60 * 1000
  const warning = olderThanSixHours ? ' Recheck provider price before booking.' : ''

  return {
    sentence: `Freshest fare checked ${relative}.${warning}`,
    mobileClause: `Freshest ${relative}`,
    metric: relative,
    detail: 'Provider timestamps on visible fares.',
  }
}
