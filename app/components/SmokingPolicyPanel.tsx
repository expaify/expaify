export type HotelSmokingEvidenceState =
  | 'confirmed'
  | 'ambiguous'
  | 'conflicting'
  | 'not_provided'
  | 'unavailable'

export type HotelSmokingPolicyLoadState = 'loading' | 'ready' | 'refreshing' | 'error'

export type RoomSmokingPolicyValue =
  | 'all_rooms_non_smoking'
  | 'smoking_rooms_offered'
  | 'selected_room_non_smoking'
  | 'selected_room_smoking'

export type PropertySmokingPolicyValue =
  | 'smoke_free_property'
  | 'indoor_common_areas_smoke_free'
  | 'designated_smoking_areas'
  | 'smoking_permitted_in_stated_areas'

export type HotelSmokingScope =
  | 'property_room_inventory'
  | 'property_room_capability'
  | 'selected_room_rate'
  | 'entire_property'
  | 'indoor_common_areas'
  | 'designated_areas'
  | 'stated_areas'
  | 'unclear'

export type SupplierSmokingStatement = {
  id: string
  value?: RoomSmokingPolicyValue | PropertySmokingPolicyValue
  scope: HotelSmokingScope
  sourceLabel: string
  sourceText: string
  fetchedAt: string
  checkin?: string
  checkout?: string
  roomId?: string
  rateId?: string
}

export type HotelSmokingDimension<T> = {
  state: HotelSmokingEvidenceState
  value?: T
  scope?: HotelSmokingScope
  statements: readonly SupplierSmokingStatement[]
  /** A previously valid statement that the data layer has expired. */
  isStale?: boolean
}

export type HotelSmokingPolicyView = {
  loadState: HotelSmokingPolicyLoadState
  room: HotelSmokingDimension<RoomSmokingPolicyValue>
  property: HotelSmokingDimension<PropertySmokingPolicyValue>
  /** Set only when a refresh failed and the stale snapshot is intentionally retained. */
  refreshFailed?: boolean
}

type DimensionKind = 'room' | 'property'

const EVIDENCE_BOUNDARY = 'Supplier policy; expaify has not verified enforcement or smoke conditions.'

const scopeLabels: Record<HotelSmokingScope, string> = {
  property_room_inventory: 'All guest-room inventory',
  property_room_capability: 'Property room capability',
  selected_room_rate: 'Selected room and rate',
  entire_property: 'Entire property',
  indoor_common_areas: 'Indoor common areas',
  designated_areas: 'Designated areas',
  stated_areas: 'Supplier-stated areas',
  unclear: 'Scope unclear',
}

const stateLabels: Record<HotelSmokingEvidenceState, string> = {
  confirmed: 'Confirmed supplier statement',
  ambiguous: 'Scope unclear',
  conflicting: 'Conflicting details',
  not_provided: 'Not provided',
  unavailable: 'Could not check',
}

const stateTone: Record<HotelSmokingEvidenceState, string> = {
  confirmed: 'text-[color:var(--brand)]',
  ambiguous: 'text-[color:var(--warning)]',
  conflicting: 'text-[color:var(--warning)]',
  not_provided: 'text-[color:var(--text-3)]',
  unavailable: 'text-[color:var(--error)]',
}

function formatObservedDate(value: string): string | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function formatStayDate(value?: string): string {
  if (!value) return 'date unavailable'
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function statementMetadata(statement: SupplierSmokingStatement) {
  const observed = formatObservedDate(statement.fetchedAt)

  return (
    <p className="mt-2 break-words text-[color:var(--text-3)]">
      {statement.sourceLabel ? `Source: ${statement.sourceLabel}. ` : null}
      {observed ? (
        <>Observed <time dateTime={statement.fetchedAt}>{observed}</time>.</>
      ) : (
        'Observation time unavailable. This evidence cannot be treated as confirmed.'
      )}
    </p>
  )
}

function SupplierWording({ statement }: { statement: SupplierSmokingStatement }) {
  return (
    <div className="mt-2 min-w-0">
      <p className="font-bold text-[color:var(--text-1)]">Supplier wording</p>
      <blockquote className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] border-l-2 border-[color:var(--border-strong)] pl-3 text-[color:var(--text-2)]">
        {statement.sourceText}
      </blockquote>
      <p className="mt-2 font-medium text-[color:var(--text-2)]">Scope: {scopeLabels[statement.scope]}</p>
      {statementMetadata(statement)}
    </div>
  )
}

