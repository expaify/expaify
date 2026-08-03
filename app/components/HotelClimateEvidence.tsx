'use client'

import { useId, useState } from 'react'
import type {
  HotelClimateDimension,
  HotelClimateEvidence,
  HotelClimateRow,
  HotelClimateScope,
  HotelClimateStatement,
} from '@/lib/types'
import { getHotelClimateHandoffGuidance, validateHotelClimateEvidence } from '@/lib/hotels/climateEvidence'

const LABELS: Record<HotelClimateDimension, string> = {
  cooling: 'Cooling',
  heating: 'Heating',
  guest_control: 'Room temperature adjustment',
}

function stateSentence(row: HotelClimateRow): string {
  if (row.dimension === 'cooling') {
    if (row.value === 'present') return 'Cooling is reported.'
    if (row.value === 'explicitly_absent') return 'Cooling is reported absent.'
    if (row.value === 'not_provided') return 'Cooling was not provided by this provider.'
    if (row.value === 'check_failed') return 'Cooling details could not be checked.'
    return 'Cooling statements do not agree.'
  }
  if (row.dimension === 'heating') {
    if (row.value === 'present') return 'Heating is reported.'
    if (row.value === 'explicitly_absent') return 'Heating is reported absent.'
    if (row.value === 'not_provided') return 'Heating was not provided by this provider.'
    if (row.value === 'check_failed') return 'Heating details could not be checked.'
    return 'Heating statements do not agree.'
  }
  if (row.value === 'guest_adjustable') return 'The provider states that guests can adjust the room temperature.'
  if (row.value === 'property_controlled') return 'The provider states that room temperature is property-controlled.'
  if (row.value === 'not_provided') return 'Room temperature adjustment was not stated.'
  if (row.value === 'check_failed') return 'Room temperature adjustment could not be checked.'
  return 'Room temperature adjustment statements do not agree.'
}

function unavailableSecondary(row: HotelClimateRow): string | null {
  if (row.value === 'not_provided') return 'This is missing information, not a reported presence or absence.'
  if (row.value === 'check_failed') return 'The hotel, price, and Deal Score are still available.'
  if (row.value === 'conflicting') return 'We are not choosing one statement as correct. Confirm the current room and rate with the provider.'
  return null
}

function formatObservedAt(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(value))
}

function scopeLabel(statement: HotelClimateStatement, dimension: HotelClimateDimension, explicitAbsence = false): string {
  let scope: string
  if (statement.scope === 'selected_room_rate') scope = 'For this room and rate.'
  else if (statement.scope === 'room_category') scope = `For ${statement.roomCategoryLabel}. This does not confirm the selected room or rate.`
  else scope = `At this property. This does not confirm ${dimension === 'guest_control' ? 'room temperature adjustment' : dimension} for a specific room or rate.`

  if (explicitAbsence) return `${scope} This is a provider-stated absence, not missing information.`
  if (statement.value === 'property_controlled') return `${scope} This does not show that guests can set the temperature themselves.`
  return scope
}

function shortScopeLabel(statement: HotelClimateStatement): string {
  if (statement.scope === 'selected_room_rate') return 'For this room and rate.'
  if (statement.scope === 'room_category') return `For ${statement.roomCategoryLabel}.`
  return 'At this property.'
}

function qualification(statement: HotelClimateStatement): string | null {
  const value = statement.operatingQualification
  if (!value) return null
  if (value.kind === 'year_round') return 'Operation reported year-round.'
  if (value.kind === 'schedule_not_stated') return 'Operating schedule not stated.'
  return `Operating period: ${value.label}.`
}

function shouldShowWording(statement: HotelClimateStatement): boolean {
  return Boolean(statement.sourceWording) && (
    statement.value === 'property_controlled' ||
    statement.value === 'explicitly_absent' ||
    statement.operatingQualification?.kind === 'seasonal_period'
  )
}

function mostSpecificStatement(row: HotelClimateRow): HotelClimateStatement | undefined {
  const rank: Record<HotelClimateScope, number> = { property: 0, room_category: 1, selected_room_rate: 2 }
  return row.statements.reduce<HotelClimateStatement | undefined>((best, statement) => (
    !best || rank[statement.scope] > rank[best.scope] ? statement : best
  ), undefined)
}

