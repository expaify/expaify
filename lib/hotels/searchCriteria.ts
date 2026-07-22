import { TRACKED_MARKET_NAMES } from '@/lib/trackedMarkets'
import { CITY_DISPLAY_TO_SLUG } from '@/lib/cities'

export type HotelSearchCriteriaV1 = {
  schemaVersion: 1
  criteriaVersion: string
  destination: { state: 'all' } | { state: 'selected'; city: string }
  dates:
    | { semantic: 'missing' }
    | { semantic: 'checkin_window'; dateFrom?: string; dateTo?: string }
  occupancy:
    | { state: 'not_captured' }
    | { state: 'applied'; adults: number; children: number; childAges: number[]; rooms: number }
  source: 'deals_page' | 'destination_page' | 'edit' | 'restored'
}

export type HotelCriteriaDraft = {
  city: string
  dateFrom: string
  dateTo: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const CRITERIA_VERSION = /^[A-Za-z0-9_-]{8,80}$/
const CRITERIA_SOURCES: ReadonlyArray<HotelSearchCriteriaV1['source']> = [
  'deals_page', 'destination_page', 'edit', 'restored',
]

export type HotelCriteriaContextStatus = 'matched' | 'mismatch' | 'missing' | 'invalid'

export type HotelResultsViewState = {
  minDiscount: number
  maxPriceCents: number | null
  minStars: number
  sort: 'newest' | 'discount' | 'price'
}

export type HotelCriteriaResolution =
  | { status: 'valid'; criteria: HotelSearchCriteriaV1 }
  | { status: 'missing' | 'invalid' }

type SearchParamSource = URLSearchParams | Record<string, string | string[] | undefined>

function readSearchParam(source: SearchParamSource, key: string): string | null {
  if (source instanceof URLSearchParams) return source.get(key)
  const value = source[key]
  return typeof value === 'string' ? value : null
}

function hasSearchParam(source: SearchParamSource, key: string): boolean {
  if (source instanceof URLSearchParams) return source.has(key)
  return source[key] !== undefined
}

function canonicalCity(value: string): string | null {
  const normalized = value.normalize('NFKC').trim().toLocaleLowerCase('en-US')
  return TRACKED_MARKET_NAMES.find(city => city.normalize('NFKC').toLocaleLowerCase('en-US') === normalized) ?? null
}

function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date
}

function formatDate(value: string, includeYear: boolean): string {
  const date = parseIsoDate(value)
  if (!date) return value
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(date)
}

export function formatHotelCriteriaDates(dates: HotelSearchCriteriaV1['dates']): string {
  if (dates.semantic === 'missing' || (!dates.dateFrom && !dates.dateTo)) return 'Any check-in date'
  if (dates.dateFrom && !dates.dateTo) return `Check in on or after ${formatDate(dates.dateFrom, false)}`
  if (!dates.dateFrom && dates.dateTo) return `Check in by ${formatDate(dates.dateTo, false)}`

  const from = parseIsoDate(dates.dateFrom!)
  const to = parseIsoDate(dates.dateTo!)
  if (!from || !to) return 'Any check-in date'
  const differentYears = from.getUTCFullYear() !== to.getUTCFullYear()
  const sameMonth = !differentYears && from.getUTCMonth() === to.getUTCMonth()
  if (sameMonth) {
    const month = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(from)
    return `Check in ${month} ${from.getUTCDate()}–${to.getUTCDate()}`
  }
  return `Check in ${formatDate(dates.dateFrom!, differentYears)}–${formatDate(dates.dateTo!, differentYears)}`
}

export function hotelCriteriaDestination(criteria: HotelSearchCriteriaV1): string {
  return criteria.destination.state === 'selected' ? criteria.destination.city : 'All destinations'
}

export function hotelCriteriaToDraft(criteria: HotelSearchCriteriaV1): HotelCriteriaDraft {
  return {
    city: criteria.destination.state === 'selected' ? criteria.destination.city : '',
    dateFrom: criteria.dates.semantic === 'checkin_window' ? criteria.dates.dateFrom ?? '' : '',
    dateTo: criteria.dates.semantic === 'checkin_window' ? criteria.dates.dateTo ?? '' : '',
  }
}