function hasCurrentProvenance(statement: SupplierSmokingStatement | undefined): statement is SupplierSmokingStatement {
  if (!statement || !statement.sourceLabel.trim() || !statement.sourceText.trim()) return false
  return !Number.isNaN(new Date(statement.fetchedAt).getTime())
}

function hasQualifiedRoomConfirmation(dimension: HotelSmokingDimension<RoomSmokingPolicyValue>): boolean {
  if (dimension.state !== 'confirmed' || dimension.isStale || !dimension.value) return false

  const statement = dimension.statements[0]
  if (!hasCurrentProvenance(statement) || statement.value !== dimension.value) return false

  if (dimension.value === 'all_rooms_non_smoking') {
    return dimension.scope === 'property_room_inventory' && statement.scope === 'property_room_inventory'
  }

  if (dimension.value === 'smoking_rooms_offered') {
    return dimension.scope === 'property_room_capability' && statement.scope === 'property_room_capability'
  }

  return dimension.scope === 'selected_room_rate'
    && statement.scope === 'selected_room_rate'
    && Boolean(statement.checkin && statement.checkout && statement.roomId && statement.rateId)
}

function hasQualifiedPropertyConfirmation(dimension: HotelSmokingDimension<PropertySmokingPolicyValue>): boolean {
  if (dimension.state !== 'confirmed' || dimension.isStale || !dimension.value) return false

  const statement = dimension.statements[0]
  if (!hasCurrentProvenance(statement) || statement.value !== dimension.value) return false

  const expectedScope: Record<PropertySmokingPolicyValue, HotelSmokingScope> = {
    smoke_free_property: 'entire_property',
    indoor_common_areas_smoke_free: 'indoor_common_areas',
    designated_smoking_areas: 'designated_areas',
    smoking_permitted_in_stated_areas: 'stated_areas',
  }

  return dimension.scope === expectedScope[dimension.value] && statement.scope === expectedScope[dimension.value]
}

function getConfirmedCopy(
  kind: DimensionKind,
  dimension: HotelSmokingDimension<RoomSmokingPolicyValue | PropertySmokingPolicyValue>,
) {
  const statement = dimension.statements[0]
  const value = dimension.value

  if (kind === 'room') {
    if (value === 'all_rooms_non_smoking') {
      return {
        claim: 'All rooms non-smoking',
        support: 'The supplier states that all guest rooms at this property are non-smoking.',
      }
    }
    if (value === 'smoking_rooms_offered') {
      return {
        claim: 'Property offers smoking rooms',
        support: 'Supplier says this property offers smoking rooms. Availability for your dates is not confirmed.',
      }
    }
    if (value === 'selected_room_non_smoking' || value === 'selected_room_smoking') {
      return {
        claim: value === 'selected_room_non_smoking'
          ? 'Selected room: Non-smoking'
          : 'Selected room: Smoking permitted',
        support: `Confirmed for ${formatStayDate(statement?.checkin)} to ${formatStayDate(statement?.checkout)} and this selected room and rate.`,
      }
    }
  }

  if (value === 'smoke_free_property') {
    return {
      claim: 'Smoke-free property',
      support: 'The supplier applies this rule to the entire property.',
    }
  }
  if (value === 'indoor_common_areas_smoke_free') {
    return {
      claim: 'Indoor common areas are smoke-free',
      support: 'This statement applies to indoor shared areas, not necessarily guest rooms or outdoor areas.',
    }
  }
  if (value === 'designated_smoking_areas') {
    return {
      claim: 'Designated smoking areas',
      support: 'The supplier restricts smoking to designated areas. Review the supplier wording for location details.',
    }
  }
  if (value === 'smoking_permitted_in_stated_areas') {
    return {
      claim: 'Smoking permitted in stated areas',
      support: 'The supplier permits smoking only in the areas named below.',
    }
  }

  return {
    claim: 'Smoking policy could not be checked.',
    support: 'Confirm this with the booking partner before you book.',
  }
}

