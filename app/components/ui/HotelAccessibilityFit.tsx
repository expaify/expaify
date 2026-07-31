export const ACCESSIBILITY_NEEDS = [
  { id: 'step_free_route_to_room', label: 'Step-free route to the room', group: 'Arrival and route' },
  { id: 'accessible_room_and_bathroom', label: 'Accessible room and bathroom', group: 'Room and bathroom' },
  { id: 'roll_in_shower', label: 'Roll-in shower', group: 'Room and bathroom' },
  { id: 'accessible_tub', label: 'Accessible tub', group: 'Room and bathroom' },
  { id: 'hearing_access_alerts', label: 'Hearing-access alerts', group: 'Hearing and visual support' },
  { id: 'tactile_braille_wayfinding', label: 'Tactile or Braille wayfinding', group: 'Hearing and visual support' },
] as const

export type AccessibilityNeedId = (typeof ACCESSIBILITY_NEEDS)[number]['id']
export type AccessibilityOutcome = 'documented' | 'mismatch' | 'not_documented' | 'loading'
export type AccessibilityEvidenceState =
  | 'loading'
  | 'ready'
  | 'not_returned'
  | 'unknown'
  | 'unavailable'
  | 'stale'
  | 'malformed'
  | 'conflicting'
  | 'error'
export type AccessibilityScope = 'property' | 'room' | 'rate' | 'selected_stay'
export type AccessibilityCertainty = 'informational' | 'requestable' | 'guaranteed'

export type AccessibilityFact = {
  canonicalId: string
  needId: AccessibilityNeedId
  label: string
  state: AccessibilityEvidenceState
  scope?: AccessibilityScope
  sourceLabel?: string
  observedAt?: string
  certainty: AccessibilityCertainty
  propertyId?: string
  roomProductId?: string
  roomLabel?: string
  rateId?: string
  stayFingerprint?: string
  confirmationReference?: string
  rawProviderId?: string
  negativeCapability?: boolean
}

export type AccessibilityNeedResult = {
  id: AccessibilityNeedId
  label: string
  group: (typeof ACCESSIBILITY_NEEDS)[number]['group']
  outcome: AccessibilityOutcome
  state: AccessibilityEvidenceState
  facts: AccessibilityFact[]
  requestable: boolean
}

export type AccessibilityPresentation = {
  selectedNeeds: AccessibilityNeedId[]
  needs: AccessibilityNeedResult[]
  rollup: 'none' | 'all_documented' | 'has_mismatch' | 'needs_confirmation' | 'loading'
  documentedCount: number
  mismatchCount: number
  confirmationCount: number
}

const GROUPS = ['Room and bathroom', 'Arrival and route', 'Hearing and visual support', 'Supporting context'] as const

const REQUIRED_FACT_IDS: Record<AccessibilityNeedId, readonly string[]> = {
  step_free_route_to_room: ['step_free_arrival', 'step_free_entrance', 'step_free_reception_common', 'vertical_circulation', 'step_free_route_to_room_entry', 'room_entry_clearance', 'room_internal_circulation', 'bathroom_access'],
  accessible_room_and_bathroom: ['accessible_room_availability', 'room_entry_clearance', 'room_internal_circulation', 'bathroom_access', 'grab_bars', 'shower_seat', 'reachable_controls', 'bathroom_turning_space'],
  roll_in_shower: ['roll_in_shower'],
  accessible_tub: ['accessible_tub'],
  hearing_access_alerts: ['visual_fire_alarm', 'door_phone_notifications'],
  tactile_braille_wayfinding: ['tactile_braille_common_areas', 'tactile_braille_room_signage'],
}

const FACT_LABELS: Record<string, string> = {
  step_free_arrival: 'Arrival or drop-off route',
  step_free_entrance: 'Step-free property entrance',
  step_free_reception_common: 'Route through reception and common areas',
  vertical_circulation: 'Elevator or accessible vertical circulation',
  step_free_route_to_room_entry: 'Route to guest-room entry',
  room_entry_clearance: 'Room-entry access',
  room_internal_circulation: 'Room internal circulation',
  bathroom_access: 'Bathroom access and configuration',
  accessible_room_availability: 'Accessible room availability',
  grab_bars: 'Grab bars',
  shower_seat: 'Shower seat',
  reachable_controls: 'Reachable controls',
  bathroom_turning_space: 'Bathroom turning or clear-floor information',
  roll_in_shower: 'Roll-in shower',
  accessible_tub: 'Accessible tub',
  visual_fire_alarm: 'Visual fire alarm',
  door_phone_notifications: 'Door and phone notifications',
  tactile_braille_common_areas: 'Tactile or Braille common-area wayfinding',
  tactile_braille_room_signage: 'Tactile or Braille room signage',
}

