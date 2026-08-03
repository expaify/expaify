import { validFreshnessDate } from '@/lib/providerFreshness'
import type {
  HotelAdmissionPresentation,
  HotelGuestIdentityAffectedParty,
  HotelGuestIdentityDimensionState,
  HotelGuestIdentityEvidence,
  HotelGuestIdentityStatement,
} from '@/lib/types'
import type { Ref } from 'react'

export type GuestIdentityDimensionState = HotelGuestIdentityDimensionState

export type GuestIdentityAffectedParty = HotelGuestIdentityAffectedParty

export type GuestIdentityPresentation = {
  state: 'loading' | 'ready' | 'error'
  scope?: 'property' | 'rate' | 'selected_stay'
  affectedParty: {
    value: GuestIdentityAffectedParty
    state: GuestIdentityDimensionState
    otherLabel?: string
  }
  identityDocument: { state: GuestIdentityDimensionState }
  paymentNameMatch: { state: GuestIdentityDimensionState }
  statements: readonly HotelGuestIdentityStatement[]
  sourceLabel: string
  locale?: string
  fetchedAt?: string
  refreshFailed?: boolean
  omittedStatementCount?: number
}

type Props = {
  presentation: GuestIdentityPresentation
  variant?: 'handoff' | 'card'
  headingId?: string
  retryAvailable?: boolean
  retryPending?: boolean
  onRetry?: () => void
  statusRegionRef?: Ref<HTMLElement>
  statusRegionFocusable?: boolean
}

const MAX_LABEL_LENGTH = 80
const MAX_STATEMENT_LENGTH = 300
const MAX_VISIBLE_STATEMENTS = 3
const factClass = 'min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3'
const factLabelClass = 'text-xs font-medium uppercase tracking-wide text-[color:var(--text-3)]'
const factValueClass = 'mt-1 break-words text-sm font-medium leading-6 text-[color:var(--text-1)]'

function formatEvidenceDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function providerNames(sourceLabel: string) {
  const trimmed = sourceLabel.trim()
  if (!trimmed || trimmed.length > MAX_LABEL_LENGTH) {
    return { Provider: 'The booking provider', provider: 'the booking provider' }
  }
  return { Provider: trimmed, provider: trimmed }
}

function validStatements(statements: readonly HotelGuestIdentityStatement[]) {
  const ids = new Set<string>()
  return statements.filter(statement => {
    const id = statement.id?.trim()
    const label = statement.sourceLabel?.trim()
    const text = statement.sourceText?.trim()
    if (!id || ids.has(id) || !label || label.length > MAX_LABEL_LENGTH || !text || text.length > MAX_STATEMENT_LENGTH) return false
    ids.add(id)
    return true
  }).slice(0, MAX_VISIBLE_STATEMENTS)
}

function roleValue(presentation: GuestIdentityPresentation) {
  const party = presentation.affectedParty
  if (party.state === 'conflicting') return 'Provider details conflict'
  if (party.value === 'lead_guest') return 'Lead guest'
  if (party.value === 'cardholder') return 'Cardholder'
  if (party.value === 'all_occupants') return 'All occupants'
  if (party.value === 'unspecified') return 'Not specified by the provider'
  if (party.value === 'other') {
    const label = party.otherLabel?.trim()
    return label && label.length <= MAX_LABEL_LENGTH ? `Provider-named party: ${label}` : 'Not established'
  }
  return 'Not established'
}

function identityValue(state: GuestIdentityDimensionState, Provider: string) {
  if (state === 'confirmed') return 'Required at check-in'
  if (state === 'conditional') return 'May be required at check-in. See the provider wording below.'
  if (state === 'not_required') return `${Provider} reports identification is not required at check-in.`
  if (state === 'conflicting') return 'Provider details conflict.'
  return 'Not established by the provider.'
}

function paymentValue(state: GuestIdentityDimensionState, Provider: string) {
  if (state === 'confirmed') return 'Must match the lead guest’s name.'
  if (state === 'conditional') return 'May need to match the lead guest’s name. See the provider wording below.'
  if (state === 'not_required') return `${Provider} reports the cardholder name does not have to match the lead guest’s name.`
  if (state === 'conflicting') return 'Provider details conflict.'
  return 'Whether it must match the lead guest’s name is not established.'
}

