export type DealSearchFilters = {
  destination_type?: 'hotel'
  city?: string
  max_price?: number
  min_stars?: number
  min_discount?: number
  date_from?: string
  date_to?: string
}

export type DealSearchParseResult =
  | { ok: true; filters: DealSearchFilters }
  | { ok: false; reason: string }

export const DEAL_SEARCH_CITIES = [
  'Miami', 'New York', 'Cancún', 'Paris', 'Rome', 'Barcelona', 'Lisbon',
  'London', 'Tokyo', 'Bangkok', 'Dubai', 'Las Vegas', 'Orlando', 'San Juan',
  'Tulum', 'Amsterdam', 'Athens', 'Punta Cana', 'Charlotte', 'Nashville',
] as const

const citySet = new Set<string>(DEAL_SEARCH_CITIES)
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const allowedKeys = ['destination_type', 'city', 'max_price', 'min_stars', 'min_discount', 'date_from', 'date_to'] as const

export const DEAL_SEARCH_FILTER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    destination_type: { type: ['string', 'null'], enum: ['hotel', null] },
    city: { type: ['string', 'null'], enum: [...DEAL_SEARCH_CITIES, null] },
    max_price: { type: ['integer', 'null'], minimum: 1, maximum: 100000 },
    min_stars: { type: ['integer', 'null'], minimum: 1, maximum: 5 },
    min_discount: { type: ['integer', 'null'], minimum: 0, maximum: 99 },
    date_from: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    date_to: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
  },
  required: allowedKeys,
} as const

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !datePattern.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function validInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

export function validateDealSearchFilters(input: unknown): DealSearchParseResult {
  if (!isPlainObject(input)) return { ok: false, reason: 'not an object' }

  const allowed = new Set<string>(allowedKeys)
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) return { ok: false, reason: `unknown key: ${key}` }
  }

  const filters: DealSearchFilters = {}

  if (input.destination_type !== undefined) {
    if (input.destination_type !== 'hotel') return { ok: false, reason: 'destination_type must be hotel' }
    filters.destination_type = 'hotel'
  }

  if (input.city !== undefined) {
    if (typeof input.city !== 'string' || !citySet.has(input.city)) return { ok: false, reason: 'unsupported city' }
    filters.city = input.city
  }

  if (input.max_price !== undefined) {
    if (!validInteger(input.max_price, 1, 100000)) return { ok: false, reason: 'max_price must be an integer dollar amount' }
    filters.max_price = input.max_price
  }

  if (input.min_stars !== undefined) {
    if (!validInteger(input.min_stars, 1, 5)) return { ok: false, reason: 'min_stars must be 1-5' }
    filters.min_stars = input.min_stars
  }

  if (input.min_discount !== undefined) {
    if (!validInteger(input.min_discount, 0, 99)) return { ok: false, reason: 'min_discount must be 0-99' }
    filters.min_discount = input.min_discount
  }

  if (input.date_from !== undefined) {
    if (!validDate(input.date_from)) return { ok: false, reason: 'date_from must be YYYY-MM-DD' }
    filters.date_from = input.date_from
  }

  if (input.date_to !== undefined) {
    if (!validDate(input.date_to)) return { ok: false, reason: 'date_to must be YYYY-MM-DD' }
    filters.date_to = input.date_to
  }

  if (filters.date_from && filters.date_to && filters.date_to < filters.date_from) {
    return { ok: false, reason: 'date_to must be on or after date_from' }
  }

  return { ok: true, filters }
}

export function normalizeDealSearchFilterInput(input: unknown): Record<string, unknown> | null {
  if (!isPlainObject(input)) return null

  const normalized: Record<string, unknown> = {}
  for (const key of allowedKeys) {
    const value = input[key]
    if (value !== undefined && value !== null && value !== '') {
      normalized[key] = value
    }
  }
  return normalized
}

export function hasDealSearchFilters(filters: DealSearchFilters): boolean {
  return Object.keys(filters).some(key => filters[key as keyof DealSearchFilters] !== undefined)
}
