import type {
  HotelClimateDimension,
  HotelClimateEvidence,
  HotelClimateRow,
  HotelClimateScope,
  HotelClimateStatement,
  HotelClimateValue,
} from '@/lib/types'

const DIMENSIONS: readonly HotelClimateDimension[] = ['cooling', 'heating', 'guest_control']
const VALUES = new Set<HotelClimateValue>([
  'present', 'explicitly_absent', 'guest_adjustable', 'property_controlled',
  'not_provided', 'check_failed', 'conflicting',
])
const SCOPES = new Set<HotelClimateScope>(['property', 'room_category', 'selected_room_rate'])
const SCOPE_RANK: Record<HotelClimateScope, number> = {
  property: 0,
  room_category: 1,
  selected_room_rate: 2,
}

export type HotelClimateContext = {
  offerId: string
  roomId?: string
  rateId?: string
  checkIn?: string
  checkOut?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max && !/[\u0000-\u001f<>]/.test(value)
}

function validDate(value: unknown, now: number): value is string {
  if (typeof value !== 'string' || value.length === 0) return false
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && timestamp <= now
}

function statementValueAllowed(dimension: HotelClimateDimension, value: unknown): value is HotelClimateStatement['value'] {
  return dimension === 'guest_control'
    ? value === 'guest_adjustable' || value === 'property_controlled'
    : value === 'present' || value === 'explicitly_absent'
}

function validateStatement(
  input: unknown,
  dimension: HotelClimateDimension,
  context: HotelClimateContext | undefined,
  now: number,
): HotelClimateStatement | null {
  if (!isRecord(input) || !boundedString(input.id, 80) || !statementValueAllowed(dimension, input.value)) return null
  if (!SCOPES.has(input.scope as HotelClimateScope) || !boundedString(input.sourceLabel, 80) || !validDate(input.observedAt, now)) return null
  const scope = input.scope as HotelClimateScope
  if (input.sourceWording !== undefined && (!boundedString(input.sourceWording, 180))) return null

  if (scope === 'room_category' && (!boundedString(input.roomCategoryId, 80) || !boundedString(input.roomCategoryLabel, 80))) return null
  if (scope === 'selected_room_rate') {
    if (![input.roomId, input.rateId, input.checkIn, input.checkOut].every(value => boundedString(value, 80))) return null
    if (context && (
      input.roomId !== context.roomId || input.rateId !== context.rateId ||
      input.checkIn !== context.checkIn || input.checkOut !== context.checkOut
    )) return null
  }

  let operatingQualification: HotelClimateStatement['operatingQualification']
  if (input.operatingQualification !== undefined) {
    if (!isRecord(input.operatingQualification)) return null
    const kind = input.operatingQualification.kind
    if (kind === 'year_round' || kind === 'schedule_not_stated') operatingQualification = { kind }
    else if (kind === 'seasonal_period' && boundedString(input.operatingQualification.label, 80)) {
      operatingQualification = { kind, label: input.operatingQualification.label }
    } else return null
  }

  return {
    id: input.id,
    value: input.value,
    scope,
    sourceLabel: input.sourceLabel,
    observedAt: input.observedAt,
    ...(input.sourceWording !== undefined ? { sourceWording: input.sourceWording } : {}),
    ...(input.roomCategoryId !== undefined ? { roomCategoryId: input.roomCategoryId as string } : {}),
    ...(input.roomCategoryLabel !== undefined ? { roomCategoryLabel: input.roomCategoryLabel as string } : {}),
    ...(input.roomId !== undefined ? { roomId: input.roomId as string } : {}),
    ...(input.rateId !== undefined ? { rateId: input.rateId as string } : {}),
    ...(input.checkIn !== undefined ? { checkIn: input.checkIn as string } : {}),
    ...(input.checkOut !== undefined ? { checkOut: input.checkOut as string } : {}),
    ...(operatingQualification ? { operatingQualification } : {}),
  }
}

