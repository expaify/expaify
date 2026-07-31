export type HotelTimeFitOutcome =
  | 'fits_standard'
  | 'outside_standard'
  | 'cannot_assess'

export type HotelTimeFitReason =
  | 'arrival_at_or_after_start'
  | 'arrival_before_start'
  | 'arrival_after_standard_end'
  | 'departure_at_or_before_deadline'
  | 'departure_after_deadline'
  | 'missing_scenario_time'
  | 'missing_relevant_boundary'
  | 'missing_standard_end_contract'
  | 'ambiguous_local_day'
  | 'conflicting_evidence'
  | 'malformed_time'
  | 'evidence_loading'
  | 'evidence_error'

export type HotelTimeFitPresentation = {
  outcome: HotelTimeFitOutcome
  reason: HotelTimeFitReason
  outcomeCopy: string
  comparisonCopy: string
}

type EvidenceStatus = 'confirmed' | 'unavailable' | 'not_returned' | 'unknown'

type TimeFact = {
  status: EvidenceStatus
  time?: string
  sourceLabel: string
  fetchedAt?: string
  stale?: boolean
}

/**
 * Research-only fixture shape matching the currently proposed arrival-logistics
 * contract. It deliberately has no standard check-in-end field: that fact and
 * its service-day meaning are not represented by the upstream contract yet.
 */
export type ResearchArrivalLogisticsEvidence = {
  state: 'loading' | 'ready' | 'error'
  arrivalFrom: TimeFact
  departureBy: TimeFact
  lateArrival: {
    status: EvidenceStatus
    obligation: 'contact_property_required' | 'no_action_required' | 'not_accommodated' | 'unknown'
    cutoff?: string
    sourceLabel: string
    fetchedAt?: string
  }
  evidenceRevision: string
  conflict: boolean
  conflictingFacts?: Array<{ sourceLabel: string; statement: string }>
}

export type ResearchTimeScenario = {
  kind: 'arrival' | 'departure'
  localTime?: string
  localDate?: string
  stayDate: string
  dayAssociation: 'unambiguous' | 'ambiguous'
  dstAssociation?: 'unambiguous' | 'ambiguous'
}

export const HOTEL_TIME_FIT_FIXTURE_IDS = [
  'early_arrival_request',
  'early_arrival_no_request',
  'late_obligation_only',
  'post_checkout_request',
  'early_departure_control',
  'missing_arrival_intent',
  'missing_departure_boundary',
  'conflicting_boundary',
  'arrival_at_start',
  'departure_at_deadline',
  'ambiguous_local_day',
  'malformed_time',
  'stale_boundary',
  'missing_source',
  'evidence_loading',
  'evidence_error',
] as const

export type TimeFitFixtureId = typeof HOTEL_TIME_FIT_FIXTURE_IDS[number]

export type TimeFitFixture = {
  id: TimeFitFixtureId
  label: string
  prompt: string
  scenario: ResearchTimeScenario
  evidence: ResearchArrivalLogisticsEvidence
  exceptionPath: 'early_request' | 'late_request' | 'none_published' | 'contact_obligation' | 'missing'
  deterministicRetryTo?: TimeFitFixtureId
}

const REVISION = 'research-time-fit-r1'
const SOURCE = 'Synthetic Property Policy'
const CHECKED_AT = '2026-07-29T12:00:00.000Z'

const unavailableFact = (): TimeFact => ({
  status: 'not_returned',
  sourceLabel: SOURCE,
  fetchedAt: CHECKED_AT,
})

function evidence(overrides: Partial<ResearchArrivalLogisticsEvidence> = {}): ResearchArrivalLogisticsEvidence {
  return {
    state: 'ready',
    arrivalFrom: unavailableFact(),
    departureBy: unavailableFact(),
    lateArrival: {
      status: 'not_returned',
      obligation: 'unknown',
      sourceLabel: SOURCE,
      fetchedAt: CHECKED_AT,
    },
    evidenceRevision: REVISION,
    conflict: false,
    ...overrides,
  }
}

const arrivalAtNoon: ResearchTimeScenario = {
  kind: 'arrival',
  localTime: '12:00',
  localDate: '2026-08-14',
  stayDate: '2026-08-14',
  dayAssociation: 'unambiguous',
}