export function hotelCriteriaFromDraft(
  draft: HotelCriteriaDraft,
  criteriaVersion: string,
  source: HotelSearchCriteriaV1['source'] = 'edit',
): HotelSearchCriteriaV1 {
  return {
    schemaVersion: 1,
    criteriaVersion,
    destination: draft.city ? { state: 'selected', city: draft.city } : { state: 'all' },
    dates: draft.dateFrom || draft.dateTo
      ? { semantic: 'checkin_window', dateFrom: draft.dateFrom || undefined, dateTo: draft.dateTo || undefined }
      : { semantic: 'missing' },
    occupancy: { state: 'not_captured' },
    source,
  }
}

export function hotelCriteriaDraftChanged(criteria: HotelSearchCriteriaV1, draft: HotelCriteriaDraft): boolean {
  const active = hotelCriteriaToDraft(criteria)
  return active.city !== draft.city || active.dateFrom !== draft.dateFrom || active.dateTo !== draft.dateTo
}

export function isValidHotelDate(value: string): boolean {
  return value === '' || parseIsoDate(value) !== null
}

/** Strictly reconstructs V1 criteria. A referenced but malformed value is never
 * partially trusted or silently converted to an all-destinations search. */
export function resolveHotelSearchCriteria(source: SearchParamSource): HotelCriteriaResolution {
  const hasReference = hasSearchParam(source, 'criteriaVersion') || hasSearchParam(source, 'criteriaSchema')
  if (!hasReference) return { status: 'missing' }

  const singletonKeys = [
    'criteriaSchema', 'criteriaVersion', 'criteriaSource', 'city',
    'date_from', 'date_to', 'occupancy', 'adults', 'rooms', 'market_id', 'criteriaReturn',
  ]
  const hasAmbiguousValue = source instanceof URLSearchParams
    ? singletonKeys.some(key => source.getAll(key).length > 1)
    : singletonKeys.some(key => Array.isArray(source[key]))
  if (hasAmbiguousValue) return { status: 'invalid' }

  const schema = readSearchParam(source, 'criteriaSchema')
  const criteriaVersion = readSearchParam(source, 'criteriaVersion')
  const cityValue = readSearchParam(source, 'city')
  const dateFrom = readSearchParam(source, 'date_from') ?? ''
  const dateTo = readSearchParam(source, 'date_to') ?? ''
  const sourceValue = readSearchParam(source, 'criteriaSource') ?? 'restored'

  if (
    schema !== '1' ||
    !criteriaVersion || !CRITERIA_VERSION.test(criteriaVersion) ||
    !CRITERIA_SOURCES.includes(sourceValue as HotelSearchCriteriaV1['source']) ||
    !isValidHotelDate(dateFrom) || !isValidHotelDate(dateTo) ||
    Boolean(dateFrom && dateTo && dateTo < dateFrom) ||
    hasSearchParam(source, 'occupancy') ||
    hasSearchParam(source, 'adults') ||
    hasSearchParam(source, 'rooms') ||
    hasSearchParam(source, 'market_id') ||
    (hasSearchParam(source, 'criteriaReturn') && readSearchParam(source, 'criteriaReturn') !== 'destination') ||
    (cityValue !== null && canonicalCity(cityValue) === null)
  ) {
    return { status: 'invalid' }
  }

  const city = cityValue === null ? null : canonicalCity(cityValue)
  return {
    status: 'valid',
    criteria: {
      schemaVersion: 1,
      criteriaVersion,
      destination: city ? { state: 'selected', city } : { state: 'all' },
      dates: dateFrom || dateTo
        ? { semantic: 'checkin_window', dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }
        : { semantic: 'missing' },
      occupancy: { state: 'not_captured' },
      source: sourceValue as HotelSearchCriteriaV1['source'],
    },
  }
}