function ClimateEvidenceRow({ row, unsupported }: { row: HotelClimateRow; unsupported: boolean }) {
  const warning = row.isStale || row.value === 'explicitly_absent' || row.value === 'conflicting'
  const failed = row.value === 'check_failed'
  const statement = mostSpecificStatement(row)
  const rowClass = failed
    ? 'border-[color:var(--border-strong)] bg-[color:var(--error-soft)]'
    : warning
      ? 'border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]'
      : 'border-[color:var(--border)] bg-[color:var(--bg-surface)]'

  if (unsupported) {
    return (
      <div className={`min-w-0 rounded-[var(--radius-control)] border p-3 ${rowClass}`}>
        <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">{LABELS[row.dimension]}</dt>
        <dd className="mt-1 break-words text-sm font-medium leading-6 text-[color:var(--text-1)]">{LABELS[row.dimension]} details are not supported by this provider connection.</dd>
        <dd className="mt-1 break-words text-xs leading-5 text-[color:var(--text-2)]">No check was attempted. Confirm this with the provider if it matters to your stay.</dd>
      </div>
    )
  }

  return (
    <div className={`min-w-0 rounded-[var(--radius-control)] border p-3 ${rowClass}`}>
      <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">{LABELS[row.dimension]}</dt>
      <dd className={`mt-1 break-words text-sm font-medium leading-6 ${warning ? 'text-[color:var(--warning)]' : failed ? 'text-[color:var(--error-text)]' : 'text-[color:var(--text-1)]'}`}>
        {stateSentence(row)}
      </dd>
      {row.isStale ? (
        <dd className="mt-1 break-words text-xs font-medium leading-5 text-[color:var(--warning)]">Earlier provider information could not be reconfirmed. Do not rely on it as current.</dd>
      ) : null}
      {unavailableSecondary(row) ? (
        <dd className="mt-1 break-words text-xs leading-5 text-[color:var(--text-2)]">{unavailableSecondary(row)}</dd>
      ) : null}
      {row.value === 'conflicting' ? (
        <dd className="mt-2 space-y-2 break-words text-xs leading-5 text-[color:var(--text-2)]">
          {row.statements.slice(0, 3).map(conflict => (
            <p key={conflict.id}>
              {conflict.value === 'present' ? `${LABELS[row.dimension]} is reported.` : conflict.value === 'explicitly_absent' ? `${LABELS[row.dimension]} is reported absent.` : conflict.value === 'guest_adjustable' ? 'Guests can adjust the room temperature.' : 'Room temperature is property-controlled.'}{' '}
              {shortScopeLabel(conflict)} Source: {conflict.sourceLabel} · Checked {formatObservedAt(conflict.observedAt)}.
              {conflict.sourceWording ? ` Provider wording: “${conflict.sourceWording}”` : ''}
            </p>
          ))}
          {row.statements.length > 3 ? <p>Additional provider statements were withheld because they do not resolve the conflict.</p> : null}
        </dd>
      ) : statement ? (
        <>
          <dd className="mt-1 break-words text-xs leading-5 text-[color:var(--text-2)]">
            {scopeLabel(statement, row.dimension, row.value === 'explicitly_absent')}
            {qualification(statement) ? ` ${qualification(statement)}` : ''}
          </dd>
          <dd className="mt-2 break-words text-xs leading-5 text-[color:var(--text-3)]">
            Source: {statement.sourceLabel} · Checked {formatObservedAt(statement.observedAt)}
            {shouldShowWording(statement) ? <span className="block">Provider wording: “{statement.sourceWording}”</span> : null}
          </dd>
        </>
      ) : null}
    </div>
  )
}

function FailedRows() {
  return (
    <dl className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
      {(['cooling', 'heating', 'guest_control'] as const).map(dimension => (
        <ClimateEvidenceRow key={dimension} unsupported={false} row={{ dimension, value: 'check_failed', statements: [], isStale: false }} />
      ))}
    </dl>
  )
}

export type HotelClimateEvidenceLedgerProps = {
  evidence?: HotelClimateEvidence
  headingLevel?: 'h2' | 'h3'
  continuityFailed?: boolean
  retry?: () => Promise<HotelClimateEvidence | null>
}

type LedgerViewProps = {
  evidence?: HotelClimateEvidence
  headingLevel: 'h2' | 'h3'
  continuityFailed: boolean
  headingId: string
  retrying?: boolean
  announcement?: string
  canRetry?: boolean
  onRetry?: () => void
}