const fixtureMap: Record<TimeFitFixtureId, Omit<TimeFitFixture, 'id'>> = {
  early_arrival_request: {
    label: 'Early arrival · request evidenced',
    prompt: 'You plan to arrive at the property at 12:00 PM on Aug 14. Standard room access starts at 3:00 PM.',
    scenario: arrivalAtNoon,
    evidence: evidence({ arrivalFrom: { status: 'confirmed', time: '15:00', sourceLabel: SOURCE, fetchedAt: CHECKED_AT } }),
    exceptionPath: 'early_request',
  },
  early_arrival_no_request: {
    label: 'Early arrival · no request evidence',
    prompt: 'You plan to arrive at the property at 12:00 PM on Aug 14. No exception path was returned.',
    scenario: arrivalAtNoon,
    evidence: evidence({ arrivalFrom: { status: 'confirmed', time: '15:00', sourceLabel: SOURCE, fetchedAt: CHECKED_AT } }),
    exceptionPath: 'missing',
  },
  late_obligation_only: {
    label: 'Late arrival · contact obligation only',
    prompt: 'You plan to arrive at 11:40 PM. The property says to contact it for arrivals after 10:00 PM, but publishes no separate standard end.',
    scenario: { kind: 'arrival', localTime: '23:40', localDate: '2026-08-14', stayDate: '2026-08-14', dayAssociation: 'unambiguous' },
    evidence: evidence({
      arrivalFrom: { status: 'confirmed', time: '15:00', sourceLabel: SOURCE, fetchedAt: CHECKED_AT },
      lateArrival: { status: 'confirmed', obligation: 'contact_property_required', cutoff: '22:00', sourceLabel: SOURCE, fetchedAt: CHECKED_AT },
    }),
    exceptionPath: 'contact_obligation',
  },
  post_checkout_request: {
    label: 'Post-checkout room use · request evidenced',
    prompt: 'You plan to use the room until 2:00 PM. The published room-vacate deadline is 11:00 AM.',
    scenario: { kind: 'departure', localTime: '14:00', localDate: '2026-08-17', stayDate: '2026-08-17', dayAssociation: 'unambiguous' },
    evidence: evidence({ departureBy: { status: 'confirmed', time: '11:00', sourceLabel: SOURCE, fetchedAt: CHECKED_AT } }),
    exceptionPath: 'late_request',
  },
  early_departure_control: {
    label: 'Early departure control',
    prompt: 'You plan to leave at 6:00 AM. The published room-vacate deadline is 11:00 AM.',
    scenario: { kind: 'departure', localTime: '06:00', localDate: '2026-08-17', stayDate: '2026-08-17', dayAssociation: 'unambiguous' },
    evidence: evidence({ departureBy: { status: 'confirmed', time: '11:00', sourceLabel: SOURCE, fetchedAt: CHECKED_AT } }),
    exceptionPath: 'none_published',
  },
  missing_arrival_intent: {
    label: 'Missing arrival intent',
    prompt: 'No expected property-arrival time is assigned to this scenario.',
    scenario: { kind: 'arrival', localDate: '2026-08-14', stayDate: '2026-08-14', dayAssociation: 'unambiguous' },
    evidence: evidence({ arrivalFrom: { status: 'confirmed', time: '15:00', sourceLabel: SOURCE, fetchedAt: CHECKED_AT } }),
    exceptionPath: 'missing',
  },
  missing_departure_boundary: {
    label: 'Missing departure deadline',
    prompt: 'A planned room-vacate time is assigned, but the source returned no departure deadline.',
    scenario: { kind: 'departure', localTime: '10:00', localDate: '2026-08-17', stayDate: '2026-08-17', dayAssociation: 'unambiguous' },
    evidence: evidence(),
    exceptionPath: 'missing',
  },
  conflicting_boundary: {
    label: 'Conflicting arrival boundary',
    prompt: 'Two synthetic property sources disagree about when standard room access starts.',
    scenario: arrivalAtNoon,
    evidence: evidence({
      conflict: true,
      arrivalFrom: { status: 'confirmed', time: '15:00', sourceLabel: 'Synthetic property page', fetchedAt: CHECKED_AT },
      conflictingFacts: [
        { sourceLabel: 'Synthetic property page', statement: 'Standard room access starts at 3:00 PM.' },
        { sourceLabel: 'Synthetic provider listing', statement: 'Standard room access starts at 4:00 PM.' },
      ],
    }),
    exceptionPath: 'missing',
  },
  arrival_at_start: {
    label: 'Boundary · arrival exactly at start',
    prompt: 'You plan to arrive exactly when standard room access starts.',
    scenario: { kind: 'arrival', localTime: '15:00', localDate: '2026-08-14', stayDate: '2026-08-14', dayAssociation: 'unambiguous' },
    evidence: evidence({ arrivalFrom: { status: 'confirmed', time: '15:00', sourceLabel: SOURCE, fetchedAt: CHECKED_AT } }),
    exceptionPath: 'none_published',
  },
  departure_at_deadline: {
    label: 'Boundary · departure exactly at deadline',
    prompt: 'You plan to leave exactly at the published room-vacate deadline.',
    scenario: { kind: 'departure', localTime: '11:00', localDate: '2026-08-17', stayDate: '2026-08-17', dayAssociation: 'unambiguous' },
    evidence: evidence({ departureBy: { status: 'confirmed', time: '11:00', sourceLabel: SOURCE, fetchedAt: CHECKED_AT } }),
    exceptionPath: 'none_published',
  },
  ambiguous_local_day: {
    label: 'Ambiguous local day',
    prompt: 'The arrival time cannot be associated safely with the property-local stay date.',
    scenario: { kind: 'arrival', localTime: '00:30', localDate: '2026-08-15', stayDate: '2026-08-14', dayAssociation: 'ambiguous' },
    evidence: evidence({ arrivalFrom: { status: 'confirmed', time: '15:00', sourceLabel: SOURCE, fetchedAt: CHECKED_AT } }),
    exceptionPath: 'missing',
  },
  malformed_time: {
    label: 'Malformed published time',
    prompt: 'The source returned a time that cannot be interpreted safely.',
    scenario: arrivalAtNoon,
    evidence: evidence({ arrivalFrom: { status: 'confirmed', time: '25:00', sourceLabel: SOURCE, fetchedAt: CHECKED_AT } }),
    exceptionPath: 'missing',
  },
  stale_boundary: {
    label: 'Stale arrival boundary',
    prompt: 'The upstream fixture marks the published arrival boundary as stale and unusable.',
    scenario: arrivalAtNoon,
    evidence: evidence({ arrivalFrom: { status: 'confirmed', time: '15:00', sourceLabel: SOURCE, fetchedAt: CHECKED_AT, stale: true } }),
    exceptionPath: 'missing',
  },
  missing_source: {
    label: 'Missing fact source',
    prompt: 'The arrival boundary has no source attribution and cannot be used.',
    scenario: arrivalAtNoon,
    evidence: evidence({ arrivalFrom: { status: 'confirmed', time: '15:00', sourceLabel: '', fetchedAt: CHECKED_AT } }),
    exceptionPath: 'missing',
  },
  evidence_loading: {
    label: 'Evidence loading',
    prompt: 'Published arrival and departure evidence is still being checked.',
    scenario: arrivalAtNoon,
    evidence: evidence({ state: 'loading' }),
    exceptionPath: 'missing',
  },
  evidence_error: {
    label: 'Evidence error · deterministic retry',
    prompt: 'Published evidence could not be checked. Retry transitions only to the declared early-arrival fixture.',
    scenario: arrivalAtNoon,
    evidence: evidence({ state: 'error' }),
    exceptionPath: 'missing',
    deterministicRetryTo: 'early_arrival_no_request',
  },
}

