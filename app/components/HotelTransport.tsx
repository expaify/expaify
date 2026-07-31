import type {
  HotelTransportAction,
  HotelTransportChargeBasis,
  HotelTransportConflictDimension,
  HotelTransportDirection,
  HotelTransportEvidence,
  HotelTransportOperator,
  HotelTransportServiceKind,
  HotelTransportTripBasis,
} from '@/lib/types'
import { formatMoney, isValidMoney } from '@/lib/money'

const PANEL_CLASS = 'rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 text-xs leading-5 text-[color:var(--text-2)]'
const MUTED_CLASS = 'mt-2 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] px-3 py-2 font-medium text-[color:var(--text-3)]'

type TransportView =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'not_returned' }
  | { kind: 'unclear'; conflicts: readonly HotelTransportConflictDimension[] }
  | { kind: 'unavailable'; sourceLabel: string; updated: string }
  | { kind: 'confirmed'; evidence: HotelTransportEvidence; sourceLabel: string; updated: string; refreshing: boolean }

function cleanText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const cleaned = value.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim()
  return cleaned || undefined
}

function formatUpdatedDate(value: string | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime()) || date.getTime() > Date.now()) return null
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function validSourceLabel(value: unknown): string | undefined {
  const sourceLabel = cleanText(value)
  if (!sourceLabel) return undefined
  const normalized = sourceLabel.toLowerCase()
  if (normalized === 'hotellook' || normalized === 'hotel provider' || normalized === 'provider' || normalized === 'unknown') {
    return undefined
  }
  return sourceLabel
}

function hasContradictoryCost(evidence: HotelTransportEvidence): boolean {
  return evidence.cost?.state === 'included' && evidence.cost.amount !== undefined
}

function getTransportView(evidence: HotelTransportEvidence | null | undefined): TransportView {
  if (!evidence || evidence.state === 'error') return { kind: 'error' }

  // Hotellook is retired. Stale objects and generic labels are not valid production provenance.
  const sourceLabel = validSourceLabel(evidence.sourceLabel)
  const updated = formatUpdatedDate(evidence.fetchedAt)
  const conflicts = evidence.conflictDimensions ?? []
  const hasConflict = conflicts.length > 0 || hasContradictoryCost(evidence)
  const hasProvenance = Boolean(sourceLabel && updated)

  if (evidence.state === 'loading' && evidence.facilityStatus !== 'confirmed') return { kind: 'loading' }
  if (hasConflict) return { kind: 'unclear', conflicts }

  if (evidence.facilityStatus === 'unavailable') {
    return hasProvenance
      ? { kind: 'unavailable', sourceLabel: sourceLabel!, updated: updated! }
      : { kind: 'unclear', conflicts: [] }
  }
  if (evidence.facilityStatus === 'not_returned') {
    return evidence.state === 'ready'
      ? { kind: 'not_returned' }
      : { kind: 'loading' }
  }
  if (evidence.facilityStatus !== 'confirmed' || !hasProvenance || !evidence.serviceKind) {
    return { kind: 'unclear', conflicts: [] }
  }

  return {
    kind: 'confirmed',
    evidence,
    sourceLabel: sourceLabel!,
    updated: updated!,
    refreshing: evidence.state === 'loading',
  }
}

const chargeBasisLabels: Record<HotelTransportChargeBasis, string> = {
  per_person: 'per person',
  per_vehicle: 'per vehicle',
  per_booking: 'per booking',
  unknown: 'charge basis not documented',
}

const tripBasisLabels: Record<HotelTransportTripBasis, string> = {
  each_way: 'each way',
  round_trip: 'round trip',
  unknown: 'trip basis not documented',
}

function summaryCopy(view: TransportView): { visible: string; aria: string; warning?: boolean } {
  if (view.kind === 'loading') return {
    visible: 'Checking airport transfer…',
    aria: 'Checking airport transfer details.',
  }
  if (view.kind === 'error') return {
    visible: 'Airport transfer details could not be checked',
    aria: 'Airport transfer details could not be checked',
  }
  if (view.kind === 'not_returned') return {
    visible: 'Airport transfer not documented',
    aria: 'Airport transfer not documented by this provider. This does not mean no service exists.',
  }
  if (view.kind === 'unclear') return {
    visible: 'Airport transfer details are unclear',
    aria: 'Airport transfer details are unclear. Confirm directly with the property before arrival.',
  }
  if (view.kind === 'unavailable') return {
    visible: 'No airport transfer reported',
    aria: `No airport transfer reported by ${view.sourceLabel}.`,
    warning: true,
  }

  const cost = view.evidence.cost
  if (cost?.state === 'included') return {
    visible: 'Complimentary airport transfer',
    aria: `Complimentary airport transfer reported by ${view.sourceLabel}. Review hours and advance instructions in details.`,
  }
  if (cost?.state === 'paid') {
    const validAmount = cost.amount && isValidMoney(cost.amount) && cost.amount.priceCents > 0
      ? formatMoney(cost.amount)
      : null
    const hasBothBases = cost.chargeBasis !== 'unknown' && cost.tripBasis !== 'unknown'
    if (!validAmount) return {
      visible: 'Airport transfer · Paid; amount not documented',
      aria: 'Paid airport transfer. Amount not documented. Review cost basis, hours, and advance instructions in details.',
    }
    if (!hasBothBases) return {
      visible: `Airport transfer · ${validAmount}; charge basis not fully documented`,
      aria: `Paid airport transfer. ${validAmount}. Charge basis not fully documented. Review details.`,
    }
    const bases = `${chargeBasisLabels[cost.chargeBasis]}, ${tripBasisLabels[cost.tripBasis]}`
    return {
      visible: `Airport transfer · ${validAmount} ${bases}`,
      aria: `Paid airport transfer. ${validAmount} ${bases}. Reported by ${view.sourceLabel}. Review hours and advance instructions in details.`,
    }
  }
  return {
    visible: 'Airport transfer · Cost not documented',
    aria: 'Airport transfer reported. Cost not documented. Review hours and advance instructions in details.',
  }
}

