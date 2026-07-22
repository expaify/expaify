import type { ReactNode } from 'react'

type QuietEvidenceOverallState =
  | 'checking'
  | 'evidence_available'
  | 'no_evidence_returned'
  | 'check_failed'

type EvidenceClassState =
  | 'ready'
  | 'not_returned'
  | 'insufficient_location'
  | 'stale'
  | 'conflicting'
  | 'error'

type ProviderQuietFact = {
  id: 'soundproofing_property' | 'soundproofing_room' | 'quiet_room_option'
  scope: 'property' | 'room_type' | 'selected_stay'
  certainty: 'supported' | 'requestable' | 'guaranteed'
  sourceLabel: string
  fetchedAt: string
  roomTypeLabel?: string
}

type NearbyContextItem = {
  category: 'airport' | 'rail' | 'major_road' | 'nightlife'
  referencePoint: string
  distance: number
  unit: string
  method: 'straight_line' | string
  sourceLabel: string
  sourceUpdatedAt: string
  propertyLocationLabel: 'Exact address' | 'Coordinates'
}

type GuestNoiseTheme = {
  summary: string
  sourceLabel: string
  windowStart: string
  windowEnd: string
  reviewCount?: number
}

type StaleContextMetadata = {
  sourceLabel: string
  sourceUpdatedAt: string
}

export type QuietStayEvidence = {
  overallState: QuietEvidenceOverallState
  providerFacts: ProviderQuietFact[]
  nearbyContext: NearbyContextItem[]
  reviewTheme: GuestNoiseTheme | null
  locationPrecision: 'exact' | 'coordinates' | 'area' | 'search_area' | 'missing'
  conflictClasses: Array<
    | 'provider_fact__review_theme'
    | 'provider_fact__nearby_context'
    | 'nearby_context__review_theme'
  >
  providerFactState?: EvidenceClassState
  contextState?: EvidenceClassState
  reviewThemeState?: EvidenceClassState
  staleContext?: StaleContextMetadata
}

export const NO_QUIET_STAY_EVIDENCE: QuietStayEvidence = {
  overallState: 'no_evidence_returned',
  providerFacts: [],
  nearbyContext: [],
  reviewTheme: null,
  locationPrecision: 'missing',
  conflictClasses: [],
}

const SCOPE_CAVEAT =
  'These details describe provider information, nearby places, or guest opinion. They do not predict whether a specific room will be quiet.'

function validSourceLabel(value: string | undefined): value is string {
  return Boolean(value?.trim() && value.trim().length <= 80)
}

function validText(value: string | undefined): value is string {
  return Boolean(value?.trim())
}