function ClimateLedgerView({ evidence, headingLevel, continuityFailed, headingId, retrying = false, announcement = '', canRetry = false, onRetry }: LedgerViewProps) {
  const validated = validateHotelClimateEvidence(evidence)
  const malformed = evidence !== undefined && validated === null
  const failedContinuity = continuityFailed || evidence === undefined
  const busy = retrying || validated?.loadState === 'loading' || validated?.loadState === 'refreshing'
  const Heading = headingLevel
  return (
    <section aria-labelledby={headingId} aria-busy={busy || undefined} className="mt-5 min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5 sm:p-4">
      <Heading id={headingId} className="text-base font-medium text-[color:var(--text-1)]">Room climate evidence</Heading>
      <p className="mt-1 text-xs leading-5 text-[color:var(--text-2)]">Provider-reported equipment and control only. This does not predict room temperature or comfort.</p>
      <div role="status" aria-live="polite" aria-atomic="true" className="mt-2 text-xs font-medium leading-5 text-[color:var(--text-2)]">
        {announcement || (validated?.loadState === 'loading' ? 'Checking room climate details…' : validated?.loadState === 'refreshing' ? 'Checking for updated room climate details…' : '')}
      </div>

      {validated?.loadState === 'loading' ? (
        <dl className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3" aria-hidden="true">
          {Object.values(LABELS).map(label => <div key={label} className="min-h-32 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-3"><div className="skeleton h-3 w-28 rounded-full" /><div className="skeleton mt-3 h-4 w-full rounded-full" /><div className="skeleton mt-2 h-3 w-4/5 rounded-full" /></div>)}
        </dl>
      ) : failedContinuity || malformed ? (
        <>
          <p className={`mt-3 text-sm font-medium leading-6 ${malformed ? 'text-[color:var(--error-text)]' : 'text-[color:var(--warning)]'}`} role={malformed ? 'alert' : undefined}>
            {malformed ? 'Returned room climate details could not be verified.' : 'Room climate details could not be carried into this review.'}
          </p>
          <FailedRows />
          {failedContinuity ? <p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">Check cooling, heating, and room temperature adjustment with the provider.</p> : null}
        </>
      ) : validated ? (
        <>
          {validated.rows.every(row => row.value === 'not_provided') && validated.capability === 'supported' ? <p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">The provider returned no room climate details for this offer.</p> : null}
          <dl className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            {validated.rows.map(row => <ClimateEvidenceRow key={row.dimension} row={row} unsupported={validated.capability === 'unsupported'} />)}
          </dl>
        </>
      ) : <FailedRows />}

      {canRetry ? (
        <button type="button" onClick={onRetry} disabled={retrying} aria-disabled={retrying ? 'true' : undefined} className="btn btn-outline mt-4 min-h-11 w-full sm:w-auto focus-visible:shadow-[var(--focus-ring)]">
          {retrying ? 'Checking room climate details…' : 'Try climate check again'}
        </button>
      ) : null}
    </section>
  )
}

function InteractiveHotelClimateEvidenceLedger({ evidence: initialEvidence, headingLevel = 'h3', continuityFailed = false, retry }: HotelClimateEvidenceLedgerProps & { retry: () => Promise<HotelClimateEvidence | null> }) {
  const headingId = `hotel-climate-${useId().replace(/:/g, '')}`
  const [evidence, setEvidence] = useState(initialEvidence)
  const [retrying, setRetrying] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const validated = validateHotelClimateEvidence(evidence)
  const malformed = evidence !== undefined && validated === null
  const canRetry = malformed || validated?.loadState === 'failed' || validated?.rows.some(row => row.value === 'check_failed' || (row.isStale && row.refreshFailed))

  const handleRetry = async () => {
    if (!retry || retrying) return
    setRetrying(true)
    setAnnouncement('Checking room climate details…')
    try {
      const next = await retry()
      const checked = validateHotelClimateEvidence(next)
      if (checked) {
        setEvidence(checked)
        setAnnouncement('Room climate details updated.')
      } else setAnnouncement('Room climate details still could not be checked. Try again or confirm with the provider.')
    } catch {
      setAnnouncement('Room climate details still could not be checked. Try again or confirm with the provider.')
    } finally {
      setRetrying(false)
    }
  }

  return <ClimateLedgerView evidence={evidence} headingLevel={headingLevel} continuityFailed={continuityFailed} headingId={headingId} retrying={retrying} announcement={announcement} canRetry={canRetry} onRetry={handleRetry} />
}

export function HotelClimateEvidenceLedger(props: HotelClimateEvidenceLedgerProps) {
  if (props.retry) return <InteractiveHotelClimateEvidenceLedger {...props} retry={props.retry} />
  return <ClimateLedgerView evidence={props.evidence} headingLevel={props.headingLevel ?? 'h3'} continuityFailed={props.continuityFailed ?? false} headingId="hotel-climate-evidence-title" />
}

export function HotelClimateHandoffCheck({ evidence }: { evidence?: HotelClimateEvidence }) {
  const guidance = getHotelClimateHandoffGuidance(evidence)
  return (
    <section aria-labelledby="room-climate-check-title" className="mt-5 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5 sm:p-4">
      <h3 id="room-climate-check-title" className="text-sm font-medium text-[color:var(--text-1)]">Room climate check</h3>
      {guidance.length ? (
        <ul className="mt-2 space-y-2">
          {guidance.map(item => <li key={item} className="flex gap-2 text-sm leading-6 text-[color:var(--text-2)]"><span aria-hidden="true">•</span><span>{item}</span></li>)}
        </ul>
      ) : <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">The provider evidence above covers cooling, heating, and room temperature adjustment for this room and rate. Recheck the current room details before payment.</p>}
    </section>
  )
}