function unresolvedItems(presentation: GuestIdentityPresentation) {
  const items: string[] = []
  if (presentation.affectedParty.state === 'not_established') items.push('who the rule applies to')
  if (presentation.identityDocument.state === 'not_established') items.push('the identification requirement')
  if (presentation.paymentNameMatch.state === 'not_established') items.push('whether the cardholder name must match')
  return items
}

function joinItems(items: readonly string[]) {
  if (items.length < 2) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`
}

function actionCopy(presentation: GuestIdentityPresentation) {
  const conditional = presentation.identityDocument.state === 'conditional' || presentation.paymentNameMatch.state === 'conditional'
  if (conditional) {
    return 'This requirement depends on the provider’s conditions. Read the provider wording and verify it on the booking partner or with the property before paying.'
  }
  const conflicting = presentation.affectedParty.state === 'conflicting'
    || presentation.identityDocument.state === 'conflicting'
    || presentation.paymentNameMatch.state === 'conflicting'
  if (conflicting) return 'These details conflict. Check with the booking partner or property before paying.'

  const statements = validStatements(presentation.statements)
  const proseOnly = presentation.affectedParty.value === 'unspecified'
    && presentation.identityDocument.state === 'not_established'
    && presentation.paymentNameMatch.state === 'not_established'
    && statements.length > 0
  if (proseOnly) {
    return 'The provider wording may describe an ID or payment rule, but expaify cannot safely summarize who it applies to. Read it and check the rule on the booking partner or with the property before paying.'
  }

  const bothNegative = presentation.identityDocument.state === 'not_required'
    && presentation.paymentNameMatch.state === 'not_required'
    && presentation.affectedParty.state === 'not_established'
  if (bothNegative) return 'Recheck the booking partner’s current terms before paying; the property makes the final admission decision at check-in.'

  const hasAffirmative = presentation.identityDocument.state === 'confirmed'
    || presentation.paymentNameMatch.state === 'confirmed'
  if (hasAffirmative) {
    if (presentation.affectedParty.value === 'lead_guest') return 'Make sure the lead guest can meet these rules at check-in. Recheck the booking partner’s terms before paying.'
    if (presentation.affectedParty.value === 'cardholder') return 'Make sure the cardholder can meet these rules at check-in. Recheck the booking partner’s terms before paying.'
    if (presentation.affectedParty.value === 'all_occupants') return 'Make sure every occupant covered by the rule can meet it at check-in. Recheck the booking partner’s terms before paying.'
    if (presentation.affectedParty.value === 'other') return 'Make sure the provider-named party can meet these rules at check-in. Recheck the booking partner’s terms before paying.'
  }

  const unresolved = unresolvedItems(presentation)
  if (unresolved.length > 0) {
    if (unresolved.length === 1) return `Check ${unresolved[0]} on the booking partner before paying.`
    if (unresolved.length < 3) return `Check ${joinItems(unresolved)} on the booking partner before paying.`
  }

  return 'Check who these rules apply to on the booking partner or with the property before paying.'
}

function stateTitle(presentation: GuestIdentityPresentation) {
  if (presentation.state === 'loading') return 'Checking ID and cardholder rules…'
  if (presentation.state === 'error') return presentation.refreshFailed
    ? 'Updated rules could not be checked'
    : 'ID and cardholder rules could not be checked'
  if (
    presentation.affectedParty.state === 'conflicting'
    || presentation.identityDocument.state === 'conflicting'
    || presentation.paymentNameMatch.state === 'conflicting'
  ) return 'ID or cardholder details conflict'
  if (presentation.identityDocument.state === 'conditional' || presentation.paymentNameMatch.state === 'conditional') return 'Conditions apply'
  const statements = validStatements(presentation.statements)
  if (
    presentation.affectedParty.value === 'unspecified'
    && presentation.identityDocument.state === 'not_established'
    && presentation.paymentNameMatch.state === 'not_established'
    && statements.length > 0
  ) return 'Provider rule reported; who it applies to is not specified'
  if (unresolvedItems(presentation).length === 3) return 'ID and cardholder rules not provided'
  if (unresolvedItems(presentation).length > 0) return 'Some ID or cardholder details are not established'
  return null
}

function scopeCopy(scope: GuestIdentityPresentation['scope']) {
  if (scope === 'property') return 'For this property.'
  if (scope === 'rate' || scope === 'selected_stay') return 'For this room offer.'
  return null
}

function provenanceCopy(presentation: GuestIdentityPresentation, Provider: string) {
  if (presentation.state === 'error' && !presentation.refreshFailed) return `Source: ${Provider}. Check failed.`
  if (unresolvedItems(presentation).length === 3 && presentation.statements.length === 0) {
    return `Source: ${Provider}. ID and cardholder rules not returned.`
  }
  const date = validFreshnessDate(presentation.fetchedAt)
  return date
    ? `Source: ${Provider}. ID and cardholder rules fetched ${formatEvidenceDate(date)}.`
    : `Source: ${Provider}. ID and cardholder rules freshness not available.`
}

export function getGuestIdentityAccessibleAction(presentation: GuestIdentityPresentation) {
  if (presentation.state === 'loading') return 'ID and cardholder rules are being checked; verify them before paying.'
  if (presentation.state === 'error' && !presentation.refreshFailed) return 'ID and cardholder rules could not be checked; verify them before paying.'
  if (unresolvedItems(presentation).length === 3 && presentation.statements.length === 0) {
    return 'ID and cardholder rules were not provided; check them before paying.'
  }
  return actionCopy(presentation)
}

export function deriveGuestIdentityPresentation(
  admission: HotelAdmissionPresentation,
  sourceLabel: string,
): GuestIdentityPresentation {
  const empty = {
    affectedParty: { value: 'not_established' as const, state: 'not_established' as const },
    identityDocument: { state: 'not_established' as const },
    paymentNameMatch: { state: 'not_established' as const },
    statements: [] as readonly HotelGuestIdentityStatement[],
    sourceLabel,
  }
  if (admission.state === 'loading') return { state: 'loading', ...empty }
  if (admission.state === 'error') return { state: 'error', ...empty }
  if (admission.state === 'not_provided') return { state: 'ready', ...empty }

  const row = admission.rows.find(candidate => candidate.family === 'checkin_identity')
  if (!row) return { state: 'ready', ...empty, fetchedAt: admission.fetchedAt }
  if (row.rowState === 'restricted') {
    return {
      state: 'ready',
      affectedParty: { value: 'unspecified', state: 'not_established' },
      identityDocument: { state: 'not_established' },
      paymentNameMatch: { state: 'not_established' },
      statements: row.statements,
      sourceLabel,
      fetchedAt: admission.fetchedAt,
      omittedStatementCount: row.omittedStatementCount,
    }
  }
  if (row.rowState === 'conflicting') {
    return {
      state: 'ready',
      affectedParty: { value: 'not_established', state: 'conflicting' },
      identityDocument: { state: 'not_established' },
      paymentNameMatch: { state: 'not_established' },
      statements: row.statements,
      sourceLabel,
      fetchedAt: admission.fetchedAt,
      omittedStatementCount: row.omittedStatementCount,
    }
  }
  return { state: 'ready', ...empty, fetchedAt: admission.fetchedAt }
}

export function presentGuestIdentityEvidence(
  evidence: HotelGuestIdentityEvidence,
  sourceLabel: string,
  options?: { refreshFailed?: boolean },
): GuestIdentityPresentation {
  return {
    state: evidence.state,
    scope: evidence.scope,
    affectedParty: evidence.affectedParty,
    identityDocument: evidence.identityDocument,
    paymentNameMatch: evidence.paymentNameMatch,
    statements: evidence.statements,
    sourceLabel,
    locale: evidence.locale,
    fetchedAt: evidence.fetchedAt,
    omittedStatementCount: evidence.omittedStatementCount,
    ...(options?.refreshFailed ? { refreshFailed: true } : {}),
  }
}

type GuestIdentityCardChip = { text: string; ariaLabel: string }

export function getGuestIdentityCardChip(presentation: GuestIdentityPresentation): GuestIdentityCardChip | null {
  if (presentation.state !== 'ready') return null
  const identityAffirmative = presentation.identityDocument.state === 'confirmed' || presentation.identityDocument.state === 'conditional'
  const paymentAffirmative = presentation.paymentNameMatch.state === 'confirmed' || presentation.paymentNameMatch.state === 'conditional'
  const proseOnlyRule = presentation.affectedParty.value === 'unspecified'
    && presentation.affectedParty.state === 'not_established'
    && presentation.identityDocument.state === 'not_established'
    && presentation.paymentNameMatch.state === 'not_established'
    && validStatements(presentation.statements).length > 0
  if (!identityAffirmative && !paymentAffirmative && !proseOnlyRule) return null

  if (presentation.paymentNameMatch.state === 'confirmed') {
    return {
      text: 'Cardholder name must match',
      ariaLabel: 'Check-in rule: the cardholder name must match the lead guest’s name. Open hotel details for provider wording.',
    }
  }

  const party = presentation.affectedParty.value
  if (presentation.identityDocument.state === 'confirmed') {
    if (party === 'lead_guest') return { text: 'Lead guest: ID at check-in', ariaLabel: 'Check-in rule: the lead guest must present identification at check-in. Open hotel details for provider wording.' }
    if (party === 'cardholder') return { text: 'Cardholder: ID at check-in', ariaLabel: 'Check-in rule: the cardholder must present identification at check-in. Open hotel details for provider wording.' }
    if (party === 'all_occupants') return { text: 'All occupants: ID at check-in', ariaLabel: 'Check-in rule: all occupants must present identification at check-in. Open hotel details for provider wording.' }
  }

  if (presentation.identityDocument.state === 'conditional' || presentation.paymentNameMatch.state === 'conditional') {
    const role = party === 'lead_guest' ? { text: 'Lead guest', spoken: 'the lead guest' }
      : party === 'cardholder' ? { text: 'Cardholder', spoken: 'the cardholder' }
        : party === 'all_occupants' ? { text: 'All occupants', spoken: 'all occupants' }
          : null
    if (role) {
      return {
        text: `${role.text}: ID/card rule—details`,
        ariaLabel: `A conditional identification or cardholder rule is reported for ${role.spoken}. Open hotel details for the condition and provider wording.`,
      }
    }
  }

  return {
    text: 'Check-in ID/card rule—details',
    ariaLabel: 'The provider reported an identification or cardholder rule but did not specify who it applies to in structured data. Open hotel details for provider wording.',
  }
}

export function HotelGuestIdentityCardChip({ presentation }: { presentation: GuestIdentityPresentation }) {
  const chip = getGuestIdentityCardChip(presentation)
  if (!chip) return null
  return (
    <span
      aria-label={chip.ariaLabel}
      className="mt-1.5 inline-flex min-h-7 max-w-full items-center rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] px-2 py-1 text-xs font-medium leading-4 text-[color:var(--warning)]"
    >
      <span className="break-words whitespace-normal">{chip.text}</span>
    </span>
  )
}

export function HotelGuestIdentityRules({
  presentation,
  variant = 'handoff',
  headingId = variant === 'handoff' ? 'hotel-guest-identity-title' : 'hotel-card-guest-identity-title',
  retryAvailable = false,
  retryPending = false,
  onRetry,
  statusRegionRef,
  statusRegionFocusable = false,
}: Props) {
  const { Provider, provider } = providerNames(presentation.sourceLabel)
  const title = stateTitle(presentation)
  const statements = validStatements(presentation.statements)
  const isLoading = presentation.state === 'loading'
  const hasPriorEvidence = isLoading && (
    presentation.affectedParty.state !== 'not_established'
    || presentation.identityDocument.state !== 'not_established'
    || presentation.paymentNameMatch.state !== 'not_established'
    || statements.length > 0
  )
  const errorWithoutPrior = presentation.state === 'error' && !presentation.refreshFailed
  const live = isLoading || presentation.state === 'error'
  const warning = presentation.state === 'error'
    ? 'error'
    : title !== null && title !== 'Provider rule reported; who it applies to is not specified'
      ? 'warning'
      : null
  const Element = variant === 'handoff' ? 'section' : 'div'
  const outerClass = variant === 'handoff'
    ? 'mt-4 min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-raised)] px-3.5 py-3 sm:px-4 sm:py-4'
    : 'min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-raised)] px-3.5 py-3'
  const loadingCopy = hasPriorEvidence
    ? 'Checking for updated ID and cardholder rules…'
    : 'We’re checking what the provider reports. If you continue before this finishes, check these rules on the booking partner before paying.'

  return (
    <Element
      ref={statusRegionRef as never}
      aria-labelledby={headingId}
      className={outerClass}
      role={variant === 'card' ? (live ? 'status' : 'group') : live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
      aria-atomic={live ? 'true' : undefined}
      tabIndex={statusRegionFocusable ? -1 : undefined}
    >
      <h3 id={headingId} className="text-sm font-medium leading-5 text-[color:var(--text-1)]">ID and cardholder rules</h3>
      {title ? <p className="mt-2 break-words text-sm font-medium leading-6 text-[color:var(--text-1)]">{title}</p> : null}
      {isLoading ? <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">{loadingCopy}</p> : null}
      {presentation.state === 'error' ? (
        <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">
          {presentation.refreshFailed
            ? 'The previously reported details remain below. Their current accuracy is not confirmed. Check the booking partner or property before paying.'
            : `We couldn’t check these rules with ${provider}. This does not mean there are no requirements. Try again, or check with the booking partner or property before paying.`}
        </p>
      ) : null}
      {presentation.state === 'ready' && unresolvedItems(presentation).length === 3 && statements.length === 0 ? (
        <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">
          {Provider} did not tell us whether the lead guest, cardholder, or all occupants need ID, or whether the cardholder name must match. Check these rules on the booking partner before paying.
        </p>
      ) : null}

      <dl className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className={`${factClass} sm:col-span-2`}>
          <dt className={factLabelClass}>Who this applies to</dt>
          <dd className={factValueClass}>{isLoading && !hasPriorEvidence ? 'Checking…' : errorWithoutPrior ? 'Not established' : roleValue(presentation)}</dd>
        </div>
        <div className={factClass}>
          <dt className={factLabelClass}>Identification</dt>
          <dd className={factValueClass}>{isLoading && !hasPriorEvidence ? 'Checking…' : errorWithoutPrior ? 'Not established by the provider.' : identityValue(presentation.identityDocument.state, Provider)}</dd>
        </div>
        <div className={factClass}>
          <dt className={factLabelClass}>Cardholder name</dt>
          <dd className={factValueClass}>{isLoading && !hasPriorEvidence ? 'Checking…' : errorWithoutPrior ? 'Whether it must match the lead guest’s name is not established.' : paymentValue(presentation.paymentNameMatch.state, Provider)}</dd>
        </div>
      </dl>

      {statements.length > 0 && (!isLoading || hasPriorEvidence) && !errorWithoutPrior ? (
        <div className="mt-3 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--text-3)]">
            Provider wording{presentation.locale?.trim() ? ` (${presentation.locale.trim()})` : ''}
          </p>
          <ul className="mt-2 space-y-3">
            {statements.map(statement => {
              const observed = validFreshnessDate(statement.observedAt)
              return (
                <li key={statement.id} className="min-w-0">
                  <p className="[overflow-wrap:anywhere] whitespace-pre-wrap break-words text-sm leading-6 text-[color:var(--text-1)]">“{statement.sourceText.trim()}”</p>
                  <p className="mt-1 break-words text-xs leading-5 text-[color:var(--text-3)]">
                    Source: {statement.sourceLabel.trim()}. {observed ? `Observed ${formatEvidenceDate(observed)}.` : 'Observation date not available.'}
                  </p>
                </li>
              )
            })}
          </ul>
          {(presentation.omittedStatementCount ?? 0) > 0 ? (
            <p className="mt-2 text-xs font-medium leading-5 text-[color:var(--warning)]">
              {Provider} returned {presentation.omittedStatementCount} more {presentation.omittedStatementCount === 1 ? 'statement' : 'statements'} for this rule. Check the property’s full rules before paying.
            </p>
          ) : null}
        </div>
      ) : null}

      {!isLoading || hasPriorEvidence ? (
        <p className={`mt-3 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] px-3 py-2.5 text-sm leading-6 ${
          warning === 'error'
            ? 'bg-[color:var(--error-soft)] text-[color:var(--error-text)]'
            : warning === 'warning'
              ? 'bg-[color:var(--warning-soft)] text-[color:var(--warning)]'
              : 'bg-[color:var(--bg-raised)] text-[color:var(--text-2)]'
        }`}>{errorWithoutPrior ? `Check these rules with ${provider} before paying.` : actionCopy(presentation)}</p>
      ) : null}

      {!isLoading || hasPriorEvidence ? (
        <div className="mt-3 space-y-1 text-xs leading-5 text-[color:var(--text-3)]">
          {scopeCopy(presentation.scope) ? <p>{scopeCopy(presentation.scope)}</p> : null}
          <p className="break-words">{provenanceCopy(presentation, Provider)}</p>
        </div>
      ) : null}

      {(presentation.state === 'error' || retryPending) && retryAvailable ? (
        <button
          type="button"
          disabled={retryPending}
          onClick={onRetry}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] px-4 text-sm font-medium text-[color:var(--text-1)] focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {retryPending ? 'Checking…' : 'Try again'}
        </button>
      ) : null}
    </Element>
  )
}
