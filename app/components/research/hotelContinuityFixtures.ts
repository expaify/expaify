export type PrototypeContextState = 'ineligible' | 'loading' | 'eligible' | 'error'

export type ContextIneligibilityReason =
  | 'source_not_authoritative'
  | 'impact_not_explicit'
  | 'geography_no_match'
  | 'stay_no_overlap'
  | 'missing_expiry'
  | 'resolved_or_cancelled'
  | 'fetch_too_old'

export type PrototypePropertyEvidenceState =
  | 'loading'
  | 'missing'
  | 'partial'
  | 'confirmed'
  | 'stale'
  | 'conflict'
  | 'error'

export type ContinuitySignal =
  | 'backup_power'
  | 'connectivity_continuity'
  | 'essential_service'
  | 'current_operating_status'
  | 'selected_stay_confirmation'

export type EvidenceScope = 'property' | 'room' | 'rate' | 'selected_stay'

export type PrototypeDestinationContext = {
  state: PrototypeContextState
  ineligibilityReason?: ContextIneligibilityReason
  eventId?: string
  exactArea?: string
  impactType?: 'electricity' | 'connectivity' | 'electricity_and_connectivity'
  authorityName?: string
  authorityUrl?: string
  effectiveAt?: string
  expiresAt?: string
  fetchedAt?: string
  lifecycle?: 'active' | 'updated' | 'resolved' | 'cancelled'
}

export type PrototypeContinuityFact = {
  id: string
  signal: ContinuitySignal
  title: string
  documentedClaim: string
  scope: EvidenceScope
  supportedServices: string[]
  unsupportedOrUndocumentedServices: string[]
  runtimeOrCapacity: string | null
  powerDependency?: string
  verificationMethod: string
  verifiedAt: string
  expiresAt?: string
  sourceName: string
  sourceClass: 'property' | 'provider' | 'auditor' | 'authority'
  sourceUrl: string
  supersededAt?: string
  contradictionIds?: string[]
}

export type PrototypeContinuityDisclosure = {
  context: PrototypeDestinationContext
  propertyState: PrototypePropertyEvidenceState
  facts: PrototypeContinuityFact[]
  hotelContactHref?: string
}

export type ContinuityFixtureId =
  | 'control'
  | 'confirmed'
  | 'missing'
  | 'partial'
  | 'stale'
  | 'conflict'
  | 'property-error'
  | 'context-loading'
  | 'property-loading'
  | 'context-error'
  | 'resolved'
  | 'no-overlap'

const FIXTURE_IDS = new Set<ContinuityFixtureId>([
  'control',
  'confirmed',
  'missing',
  'partial',
  'stale',
  'conflict',
  'property-error',
  'context-loading',
  'property-loading',
  'context-error',
  'resolved',
  'no-overlap',
])

// Research thresholds from design section 5.3. These are prototype gates, not
// production configuration and must not be reused for ranking or Deal Score.
export const RESEARCH_MAX_AGE_DAYS: Record<ContinuitySignal, number> = {
  backup_power: 180,
  connectivity_continuity: 90,
  essential_service: 90,
  current_operating_status: 1,
  selected_stay_confirmation: 7,
}

const RESEARCH_SOURCE_ORIGIN = 'https://example.com'
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function parseContinuityFixture(value: string | string[] | undefined): ContinuityFixtureId {
  const candidate = Array.isArray(value) ? value[0] : value
  return candidate && FIXTURE_IDS.has(candidate as ContinuityFixtureId)
    ? candidate as ContinuityFixtureId
    : 'control'
}

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

function factAgeMs(signal: ContinuitySignal): number {
  return RESEARCH_MAX_AGE_DAYS[signal] * DAY_MS
}

function validResearchUrl(value?: string): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.origin === RESEARCH_SOURCE_ORIGIN
  } catch {
    return false
  }
}

function contextIsEligible(context: PrototypeDestinationContext, stayStartMs: number, stayEndMs: number, nowMs: number): boolean {
  if (context.state !== 'eligible' || context.lifecycle === 'resolved' || context.lifecycle === 'cancelled') return false
  if (!context.eventId || !context.exactArea || !context.impactType || !context.authorityName || !validResearchUrl(context.authorityUrl)) return false
  if (!context.effectiveAt || !context.expiresAt || !context.fetchedAt) return false

  const effectiveMs = Date.parse(context.effectiveAt)
  const expiresMs = Date.parse(context.expiresAt)
  const fetchedMs = Date.parse(context.fetchedAt)
  if (![effectiveMs, expiresMs, fetchedMs].every(Number.isFinite)) return false
  if (nowMs - fetchedMs > FIFTEEN_MINUTES_MS || fetchedMs > nowMs) return false
  return effectiveMs <= stayEndMs && expiresMs >= stayStartMs
}

function baseContext(stayStartMs: number, stayEndMs: number, nowMs: number): PrototypeDestinationContext {
  return {
    state: 'eligible',
    eventId: 'research-event-001',
    exactArea: 'Research District East electricity service area',
    impactType: 'electricity_and_connectivity',
    authorityName: 'Research Utility Authority',
    authorityUrl: `${RESEARCH_SOURCE_ORIGIN}/research/disruption-source`,
    effectiveAt: iso(Math.min(stayStartMs, nowMs - 5 * 60 * 1000)),
    expiresAt: iso(Math.max(stayEndMs, nowMs + DAY_MS)),
    fetchedAt: iso(nowMs - 5 * 60 * 1000),
    lifecycle: 'updated',
  }
}