function SmokingPolicyDimension({
  kind,
  dimension,
  headingId,
  forceUnavailable = false,
  forceStale = false,
}: {
  kind: DimensionKind
  dimension: HotelSmokingDimension<RoomSmokingPolicyValue | PropertySmokingPolicyValue>
  headingId: string
  forceUnavailable?: boolean
  forceStale?: boolean
}) {
  const heading = kind === 'room' ? 'Room policy' : 'Property & common areas'
  const state = forceUnavailable ? 'unavailable' : dimension.state
  const hasPriorStatement = dimension.statements.length > 0
  const stale = !forceUnavailable && hasPriorStatement && (forceStale || dimension.isStale)
  const confirmedCopy = state === 'confirmed' ? getConfirmedCopy(kind, dimension) : null

  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-3 py-3"
    >
      <h5 id={headingId} className="text-sm font-bold leading-5 text-[color:var(--text-1)]">{heading}</h5>
      <p className={`mt-1 text-xs font-bold leading-5 ${stale ? 'text-[color:var(--warning)]' : stateTone[state]}`}>
        {stale ? 'Previous supplier policy — refresh required' : stateLabels[state]}
      </p>

      {stale ? (
        <p className="mt-1 rounded-[var(--radius-control)] bg-[color:var(--warning-soft)] px-2.5 py-2 font-medium text-[color:var(--warning)]">
          This supplier statement is out of date and is not treated as a current confirmation.
        </p>
      ) : null}

      {state === 'confirmed' && confirmedCopy ? (
        <>
          <p className="mt-1 font-bold text-[color:var(--text-1)]">{confirmedCopy.claim}</p>
          <p className="mt-1 font-medium text-[color:var(--text-2)]">{confirmedCopy.support}</p>
          {dimension.statements[0] ? <SupplierWording statement={dimension.statements[0]} /> : null}
        </>
      ) : null}

      {state === 'ambiguous' ? (
        <>
          <p className="mt-1 font-medium text-[color:var(--text-2)]">Policy wording provided; scope unclear.</p>
          {dimension.statements.map(statement => <SupplierWording key={statement.id} statement={statement} />)}
        </>
      ) : null}

      {state === 'conflicting' ? (
        <>
          <p className="mt-1 rounded-[var(--radius-control)] bg-[color:var(--warning-soft)] px-2.5 py-2 font-medium text-[color:var(--warning)]">
            Supplier policy details conflict. Confirm before booking.
          </p>
          <p className="mt-2 font-bold text-[color:var(--text-1)]">
            Supplier statements ({dimension.statements.length})
          </p>
          <p className="sr-only">{dimension.statements.length} current supplier statements conflict. Confirm before booking.</p>
          <ol className="mt-2 space-y-2" aria-label="Conflicting supplier statements">
            {dimension.statements.map(statement => (
              <li key={statement.id} className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] px-2.5 py-2">
                <p className="font-bold text-[color:var(--text-1)]">Scope: {scopeLabels[statement.scope]}</p>
                <blockquote className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] border-l-2 border-[color:var(--border-strong)] pl-3 text-[color:var(--text-2)]">
                  {statement.sourceText}
                </blockquote>
                {statementMetadata(statement)}
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {state === 'not_provided' ? (
        <p className="mt-1 font-medium text-[color:var(--text-2)]">Smoking policy not provided by this supplier.</p>
      ) : null}

      {state === 'unavailable' ? (
        <div className="mt-1 rounded-[var(--radius-control)] bg-[color:var(--error-soft)] px-2.5 py-2 font-medium text-[color:var(--text-2)]">
          <p>Smoking policy could not be checked.</p>
          <p className="mt-1">Confirm this with the booking partner before you book.</p>
        </div>
      ) : null}
    </section>
  )
}

export function getCollapsedSmokingPolicy(policy?: HotelSmokingPolicyView): { label: string; ariaLabel: string } | null {
  if (!policy || policy.loadState !== 'ready') return null

  const room = policy.room
  const property = policy.property
  const roomValue = hasQualifiedRoomConfirmation(room) ? room.value : undefined
  const propertyValue = hasQualifiedPropertyConfirmation(property) ? property.value : undefined
  const selectedStatement = room.statements[0]

  if (roomValue === 'selected_room_non_smoking' || roomValue === 'selected_room_smoking') {
    const nonSmoking = roomValue === 'selected_room_non_smoking'
    return {
      label: nonSmoking ? 'Selected room: Non-smoking' : 'Selected room: Smoking permitted',
      ariaLabel: `Room policy. Confirmed for the selected room and rate from ${formatStayDate(selectedStatement?.checkin)} to ${formatStayDate(selectedStatement?.checkout)}. ${nonSmoking ? 'Non-smoking' : 'Smoking permitted'}. Open Details for full supplier evidence.`,
    }
  }

  if (propertyValue === 'smoke_free_property') {
    return {
      label: 'Smoke-free property',
      ariaLabel: 'Property and common areas. Confirmed supplier statement. The supplier applies a smoke-free rule to the entire property. Open Details for full supplier evidence.',
    }
  }

  if (roomValue === 'all_rooms_non_smoking') {
    return {
      label: 'All rooms non-smoking',
      ariaLabel: 'Room policy. Confirmed supplier statement. All guest rooms at this property are non-smoking. Open Details for full supplier evidence.',
    }
  }

  const propertySummary = {
    indoor_common_areas_smoke_free: ['Indoor common areas smoke-free', 'Property and common areas. Confirmed supplier statement. Indoor shared areas are smoke-free; guest rooms and outdoor areas are not established by this statement.'],
    designated_smoking_areas: ['Designated smoking areas', 'Property and common areas. Confirmed supplier statement. Smoking is restricted to designated areas.'],
    smoking_permitted_in_stated_areas: ['Smoking permitted in stated areas', 'Property and common areas. Confirmed supplier statement. Smoking is permitted in the supplier-stated areas shown in details.'],
  } as const

  if (propertyValue && propertyValue in propertySummary) {
    const [label, sentence] = propertySummary[propertyValue as keyof typeof propertySummary]
    return { label, ariaLabel: `${sentence} Open Details for full supplier evidence.` }
  }

  if (roomValue === 'smoking_rooms_offered') {
    return {
      label: 'Smoking rooms offered; dates not confirmed',
      ariaLabel: 'Room policy. Confirmed property capability. The supplier says this property offers smoking rooms, but availability for your dates is not confirmed. Open Details for full supplier evidence.',
    }
  }

  return null
}

export default function SmokingPolicyPanel({
  offerId,
  policy,
  surface,
}: {
  offerId: string
  policy: HotelSmokingPolicyView
  surface: 'result_detail' | 'review'
}) {
  const idBase = `${surface}-${offerId}`.replace(/[^a-zA-Z0-9_-]/g, '-')
  const titleId = `smoking-policy-title-${idBase}`
  const initialLoading = policy.loadState === 'loading'
  const refreshing = policy.loadState === 'refreshing'
  const failed = policy.loadState === 'error'
  const hasPreviousStatement = policy.room.statements.length > 0 || policy.property.statements.length > 0

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={initialLoading || refreshing}
      className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 text-xs leading-5 text-[color:var(--text-2)] sm:px-4 sm:py-4"
    >
      <h4 id={titleId} className="font-bold text-[color:var(--text-1)]">Smoking policy</h4>
      {failed ? (
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          Smoking policy could not be checked.
        </p>
      ) : null}

      {initialLoading ? (
        <p className="mt-3 font-medium text-[color:var(--text-3)]" role="status" aria-live="polite" aria-atomic="true">
          Checking supplier smoking policy…
        </p>
      ) : (
        <>
          {refreshing ? (
            <div className="mt-3 font-medium text-[color:var(--text-3)]" role="status" aria-live="polite" aria-atomic="true">
              <p>{policy.refreshFailed ? 'Policy refresh failed. The previous supplier statement is shown and is not treated as current confirmation.' : 'Refreshing supplier policy…'}</p>
              {!policy.refreshFailed && hasPreviousStatement ? <p>Showing the previous supplier statement while we check for an update.</p> : null}
            </div>
          ) : null}
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <SmokingPolicyDimension
              kind="room"
              dimension={policy.room}
              headingId={`${titleId}-room`}
              forceUnavailable={failed}
              forceStale={refreshing}
            />
            <SmokingPolicyDimension
              kind="property"
              dimension={policy.property}
              headingId={`${titleId}-property`}
              forceUnavailable={failed}
              forceStale={refreshing}
            />
          </div>
        </>
      )}

      <p className="mt-3 border-t border-[color:var(--border)] pt-3 font-medium text-[color:var(--text-3)]">
        {EVIDENCE_BOUNDARY}
      </p>
    </section>
  )
}
