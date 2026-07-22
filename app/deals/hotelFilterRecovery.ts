export type HotelFilterKey =
  | 'city'
  | 'minDiscount'
  | 'minStars'
  | 'maxPrice'
  | 'dateFrom'
  | 'dateTo'

export type Money = { priceCents: number; currency: string }

export type HotelFilterValue =
  | { kind: 'percentage'; value: number }
  | { kind: 'stars'; value: number }
  | { kind: 'money'; value: Money }
  | { kind: 'city'; value: string }
  | { kind: 'date'; value: string }
  | { kind: 'none' }

export type HotelRecoveryOption = {
  filterKey: HotelFilterKey
  from: HotelFilterValue
  relaxedTo: HotelFilterValue
  resultingTotal: number
  addedCount: number
  contextPreserved: HotelFilterKey[]
  dataVersion: string
}

export type HotelResultMetadata = {
  queryId: string
  inventoryKind: 'live' | 'sample'
  filteredTotal: number
  baselineContextTotal: number
  dataVersion: string
  generatedAt: string
  recoveryOptions: HotelRecoveryOption[]
}

export type HotelFilterState = {
  city: string
  minDiscount: number
  minStars: number
  maxPriceCents: number | null
  dateFrom: string
  dateTo: string
}

const FILTER_KEYS: HotelFilterKey[] = [
  'city',
  'minDiscount',
  'minStars',
  'maxPrice',
  'dateFrom',
  'dateTo',
]

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}

function isFilterKey(value: unknown): value is HotelFilterKey {
  return typeof value === 'string' && FILTER_KEYS.includes(value as HotelFilterKey)
}

function isCurrency(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value)
}

function parseFilterValue(value: unknown): HotelFilterValue | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null
  if (value.kind === 'none') return { kind: 'none' }
  if (value.kind === 'percentage' && isNonNegativeInteger(value.value)) {
    return { kind: 'percentage', value: value.value }
  }
  if (value.kind === 'stars' && isNonNegativeInteger(value.value) && value.value <= 5) {
    return { kind: 'stars', value: value.value }
  }
  if (value.kind === 'city' && typeof value.value === 'string' && value.value.trim()) {
    return { kind: 'city', value: value.value }
  }
  if (value.kind === 'date' && typeof value.value === 'string' && ISO_DATE.test(value.value)) {
    return { kind: 'date', value: value.value }
  }
  if (value.kind === 'money' && isRecord(value.value)) {
    const priceCents = value.value.priceCents
    const currency = value.value.currency
    if (isNonNegativeInteger(priceCents) && isCurrency(currency)) {
      return { kind: 'money', value: { priceCents, currency } }
    }
  }
  return null
}

function activeKeys(filters: HotelFilterState, defaultCity: string | undefined): HotelFilterKey[] {
  const keys: HotelFilterKey[] = []
  if (defaultCity || filters.city) keys.push('city')
  if (filters.minDiscount !== 20) keys.push('minDiscount')
  if (filters.minStars > 0) keys.push('minStars')
  if (filters.maxPriceCents !== null) keys.push('maxPrice')
  if (filters.dateFrom) keys.push('dateFrom')
  if (filters.dateTo) keys.push('dateTo')
  return keys
}

function valueMatchesCurrent(key: HotelFilterKey, value: HotelFilterValue, filters: HotelFilterState): boolean {
  switch (key) {
    case 'city': return value.kind === 'city' && value.value === filters.city
    case 'minDiscount': return value.kind === 'percentage' && value.value === filters.minDiscount
    case 'minStars': return value.kind === 'stars' && value.value === filters.minStars
    case 'maxPrice': return value.kind === 'money' && value.value.priceCents === filters.maxPriceCents
    case 'dateFrom': return value.kind === 'date' && value.value === filters.dateFrom
    case 'dateTo': return value.kind === 'date' && value.value === filters.dateTo
  }
}

function valueMatchesBaseline(key: HotelFilterKey, value: HotelFilterValue, defaultCity: string | undefined): boolean {
  switch (key) {
    case 'city': return !defaultCity && value.kind === 'none'
    case 'minDiscount': return value.kind === 'percentage' && value.value === 20
    case 'minStars': return (value.kind === 'stars' && value.value === 0) || value.kind === 'none'
    case 'maxPrice': return value.kind === 'none'
    case 'dateFrom':
    case 'dateTo': return value.kind === 'none'
  }
}