function validateRow(
  input: unknown,
  expectedDimension: HotelClimateDimension,
  capability: HotelClimateEvidence['capability'],
  context: HotelClimateContext | undefined,
  now: number,
): HotelClimateRow | null {
  if (!isRecord(input) || input.dimension !== expectedDimension || !VALUES.has(input.value as HotelClimateValue)) return null
  if (!Array.isArray(input.statements) || typeof input.isStale !== 'boolean') return null
  if (input.refreshFailed !== undefined && typeof input.refreshFailed !== 'boolean') return null

  if (capability === 'unsupported') {
    if (input.statements.length !== 0 || input.isStale || input.value !== 'not_provided') return null
    return { dimension: expectedDimension, value: 'not_provided', statements: [], isStale: false }
  }

  const statements = input.statements.map(statement => validateStatement(statement, expectedDimension, context, now))
  if (statements.some(statement => statement === null)) return null
  const validStatements = statements as HotelClimateStatement[]
  const value = input.value as HotelClimateValue
  const needsStatement = !['not_provided', 'check_failed'].includes(value)
  if ((needsStatement && validStatements.length === 0) || (!needsStatement && validStatements.length > 0)) return null
  if (value === 'conflicting' && validStatements.length < 2) return null
  if (value !== 'conflicting' && validStatements.some(statement => statement.value !== value)) return null

  const mostSpecificScope = validStatements.length
    ? validStatements.reduce<HotelClimateScope>((current, statement) => (
        SCOPE_RANK[statement.scope] > SCOPE_RANK[current] ? statement.scope : current
      ), validStatements[0].scope)
    : undefined
  if (input.mostSpecificScope !== undefined && input.mostSpecificScope !== mostSpecificScope) return null

  return {
    dimension: expectedDimension,
    value,
    ...(mostSpecificScope ? { mostSpecificScope } : {}),
    statements: validStatements,
    isStale: input.isStale,
    ...(input.refreshFailed === true ? { refreshFailed: true } : {}),
  }
}

export function validateHotelClimateEvidence(
  input: unknown,
  context?: HotelClimateContext,
  now = Date.now(),
): HotelClimateEvidence | null {
  if (!isRecord(input) || input.schemaVersion !== 1) return null
  if (input.capability !== 'supported' && input.capability !== 'unsupported') return null
  if (!['loading', 'ready', 'refreshing', 'failed'].includes(String(input.loadState))) return null
  if (!boundedString(input.providerId, 80) || !boundedString(input.providerPropertyId, 80) || !boundedString(input.offerId, 80)) return null
  if (!boundedString(input.evidenceRevision, 40) || !Array.isArray(input.rows) || input.rows.length !== 3) return null
  if (context && input.offerId !== context.offerId) return null

  const inputRows = input.rows as unknown[]
  const rows = DIMENSIONS.map((dimension, index) => validateRow(inputRows[index], dimension, input.capability as HotelClimateEvidence['capability'], context, now))
  if (rows.some(row => row === null)) return null

  return {
    schemaVersion: 1,
    capability: input.capability,
    loadState: input.loadState as HotelClimateEvidence['loadState'],
    providerId: input.providerId,
    providerPropertyId: input.providerPropertyId,
    offerId: input.offerId,
    evidenceRevision: input.evidenceRevision,
    rows: rows as [HotelClimateRow, HotelClimateRow, HotelClimateRow],
  }
}

export function createUnsupportedHotelClimateEvidence(
  offerId: string,
  providerId = 'other',
  providerPropertyId = offerId,
): HotelClimateEvidence {
  const row = (dimension: HotelClimateDimension): HotelClimateRow => ({
    dimension,
    value: 'not_provided',
    statements: [],
    isStale: false,
  })
  return {
    schemaVersion: 1,
    capability: 'unsupported',
    loadState: 'ready',
    providerId: providerId.trim() || 'other',
    providerPropertyId: providerPropertyId.trim() || offerId,
    offerId,
    evidenceRevision: 'unsupported-v1',
    rows: [row('cooling'), row('heating'), row('guest_control')],
  }
}

const positiveValue = (row: HotelClimateRow): boolean => (
  row.value === 'present' || row.value === 'guest_adjustable' || row.value === 'property_controlled'
)
const shortScope = (scope: HotelClimateScope): string => ({
  property: 'at property',
  room_category: 'room category',
  selected_room_rate: 'this room and rate',
})[scope]
const leastSpecificScope = (rows: HotelClimateRow[]): HotelClimateScope => rows.reduce<HotelClimateScope>((scope, row) => {
  const next = row.mostSpecificScope ?? 'property'
  return SCOPE_RANK[next] < SCOPE_RANK[scope] ? next : scope
}, 'selected_room_rate')

