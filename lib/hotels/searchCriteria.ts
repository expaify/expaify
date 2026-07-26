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

export function resultCountBucket(count: number): '0' | '1_5' | '6_20' | '21_plus' {
  if (count === 0) return '0'
  if (count <= 5) return '1_5'
  if (count <= 20) return '6_20'
  return '21_plus'
}