export function buildHotelResultsUrl(
  criteria: HotelSearchCriteriaV1,
  view?: Partial<HotelResultsViewState>,
): string {
  const params = new URLSearchParams({
    criteriaSchema: '1',
    criteriaVersion: criteria.criteriaVersion,
    criteriaSource: criteria.source,
  })
  if (criteria.destination.state === 'selected') params.set('city', criteria.destination.city)
  if (criteria.dates.semantic === 'checkin_window') {
    if (criteria.dates.dateFrom) params.set('date_from', criteria.dates.dateFrom)
    if (criteria.dates.dateTo) params.set('date_to', criteria.dates.dateTo)
  }
  if (view?.minDiscount !== undefined && view.minDiscount !== 20) params.set('min_discount', String(view.minDiscount))
  if (view?.maxPriceCents) params.set('max_price_cents', String(view.maxPriceCents))
  if (view?.minStars) params.set('min_stars', String(view.minStars))
  if (view?.sort && view.sort !== 'newest') params.set('sort', view.sort)
  return `/deals?${params.toString()}`
}

export function buildHotelDestinationUrl(
  criteria: HotelSearchCriteriaV1,
  view?: Partial<HotelResultsViewState>,
): string {
  if (criteria.destination.state !== 'selected') return buildHotelResultsUrl(criteria, view)
  const slug = CITY_DISPLAY_TO_SLUG[criteria.destination.city]
  if (!slug) return buildHotelResultsUrl(criteria, view)
  const query = buildHotelResultsUrl(criteria, view).split('?')[1]
  const params = new URLSearchParams(query)
  params.set('criteriaReturn', 'destination')
  return `/destinations/${slug}?${params.toString()}`
}

export function buildHotelBackUrl(
  criteria: HotelSearchCriteriaV1,
  view: HotelResultsViewState,
  source: SearchParamSource,
): string {
  return readSearchParam(source, 'criteriaReturn') === 'destination'
    ? buildHotelDestinationUrl(criteria, view)
    : buildHotelResultsUrl(criteria, view)
}

export function resolveHotelResultsView(source: SearchParamSource): HotelResultsViewState | null {
  const viewKeys = ['min_discount', 'max_price_cents', 'min_stars', 'sort']
  if (
    (source instanceof URLSearchParams && viewKeys.some(key => source.getAll(key).length > 1)) ||
    (!(source instanceof URLSearchParams) && viewKeys.some(key => Array.isArray(source[key])))
  ) return null

  const readInteger = (key: string, fallback: number): number | null => {
    const raw = readSearchParam(source, key)
    if (raw === null) return fallback
    if (!/^\d+$/.test(raw)) return null
    return Number(raw)
  }
  const minDiscount = readInteger('min_discount', 20)
  const maxPriceCents = readInteger('max_price_cents', 0)
  const minStars = readInteger('min_stars', 0)
  const sort = readSearchParam(source, 'sort') ?? 'newest'
  if (
    minDiscount === null || minDiscount < 0 || minDiscount > 90 ||
    maxPriceCents === null || maxPriceCents < 0 || maxPriceCents > 100_000_000 ||
    minStars === null || minStars < 0 || minStars > 5 ||
    !['newest', 'discount', 'price'].includes(sort)
  ) return null
  return {
    minDiscount,
    maxPriceCents: maxPriceCents || null,
    minStars,
    sort: sort as HotelResultsViewState['sort'],
  }
}

export function buildHotelDetailUrl(dealId: string, resultsUrl: string): string {
  const query = resultsUrl.split('?')[1]
  return `/deals/${encodeURIComponent(dealId)}${query ? `?${query}` : ''}`
}

export function hotelCriteriaContextStatus(
  criteria: HotelSearchCriteriaV1,
  deal: { city: string; checkInDate?: string | null },
): 'matched' | 'mismatch' {
  if (criteria.destination.state === 'selected' && canonicalCity(deal.city) !== criteria.destination.city) return 'mismatch'
  if (criteria.dates.semantic === 'missing') return 'matched'
  if (!deal.checkInDate || !parseIsoDate(deal.checkInDate.slice(0, 10))) return 'mismatch'
  const checkIn = deal.checkInDate.slice(0, 10)
  if (criteria.dates.dateFrom && checkIn < criteria.dates.dateFrom) return 'mismatch'
  if (criteria.dates.dateTo && checkIn > criteria.dates.dateTo) return 'mismatch'
  return 'matched'
}

export function createHotelCriteriaVersion(): string {
  return crypto.randomUUID()
}

export function resultCountBucket(count: number): '0' | '1_5' | '6_20' | '21_plus' {
  if (count === 0) return '0'
  if (count <= 5) return '1_5'
  if (count <= 20) return '6_20'
  return '21_plus'
}