export function getHotelClimateResultCue(input: unknown): string | null {
  const evidence = validateHotelClimateEvidence(input)
  if (!evidence) return null
  if (evidence.loadState === 'loading') return 'Checking room climate details…'
  if (evidence.capability === 'unsupported') return 'Room climate details not supported by this provider'

  const current = evidence.rows.filter(row => !row.isStale)
  if (current.some(row => row.value === 'conflicting')) return 'Room climate details conflict · check cooling, heating, and adjustment'
  const absent = current.filter(row => row.value === 'explicitly_absent')
  if (absent.length) {
    const subject = absent.length > 1 ? 'Cooling and heating' : absent[0].dimension === 'cooling' ? 'Cooling' : 'Heating'
    return `${subject} reported absent · ${shortScope(leastSpecificScope(absent))}`
  }

  const positives = current.filter(positiveValue)
  if (positives.length === 3 && positives.every(row => row.mostSpecificScope === 'selected_room_rate')) {
    return 'Cooling, heating, and room adjustment reported · this room and rate'
  }
  const cooling = current[0]
  const heating = current[1]
  const control = current[2]
  if (positiveValue(cooling) && positiveValue(heating) && cooling.mostSpecificScope === heating.mostSpecificScope && ['not_provided', 'check_failed'].includes(control.value)) {
    return `Cooling and heating reported · ${shortScope(cooling.mostSpecificScope ?? 'property')} · adjustment not stated`
  }
  if (positives.length) {
    const names = positives.slice(0, 2).map(row => row.dimension === 'guest_control' ? 'room adjustment' : row.dimension)
    const subject = names.map((name, index) => index === 0 ? `${name[0].toUpperCase()}${name.slice(1)}` : name).join(' and ')
    return `${subject} reported · ${shortScope(leastSpecificScope(positives))}`
  }
  if (evidence.rows.some(row => row.isStale)) return 'Earlier room climate details could not be reconfirmed'
  if (evidence.rows.some(row => row.value === 'check_failed') || evidence.loadState === 'failed') return 'Some room climate details could not be checked'
  if (evidence.rows.every(row => row.value === 'not_provided')) return 'Room climate details not provided'
  return null
}

export function getHotelClimateHandoffGuidance(input: unknown): string[] {
  const evidence = validateHotelClimateEvidence(input)
  if (!evidence) return [
    'Confirm cooling for the room and rate you choose.',
    'Confirm heating for the room and rate you choose.',
    'Confirm whether you can adjust the room temperature yourself.',
  ]
  if (evidence.capability === 'unsupported') return getHotelClimateHandoffGuidance(null)

  const guidance: string[] = []
  for (const row of evidence.rows) {
    const statement = row.statements[0]
    const resolvedForRate = !row.isStale && row.value !== 'conflicting' && statement?.scope === 'selected_room_rate'
    if (resolvedForRate && row.dimension !== 'guest_control') continue
    if (resolvedForRate && row.value === 'guest_adjustable') continue

    if (row.dimension === 'guest_control') {
      if (!row.isStale && row.value === 'guest_adjustable' && statement?.scope !== 'selected_room_rate') {
        guidance.push('Confirm that guest room-temperature adjustment applies to the room and rate you choose.')
      } else guidance.push('Confirm whether you can adjust the room temperature yourself.')
      continue
    }

    const noun = row.dimension
    if (!row.isStale && statement?.scope === 'property' && row.value !== 'conflicting') {
      guidance.push(`Confirm whether ${noun} applies to the room and rate you choose.`)
    } else if (!row.isStale && statement?.scope === 'room_category' && statement.roomCategoryLabel && row.value !== 'conflicting') {
      guidance.push(`Confirm that ${statement.roomCategoryLabel} is the room and rate you choose, and recheck ${noun}.`)
    } else guidance.push(`Confirm ${noun} for the room and rate you choose.`)
  }
  return guidance
}
