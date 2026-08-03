export const HOTEL_POOL_FIXTURE_IDS = [
  'indoor_year_round_heated_full',
  'outdoor_seasonal_full',
  'seasonal_partial',
  'seasonal_none',
  'seasonal_dates_missing',
  'stay_dates_missing',
  'indoor_heat_unknown',
  'multiple_mixed',
  'temporary_closure_overlap',
  'stale',
  'conflicting',
  'malformed_interval',
  'not_returned',
  'check_failed',
  'revision_updated',
  'year_rollover',
] as const

export type HotelPoolFixtureId = (typeof HOTEL_POOL_FIXTURE_IDS)[number]

export type PoolEvidenceState =
  | 'loading'
  | 'ready'
  | 'not_returned'
  | 'malformed'
  | 'conflicting'
  | 'stale'
  | 'check_failed'

export type PoolPresence = 'present' | 'absent' | 'not_returned' | 'unknown' | 'conflicting'
export type PoolType = 'indoor' | 'outdoor' | 'indoor_and_outdoor' | 'not_provided' | 'conflicting'
export type PoolScheduleKind = 'year_round' | 'seasonal' | 'not_provided' | 'conflicting'
export type PoolStayRelation = 'full_overlap' | 'partial_overlap' | 'no_overlap' | 'indeterminate'
export type PoolHeated = 'heated' | 'not_heated' | 'not_provided' | 'conflicting'

export type PoolDateInterval = {
  start: string
  end: string
  recurrence: 'annual' | 'one_off'
}

export type HotelPoolRecord = {
  poolId: string
  displayName?: string
  presence: PoolPresence
  type: PoolType
  scheduleKind: PoolScheduleKind
  operatingIntervals: readonly PoolDateInterval[]
  selectedStayRelation: PoolStayRelation
  heated: PoolHeated
  temporaryClosureIntervals: readonly PoolDateInterval[]
  source: {
    sourceId: string
    sourceLabel: string
    fetchedAt: string
    scope: 'property'
  }
  conflictDimensions?: readonly ('presence' | 'type' | 'schedule' | 'heated' | 'closure')[]
}

export type HotelPoolEvidence = {
  state: PoolEvidenceState
  evidenceRevision: string
  revisionStatus?: 'saved' | 'updated' | 'unavailable'
  selectedStay?: { checkIn: string; checkOut: string }
  pools: readonly HotelPoolRecord[]
  staleAsOf?: string
  fixtureId: HotelPoolFixtureId
}

const DAY = 86_400_000

function validIsoDate(value?: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)))
}