const NEED_BY_ID = Object.fromEntries(ACCESSIBILITY_NEEDS.map(need => [need.id, need])) as Record<AccessibilityNeedId, (typeof ACCESSIBILITY_NEEDS)[number]>

function isCurrentDate(value?: string): boolean {
  return Boolean(value && Number.isFinite(Date.parse(value)))
}

function hasSelectedStayBinding(fact: AccessibilityFact): boolean {
  if (fact.scope !== 'rate' && fact.scope !== 'selected_stay') return false
  if (!fact.sourceLabel?.trim() || !isCurrentDate(fact.observedAt) || !fact.propertyId?.trim()) return false
  if (!fact.roomProductId?.trim() || !fact.rateId?.trim() || !fact.stayFingerprint?.trim()) return false
  if (fact.certainty === 'requestable') return false
  return fact.certainty !== 'guaranteed' || Boolean(fact.confirmationReference?.trim())
}

function deriveNeed(needId: AccessibilityNeedId, facts: AccessibilityFact[]): AccessibilityNeedResult {
  const need = NEED_BY_ID[needId]
  const relevant = facts.filter(fact => fact.needId === needId)
  const requestable = relevant.some(fact => fact.certainty === 'requestable')
  const loading = relevant.length > 0 && relevant.every(fact => fact.state === 'loading')
  if (loading) return { ...need, outcome: 'loading', state: 'loading', facts: relevant, requestable }

  const validMismatch = relevant.find(fact => (
    fact.state === 'unavailable' && fact.negativeCapability === true &&
    Boolean(fact.sourceLabel?.trim()) && isCurrentDate(fact.observedAt) && Boolean(fact.propertyId?.trim()) &&
    Boolean(fact.scope) && (needId === 'step_free_route_to_room' || fact.scope === 'rate' || fact.scope === 'selected_stay')
  ))
  if (validMismatch) return { ...need, outcome: 'mismatch', state: 'unavailable', facts: relevant, requestable }

  const degradingState = relevant.find(fact => (
    ['error', 'conflicting', 'stale', 'malformed', 'unknown', 'not_returned', 'unavailable'].includes(fact.state) ||
    !fact.sourceLabel?.trim() || !isCurrentDate(fact.observedAt)
  ))?.state

  const hasEveryRequiredFact = REQUIRED_FACT_IDS[needId].every(id => relevant.some(fact => fact.canonicalId === id))
  if (!degradingState && !requestable && hasEveryRequiredFact && relevant.every(fact => fact.state === 'ready' && hasSelectedStayBinding(fact))) {
    return { ...need, outcome: 'documented', state: 'ready', facts: relevant, requestable }
  }

  return {
    ...need,
    outcome: 'not_documented',
    state: degradingState ?? (relevant.length === 0 ? 'not_returned' : 'unknown'),
    facts: relevant,
    requestable,
  }
}

export function createAccessibilityPresentation(
  selectedNeeds: readonly AccessibilityNeedId[] = [],
  facts: readonly AccessibilityFact[] = [],
): AccessibilityPresentation {
  const selected = ACCESSIBILITY_NEEDS.map(need => need.id).filter(id => selectedNeeds.includes(id))
  const needs = selected.map(id => deriveNeed(id, [...facts]))
  const documentedCount = needs.filter(need => need.outcome === 'documented').length
  const mismatchCount = needs.filter(need => need.outcome === 'mismatch').length
  const confirmationCount = needs.filter(need => need.outcome === 'not_documented' || need.outcome === 'loading').length
  const rollup = needs.length === 0
    ? 'none'
    : mismatchCount > 0
      ? 'has_mismatch'
      : needs.every(need => need.outcome === 'documented')
        ? 'all_documented'
        : needs.some(need => need.outcome === 'loading')
          ? 'loading'
          : 'needs_confirmation'
  return { selectedNeeds: selected, needs, rollup, documentedCount, mismatchCount, confirmationCount }
}

