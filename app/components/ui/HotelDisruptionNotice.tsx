'use client'

import { useEffect, useMemo, useRef } from 'react'
import { track } from '@/lib/analytics'
import type {
  HotelDisruptionEvidence,
  HotelDisruptionEvidenceState,
  HotelDisruptionImpactClass,
  HotelDisruptionNoticeType,
  HotelDisruptionRelation,
  SupplierDisruptionStatement,
} from '@/lib/types'

export const NO_HOTEL_DISRUPTION_EVIDENCE: HotelDisruptionEvidence = {
  loadState: 'ready',
  state: 'not_returned',
  relation: undefined,
  material: false,
  promoted: false,
  statements: [],
  evidenceRevision: 'unavailable',
}

const MAX_SOURCE_LENGTH = 80
const MAX_TEXT_LENGTH = 300
const MAX_LABEL_LENGTH = 80

const impactLabels: Record<HotelDisruptionImpactClass, string> = {
  reported_noise: 'Noise reported',
  guest_room_work: 'Guest-room work',
  guest_area_work: 'Guest-area work',
  arrival_or_checkin: 'Arrival or check-in affected',
  guest_circulation: 'Guest circulation affected',
  primary_facility_closure: 'Primary facility closure',
  primary_facility_restriction: 'Primary facility access restricted',
  access_limitation: 'Access limitation',
  service_limitation: 'Service limitation',
  non_guest_cosmetic: 'Non-guest cosmetic work',
  impact_not_provided: 'Impact not provided',
}

const stateCopy: Record<Exclude<HotelDisruptionEvidenceState, 'reported'>, { heading: string; body: string; handoff: string }> = {
  not_returned: {
    heading: 'Renovation and closure details were not provided',
    body: 'This supplier did not return renovation, construction, or facility-closure information. This does not mean the hotel is unaffected.',
    handoff: 'This supplier did not provide renovation or closure information. Confirm current conditions with the provider if they matter to your stay.',
  },
  check_failed: {
    heading: 'Renovation and closure details could not be checked',
    body: 'We could not check supplier-reported disruption information. The hotel, price, and Deal Score are still available.',
    handoff: 'We could not check renovation or closure details. Confirm current conditions with the provider before booking.',
  },
  malformed: {
    heading: 'Returned disruption details could not be verified',
    body: 'The supplier returned information we could not safely attribute or interpret. We are not showing it as a hotel fact.',
    handoff: 'Supplier disruption details could not be verified. Confirm current conditions with the provider before booking.',
  },
  conflicting: {
    heading: 'Supplier notices do not agree',
    body: 'Current supplier statements disagree about the reported work, affected area, impact, or dates. We are not choosing one as correct.',
    handoff: 'Supplier notices conflict, and your stay may be affected. Compare the statements below and confirm current conditions with the provider.',
  },
  stale_unconfirmed: {
    heading: 'Earlier disruption notice could not be reconfirmed',
    body: 'This supplier notice is older than the approved evidence window, or its refresh failed. It may no longer describe current conditions.',
    handoff: 'An earlier disruption notice could not be reconfirmed. Confirm current conditions with the provider before booking.',
  },
}

function boundedText(value: unknown, maxLength = MAX_LABEL_LENGTH): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength && !/[\u0000-\u001F\u007F]/.test(value)
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function validStatement(statement: SupplierDisruptionStatement): boolean {
  return boundedText(statement.id) &&
    boundedText(statement.sourceLabel, MAX_SOURCE_LENGTH) &&
    boundedText(statement.sourceText, MAX_TEXT_LENGTH) &&
    validDate(statement.observedAt) &&
    statement.affectedScopes.every(scope => boundedText(scope)) &&
    statement.impactClasses.every(impact => impact in impactLabels) &&
    (!statement.summaryImpactLabel || boundedText(statement.summaryImpactLabel)) &&
    (!statement.reportedStart || validDate(statement.reportedStart)) &&
    (!statement.reportedEnd || validDate(statement.reportedEnd)) &&
    (!statement.reportedHours || boundedText(statement.reportedHours)) &&
    (!statement.supplierSeverityLabel || boundedText(statement.supplierSeverityLabel))
}