function parseOption(
  value: unknown,
  metadata: Pick<HotelResultMetadata, 'filteredTotal' | 'dataVersion'>,
  filters: HotelFilterState,
  defaultCity: string | undefined,
): HotelRecoveryOption | null {
  if (!isRecord(value) || !isFilterKey(value.filterKey)) return null
  const from = parseFilterValue(value.from)
  const relaxedTo = parseFilterValue(value.relaxedTo)
  if (!from || !relaxedTo || !valueMatchesCurrent(value.filterKey, from, filters)) return null
  if (!valueMatchesBaseline(value.filterKey, relaxedTo, defaultCity)) return null
  if (!isNonNegativeInteger(value.resultingTotal) || !isNonNegativeInteger(value.addedCount)) return null
  if (value.resultingTotal <= metadata.filteredTotal) return null
  if (value.addedCount !== value.resultingTotal - metadata.filteredTotal) return null
  if (value.dataVersion !== metadata.dataVersion) return null
  const contextPreserved = value.contextPreserved
  if (!Array.isArray(contextPreserved) || !contextPreserved.every(isFilterKey)) return null

  const requiredContext = activeKeys(filters, defaultCity).filter(key => key !== value.filterKey)
  if (!requiredContext.every(key => contextPreserved.includes(key))) return null

  return {
    filterKey: value.filterKey,
    from,
    relaxedTo,
    resultingTotal: value.resultingTotal,
    addedCount: value.addedCount,
    contextPreserved: [...new Set(contextPreserved)],
    dataVersion: value.dataVersion,
  }
}

/**
 * Validates only metadata that can be proven by the UI. Request ordering is
 * checked by DealFeed's request sequence; the DEV contract will additionally
 * provide the deterministic query identity used by the server.
 */
export function parseHotelResultMetadata(
  value: unknown,
  filters: HotelFilterState,
  defaultCity?: string,
): HotelResultMetadata | null {
  if (!isRecord(value)) return null
  if (typeof value.queryId !== 'string' || !value.queryId) return null
  if (value.inventoryKind !== 'live' && value.inventoryKind !== 'sample') return null
  if (!isNonNegativeInteger(value.filteredTotal) || !isNonNegativeInteger(value.baselineContextTotal)) return null
  if (typeof value.dataVersion !== 'string' || !value.dataVersion) return null
  if (typeof value.generatedAt !== 'string' || Number.isNaN(Date.parse(value.generatedAt))) return null
  if (!Array.isArray(value.recoveryOptions)) return null

  const base = {
    filteredTotal: value.filteredTotal,
    dataVersion: value.dataVersion,
  }
  const options = value.recoveryOptions
    .map(option => parseOption(option, base, filters, defaultCity))
    .filter((option): option is HotelRecoveryOption => option !== null)

  return {
    queryId: value.queryId,
    inventoryKind: value.inventoryKind,
    filteredTotal: value.filteredTotal,
    baselineContextTotal: value.baselineContextTotal,
    dataVersion: value.dataVersion,
    generatedAt: value.generatedAt,
    recoveryOptions: options,
  }
}

export function formatDealCount(count: number): string {
  return `${count.toLocaleString()} current ${count === 1 ? 'deal' : 'deals'}`
}

export function formatFilterValue(key: HotelFilterKey, filters: HotelFilterState): string {
  switch (key) {
    case 'city': return filters.city
    case 'minDiscount': return `${filters.minDiscount}%+ off`
    case 'minStars': return `${filters.minStars}★ & up`
    case 'maxPrice': return `Under $${Math.round((filters.maxPriceCents ?? 0) / 100).toLocaleString()}/night`
    case 'dateFrom': return `From ${formatFullDate(filters.dateFrom)}`
    case 'dateTo': return `To ${formatFullDate(filters.dateTo)}`
  }
}

export function formatFullDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function formatDateRange(dateFrom: string, dateTo: string): string {
  if (!dateFrom && !dateTo) return ''
  if (!dateFrom) return formatFullDate(dateTo)
  if (!dateTo) return formatFullDate(dateFrom)
  const start = new Date(`${dateFrom}T00:00:00Z`)
  const end = new Date(`${dateTo}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return `${dateFrom}–${dateTo}`
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear()
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth()
  const startText = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' as const }),
    timeZone: 'UTC',
  }).format(start)
  const endText = new Intl.DateTimeFormat('en-US', {
    ...(sameMonth ? {} : { month: 'short' as const }),
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(end)
  return `${startText}–${endText}`
}