function backupFact(nowMs: number, ageDays = 30): PrototypeContinuityFact {
  return {
    id: 'backup-power-001',
    signal: 'backup_power',
    title: 'Backup power',
    documentedClaim: 'A property inspection documented a standby generator serving the front desk, one elevator, and corridor lighting.',
    scope: 'property',
    supportedServices: ['Front desk', 'One elevator', 'Corridor lighting'],
    unsupportedOrUndocumentedServices: ['Guest-room outlets', 'Air conditioning', 'In-room internet equipment'],
    runtimeOrCapacity: 'Up to 8 hours at the documented inspection load',
    verificationMethod: 'On-site equipment inspection and load schedule review',
    verifiedAt: iso(nowMs - ageDays * DAY_MS),
    sourceName: 'Research Property Auditor',
    sourceClass: 'auditor',
    sourceUrl: `${RESEARCH_SOURCE_ORIGIN}/research/backup-power-evidence`,
  }
}

function partialConnectivityFact(nowMs: number): PrototypeContinuityFact {
  return {
    id: 'connectivity-partial-001',
    signal: 'connectivity_continuity',
    title: 'Connectivity continuity',
    documentedClaim: 'The property source documents a secondary internet carrier, but does not document independent routing or equipment power continuity.',
    scope: 'property',
    supportedServices: ['Lobby internet access'],
    unsupportedOrUndocumentedServices: ['Independent network paths', 'Guest-room internet access'],
    runtimeOrCapacity: null,
    powerDependency: 'Not documented by this source.',
    verificationMethod: 'Property network inventory supplied for research review',
    verifiedAt: iso(nowMs - 20 * DAY_MS),
    sourceName: 'Research Hotel Operations File',
    sourceClass: 'property',
    sourceUrl: `${RESEARCH_SOURCE_ORIGIN}/research/connectivity-evidence`,
  }
}

function conflictFacts(nowMs: number): PrototypeContinuityFact[] {
  const first = backupFact(nowMs, 12)
  first.id = 'conflict-property-001'
  first.documentedClaim = 'The property operations file reports that the standby generator passed its scheduled load test.'
  first.sourceName = 'Research Hotel Operations File'
  first.sourceClass = 'property'
  first.sourceUrl = `${RESEARCH_SOURCE_ORIGIN}/research/property-source`
  first.contradictionIds = ['conflict-auditor-002']

  const second = backupFact(nowMs, 10)
  second.id = 'conflict-auditor-002'
  second.documentedClaim = 'The independent inspection file reports that the same standby generator did not complete its scheduled load test.'
  second.sourceName = 'Research Property Auditor'
  second.sourceUrl = `${RESEARCH_SOURCE_ORIGIN}/research/auditor-source`
  second.contradictionIds = ['conflict-property-001']
  return [first, second]
}

export function createContinuityFixture(
  fixtureId: ContinuityFixtureId,
  stayStart: string | null,
  stayEnd: string | null,
  nowMs = Date.now(),
): PrototypeContinuityDisclosure | null {
  const parsedStart = stayStart ? Date.parse(stayStart) : NaN
  const parsedEnd = stayEnd ? Date.parse(stayEnd) : NaN
  const stayStartMs = Number.isFinite(parsedStart) ? parsedStart : nowMs
  const stayEndMs = Number.isFinite(parsedEnd) && parsedEnd >= stayStartMs ? parsedEnd : stayStartMs + DAY_MS

  if (fixtureId === 'control') return null
  if (fixtureId === 'context-loading') {
    return { context: { state: 'loading' }, propertyState: 'loading', facts: [] }
  }
  if (fixtureId === 'context-error') {
    return { context: { state: 'error' }, propertyState: 'error', facts: [] }
  }
  if (fixtureId === 'resolved') return null
  if (fixtureId === 'no-overlap') return null

  const context = baseContext(stayStartMs, stayEndMs, nowMs)
  if (!contextIsEligible(context, stayStartMs, stayEndMs, nowMs)) return null

  if (fixtureId === 'confirmed') {
    return { context, propertyState: 'confirmed', facts: [backupFact(nowMs)] }
  }
  if (fixtureId === 'missing') {
    return { context, propertyState: 'missing', facts: [] }
  }
  if (fixtureId === 'partial') {
    return { context, propertyState: 'partial', facts: [partialConnectivityFact(nowMs)] }
  }
  if (fixtureId === 'stale') {
    const fact = backupFact(nowMs, 181)
    if (nowMs - Date.parse(fact.verifiedAt) <= factAgeMs(fact.signal)) return null
    return { context, propertyState: 'stale', facts: [fact] }
  }
  if (fixtureId === 'conflict') {
    return { context, propertyState: 'conflict', facts: conflictFacts(nowMs) }
  }
  if (fixtureId === 'property-error') {
    return { context, propertyState: 'error', facts: [] }
  }
  return { context, propertyState: 'loading', facts: [] }
}