function outcomeCopy(need: AccessibilityNeedResult): string {
  if (need.outcome === 'documented') return 'Documented for this stay'
  if (need.outcome === 'mismatch') return 'Documented mismatch'
  if (need.outcome === 'loading') return 'Checking accessibility details…'
  if (need.requestable) return 'Request only — not guaranteed'
  if (need.state === 'error') return 'Could not be checked — confirm'
  if (need.state === 'stale') return 'Out of date — confirm'
  if (need.state === 'conflicting') return 'Sources conflict — confirm'
  return 'Not documented — confirm'
}

function screenReaderOutcome(need: AccessibilityNeedResult): string {
  if (need.outcome === 'documented') return 'Documented for this selected stay.'
  if (need.outcome === 'mismatch') return 'The provider documents that this requirement is unavailable.'
  if (need.outcome === 'loading') return 'Accessibility details are still being checked.'
  if (need.requestable) return 'Request only; not guaranteed.'
  if (need.state === 'error') return 'Accessibility details could not be checked; confirm before booking.'
  return 'Not documented; confirm before booking.'
}

export function accessibilityCardAccessibleText(presentation?: AccessibilityPresentation, expired = false): string | undefined {
  if (!presentation || presentation.needs.length === 0) return undefined
  return `Accessibility fit. ${presentation.needs.map(need => `${need.label}: ${expired ? 'Not documented; confirm before booking.' : screenReaderOutcome(need)}`).join(' ')}`
}

export function AccessibilityCardCue({ presentation, expired = false }: {
  presentation?: AccessibilityPresentation
  expired?: boolean
}) {
  if (!presentation || presentation.needs.length === 0) return null
  const effectiveNeeds = expired
    ? presentation.needs.map(need => ({ ...need, outcome: 'not_documented' as const, state: 'stale' as const }))
    : presentation.needs
  const rollup = expired
    ? 'Some needs require confirmation'
    : presentation.rollup === 'all_documented'
      ? 'All selected needs documented'
      : presentation.rollup === 'has_mismatch'
        ? 'Does not match a selected need'
        : presentation.rollup === 'loading'
          ? 'Checking accessibility details…'
          : 'Some needs require confirmation'
  const tone = !expired && presentation.rollup === 'all_documented'
    ? 'border-[color:var(--brand)] bg-[color:var(--success-soft)]'
    : !expired && presentation.rollup === 'has_mismatch'
      ? 'border-[color:var(--error)] bg-[color:var(--error-soft)]'
      : 'border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]'

  return (
    <div className={`rounded-[var(--radius-control)] border px-3 py-2.5 ${tone}`}>
      <p className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Accessibility fit</p>
      {expired ? <p className="mt-1 text-small font-medium leading-5 text-[color:var(--text-1)]">Saved accessibility details may be out of date.</p> : null}
      <p className="mt-1 text-small font-medium leading-5 text-[color:var(--text-1)]">{rollup}</p>
      {!expired && presentation.rollup === 'loading' ? (
        <div aria-hidden="true" className="mt-2 space-y-2"><div className="skeleton h-4 w-4/5" /><div className="skeleton h-4 w-3/5" /></div>
      ) : null}
      {presentation.needs.length > 1 ? (
        <p className="mt-1 text-caption leading-5 text-[color:var(--text-2)]">{expired ? 0 : presentation.documentedCount} of {presentation.needs.length} selected needs documented</p>
      ) : null}
      <ul className="mt-1 space-y-1">
        {effectiveNeeds.map(need => <li key={need.id} className="break-words text-caption leading-5 text-[color:var(--text-2)]">{need.label}: {outcomeCopy(need)}</li>)}
      </ul>
    </div>
  )
}