export function HotelTransportSummary({ evidence }: { evidence?: HotelTransportEvidence | null }) {
  const copy = summaryCopy(getTransportView(evidence))
  return (
    <p
      className={`mt-1.5 break-words text-xs font-medium leading-5 ${copy.warning ? 'text-[color:var(--warning)]' : 'text-[color:var(--text-2)]'}`}
      aria-label={copy.aria}
    >
      {copy.visible}
    </p>
  )
}

const serviceLabels: Record<HotelTransportServiceKind, string> = {
  airport_shuttle: 'Airport shuttle',
  airport_transfer: 'Airport transfer',
  other_documented: 'Documented airport transport',
}

const directionLabels: Record<HotelTransportDirection, string> = {
  to_property: 'To the property',
  from_property: 'From the property',
  round_trip: 'Round trip',
  unknown: 'Direction not documented',
}

const operatorLabels: Record<HotelTransportOperator, string> = {
  property: 'Property operated',
  third_party: 'Third-party operated',
  unknown: 'Operator not documented',
}

function serviceCopy(evidence: HotelTransportEvidence): string {
  const label = serviceLabels[evidence.serviceKind!]
  const endpoint = cleanText(evidence.endpointName)
  const direction = evidence.direction ?? 'unknown'
  const operator = evidence.operator ?? 'unknown'
  const service = endpoint
    ? direction === 'unknown'
      ? `${label} for ${endpoint} · Direction not documented`
      : `${label} between ${endpoint} and the property · ${directionLabels[direction]}`
    : `${label} · Airport endpoint not documented`
  return `${service} · ${operatorLabels[operator]}`
}

function costCopy(evidence: HotelTransportEvidence): string {
  const cost = evidence.cost
  if (!cost || cost.state === 'unknown') return 'Cost not documented. Confirm any charge with the property.'
  if (cost.state === 'included') return 'Complimentary.'
  const amount = cost.amount && isValidMoney(cost.amount) && cost.amount.priceCents > 0
    ? formatMoney(cost.amount)
    : null
  return amount
    ? `${amount} ${chargeBasisLabels[cost.chargeBasis]}, ${tripBasisLabels[cost.tripBasis]}. Separate from the displayed nightly room rate.`
    : 'Paid; amount not documented. Separate from the displayed nightly room rate.'
}

function isValidTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function hoursCopy(evidence: HotelTransportEvidence): string {
  const hours = evidence.hours
  if (!hours || hours.mode === 'unknown') return 'Hours not documented. Confirm operating hours for your arrival.'
  if (hours.mode === '24_hours') return '24 hours. Your arrival-time fit was not checked.'
  if (hours.mode === 'on_request') return 'On request. Your arrival-time fit was not checked.'
  const windows = hours.windows?.filter(window => isValidTime(window.startLocal) && isValidTime(window.endLocal)) ?? []
  if (!windows.length) return 'Hours not documented. Confirm operating hours for your arrival.'
  const display = windows.map(window => `${cleanText(window.days) ? `${cleanText(window.days)} ` : ''}${window.startLocal}–${window.endLocal}`).join('; ')
  const timezone = cleanText(hours.timezone)
  return timezone
    ? `${display} ${timezone}. Your arrival-time fit was not checked.`
    : `${display}, property local time. Your arrival-time fit was not checked.`
}

const actionLabels: Record<HotelTransportAction, string> = {
  none_documented: 'No advance action documented. Confirm this remains current before arrival.',
  reserve_before_arrival: 'Reserve before arrival.',
  call_on_arrival: 'Call the property on arrival.',
  contact_property: 'Contact the property before arrival.',
  unknown: 'Advance instructions not documented. Confirm directly with the property.',
}

function actionCopy(evidence: HotelTransportEvidence): string {
  const action = evidence.action
  if (!action) return actionLabels.unknown
  let copy = actionLabels[action.kind]
  const deadline = cleanText(action.advanceDeadline)
  const instruction = cleanText(action.instruction)
  if (action.kind === 'reserve_before_arrival' && deadline) copy += ` ${deadline}.`
  if (instruction) copy += ` ${instruction}`
  return copy
}

