import type { ReactNode } from 'react'

export type QuietEvidenceOverallState =
  | 'checking'
  | 'evidence_available'
  | 'no_evidence_returned'
  | 'check_failed'

export type EvidenceClassState =
  | 'ready'
  | 'not_returned'
  | 'insufficient_location'
  | 'stale'
  | 'malformed'
  | 'conflicting'
  | 'error'

export type QuietEvidenceScope =
  | 'selected_stay'
  | 'room_type'
  | 'property'
  | 'guest_pattern'
  | 'nearby_context'

export type SelectedStayQuietFact = {
  normalizedId: string
  rawProviderId: string
  scope: 'selected_stay' | 'room_type'
  attributeLabel: string
  sourceLabel: string
  observedAt: string
  certainty: 'supported' | 'requestable' | 'transmitted' | 'acknowledged' | 'guaranteed'
  selectedProductId?: string
  roomTypeLabel?: string
  requestReference?: string
}

export type PropertyQuietFact = {
  normalizedId: 'soundproofing_property'
  rawProviderId: string
  sourceLabel: string
  observedAt: string
}

export type GuestNoisePattern = {
  pattern:
    | 'street_or_traffic'
    | 'nightlife'
    | 'aircraft'
    | 'rail_or_transport'
    | 'corridors'
    | 'lifts'
    | 'adjoining_rooms'
    | 'property_venues_or_events'
    | 'building_systems'
  sourceLabel: string
  licensedForDisplay: true
  windowStart: string
  windowEnd: string
  observedAt: string
  reviewCount?: number
}

export type NearbyContextItem = {
  category: 'airport' | 'rail' | 'major_road' | 'nightlife'
  referencePoint: string
  distance: number
  unit: string
  method: 'straight_line'
  sourceLabel: string
  sourceUpdatedAt: string
  sourceVersion: string
  propertyLocationLabel: 'Exact address' | 'Coordinates'
}

type StaleMetadata = {
  sourceLabel: string
  sourceUpdatedAt: string
}

export type QuietStayEvidence = {
  overallState: QuietEvidenceOverallState
  selectedStayFacts: SelectedStayQuietFact[]
  propertyFacts: PropertyQuietFact[]
  guestPatterns: GuestNoisePattern[]
  nearbyContext: NearbyContextItem[]
  locationPrecision: 'exact' | 'coordinates' | 'area' | 'search_area' | 'missing'
  selectedStayState?: EvidenceClassState
  propertyFactState?: EvidenceClassState
  guestPatternState?: EvidenceClassState
  contextState?: EvidenceClassState
  staleContext?: StaleMetadata
}

export const NO_QUIET_STAY_EVIDENCE: QuietStayEvidence = {
  overallState: 'no_evidence_returned',
  selectedStayFacts: [],
  propertyFacts: [],
  guestPatterns: [],
  nearbyContext: [],
  locationPrecision: 'missing',
}

const SCOPE_CAVEAT = 'These details do not predict whether a specific room will be quiet.'
const MAX_SOURCE_LENGTH = 80
const MAX_BOUNDED_TEXT_LENGTH = 160

const patternLabels: Record<GuestNoisePattern['pattern'], string> = {
  street_or_traffic: 'street or traffic',
  nightlife: 'nightlife',
  aircraft: 'aircraft',
  rail_or_transport: 'rail or transport',
  corridors: 'corridors',
  lifts: 'lifts',
  adjoining_rooms: 'adjoining rooms',
  property_venues_or_events: 'property venues or events',
  building_systems: 'building systems',
}

const classLabels: Record<Exclude<QuietEvidenceScope, 'none'>, string> = {
  selected_stay: 'Selected stay',
  room_type: 'Room type',
  property: 'Property',
  guest_pattern: 'Guest reports',
  nearby_context: 'Nearby context',
}

function validBoundedText(value: unknown, maxLength = MAX_BOUNDED_TEXT_LENGTH): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength
}