function stateEvidenceCopy(need: AccessibilityNeedResult, fact?: AccessibilityFact): string {
  const provider = fact?.sourceLabel?.trim() || 'The provider'
  if (need.requestable) return 'This feature can be requested, but the request is not guaranteed.'
  if (need.state === 'not_returned') return `${provider} did not return this accessibility detail.`
  if (need.state === 'unknown') return 'The available information does not establish this requirement.'
  if (need.state === 'error') return 'This accessibility detail could not be checked. Price and hotel details are still available.'
  if (need.state === 'stale') return `This detail is out of date.${fact?.observedAt && isCurrentDate(fact.observedAt) ? ` It was last checked ${new Date(fact.observedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })};` : ''} confirm before booking.`
  if (need.state === 'malformed') return 'The provider returned an accessibility detail we could not verify or display.'
  if (need.state === 'conflicting') return 'Sources conflict. Review each source and confirm before booking.'
  if (need.state === 'unavailable') return `${provider} documents that this requirement is unavailable for the stated scope.`
  if (need.outcome === 'documented') return fact?.label || 'The selected-stay requirement is documented.'
  return 'Some accessibility details are documented, but this need is not confirmed for the selected stay.'
}

function formatScope(scope?: AccessibilityScope): string {
  if (!scope) return 'Scope not provided'
  return scope === 'selected_stay' ? 'Selected stay' : scope[0].toUpperCase() + scope.slice(1)
}

function formatCertainty(certainty?: AccessibilityCertainty): string {
  if (certainty === 'guaranteed') return 'Guaranteed for selected stay'
  if (certainty === 'requestable') return 'Request only'
  return 'Documented information'
}