function validDate(value: string | undefined): value is string {
  return Boolean(value && Number.isFinite(Date.parse(value)))
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function validProviderFact(fact: ProviderQuietFact): boolean {
  if (!validSourceLabel(fact.sourceLabel) || !validDate(fact.fetchedAt)) return false
  if (fact.id === 'soundproofing_property') return fact.scope === 'property' && fact.certainty === 'supported'
  if (fact.id === 'soundproofing_room') {
    return fact.scope === 'room_type' && fact.certainty === 'supported' && validText(fact.roomTypeLabel)
  }
  return (
    (fact.scope === 'selected_stay' && fact.certainty === 'guaranteed') ||
    fact.certainty === 'requestable'
  )
}

function validNearbyContext(item: NearbyContextItem): boolean {
  return (
    validText(item.referencePoint) &&
    validSourceLabel(item.sourceLabel) &&
    validText(item.unit) &&
    validDate(item.sourceUpdatedAt) &&
    Number.isFinite(item.distance) &&
    item.distance >= 0 &&
    (item.method === 'straight_line' || Boolean(item.method.trim()))
  )
}

function validGuestTheme(theme: GuestNoiseTheme): boolean {
  return (
    validSourceLabel(theme.sourceLabel) &&
    validText(theme.summary) &&
    validDate(theme.windowStart) &&
    validDate(theme.windowEnd) &&
    (theme.reviewCount === undefined || (Number.isInteger(theme.reviewCount) && theme.reviewCount > 0))
  )
}

function ProviderFactItem({ fact }: { fact: ProviderQuietFact }) {
  const date = formatDate(fact.fetchedAt)
  let primary: string
  let metadata: string

  if (fact.id === 'soundproofing_property') {
    primary = 'Provider lists soundproofing for this property. It may not apply to every room.'
    metadata = `Property information from ${fact.sourceLabel.trim()} · Updated ${date}`
  } else if (fact.id === 'soundproofing_room') {
    if (fact.scope !== 'room_type' || !validText(fact.roomTypeLabel)) return null
    primary = 'Provider lists soundproofing for this room type. Confirm the selected room before payment.'
    metadata = `${fact.roomTypeLabel.trim()} · Room information from ${fact.sourceLabel.trim()} · Updated ${date}`
  } else if (fact.scope === 'selected_stay' && fact.certainty === 'guaranteed') {
    primary = 'Provider confirms this quiet-room attribute for the selected stay.'
    metadata = `Selected stay confirmed by ${fact.sourceLabel.trim()} · Checked ${date}`
  } else if (fact.certainty === 'requestable') {
    primary = 'A quieter room can be requested. Requests depend on availability and are not guaranteed.'
    metadata = `Request capability from ${fact.sourceLabel.trim()} · Checked ${date}`
  } else {
    return null
  }

  return (
    <li className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3">
      <p className="text-sm leading-6 text-[color:var(--text-1)]">{primary}</p>
      <p className="mt-2 break-words text-caption leading-5 text-[color:var(--text-3)]">{metadata}</p>
    </li>
  )
}

function NearbyContextEntry({ item }: { item: NearbyContextItem }) {
  const method = item.method === 'straight_line' ? 'in a straight line' : item.method.trim()

  return (
    <li className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3">
      <p className="text-sm leading-6 text-[color:var(--text-1)]">
        {item.referencePoint.trim()} is {item.distance.toLocaleString('en-US')} {item.unit.trim()} away {method}. Proximity does not predict noise in a specific room.
      </p>
      <p className="mt-2 break-words text-caption leading-5 text-[color:var(--text-3)]">
        Nearby data from {item.sourceLabel.trim()} · Updated {formatDate(item.sourceUpdatedAt)} · Property location: {item.propertyLocationLabel}
      </p>
    </li>
  )
}

function GuestReviewItem({ theme }: { theme: GuestNoiseTheme }) {
  const window = `${formatDate(theme.windowStart)}–${formatDate(theme.windowEnd)}`

  return (
    <li className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3">
      <p className="text-sm leading-6 text-[color:var(--text-1)]">
        Guests mention {theme.summary.trim()}. Summary of guest reviews via {theme.sourceLabel.trim()}.
      </p>
      <p className="mt-2 break-words text-caption leading-5 text-[color:var(--text-3)]">
        {theme.reviewCount
          ? `Based on ${theme.reviewCount.toLocaleString('en-US')} guest reviews from ${window}`
          : `Guest review window: ${window}`}
      </p>
    </li>
  )
}

function ClassMessage({ children }: { children: string }) {
  return <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">{children}</p>
}

function EvidenceGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-4 first:pt-0 last:pb-0">
      <h4 className="text-sm font-bold leading-5 text-[color:var(--text-1)]">{title}</h4>
      {children}
    </section>
  )
}