function validSourceLabel(value: unknown): value is string {
  return validBoundedText(value, MAX_SOURCE_LENGTH)
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && timestamp <= Date.now()
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function validSelectedStayFact(fact: SelectedStayQuietFact): boolean {
  if (
    !validBoundedText(fact.normalizedId) ||
    !validBoundedText(fact.rawProviderId) ||
    !validBoundedText(fact.attributeLabel) ||
    !validSourceLabel(fact.sourceLabel) ||
    !validDate(fact.observedAt)
  ) return false

  if (fact.scope === 'room_type') {
    if (!validBoundedText(fact.roomTypeLabel) || !validBoundedText(fact.selectedProductId)) return false
    return fact.certainty === 'supported' || fact.certainty === 'requestable'
  }

  if (fact.certainty === 'transmitted') {
    return validBoundedText(fact.requestReference, 60)
  }

  return fact.certainty === 'supported' || fact.certainty === 'requestable' ||
    fact.certainty === 'acknowledged' || fact.certainty === 'guaranteed'
}

function validPropertyFact(fact: PropertyQuietFact): boolean {
  return fact.normalizedId === 'soundproofing_property' &&
    validBoundedText(fact.rawProviderId) &&
    validSourceLabel(fact.sourceLabel) &&
    validDate(fact.observedAt)
}

function validGuestPattern(item: GuestNoisePattern): boolean {
  if (
    item.licensedForDisplay !== true ||
    !(item.pattern in patternLabels) ||
    !validSourceLabel(item.sourceLabel) ||
    !validDate(item.windowStart) ||
    !validDate(item.windowEnd) ||
    !validDate(item.observedAt) ||
    Date.parse(item.windowStart) > Date.parse(item.windowEnd)
  ) return false

  return item.reviewCount === undefined || (Number.isInteger(item.reviewCount) && item.reviewCount > 0)
}

function validNearbyContext(item: NearbyContextItem): boolean {
  return (
    ['airport', 'rail', 'major_road', 'nightlife'].includes(item.category) &&
    validBoundedText(item.referencePoint) &&
    validBoundedText(item.unit, 24) &&
    item.method === 'straight_line' &&
    validSourceLabel(item.sourceLabel) &&
    validDate(item.sourceUpdatedAt) &&
    validBoundedText(item.sourceVersion) &&
    Number.isFinite(item.distance) &&
    item.distance >= 0 &&
    (item.propertyLocationLabel === 'Exact address' || item.propertyLocationLabel === 'Coordinates')
  )
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter(item => {
    const value = key(item)
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}

function validItems(evidence: QuietStayEvidence) {
  const selectedStayFacts = evidence.selectedStayState && !['ready', 'conflicting'].includes(evidence.selectedStayState)
    ? []
    : uniqueBy(evidence.selectedStayFacts.filter(validSelectedStayFact), fact => `${fact.normalizedId}:${fact.sourceLabel}:${fact.scope}`)
        .sort((a, b) => (a.scope === b.scope ? 0 : a.scope === 'selected_stay' ? -1 : 1))
  const propertyFacts = evidence.propertyFactState && !['ready', 'conflicting'].includes(evidence.propertyFactState)
    ? []
    : uniqueBy(evidence.propertyFacts.filter(validPropertyFact), fact => `${fact.normalizedId}:${fact.sourceLabel}`)
  const guestPatterns = evidence.guestPatternState && !['ready', 'conflicting'].includes(evidence.guestPatternState)
    ? []
    : uniqueBy(evidence.guestPatterns.filter(validGuestPattern), item => `${item.pattern}:${item.sourceLabel}`)
  const contextEligible = evidence.locationPrecision === 'exact' || evidence.locationPrecision === 'coordinates'
  const nearbyContext = contextEligible && (!evidence.contextState || ['ready', 'conflicting'].includes(evidence.contextState))
    ? uniqueBy(evidence.nearbyContext.filter(validNearbyContext), item => `${item.category}:${item.referencePoint}:${item.sourceLabel}`)
    : []

  return { selectedStayFacts, propertyFacts, guestPatterns, nearbyContext, contextEligible }
}

export function getStrongestQuietEvidenceClass(evidence?: QuietStayEvidence): QuietEvidenceScope | 'none' {
  if (!evidence || evidence.overallState !== 'evidence_available') return 'none'
  const items = validItems(evidence)
  if (items.selectedStayFacts.some(fact => fact.scope === 'selected_stay')) return 'selected_stay'
  if (items.selectedStayFacts.some(fact => fact.scope === 'room_type')) return 'room_type'
  if (items.propertyFacts.length > 0) return 'property'
  if (items.guestPatterns.length > 0) return 'guest_pattern'
  if (items.nearbyContext.length > 0) return 'nearby_context'
  return 'none'
}

export function getQuietEvidenceResultCue(evidence?: QuietStayEvidence): string | null {
  const strongestClass = getStrongestQuietEvidenceClass(evidence)
  return strongestClass === 'none'
    ? null
    : `Quiet-stay evidence available · ${classLabels[strongestClass]}`
}

function EvidenceItem({ children }: { children: ReactNode }) {
  return (
    <li className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3">
      {children}
    </li>
  )
}

function SelectedStayItem({ fact }: { fact: SelectedStayQuietFact }) {
  const date = formatDate(fact.observedAt)
  let claim: string
  let metadata: string

  if (fact.certainty === 'requestable') {
    claim = 'A quieter room can be requested. Nothing has been sent by expaify, and requests depend on availability.'
    metadata = `Request capability from ${fact.sourceLabel.trim()} · Checked ${date}`
  } else if (fact.certainty === 'transmitted') {
    claim = 'The booking provider says it sent your quieter-room request.'
    metadata = `Request receipt from ${fact.sourceLabel.trim()} · ${fact.requestReference?.trim()} · ${date}`
  } else if (fact.certainty === 'acknowledged') {
    claim = 'The property acknowledged your quieter-room request.'
    metadata = `Acknowledgment via ${fact.sourceLabel.trim()} · ${date}`
  } else if (fact.scope === 'room_type') {
    claim = `Provider lists soundproofing for ${fact.roomTypeLabel?.trim()}. Confirm this room type is selected before payment.`
    metadata = `${fact.roomTypeLabel?.trim()} · Room information from ${fact.sourceLabel.trim()} · Updated ${date}`
  } else {
    claim = `The provider confirms ${fact.attributeLabel.trim()} for this selected stay.`
    metadata = `Selected stay confirmed by ${fact.sourceLabel.trim()} · Checked ${date}`
  }

  return (
    <EvidenceItem>
      <p className="break-words text-sm leading-6 text-[color:var(--text-1)]">{claim}</p>
      <p className="mt-2 break-words text-caption leading-5 text-[color:var(--text-3)]">{metadata}</p>
    </EvidenceItem>
  )
}

function PropertyFactItem({ fact }: { fact: PropertyQuietFact }) {
  return (
    <EvidenceItem>
      <p className="text-sm leading-6 text-[color:var(--text-1)]">Provider lists soundproofing for this property. It may not apply to every room.</p>
      <p className="mt-2 break-words text-caption leading-5 text-[color:var(--text-3)]">
        Property information from {fact.sourceLabel.trim()} · Updated {formatDate(fact.observedAt)}
      </p>
    </EvidenceItem>
  )
}

function GuestPatternItem({ item }: { item: GuestNoisePattern }) {
  const window = `${formatDate(item.windowStart)}–${formatDate(item.windowEnd)}`
  return (
    <EvidenceItem>
      <p className="text-sm leading-6 text-[color:var(--text-1)]">
        Guests mention {patternLabels[item.pattern]}. Summary of guest reviews via {item.sourceLabel.trim()}.
      </p>
      <p className="mt-2 break-words text-caption leading-5 text-[color:var(--text-3)]">
        {item.reviewCount === undefined
          ? `Guest review window: ${window}`
          : `Based on ${item.reviewCount.toLocaleString('en-US')} guest reviews from ${window}`}
      </p>
    </EvidenceItem>
  )
}

function NearbyContextEntry({ item }: { item: NearbyContextItem }) {
  return (
    <EvidenceItem>
      <p className="break-words text-sm leading-6 text-[color:var(--text-1)]">
        {item.referencePoint.trim()} is {item.distance.toLocaleString('en-US')} {item.unit.trim()} away in a straight line. Proximity does not predict noise in a specific room.
      </p>
      <p className="mt-2 break-words text-caption leading-5 text-[color:var(--text-3)]">
        Nearby data from {item.sourceLabel.trim()} · Updated {formatDate(item.sourceUpdatedAt)} · Property location: {item.propertyLocationLabel}
      </p>
    </EvidenceItem>
  )
}

function ClassMessage({ children }: { children: string }) {
  return <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">{children}</p>
}

function EvidenceGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-4 first:pt-0 last:pb-0">
      <h4 className="text-sm font-medium leading-5 text-[color:var(--text-1)]">{title}</h4>
      {children}
    </section>
  )
}

function classMessage(
  state: EvidenceClassState | undefined,
  copy: { notReturned: string; stale: string; malformed: string; error: string; insufficient?: string },
): string | null {
  if (state === 'error') return copy.error
  if (state === 'malformed') return copy.malformed
  if (state === 'stale') return copy.stale
  if (state === 'insufficient_location') return copy.insufficient ?? copy.notReturned
  if (state === 'not_returned') return copy.notReturned
  return null
}

function ledgerStatus(evidence: QuietStayEvidence, statusClass: string) {
  if (evidence.overallState === 'evidence_available') return null
  const status = {
    checking: 'Checking quiet-stay evidence…',
    no_evidence_returned: 'Quiet-stay details were not provided by this hotel source. Location and rating do not tell us whether a room will be quiet.',
    check_failed: 'Quiet-stay evidence could not be checked. Confirm room location, soundproofing, and current surroundings with the booking partner.',
  }[evidence.overallState]
  const isLive = evidence.overallState === 'checking' || evidence.overallState === 'check_failed'
  return (
    <p className={statusClass} role={isLive ? 'status' : undefined} aria-live={isLive ? 'polite' : undefined} aria-atomic={isLive ? 'true' : undefined}>
      {status}
    </p>
  )
}

export function QuietStayEvidenceLedger({ evidence }: { evidence: QuietStayEvidence }) {
  const statusClass = 'mt-4 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-base)] px-3.5 py-3 text-sm leading-6 text-[color:var(--text-2)]'
  const items = validItems(evidence)
  const hasValidItems = getStrongestQuietEvidenceClass(evidence) !== 'none'
  const effectiveEvidence = evidence.overallState === 'evidence_available' && !hasValidItems
    ? { ...evidence, overallState: 'check_failed' as const }
    : evidence

  if (effectiveEvidence.overallState !== 'evidence_available') {
    return (
      <section
        aria-labelledby="quiet-stay-title"
        aria-busy={effectiveEvidence.overallState === 'checking' ? true : undefined}
        className="mt-5 min-w-0 border-t border-[color:var(--border)] pt-5"
      >
        <h3 id="quiet-stay-title" className="text-h3 text-[color:var(--text-1)]">Quiet-stay evidence</h3>
        <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">{SCOPE_CAVEAT}</p>
        {ledgerStatus(effectiveEvidence, statusClass)}
      </section>
    )
  }

  const selectedState = evidence.selectedStayState ?? (
    evidence.selectedStayFacts.length > 0 && items.selectedStayFacts.length === 0 ? 'malformed' : undefined
  )
  const propertyState = evidence.propertyFactState ?? (
    evidence.propertyFacts.length > 0 && items.propertyFacts.length === 0 ? 'malformed' : undefined
  )
  const guestState = evidence.guestPatternState ?? (
    evidence.guestPatterns.length > 0 && items.guestPatterns.length === 0 ? 'malformed' : undefined
  )
  const contextState = evidence.contextState ?? (
    !items.contextEligible
      ? 'insufficient_location'
      : evidence.nearbyContext.length > 0 && items.nearbyContext.length === 0
        ? 'malformed'
        : undefined
  )
  const selectedMessage = classMessage(selectedState, {
    notReturned: 'No selected-room or selected-stay quiet-stay detail was provided.',
    stale: 'Selected-room or selected-stay details are out of date and are not shown.',
    malformed: 'Some selected-room or selected-stay details could not be verified and are not shown.',
    error: 'Selected-room or selected-stay details could not be checked.',
  })
  const propertyMessage = classMessage(propertyState, {
    notReturned: 'No property-level quiet-stay fact was provided.',
    stale: 'Property quiet-stay details are out of date and are not shown.',
    malformed: 'Some property quiet-stay details could not be verified and are not shown.',
    error: 'Property quiet-stay details could not be checked.',
  })
  const guestMessage = classMessage(guestState, {
    notReturned: 'No licensed guest noise pattern was provided.',
    stale: 'Guest noise patterns are out of date and are not shown.',
    malformed: 'Some guest-pattern details could not be verified and are not shown.',
    error: 'Guest noise patterns could not be checked.',
  })
  const contextMessage = classMessage(contextState, {
    notReturned: 'No usable nearby context was provided.',
    insufficient: 'Property-level proximity cannot be calculated from the area information provided.',
    stale: 'Nearby context is out of date and is not shown.',
    malformed: 'Some nearby details could not be verified and are not shown.',
    error: 'Nearby context could not be checked.',
  })
  const hasConflict = [selectedState, propertyState, guestState, contextState].includes('conflicting')

  return (
    <section aria-labelledby="quiet-stay-title" className="mt-5 min-w-0 border-t border-[color:var(--border)] pt-5">
      <h3 id="quiet-stay-title" className="text-h3 text-[color:var(--text-1)]">Quiet-stay evidence</h3>
      <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">{SCOPE_CAVEAT}</p>
      {hasConflict ? <p className={statusClass}>Sources differ. Review each source before deciding.</p> : null}

      <div className="mt-5 divide-y divide-[color:var(--border)]">
        <EvidenceGroup title="Selected room or stay">
          {selectedMessage ? <ClassMessage>{selectedMessage}</ClassMessage> : items.selectedStayFacts.length ? (
            <ul className="mt-3 space-y-3">{items.selectedStayFacts.map(fact => <SelectedStayItem key={`${fact.normalizedId}:${fact.sourceLabel}`} fact={fact} />)}</ul>
          ) : <ClassMessage>No selected-room or selected-stay quiet-stay detail was provided.</ClassMessage>}
        </EvidenceGroup>
        <EvidenceGroup title="Property facts">
          {propertyMessage ? <ClassMessage>{propertyMessage}</ClassMessage> : items.propertyFacts.length ? (
            <ul className="mt-3 space-y-3">{items.propertyFacts.map(fact => <PropertyFactItem key={`${fact.normalizedId}:${fact.sourceLabel}`} fact={fact} />)}</ul>
          ) : <ClassMessage>No property-level quiet-stay fact was provided.</ClassMessage>}
        </EvidenceGroup>
        <EvidenceGroup title="Guest-reported patterns">
          {guestMessage ? <ClassMessage>{guestMessage}</ClassMessage> : items.guestPatterns.length ? (
            <ul className="mt-3 space-y-3">{items.guestPatterns.map(item => <GuestPatternItem key={`${item.pattern}:${item.sourceLabel}`} item={item} />)}</ul>
          ) : <ClassMessage>No licensed guest noise pattern was provided.</ClassMessage>}
        </EvidenceGroup>
        <EvidenceGroup title="Nearby context">
          {contextMessage || !items.contextEligible ? (
            <ClassMessage>{contextMessage ?? 'Property-level proximity cannot be calculated from the area information provided.'}</ClassMessage>
          ) : items.nearbyContext.length ? (
            <ul className="mt-3 space-y-3">{items.nearbyContext.map(item => <NearbyContextEntry key={`${item.category}:${item.referencePoint}:${item.sourceLabel}`} item={item} />)}</ul>
          ) : <ClassMessage>No usable nearby context was provided.</ClassMessage>}
          {evidence.contextState === 'stale' && evidence.staleContext && validSourceLabel(evidence.staleContext.sourceLabel) && validDate(evidence.staleContext.sourceUpdatedAt) ? (
            <p className="mt-2 break-words text-caption leading-5 text-[color:var(--text-3)]">
              Last source update: {formatDate(evidence.staleContext.sourceUpdatedAt)} · {evidence.staleContext.sourceLabel.trim()}
            </p>
          ) : null}
        </EvidenceGroup>
      </div>
    </section>
  )
}

export function QuietStayEvidenceHandoff({
  evidence,
  selectedProductId,
}: {
  evidence?: QuietStayEvidence
  selectedProductId?: string
}) {
  if (!evidence || evidence.overallState !== 'evidence_available') return null
  const items = validItems(evidence)
  const applicableSelectedFacts = items.selectedStayFacts.filter(fact => (
    fact.scope === 'selected_stay' ||
    (fact.scope === 'room_type' && validBoundedText(selectedProductId) && fact.selectedProductId === selectedProductId)
  ))
  const hasApplicableEvidence = applicableSelectedFacts.length > 0 || items.propertyFacts.length > 0 ||
    items.guestPatterns.length > 0 || items.nearbyContext.length > 0
  if (!hasApplicableEvidence) return null

  return (
    <section aria-labelledby="quiet-stay-handoff-title" className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6">
      <h2 id="quiet-stay-handoff-title" className="text-xl font-medium leading-tight text-[color:var(--text-1)] sm:text-2xl">Quiet-stay evidence for this choice</h2>
      <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">{SCOPE_CAVEAT}</p>
      <ul className="mt-4 space-y-3">
        {applicableSelectedFacts.map(fact => <SelectedStayItem key={`${fact.normalizedId}:${fact.sourceLabel}`} fact={fact} />)}
        {items.propertyFacts.map(fact => <PropertyFactItem key={`${fact.normalizedId}:${fact.sourceLabel}`} fact={fact} />)}
        {items.guestPatterns.map(item => <GuestPatternItem key={`${item.pattern}:${item.sourceLabel}`} item={item} />)}
        {items.nearbyContext.map(item => <NearbyContextEntry key={`${item.category}:${item.referencePoint}:${item.sourceLabel}`} item={item} />)}
      </ul>
    </section>
  )
}