function EvidenceDefinitions({ need }: { need: AccessibilityNeedResult }) {
  const fact = need.facts[0]
  const rows: Array<[string, string]> = [
    ['Outcome', outcomeCopy(need)],
    ['What is documented', stateEvidenceCopy(need, fact)],
    ['Scope', formatScope(fact?.scope)],
    ['Certainty', formatCertainty(fact?.certainty)],
    ['Room or product', fact?.roomLabel || fact?.roomProductId || 'No room or product identified'],
    ['Rate or selected stay', fact?.rateId || fact?.stayFingerprint || 'No rate or selected stay identified'],
    ['Source', fact?.sourceLabel?.trim() || 'Source not provided'],
    ['Last checked', fact?.observedAt && isCurrentDate(fact.observedAt) ? new Date(fact.observedAt).toLocaleString('en-US') : 'Last checked not provided'],
  ]
  if (fact?.confirmationReference && need.outcome === 'documented') rows.push(['Confirmation reference', fact.confirmationReference])
  return (
    <dl className="mt-3 grid min-w-0 grid-cols-1 gap-y-1 sm:grid-cols-[minmax(8rem,0.35fr)_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-2">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">{term}</dt>
          <dd className="mb-2 min-w-0 break-words text-small leading-5 text-[color:var(--text-2)] sm:mb-0">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function RequiredEvidenceRows({ need }: { need: AccessibilityNeedResult }) {
  return (
    <div className="mt-4 border-t border-[color:var(--border)] pt-3">
      <p className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Required evidence</p>
      <ul className="mt-2 space-y-3">
        {REQUIRED_FACT_IDS[need.id].map(canonicalId => {
          const fact = need.facts.find(candidate => candidate.canonicalId === canonicalId)
          const factOutcome = !fact
            ? 'Not documented — confirm'
            : fact.state === 'loading'
              ? 'Checking accessibility details…'
              : fact.state === 'stale'
                ? 'Out of date — confirm'
                : fact.state === 'conflicting'
                  ? 'Sources conflict — confirm'
                  : fact.state === 'error'
                    ? 'Could not be checked — confirm'
                    : fact.state === 'unavailable' && need.outcome === 'mismatch'
                      ? 'Documented mismatch'
                      : fact.certainty === 'requestable'
                        ? 'Request only — not guaranteed'
                        : fact.state === 'ready' && hasSelectedStayBinding(fact)
                          ? 'Documented for this stay'
                          : 'Not documented — confirm'
          return (
            <li key={canonicalId} className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3">
              <p className="text-small font-medium leading-5 text-[color:var(--text-1)]">{FACT_LABELS[canonicalId] ?? canonicalId}</p>
              <dl className="mt-2 grid min-w-0 grid-cols-1 gap-y-1 sm:grid-cols-[minmax(8rem,0.35fr)_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-2">
                {[
                  ['Outcome', factOutcome],
                  ['What is documented', fact ? stateEvidenceCopy({ ...need, state: fact.state, facts: [fact], requestable: fact.certainty === 'requestable' }, fact) : 'The available information does not establish this requirement.'],
                  ['Scope', formatScope(fact?.scope)],
                  ['Certainty', formatCertainty(fact?.certainty)],
                  ['Room or product', fact?.roomLabel || fact?.roomProductId || 'No room or product identified'],
                  ['Rate or selected stay', fact?.rateId || fact?.stayFingerprint || 'No rate or selected stay identified'],
                  ['Source', fact?.sourceLabel?.trim() || 'Source not provided'],
                  ['Last checked', fact?.observedAt && isCurrentDate(fact.observedAt) ? new Date(fact.observedAt).toLocaleString('en-US') : 'Last checked not provided'],
                  ...(fact?.confirmationReference && factOutcome === 'Documented for this stay' ? [['Confirmation reference', fact.confirmationReference]] : []),
                ].map(([term, value]) => (
                  <div key={term} className="contents">
                    <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">{term}</dt>
                    <dd className="mb-2 min-w-0 break-words text-small leading-5 text-[color:var(--text-2)] sm:mb-0">{value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function AccessibilityFitLedger({ presentation, hotelName, criteriaValid = true }: {
  presentation: AccessibilityPresentation
  hotelName: string
  criteriaValid?: boolean
}) {
  const noNeeds = presentation.needs.length === 0
  const evidenceOutcome = noNeeds
    ? 'No fit outcome without selected needs'
    : presentation.rollup === 'all_documented'
      ? 'All selected needs documented'
      : presentation.rollup === 'has_mismatch'
        ? 'Does not match a selected need'
        : presentation.rollup === 'loading'
          ? 'Checking accessibility details…'
          : 'Some needs require confirmation'
  return (
    <section aria-labelledby="accessibility-fit-title" aria-busy={presentation.rollup === 'loading'} className="mt-5 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4 sm:p-5">
      <h3 id="accessibility-fit-title" className="text-h3 text-[color:var(--text-1)]">Accessibility fit</h3>
      {noNeeds ? (
        <p className="mt-2 text-small leading-5 text-[color:var(--text-2)]">No accessibility needs were carried with this saved deal. Review the available evidence and confirm essential needs with the provider before booking.</p>
      ) : (
        <p className="mt-2 text-small leading-5 text-[color:var(--text-2)]">For this search: {presentation.needs.map(need => need.label).join(', ')}.</p>
      )}
      {!criteriaValid ? <p className="mt-2 text-small leading-5 text-[color:var(--error-text)]">Accessibility needs could not be restored. Review and apply them again.</p> : null}
      <p className="mt-2 text-small leading-5 text-[color:var(--text-2)]">Property features, room features, rate eligibility, and confirmation for a selected stay are different. A request is not a guarantee.</p>
      <p className="mt-2 text-small leading-5 text-[color:var(--text-2)]">Accessibility evidence is limited; results are not filtered exhaustively.</p>
      {presentation.needs.length > 0 && presentation.needs.every(need => need.state === 'not_returned') ? <p className="mt-2 text-small leading-5 text-[color:var(--text-2)]">The provider did not return accessibility details for the selected needs. This does not mean the features are unavailable.</p> : null}
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div><dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Selected needs</dt><dd className="mt-1 text-small text-[color:var(--text-2)]">{noNeeds ? 'None selected' : `${presentation.needs.length} selected`}</dd></div>
        <div><dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Evidence outcome</dt><dd className="mt-1 text-small text-[color:var(--text-2)]">{evidenceOutcome}</dd></div>
        <div><dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Room confirmation</dt><dd className="mt-1 text-small text-[color:var(--text-2)]">{noNeeds ? 'No accessibility needs were selected for comparison.' : presentation.rollup === 'all_documented' ? 'Selected stay documents all chosen accessibility needs.' : 'No room selected — accessibility fit is not confirmed.'}</dd></div>
      </dl>
      {presentation.rollup === 'loading' ? <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">Checking accessibility details for {hotelName}.</p> : null}
      {GROUPS.map(group => {
        const groupNeeds = presentation.needs.filter(need => need.group === group)
        if (groupNeeds.length === 0) return null
        return (
          <section key={group} aria-labelledby={`accessibility-group-${group.toLowerCase().replaceAll(' ', '-')}`} className="mt-5 border-t border-[color:var(--border)] pt-4 first:border-t-0 first:pt-0">
            <h4 id={`accessibility-group-${group.toLowerCase().replaceAll(' ', '-')}`} className="text-body font-medium text-[color:var(--text-1)]">{group}</h4>
            {groupNeeds.map(need => (
              <article key={need.id} aria-labelledby={`accessibility-need-${need.id}`} className="mt-3 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-3.5">
                <h5 id={`accessibility-need-${need.id}`} className="text-body font-medium text-[color:var(--text-1)]">{need.label}</h5>
                {need.state === 'loading' ? <div aria-hidden="true" className="mt-3 space-y-2"><div className="skeleton h-4 w-4/5" /><div className="skeleton h-4 w-3/5" /></div> : null}
                {need.outcome === 'not_documented' && need.facts.some(fact => fact.state === 'ready') ? <p className="mt-2 text-small leading-5 text-[color:var(--text-2)]">Some accessibility details are documented, but this need is not confirmed for the selected stay.</p> : null}
                <EvidenceDefinitions need={need} />
                <RequiredEvidenceRows need={need} />
                {need.state === 'conflicting' && need.facts.filter(fact => fact.sourceLabel && isCurrentDate(fact.observedAt)).length > 0 ? (
                  <ul aria-label={`Conflicting evidence sources for ${need.label}.`} className="mt-3 space-y-2">
                    {need.facts.filter(fact => fact.sourceLabel && isCurrentDate(fact.observedAt)).map((fact, index) => (
                      <li key={`${fact.rawProviderId ?? fact.canonicalId}-${index}`} className="border-l-2 border-[color:var(--border-strong)] pl-3 text-small leading-5 text-[color:var(--text-2)]">{fact.label} · {formatScope(fact.scope)} · {formatCertainty(fact.certainty)} · {fact.sourceLabel} · {new Date(fact.observedAt!).toLocaleString('en-US')}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </section>
        )
      })}
    </section>
  )
}

export function AccessibilityHandoffBoundary({ presentation }: { presentation: AccessibilityPresentation }) {
  if (presentation.needs.length === 0) {
    return (
      <div className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4">
        <p className="text-body font-medium text-[color:var(--text-1)]">Accessibility check</p>
        <p className="mt-1 text-small leading-5 text-[color:var(--text-2)]">No accessibility needs were selected for comparison.</p>
        <p className="mt-1 text-small leading-5 text-[color:var(--text-2)]">No room selected — accessibility fit is not confirmed.</p>
      </div>
    )
  }
  if (presentation.rollup === 'all_documented') {
    return (
      <div className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--brand)] bg-[color:var(--success-soft)] p-4">
        <p className="text-body font-medium text-[color:var(--text-1)]">Accessibility evidence for this stay</p>
        <p className="mt-1 text-small leading-5 text-[color:var(--text-2)]">Selected stay documents all chosen accessibility needs.</p>
        <p className="mt-1 text-small leading-5 text-[color:var(--text-2)]">Review the room, rate, and accessibility details again on the provider site before paying.</p>
      </div>
    )
  }
  const unresolved = presentation.needs.filter(need => need.outcome !== 'documented')
  return (
    <div className={`mt-4 rounded-[var(--radius-control)] border p-4 ${unresolved.some(need => need.state === 'error') ? 'border-[color:var(--error)] bg-[color:var(--error-soft)]' : 'border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]'}`}>
      <p className="text-body font-medium text-[color:var(--text-1)]">{presentation.rollup === 'has_mismatch' ? 'Review before booking' : 'Confirm before booking'}</p>
      <p className="mt-1 text-small leading-5 text-[color:var(--text-2)]">No room selected — accessibility fit is not confirmed.</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-small text-[color:var(--text-2)]">{unresolved.map(need => <li key={need.id}>{need.label}: {outcomeCopy(need)}</li>)}</ul>
      {unresolved.some(need => need.requestable) ? <p className="mt-2 text-small leading-5 text-[color:var(--text-2)]">Request only — not guaranteed until the provider confirms.</p> : null}
    </div>
  )
}

export function accessibilityProviderNameSuffix(presentation?: AccessibilityPresentation): string | undefined {
  if (!presentation || presentation.needs.length === 0) return undefined
  if (presentation.rollup === 'all_documented') return 'all selected accessibility needs are documented for this stay. Review details before paying.'
  return `accessibility confirmation is still required for ${presentation.needs.filter(need => need.outcome !== 'documented').length} selected needs.`
}