function shiftDate(value: string, days: number): string {
  return new Date(Date.parse(`${value}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)
}

export function parseHotelPoolFixture(value: string | string[] | undefined): HotelPoolFixtureId | null {
  const candidate = Array.isArray(value) ? value[0] : value
  return HOTEL_POOL_FIXTURE_IDS.find(id => id === candidate) ?? null
}

export function createHotelPoolFixtureForStay(
  fixtureId: HotelPoolFixtureId,
  checkIn?: string | null,
  nights?: number | null,
): HotelPoolEvidence {
  const start = validIsoDate(checkIn) ? Date.parse(`${checkIn}T00:00:00Z`) : NaN
  const checkOut = Number.isFinite(start) && Number.isInteger(nights) && (nights ?? 0) > 0
    ? new Date(start + (nights as number) * DAY).toISOString().slice(0, 10)
    : null
  return createHotelPoolFixture(fixtureId, checkIn, checkOut)
}

function source(stale = false) {
  return {
    sourceId: 'research-provider-property',
    sourceLabel: 'Research booking provider',
    fetchedAt: stale ? '2026-07-18T09:30:00.000Z' : '2026-08-03T14:20:00.000Z',
    scope: 'property' as const,
  }
}

function record(
  poolId: string,
  overrides: Partial<HotelPoolRecord> = {},
): HotelPoolRecord {
  return {
    poolId,
    presence: 'present',
    type: 'outdoor',
    scheduleKind: 'seasonal',
    operatingIntervals: [],
    selectedStayRelation: 'indeterminate',
    heated: 'not_provided',
    temporaryClosureIntervals: [],
    source: source(),
    ...overrides,
  }
}

export function createHotelPoolFixture(
  fixtureId: HotelPoolFixtureId,
  checkIn?: string | null,
  checkOut?: string | null,
): HotelPoolEvidence {
  const hasStay = validIsoDate(checkIn) && validIsoDate(checkOut) && Date.parse(checkOut) > Date.parse(checkIn)
  const selectedStay = hasStay ? { checkIn, checkOut } : undefined
  const stayStart = selectedStay?.checkIn ?? '2026-08-10'
  const stayEnd = selectedStay?.checkOut ?? '2026-08-14'
  const fullSeason = [{ start: shiftDate(stayStart, -30), end: shiftDate(stayEnd, 30), recurrence: 'one_off' as const }]
  const revision = `pool-fixture-${fixtureId}-v1`
  const base = { state: 'ready' as const, evidenceRevision: revision, revisionStatus: 'saved' as const, selectedStay, fixtureId }

  switch (fixtureId) {
    case 'indoor_year_round_heated_full':
      return { ...base, pools: [record('indoor-main', { displayName: 'Indoor pool', type: 'indoor', scheduleKind: 'year_round', selectedStayRelation: hasStay ? 'full_overlap' : 'indeterminate', heated: 'heated' })] }
    case 'outdoor_seasonal_full':
      return { ...base, pools: [record('outdoor-main', { displayName: 'Outdoor pool', operatingIntervals: fullSeason, selectedStayRelation: hasStay ? 'full_overlap' : 'indeterminate' })] }
    case 'seasonal_partial':
      return { ...base, pools: [record('seasonal-main', { operatingIntervals: [{ start: shiftDate(stayStart, -7), end: stayStart, recurrence: 'one_off' }], selectedStayRelation: hasStay ? 'partial_overlap' : 'indeterminate' })] }
    case 'seasonal_none':
      return { ...base, pools: [record('seasonal-main', { operatingIntervals: [{ start: shiftDate(stayStart, -60), end: shiftDate(stayStart, -30), recurrence: 'one_off' }], selectedStayRelation: hasStay ? 'no_overlap' : 'indeterminate' })] }
    case 'seasonal_dates_missing':
      return { ...base, pools: [record('seasonal-main')] }
    case 'stay_dates_missing':
      return { ...base, selectedStay: undefined, pools: [record('seasonal-main', { type: 'indoor', operatingIntervals: [{ start: '2026-06-01', end: '2026-09-30', recurrence: 'annual' }] })] }
    case 'indoor_heat_unknown':
      return { ...base, pools: [record('indoor-main', { type: 'indoor', scheduleKind: 'year_round', selectedStayRelation: hasStay ? 'full_overlap' : 'indeterminate' })] }
    case 'multiple_mixed':
      return { ...base, pools: [
        record('indoor-main', { displayName: 'Indoor pool', type: 'indoor', scheduleKind: 'year_round', selectedStayRelation: hasStay ? 'full_overlap' : 'indeterminate', heated: 'heated' }),
        record('outdoor-terrace', { displayName: 'Terrace pool', operatingIntervals: [{ start: shiftDate(stayStart, -60), end: shiftDate(stayStart, -30), recurrence: 'one_off' }], selectedStayRelation: hasStay ? 'no_overlap' : 'indeterminate' }),
      ] }
    case 'temporary_closure_overlap':
      return { ...base, pools: [record('outdoor-main', { operatingIntervals: fullSeason, selectedStayRelation: hasStay ? 'full_overlap' : 'indeterminate', temporaryClosureIntervals: [{ start: stayStart, end: shiftDate(stayStart, 1), recurrence: 'one_off' }] })] }
    case 'stale':
      return { ...base, state: 'stale', staleAsOf: '2026-07-18T09:30:00.000Z', pools: [record('outdoor-main', { operatingIntervals: fullSeason, selectedStayRelation: hasStay ? 'full_overlap' : 'indeterminate', source: source(true) })] }
    case 'conflicting':
      return { ...base, state: 'conflicting', pools: [record('pool-conflict', { type: 'conflicting', scheduleKind: 'conflicting', heated: 'heated', conflictDimensions: ['type', 'schedule'] })] }
    case 'malformed_interval':
      return { ...base, state: 'malformed', pools: [] }
    case 'not_returned':
      return { ...base, state: 'not_returned', pools: [] }
    case 'check_failed':
      return { ...base, state: 'check_failed', pools: [] }
    case 'revision_updated':
      return { ...base, evidenceRevision: 'pool-fixture-revision-updated-v2', revisionStatus: 'updated', pools: [record('indoor-main', { displayName: 'Indoor pool', type: 'indoor', scheduleKind: 'year_round', selectedStayRelation: hasStay ? 'full_overlap' : 'indeterminate', heated: 'heated' })] }
    case 'year_rollover':
      return { ...base, pools: [record('winter-outdoor', { displayName: 'Winter pool', operatingIntervals: [{ start: '2025-11-01', end: '2026-03-31', recurrence: 'annual' }], selectedStayRelation: hasStay ? 'full_overlap' : 'indeterminate' })] }
  }
}