function formatDate(value?: string): string | null {
  if (!value || !validDate(value)) return null
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function displayImpact(statement?: SupplierDisruptionStatement): string {
  if (!statement) return 'Guest disruption'
  if (boundedText(statement.summaryImpactLabel)) return statement.summaryImpactLabel.trim()
  if (statement.impactClasses.includes('reported_noise')) return 'Construction noise'
  if (statement.affectedScopes[0] && statement.impactClasses.some(value => value === 'guest_room_work' || value === 'guest_area_work')) {
    return `${statement.affectedScopes[0].trim()} work`
  }
  if (statement.impactClasses.includes('primary_facility_closure') && statement.affectedScopes[0]) return `${statement.affectedScopes[0].trim()} closure`
  if (statement.impactClasses.includes('primary_facility_restriction') && statement.affectedScopes[0]) return `${statement.affectedScopes[0].trim()} access limits`
  return 'Guest disruption'
}

function usableStatements(evidence: HotelDisruptionEvidence): SupplierDisruptionStatement[] {
  if (evidence.state === 'malformed') return []
  return evidence.statements.filter(validStatement)
}

function effectiveState(evidence: HotelDisruptionEvidence, statements: SupplierDisruptionStatement[]): HotelDisruptionEvidenceState {
  if ((evidence.state === 'reported' || evidence.state === 'conflicting' || evidence.state === 'stale_unconfirmed') && statements.length === 0) return 'malformed'
  if (evidence.state === 'conflicting' && statements.length < 2) return 'malformed'
  return evidence.state
}

export function getHotelDisruptionResultCue(evidence?: HotelDisruptionEvidence): string | null {
  if (!evidence || evidence.loadState !== 'ready' || !evidence.promoted || !evidence.material) return null
  const statements = usableStatements(evidence)
  const state = effectiveState(evidence, statements)
  if (state === 'conflicting') return 'Supplier notices conflict · your stay may be affected'
  if (state === 'stale_unconfirmed') return 'Earlier disruption notice could not be reconfirmed'
  if (state !== 'reported' || !evidence.relation) return null
  const statement = statements[0]
  if (!statement) return null
  const impact = displayImpact(statement)
  if (evidence.relation === 'partial_overlap') return `${impact} reported for part of your stay`
  if (evidence.relation === 'timing_unknown') return `${impact} reported · timing not provided`
  if (evidence.relation !== 'overlap') return null
  if (statement.noticeType === 'facility_closure' && statement.affectedScopes[0]) return `${statement.affectedScopes[0].trim()} reported closed during your stay`
  if (statement.noticeType === 'facility_restriction' && statement.affectedScopes[0]) return `${statement.affectedScopes[0].trim()} access reported limited during your stay`
  if (statement.impactClasses.includes('reported_noise')) return 'Construction noise reported during your stay'
  if (statement.impactClasses.some(value => value === 'guest_room_work' || value === 'guest_area_work') && statement.affectedScopes[0]) {
    return `${statement.affectedScopes[0].trim()} work reported during your stay`
  }
  return `${impact} reported during your stay`
}

type AnalyticsContext = {
  notice_type: HotelDisruptionNoticeType | 'multiple' | 'unavailable'
  relation: HotelDisruptionRelation | 'not_computable'
  impact_class: HotelDisruptionImpactClass | 'multiple' | 'not_provided' | 'unavailable'
  evidence_state: HotelDisruptionEvidenceState
  viewport_band: 'mobile_375' | 'desktop_1280' | 'other'
  revision_bucket: string
}

function viewportBand(): AnalyticsContext['viewport_band'] {
  if (typeof window === 'undefined') return 'other'
  if (window.innerWidth <= 480) return 'mobile_375'
  if (window.innerWidth >= 1024) return 'desktop_1280'
  return 'other'
}

export function hotelDisruptionAnalyticsContext(evidence: HotelDisruptionEvidence): Omit<AnalyticsContext, 'viewport_band'> {
  const statements = usableStatements(evidence)
  const noticeTypes = [...new Set(statements.map(statement => statement.noticeType))]
  const impacts = [...new Set(statements.flatMap(statement => statement.impactClasses))]
  const revision = /^[A-Za-z0-9_-]{1,40}$/.test(evidence.evidenceRevision) ? evidence.evidenceRevision : 'unavailable'
  return {
    notice_type: noticeTypes.length > 1 ? 'multiple' : noticeTypes[0] ?? 'unavailable',
    relation: evidence.relation ?? 'not_computable',
    impact_class: impacts.length > 1 ? 'multiple' : impacts[0] ?? (evidence.state === 'reported' ? 'not_provided' : 'unavailable'),
    evidence_state: evidence.state,
    revision_bucket: revision,
  }
}

function useReachedAnalytics({
  evidence,
  event,
  surface,
  analyticsKey,
  enabled = true,
  onReached,
}: {
  evidence: HotelDisruptionEvidence
  event: 'hotel_disruption_notice_impression' | 'hotel_disruption_detail_reached' | 'hotel_disruption_handoff_reached'
  surface: 'results' | 'detail' | 'handoff'
  analyticsKey?: string
  enabled?: boolean
  onReached?: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  const context = useMemo(() => hotelDisruptionAnalyticsContext(evidence), [evidence])

  useEffect(() => {
    const target = ref.current
    if (!target || !enabled || typeof IntersectionObserver === 'undefined') return
    let timer: ReturnType<typeof setTimeout> | undefined
    const dedupeKey = `expaify.disruption.reached.${analyticsKey ?? 'anonymous'}.${surface}.${context.revision_bucket}`
    const observer = new IntersectionObserver(entries => {
      const visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5)
      if (!visible) {
        if (timer) clearTimeout(timer)
        timer = undefined
        return
      }
      if (timer) return
      timer = setTimeout(() => {
        try {
          if (window.sessionStorage.getItem(dedupeKey)) return
          window.sessionStorage.setItem(dedupeKey, '1')
        } catch {
          // Analytics storage is optional and must not affect the notice.
        }
        track(event, { surface, ...context, viewport_band: viewportBand() })
        onReached?.()
        observer.disconnect()
      }, 1000)
    }, { threshold: [0, 0.5, 1] })
    observer.observe(target)
    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [analyticsKey, context, enabled, event, onReached, surface])

  return ref
}

export function HotelDisruptionResultCue({ evidence, analyticsKey }: { evidence?: HotelDisruptionEvidence; analyticsKey?: string }) {
  const resolved = evidence ?? NO_HOTEL_DISRUPTION_EVIDENCE
  const cue = getHotelDisruptionResultCue(resolved)
  const ref = useReachedAnalytics({ evidence: resolved, event: 'hotel_disruption_notice_impression', surface: 'results', analyticsKey, enabled: !!cue })
  if (!cue) return null
  return (
    <p ref={ref as React.RefObject<HTMLParagraphElement | null>} className="mt-2 flex min-w-0 items-start gap-2 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] px-3 py-2 text-caption font-medium leading-5 text-[color:var(--text-1)]">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-[color:var(--warning)]">◇</span>
      <span className="min-w-0 break-words">{cue}</span>
    </p>
  )
}

function StatementBlock({ statement }: { statement: SupplierDisruptionStatement }) {
  const start = formatDate(statement.reportedStart)
  const end = formatDate(statement.reportedEnd)
  const checked = formatDate(statement.observedAt)
  const impacts = statement.impactClasses.map(impact => impactLabels[impact])
  return (
    <div className="min-w-0 border-l-2 border-[color:var(--border-strong)] pl-3">
      <dl className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Affected area or facility</dt>
          <dd className="mt-1 break-words text-sm leading-6 text-[color:var(--text-1)]">{statement.affectedScopes.length ? statement.affectedScopes.join(', ') : 'The supplier did not identify an affected area or facility.'}</dd>
        </div>
        <div>
          <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Reported impact</dt>
          <dd className="mt-1 break-words text-sm leading-6 text-[color:var(--text-1)]">{impacts.length ? impacts.join(', ') : 'The supplier did not provide an impact level.'}{statement.reportedHours ? `, ${statement.reportedHours}` : ''}</dd>
        </div>
        <div>
          <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Reported schedule</dt>
          <dd className="mt-1 break-words text-sm leading-6 text-[color:var(--text-1)]">
            {start ?? 'Start date not provided'}–{end ?? 'End date not provided'}{statement.reportedHours ? ` · ${statement.reportedHours}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Supplier description</dt>
          <dd className="mt-1 break-words text-sm leading-6 text-[color:var(--text-1)]">{statement.supplierSeverityLabel ? `Supplier description: ${statement.supplierSeverityLabel}` : 'The supplier did not provide an impact level.'}</dd>
        </div>
      </dl>
      <div className="mt-3">
        <p className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Supplier statement</p>
        <p className="mt-1 break-words text-sm leading-6 text-[color:var(--text-1)]" lang={statement.sourceLanguage}><q>{statement.sourceText.trim()}</q></p>
        {statement.sourceLanguage ? <p className="mt-1 text-xs text-[color:var(--text-3)]">Statement language: {statement.sourceLanguage}</p> : null}
        <p className="mt-2 break-words text-xs leading-5 text-[color:var(--text-2)]">
          {checked ? `Source: ${statement.sourceLabel.trim()}. Checked ${checked}.` : 'Checked date not provided. This notice cannot be treated as current.'}
        </p>
      </div>
    </div>
  )
}

function reportedRelationship(evidence: HotelDisruptionEvidence, statement?: SupplierDisruptionStatement): { heading: string; body: string } {
  const impact = displayImpact(statement)
  const start = formatDate(statement?.reportedStart)
  const end = formatDate(statement?.reportedEnd)
  if (evidence.relation === 'overlap') return {
    heading: `${impact} is reported during your stay`,
    body: start && end ? `Reported dates overlap your stay from ${start} to ${end}.` : 'Reported dates overlap your stay.',
  }
  if (evidence.relation === 'partial_overlap') return {
    heading: `${impact} is reported for part of your stay`,
    body: start && end ? `Reported dates overlap ${start} to ${end} of your stay.` : 'Reported dates overlap part of your stay.',
  }
  if (evidence.relation === 'no_overlap') return {
    heading: 'Reported work is outside your stay dates',
    body: start && end ? `The supplier reports ${start} to ${end}; these dates do not overlap your stay.` : 'The supplier reports this work outside your stay dates.',
  }
  return {
    heading: `${impact} is reported; timing is not clear`,
    body: 'The supplier did not provide enough timing information to rule out your stay.',
  }
}

export function HotelDisruptionEvidenceLedger({
  evidence = NO_HOTEL_DISRUPTION_EVIDENCE,
  analyticsKey,
  fixture = false,
}: {
  evidence?: HotelDisruptionEvidence
  analyticsKey?: string
  fixture?: boolean
}) {
  const statements = usableStatements(evidence)
  const state = effectiveState(evidence, statements)
  const ref = useReachedAnalytics({ evidence: { ...evidence, state }, event: 'hotel_disruption_detail_reached', surface: 'detail', analyticsKey })
  const loading = evidence.loadState === 'loading'
  const refreshing = evidence.loadState === 'refreshing'
  const copy = state === 'reported' ? reportedRelationship(evidence, statements[0]) : stateCopy[state]
  const unresolved = state === 'check_failed' || state === 'malformed' || state === 'conflicting' || state === 'stale_unconfirmed' || refreshing
  const error = state === 'check_failed' || state === 'malformed'

  return (
    <section
      ref={ref as React.RefObject<HTMLElement | null>}
      aria-labelledby="hotel-disruption-title"
      aria-busy={loading || refreshing || undefined}
      data-hotel-disruption-surface="detail"
      className={`mt-4 rounded-[var(--radius-control)] border p-4 sm:p-5 ${error ? 'border-[color:var(--error)] bg-[color:var(--error-soft)]' : unresolved ? 'border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]' : 'border-[color:var(--border)] bg-[color:var(--bg-raised)]'}`}
    >
      <h3 id="hotel-disruption-title" className="text-base font-medium text-[color:var(--text-1)]">Renovation and closures</h3>
      {fixture ? <p className="mt-2 text-xs font-medium uppercase tracking-wide text-[color:var(--warning)]">Synthetic fixture · not production evidence</p> : null}
      {loading ? (
        <div role="status" aria-live="polite" aria-atomic="true">
          <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-1)]">Checking renovation and closure details</p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">We’re checking supplier-reported information for this hotel.</p>
        </div>
      ) : (
        <>
          {refreshing ? (
            <div role="status" aria-live="polite" aria-atomic="true">
              <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-1)]">Refreshing supplier notice…</p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">Showing the earlier supplier statement while we check for an update.</p>
            </div>
          ) : null}
          <p className={`${refreshing ? 'mt-4' : 'mt-2'} text-sm font-medium leading-6 ${error ? 'text-[color:var(--error-text)]' : 'text-[color:var(--text-1)]'}`}>{copy.heading}</p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">{copy.body}</p>
          {statements.length ? (
            <div className="mt-4 space-y-5">
              {(state === 'conflicting' || state === 'stale_unconfirmed') ? (
                <p className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">{state === 'conflicting' ? 'Supplier statements' : 'Earlier supplier statement'}</p>
              ) : null}
              {statements.map(statement => <StatementBlock key={statement.id} statement={statement} />)}
            </div>
          ) : null}
          <p className="mt-4 text-xs leading-5 text-[color:var(--text-2)]">Supplier-reported information; expaify has not verified current conditions or guest impact.</p>
        </>
      )}
    </section>
  )
}

function handoffSummary(evidence: HotelDisruptionEvidence, state: HotelDisruptionEvidenceState, statements: SupplierDisruptionStatement[]): string {
  if (state !== 'reported') return stateCopy[state].handoff
  const cue = getHotelDisruptionResultCue(evidence)
  if (cue) return cue
  if (evidence.relation === 'no_overlap') return 'The supplier reports this work outside your stay dates.'
  const statement = statements[0]
  if (statement?.impactClasses.includes('non_guest_cosmetic') && statement.affectedScopes[0]) {
    return `The supplier reports ${statement.affectedScopes[0]} work, with no guest impact reported.`
  }
  return 'The supplier reports renovation, but did not identify an affected area or guest impact.'
}

export function HotelDisruptionHandoffNotice({
  evidence = NO_HOTEL_DISRUPTION_EVIDENCE,
  analyticsKey,
  fixture = false,
  onReached,
}: {
  evidence?: HotelDisruptionEvidence
  analyticsKey?: string
  fixture?: boolean
  onReached?: () => void
}) {
  const statements = usableStatements(evidence)
  const state = effectiveState(evidence, statements)
  const ref = useReachedAnalytics({ evidence: { ...evidence, state }, event: 'hotel_disruption_handoff_reached', surface: 'handoff', analyticsKey, onReached })
  const statement = statements[0]
  const checked = formatDate(statement?.observedAt)
  const neutral = state === 'not_returned' || (state === 'reported' && evidence.relation === 'no_overlap')

  return (
    <section
      ref={ref as React.RefObject<HTMLElement | null>}
      aria-labelledby="hotel-disruption-handoff-title"
      aria-busy={evidence.loadState !== 'ready' || undefined}
      data-hotel-disruption-surface="handoff"
      className={`mt-4 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] p-4 ${neutral ? 'bg-[color:var(--bg-raised)]' : 'bg-[color:var(--warning-soft)]'}`}
    >
      <h3 id="hotel-disruption-handoff-title" className="text-sm font-medium text-[color:var(--text-1)]">Before you continue</h3>
      {fixture ? <p className="mt-1 text-xs font-medium uppercase tracking-wide text-[color:var(--warning)]">Synthetic fixture · not production evidence</p> : null}
      {evidence.loadState === 'loading' ? (
        <p role="status" aria-live="polite" className="mt-1 text-sm leading-6 text-[color:var(--text-1)]">Checking renovation and closure details</p>
      ) : (
        <>
          <p className="mt-1 break-words text-sm leading-6 text-[color:var(--text-1)]">{handoffSummary(evidence, state, statements)}</p>
          {statement && state !== 'malformed' ? (
            <p className="mt-2 break-words text-xs leading-5 text-[color:var(--text-2)]">
              {checked ? `Reported by ${statement.sourceLabel}; checked ${checked}.` : 'Checked date not provided. This notice cannot be treated as current.'}
            </p>
          ) : null}
          {state === 'reported' || state === 'conflicting' || state === 'stale_unconfirmed' ? (
            <p className="mt-2 text-xs leading-5 text-[color:var(--text-2)]">Confirm current conditions, affected areas, and facility access with the provider before booking.</p>
          ) : null}
        </>
      )}
    </section>
  )
}