const conflictLabels: Record<HotelTransportConflictDimension, string> = {
  facility: 'service availability',
  service_kind: 'service type',
  direction: 'direction',
  operator: 'operator',
  cost: 'cost',
  hours: 'hours',
  action: 'advance action',
}

function TransportFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-[color:var(--text-1)]">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-[color:var(--text-2)]">{value}</dd>
    </div>
  )
}

export function HotelTransportSection({
  hotelId,
  evidence,
  bookingReview = false,
}: {
  hotelId: string
  evidence?: HotelTransportEvidence | null
  bookingReview?: boolean
}) {
  const view = getTransportView(evidence)
  const titleId = `hotel-transport-title-${hotelId}${bookingReview ? '-review' : ''}`

  return (
    <section className={PANEL_CLASS} aria-labelledby={titleId}>
      <h3 id={titleId} className="font-medium text-[color:var(--text-1)]">Airport transfer</h3>
      {view.kind === 'loading' ? (
        <p className="mt-2 font-medium text-[color:var(--text-3)]" role="status" aria-live="polite">
          Checking airport transfer details…
        </p>
      ) : view.kind === 'error' ? (
        <p className={MUTED_CLASS} role="status" aria-live="polite">
          Airport transfer details could not be checked. Confirm directly with the property before arrival.
        </p>
      ) : view.kind === 'not_returned' ? (
        <p
          className={MUTED_CLASS}
          aria-label="Airport transfer. Not documented by the hotel provider. Confirm directly with the property before arrival."
        >
          The hotel provider did not document an airport transfer. Confirm directly with the property before arrival.
        </p>
      ) : view.kind === 'unclear' ? (
        <div className={MUTED_CLASS}>
          <p>Airport transfer information from this provider is unclear. Confirm cost, hours, and required advance action directly with the property before arrival.</p>
          {view.conflicts.length ? (
            <p className="mt-1 break-words">Conflicting information: {view.conflicts.map(item => conflictLabels[item]).join(', ')}.</p>
          ) : null}
        </div>
      ) : view.kind === 'unavailable' ? (
        <div
          className="mt-2 rounded-[var(--radius-control)] bg-[color:var(--warning-soft)] px-3 py-2 font-medium text-[color:var(--warning)]"
          aria-label={`Airport transfer. Unavailable. The provider reports no airport transfer at this property. Source: ${view.sourceLabel}. Updated ${view.updated}.`}
        >
          <p>The provider reports no airport transfer at this property.</p>
          <p className="mt-1 break-words text-[color:var(--text-3)]">Source: {view.sourceLabel}. Updated {view.updated}.</p>
        </div>
      ) : (
        <>
          <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6">
            <TransportFact label="Service" value={serviceCopy(view.evidence)} />
            <TransportFact label="Cost" value={costCopy(view.evidence)} />
            <TransportFact label="Hours" value={hoursCopy(view.evidence)} />
            <TransportFact label="Before arrival" value={actionCopy(view.evidence)} />
            <div className="sm:col-span-2">
              <dt className="sr-only">Source</dt>
              <dd className="mt-1 break-words text-[color:var(--text-3)]">Source: {view.sourceLabel}. Updated {view.updated}.</dd>
            </div>
          </dl>
          {view.refreshing ? (
            <p className="mt-3 font-medium text-[color:var(--text-3)]" role="status" aria-live="polite">
              Refreshing airport transfer details…
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}

export function getAirportDistanceTransportCaveat(evidence?: HotelTransportEvidence | null): string {
  const view = getTransportView(evidence)
  if (view.kind === 'confirmed' || view.kind === 'unavailable') {
    return 'Straight-line distance only. See Airport transfer for service details.'
  }
  if (view.kind === 'not_returned') return 'Straight-line distance only. Airport transfer not documented.'
  if (view.kind === 'error') return 'Straight-line distance only. Airport transfer details could not be checked.'
  return 'Straight-line distance only. Airport transfer availability is not confirmed.'
}

export function getHotelTransportHandoffGuidance(evidence?: HotelTransportEvidence | null): string {
  const view = getTransportView(evidence)
  if (view.kind === 'unavailable') return 'The selected offer reports no airport transfer. Arrange arrival transport separately.'
  if (view.kind === 'not_returned') return 'The provider did not document airport-transfer details. Check directly with the property before arrival.'
  if (view.kind === 'error' || view.kind === 'unclear' || view.kind === 'loading') {
    return 'Airport-transfer details were not confirmed. Check directly with the property before arrival.'
  }

  const evidenceValue = view.evidence
  const unresolved = !evidenceValue.cost || evidenceValue.cost.state === 'unknown' ||
    !evidenceValue.hours || evidenceValue.hours.mode === 'unknown' ||
    !evidenceValue.action || evidenceValue.action.kind === 'unknown'
  const base = unresolved
    ? 'Confirm airport-transfer cost, hours, and required advance action with the provider before arrival.'
    : 'Reconfirm airport-transfer details with the provider before arrival.'
  return evidenceValue.cost?.state === 'paid'
    ? `${base} The transport charge is separate from the displayed nightly room rate.`
    : base
}