export const DISABLED_STANDARD_END_FIXTURE = {
  id: 'late_known_end_no_path',
  label: 'Late arrival · known standard end',
  enabled: false,
  reason: 'Blocked: published standard check-in end and local-day association are not represented by the upstream logistics contract.',
} as const

export function createHotelTimeFitFixture(id: TimeFitFixtureId): TimeFitFixture {
  return { id, ...fixtureMap[id] }
}

function parseTime(value: string | undefined): number | null {
  if (!value || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null
  const [hours, minutes] = value.split(':').map(Number)
  return (hours * 60) + minutes
}

export function formatLocalTime(value: string): string {
  const minutes = parseTime(value)
  if (minutes === null) return value
  const hours = Math.floor(minutes / 60)
  const minutePart = minutes % 60
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${String(minutePart).padStart(2, '0')} ${suffix}`
}

const outcomeCopy: Record<HotelTimeFitOutcome, string> = {
  fits_standard: 'Fits standard times',
  outside_standard: 'Outside standard times',
  cannot_assess: 'Cannot assess from published times',
}

function result(outcome: HotelTimeFitOutcome, reason: HotelTimeFitReason, comparisonCopy: string): HotelTimeFitPresentation {
  return { outcome, reason, outcomeCopy: outcomeCopy[outcome], comparisonCopy }
}

export function resolveHotelTimeFit(fixture: Pick<TimeFitFixture, 'scenario' | 'evidence'>): HotelTimeFitPresentation {
  const { scenario, evidence: facts } = fixture
  if (facts.state === 'loading') return result('cannot_assess', 'evidence_loading', 'Published arrival and departure times are still being checked.')
  if (facts.state === 'error') return result('cannot_assess', 'evidence_error', 'Published arrival and departure times could not be checked.')
  if (facts.conflict) return result('cannot_assess', 'conflicting_evidence', 'Published sources disagree about the time needed for this comparison.')
  if (!scenario.localTime) {
    return result('cannot_assess', 'missing_scenario_time', scenario.kind === 'arrival'
      ? 'Your expected property-arrival time is not included in this scenario.'
      : 'Your planned room-vacate time is not included in this scenario.')
  }
  if (scenario.dayAssociation === 'ambiguous' || scenario.dstAssociation === 'ambiguous' || !scenario.localDate || scenario.localDate !== scenario.stayDate) {
    return result('cannot_assess', 'ambiguous_local_day', 'The published time cannot be matched safely to the property’s local stay date.')
  }

  const scenarioMinutes = parseTime(scenario.localTime)
  const relevantFact = scenario.kind === 'arrival' ? facts.arrivalFrom : facts.departureBy
  if (scenarioMinutes === null || (relevantFact.status === 'confirmed' && parseTime(relevantFact.time) === null)) {
    return result('cannot_assess', 'malformed_time', 'A published or scenario time could not be interpreted safely.')
  }
  if (relevantFact.status !== 'confirmed' || !relevantFact.sourceLabel || relevantFact.stale) {
    const comparison = relevantFact.stale
      ? 'The published time is out of date and is not used for this comparison.'
      : scenario.kind === 'arrival'
        ? 'The property source does not publish the standard arrival boundary needed for this comparison.'
        : 'The property source does not publish a room-vacate deadline.'
    return result('cannot_assess', 'missing_relevant_boundary', comparison)
  }
  const boundaryMinutes = parseTime(relevantFact.time) as number

  // An obligation cutoff is never a proxy for the unpublished standard end.
  if (scenario.kind === 'arrival' && facts.lateArrival.status === 'confirmed' && facts.lateArrival.cutoff) {
    return result('cannot_assess', 'missing_standard_end_contract', 'The property publishes a late-arrival instruction, but the standard check-in end is not represented separately.')
  }
  if (scenario.kind === 'arrival') {
    const comparison = `You plan to arrive at ${formatLocalTime(scenario.localTime)}; standard room access starts at ${formatLocalTime(relevantFact.time as string)}.`
    return scenarioMinutes < boundaryMinutes
      ? result('outside_standard', 'arrival_before_start', comparison)
      : result('fits_standard', 'arrival_at_or_after_start', comparison)
  }
  const comparison = scenarioMinutes > boundaryMinutes
    ? `You plan to use the room until ${formatLocalTime(scenario.localTime)}; the published room-vacate deadline is ${formatLocalTime(relevantFact.time as string)}.`
    : `You plan to leave at ${formatLocalTime(scenario.localTime)}; the published room-vacate deadline is ${formatLocalTime(relevantFact.time as string)}.`
  return scenarioMinutes > boundaryMinutes
    ? result('outside_standard', 'departure_after_deadline', comparison)
    : result('fits_standard', 'departure_at_or_before_deadline', comparison)
}