export function QuietStayEvidenceLedger({ evidence }: { evidence: QuietStayEvidence }) {
  const statusClass =
    'mt-4 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-base)] px-3.5 py-3 text-sm leading-6 text-[color:var(--text-2)]'

  if (evidence.overallState !== 'evidence_available') {
    const status = {
      checking: 'Checking quiet-stay evidence…',
      no_evidence_returned:
        'Quiet-stay details were not provided by this hotel source. Location and rating do not tell us whether a room will be quiet.',
      check_failed:
        'Quiet-stay evidence could not be checked. Confirm room location, soundproofing, and current surroundings with the booking partner.',
    }[evidence.overallState]

    return (
      <section
        aria-labelledby="quiet-stay-title"
        aria-busy={evidence.overallState === 'checking' ? true : undefined}
        className="card mt-8 min-w-0 p-5"
      >
        <h3 id="quiet-stay-title" className="text-h3 text-[color:var(--text-1)]">Quiet-stay evidence</h3>
        <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">{SCOPE_CAVEAT}</p>
        <p
          className={statusClass}
          role={evidence.overallState === 'checking' || evidence.overallState === 'check_failed' ? 'status' : undefined}
          aria-live={evidence.overallState === 'checking' || evidence.overallState === 'check_failed' ? 'polite' : undefined}
        >
          {status}
        </p>
      </section>
    )
  }

  const providerItems = evidence.providerFacts
    .filter(validProviderFact)
    .map((fact, index) => <ProviderFactItem key={`${fact.id}-${index}`} fact={fact} />)
  const contextEligible = evidence.locationPrecision === 'exact' || evidence.locationPrecision === 'coordinates'
  const contextItems = contextEligible
    ? evidence.nearbyContext
        .filter(validNearbyContext)
        .map((item, index) => <NearbyContextEntry key={`${item.category}-${index}`} item={item} />)
    : []
  const reviewItem = evidence.reviewTheme && validGuestTheme(evidence.reviewTheme)
    ? <GuestReviewItem theme={evidence.reviewTheme} />
    : null

  return (
    <section aria-labelledby="quiet-stay-title" className="card mt-8 min-w-0 p-5">
      <h3 id="quiet-stay-title" className="text-h3 text-[color:var(--text-1)]">Quiet-stay evidence</h3>
      <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">{SCOPE_CAVEAT}</p>

      {evidence.conflictClasses.length > 0 ? (
        <p className={statusClass}>Sources differ. Review each source before deciding.</p>
      ) : null}

      <div className="mt-5 divide-y divide-[color:var(--border)]">
        <EvidenceGroup title="Provider facts">
          {evidence.providerFactState === 'error' ? (
            <ClassMessage>Provider facts could not be checked.</ClassMessage>
          ) : providerItems.length > 0 ? (
            <ul className="mt-3 space-y-3">{providerItems}</ul>
          ) : (
            <ClassMessage>No provider fact was supplied.</ClassMessage>
          )}
        </EvidenceGroup>

        <EvidenceGroup title="Nearby context">
          {evidence.contextState === 'error' ? (
            <ClassMessage>Nearby context could not be checked.</ClassMessage>
          ) : evidence.contextState === 'stale' ? (
            <>
              <ClassMessage>Nearby context is out of date and is not shown.</ClassMessage>
              {evidence.staleContext && validSourceLabel(evidence.staleContext.sourceLabel) && validDate(evidence.staleContext.sourceUpdatedAt) ? (
                <p className="mt-2 break-words text-caption leading-5 text-[color:var(--text-3)]">
                  Last source update: {formatDate(evidence.staleContext.sourceUpdatedAt)} · {evidence.staleContext.sourceLabel.trim()}
                </p>
              ) : null}
            </>
          ) : !contextEligible || evidence.contextState === 'insufficient_location' ? (
            <ClassMessage>Property-level proximity cannot be calculated from the area information provided.</ClassMessage>
          ) : contextItems.length > 0 ? (
            <ul className="mt-3 space-y-3">{contextItems}</ul>
          ) : (
            <ClassMessage>No usable nearby context was supplied.</ClassMessage>
          )}
        </EvidenceGroup>

        <EvidenceGroup title="Guest review theme">
          {evidence.reviewThemeState === 'error' ? (
            <ClassMessage>Guest review themes could not be checked.</ClassMessage>
          ) : reviewItem ? (
            <ul className="mt-3 space-y-3">{reviewItem}</ul>
          ) : (
            <ClassMessage>No licensed guest noise theme was supplied.</ClassMessage>
          )}
        </EvidenceGroup>
      </div>
    </section>
  )
}
