import type { ReactNode } from 'react'
import type { Money } from '@/lib/types'
import { formatMoney, isValidMoney } from '@/lib/money'

export type PetFitStatus = 'suitable' | 'unsuitable' | 'unknown'
export type PetPolicyAvailability = 'returned' | 'not_returned' | 'error' | 'conflict'
export type PetPolicyPermission = 'allowed' | 'prohibited' | 'by_arrangement' | 'unknown'
export type PetPolicyScope = 'property' | 'room' | 'rate' | 'selected_stay' | 'unknown'
export type PetPolicyFeeStatus = 'free' | 'mandatory_known' | 'mandatory_unknown' | 'may_apply' | 'unknown' | 'unconfirmed'

export interface PetFitEvaluation {
  status: PetFitStatus
  reasonCodes: string[]
  explanation: string
  unresolvedDimensions: string[]
  costStatus: Exclude<PetPolicyFeeStatus, 'unconfirmed'>
  policyEvidenceRef: string
}

export interface PetPolicyRestriction {
  text: string
  supplierWording?: boolean
}

export interface HotelPetPolicyEvidence {
  availability: PetPolicyAvailability
  permission: PetPolicyPermission
  includedAnimalTypes?: string[]
  excludedAnimalTypes?: string[]
  feeStatus: PetPolicyFeeStatus
  fee?: Money
  feeBasis?: 'per_pet_per_stay' | 'per_pet_per_night' | 'per_stay' | 'per_night' | 'other' | 'unknown'
  maximumPetCount?: number
  maximumWeight?: { value: number; unit: 'lb' | 'kg' }
  malformedLimit?: boolean
  restrictions?: PetPolicyRestriction[]
  restrictionsComplete?: boolean
  scope: PetPolicyScope
  sourceLabel?: string
  fetchedAt?: string
  schemaVersion?: string
  stale?: boolean
  conflictStatements?: string[]
}

export type HotelPetPolicyPresentation =
  | { state: 'loading'; profileSummary?: string }
  | {
      state: 'ready'
      evidence: HotelPetPolicyEvidence
      evaluation?: PetFitEvaluation
      profileSummary?: string
      scanSupport?: string
      confirmationHref?: string
      canRetry?: boolean
      onRetry?: () => void
    }

type ReadyPolicy = Extract<HotelPetPolicyPresentation, { state: 'ready' }>

const OUTCOME_LABELS: Record<PetFitStatus, string> = {
  suitable: 'Fits your pet',
  unsuitable: 'Does not fit your pet',
  unknown: 'Pet policy needs confirmation',
}

const UNRESOLVED_LABELS: Record<string, string> = {
  animal_type: 'allowed animal type',
  pet_count: 'pet count limit',
  weight: 'weight or size limit',
  weight_or_size: 'weight or size limit',
  restrictions: 'additional restrictions',
  pet_charge: 'pet charge',
  fee: 'pet charge',
  selected_stay: 'selected room and rate',
  scope: 'selected room and rate',
}

function toneClasses(status: PetFitStatus): string {
  if (status === 'suitable') {
    return 'border-[color:var(--border-strong)] bg-[color:var(--success-soft)] text-[color:var(--success)]'
  }
  if (status === 'unsuitable') {
    return 'border-[color:var(--border-strong)] bg-[color:var(--error-soft)] text-[color:var(--text-1)]'
  }
  return 'border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]'
}

function hasClaimProvenance(evidence: HotelPetPolicyEvidence): boolean {
  return Boolean(
    validSource(evidence)
    && formatCheckedDate(evidence.fetchedAt)
    && evidence.schemaVersion?.trim(),
  )
}

function hasResolvedFitEvidence(evidence: HotelPetPolicyEvidence): boolean {
  return Boolean(
    evidence.includedAnimalTypes?.some(type => type.trim())
    && Number.isInteger(evidence.maximumPetCount)
    && evidence.maximumPetCount! > 0
    && evidence.maximumWeight
    && Number.isFinite(evidence.maximumWeight.value)
    && evidence.maximumWeight.value > 0
    && evidence.restrictionsComplete,
  )
}

function hasMalformedFeeEvidence(evidence: HotelPetPolicyEvidence): boolean {
  if (evidence.feeStatus !== 'mandatory_known') return false
  const knownBasis = evidence.feeBasis === 'per_pet_per_stay'
    || evidence.feeBasis === 'per_pet_per_night'
    || evidence.feeBasis === 'per_stay'
    || evidence.feeBasis === 'per_night'
  return !isValidMoney(evidence.fee) || !knownBasis
}

function presentationStatus(policy: ReadyPolicy): PetFitStatus {
  const { evidence, evaluation, profileSummary } = policy
  if (!profileSummary || evidence.stale || evidence.availability !== 'returned' || !evaluation) return 'unknown'
  if (!hasClaimProvenance(evidence)) return 'unknown'
  if (evaluation.status !== 'suitable') return evaluation.status

  const canMakePositiveClaim = evidence.permission === 'allowed'
    && evidence.scope === 'selected_stay'
    && hasResolvedFitEvidence(evidence)
    && evaluation.unresolvedDimensions.length === 0
    && evidence.feeStatus !== 'unconfirmed'
    && !hasMalformedFeeEvidence(evidence)
    && !evidence.malformedLimit

  return canMakePositiveClaim ? 'suitable' : 'unknown'
}

function scanCopy(policy: ReadyPolicy): { outcome?: string; support?: string; status: PetFitStatus | 'neutral' } | null {
  const { evidence, evaluation, profileSummary, scanSupport } = policy

  if (!profileSummary) {
    return evidence.availability === 'returned'
      ? { support: 'Pet policy available in Details.', status: 'neutral' }
      : null
  }

  if (evidence.stale) {
    return { outcome: OUTCOME_LABELS.unknown, support: scanSupport ?? 'The available policy may have changed.', status: 'unknown' }
  }

  if (evidence.availability === 'not_returned') {
    return { outcome: OUTCOME_LABELS.unknown, support: 'This provider did not return a pet policy.', status: 'unknown' }
  }
  if (evidence.availability === 'error') {
    return { outcome: OUTCOME_LABELS.unknown, support: 'Pet policy could not be loaded.', status: 'unknown' }
  }
  if (evidence.availability === 'conflict') {
    return { outcome: OUTCOME_LABELS.unknown, support: 'Provider policy statements conflict.', status: 'unknown' }
  }
  if (evidence.permission === 'by_arrangement') {
    return { outcome: OUTCOME_LABELS.unknown, support: 'Property approval is required before booking.', status: 'unknown' }
  }
  if (!evaluation) {
    return { outcome: OUTCOME_LABELS.unknown, support: scanSupport ?? 'Type, limits, or stay eligibility still needs confirmation.', status: 'unknown' }
  }

  const status = presentationStatus(policy)
  const downgradedSupport = hasMalformedFeeEvidence(evidence)
    ? 'A pet charge is listed, but its amount or basis is unclear.'
    : 'Type, limits, or stay eligibility still needs confirmation.'
  return {
    outcome: OUTCOME_LABELS[status],
    support: evaluation.status === 'suitable' && status === 'unknown'
      ? downgradedSupport
      : scanSupport ?? evaluation.explanation,
    status,
  }
}

export function HotelPetPolicyScan({ policy }: { policy: HotelPetPolicyPresentation }) {
  if (policy.state === 'loading') {
    return (
      <div className="mt-3 w-full min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-muted)] px-3 py-2 text-xs leading-5 text-[color:var(--text-2)]">
        <div className="skeleton h-4 w-2/3 max-w-64 rounded-[var(--radius-control)]" aria-hidden="true" />
        <span className="sr-only" role="status" aria-live="polite">Checking this hotel&apos;s pet policy…</span>
      </div>
    )
  }

  const copy = scanCopy(policy)
  if (!copy) return null
  const classes = copy.status === 'neutral'
    ? 'border-[color:var(--border)] bg-[color:var(--bg-muted)] text-[color:var(--text-2)]'
    : toneClasses(copy.status)

  return (
    <div className={`mt-3 w-full min-w-0 rounded-[var(--radius-control)] border px-3 py-2 text-xs leading-5 sm:grid sm:grid-cols-[max-content_minmax(0,1fr)] sm:items-start sm:gap-x-3 ${classes}`}>
      {copy.outcome ? <p className="font-bold">{copy.outcome}</p> : null}
      {copy.support ? (
        <p className={`font-medium ${copy.outcome ? 'mt-0.5 sm:mt-0' : ''} ${copy.status === 'unsuitable' ? 'text-[color:var(--error)]' : ''}`}>
          {copy.support}
        </p>
      ) : null}
    </div>
  )
}

function validSource(evidence: HotelPetPolicyEvidence): string | null {
  const source = evidence.sourceLabel?.trim()
  return source ? source : null
}

function formatCheckedDate(value?: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function typeText(evidence: HotelPetPolicyEvidence): string {
  const included = evidence.includedAnimalTypes?.map(type => type.trim()).filter(Boolean)
  const excluded = evidence.excludedAnimalTypes?.map(type => type.trim()).filter(Boolean)
  if (!included?.length && !excluded?.length) return 'Allowed animal types were not specified.'

  const allowed = included?.length ? `${included.join(' and ')} allowed` : ''
  const blocked = excluded?.length ? `${excluded.join(' and ')} not allowed` : ''
  return `${[allowed, blocked].filter(Boolean).join('; ')}.`
}

function feeBasisText(basis: HotelPetPolicyEvidence['feeBasis']): string | null {
  if (basis === 'per_pet_per_stay') return 'per pet, per stay'
  if (basis === 'per_pet_per_night') return 'per pet, per night'
  if (basis === 'per_stay') return 'per stay'
  if (basis === 'per_night') return 'per night'
  return null
}

function feeText(evidence: HotelPetPolicyEvidence): string {
  const source = validSource(evidence)
  if (evidence.feeStatus === 'free') {
    return source ? `No pet charge stated by ${source}.` : 'Pet charge could not be confirmed.'
  }
  if (evidence.feeStatus === 'mandatory_known') {
    const basis = feeBasisText(evidence.feeBasis)
    if (isValidMoney(evidence.fee) && basis) {
      return `${formatMoney(evidence.fee)} ${basis}.`
    }
    return 'A pet charge is listed, but its amount or basis could not be confirmed.'
  }
  if (evidence.feeStatus === 'mandatory_unknown') return 'A mandatory pet charge applies; amount was not provided.'
  if (evidence.feeStatus === 'may_apply') return 'A pet charge may apply; amount and basis were not provided.'
  if (evidence.feeStatus === 'unconfirmed') return 'A pet charge is listed, but its amount or basis could not be confirmed.'
  return 'Pet charge was not specified.'
}

function scopeText(scope: PetPolicyScope): string {
  if (scope === 'property') return 'Property-level policy; selected room and rate still need confirmation.'
  if (scope === 'selected_stay') return 'This selected stay.'
  if (scope === 'room') return 'Room-level policy; selected rate still needs confirmation.'
  if (scope === 'rate') return 'Rate-level policy; selected room still needs confirmation.'
  return 'Policy scope was not specified.'
}

function countText(evidence: HotelPetPolicyEvidence): string {
  if (evidence.maximumPetCount === undefined) return 'Pet count limit was not specified.'
  if (!Number.isInteger(evidence.maximumPetCount) || evidence.maximumPetCount < 1) {
    return 'A pet limit is listed, but the value could not be confirmed.'
  }
  return `Up to ${evidence.maximumPetCount} pet(s).`
}

function weightText(evidence: HotelPetPolicyEvidence): string {
  if (evidence.malformedLimit) return 'A pet limit is listed, but the value could not be confirmed.'
  if (!evidence.maximumWeight) return 'Weight or size limit was not specified.'
  if (!Number.isFinite(evidence.maximumWeight.value) || evidence.maximumWeight.value <= 0) {
    return 'A pet limit is listed, but the value could not be confirmed.'
  }
  return `Up to ${evidence.maximumWeight.value} ${evidence.maximumWeight.unit} per pet.`
}

function detailedOutcome(policy: ReadyPolicy): { heading: string; body: string; status: PetFitStatus } {
  const { evidence, evaluation, profileSummary } = policy
  const checked = formatCheckedDate(evidence.fetchedAt)
  const source = validSource(evidence)

  if (evidence.stale) {
    return {
      heading: OUTCOME_LABELS.unknown,
      body: checked
        ? `This pet policy was checked ${checked} and may have changed. Confirm the current policy before booking.`
        : 'This pet policy may have changed, and its checked date was not provided. Confirm the current policy before booking.',
      status: 'unknown',
    }
  }
  if (evidence.availability === 'not_returned') {
    return { heading: 'Pet policy not returned', body: 'This provider did not return a pet policy for this hotel. Pet acceptance, charges, and restrictions are unknown.', status: 'unknown' }
  }
  if (evidence.availability === 'error') {
    return { heading: 'Pet policy could not be loaded', body: "We couldn't check this hotel's pet policy. Hotel availability is unchanged, but pet acceptance, charges, and restrictions need confirmation.", status: 'unknown' }
  }
  if (evidence.availability === 'conflict') {
    return { heading: 'Pet policy information conflicts', body: "The available policy statements disagree. We can't confirm that this hotel fits your pet until the provider or property resolves them.", status: 'unknown' }
  }
  if (evidence.permission === 'by_arrangement') {
    return { heading: 'Property approval required', body: 'This property accepts pets only by arrangement. Ask the provider or property to approve your pet and confirm charges before booking.', status: 'unknown' }
  }
  if (!profileSummary) {
    return { heading: 'Pet policy available', body: 'Add pet details on an eligible results page to compare this policy with your stay.', status: 'unknown' }
  }
  if (!source) {
    return { heading: OUTCOME_LABELS.unknown, body: 'Policy source could not be confirmed.', status: 'unknown' }
  }
  const status = presentationStatus(policy)
  if (status === 'suitable') {
    return { heading: OUTCOME_LABELS.suitable, body: `The policy returned by ${source} fits your stated ${profileSummary} for this stay.`, status: 'suitable' }
  }
  if (status === 'unsuitable') {
    return { heading: OUTCOME_LABELS.unsuitable, body: evaluation?.explanation ?? 'The returned policy does not fit your stated pet.', status: 'unsuitable' }
  }
  return {
    heading: OUTCOME_LABELS.unknown,
    body: evaluation?.status === 'unknown'
      ? evaluation.explanation
      : 'The provider returned a pet policy, but it does not resolve every detail for your pet and stay.',
    status: 'unknown',
  }
}

function Fact({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="font-bold text-[color:var(--text-1)]">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-[color:var(--text-2)]">{children}</dd>
    </div>
  )
}

export function HotelPetPolicyDetails({ hotelId, hotelName, providerName, policy }: {
  hotelId: string
  hotelName: string
  providerName: string
  policy: HotelPetPolicyPresentation
}) {
  const titleId = `hotel-pet-policy-title-${hotelId}`

  if (policy.state === 'loading') {
    return (
      <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 text-xs leading-5 text-[color:var(--text-2)]" aria-labelledby={titleId}>
        <h4 id={titleId} className="font-bold text-[color:var(--text-1)]">Pet policy for your stay</h4>
        <p className="mt-2 font-medium text-[color:var(--text-3)]">Checking pet policy…</p>
      </section>
    )
  }

  const { evidence, evaluation } = policy
  const outcome = detailedOutcome(policy)
  const source = validSource(evidence)
  const checked = formatCheckedDate(evidence.fetchedAt)
  const unresolved = [...new Set(evaluation?.unresolvedDimensions.map(item => UNRESOLVED_LABELS[item] ?? item.replaceAll('_', ' ')) ?? [])]
  const restrictions = evidence.restrictions
  const confirmationNeeded = outcome.status === 'unknown'
  const actionLabel = evidence.availability === 'error' && policy.canRetry ? 'Try policy again' : 'Confirm pet policy with provider'
  const unknownOutcomeLabel = outcome.status === 'unknown'
    ? `${outcome.heading} for ${hotelName}. ${outcome.body}`
    : undefined

  return (
    <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 text-xs leading-5 text-[color:var(--text-2)]" aria-labelledby={titleId}>
      <h4 id={titleId} className="font-bold text-[color:var(--text-1)]">Pet policy for your stay</h4>
      <div aria-label={unknownOutcomeLabel} className={`mt-2 rounded-[var(--radius-control)] border px-3 py-2 ${toneClasses(outcome.status)}`}>
        <p className="font-bold">{outcome.heading}</p>
        <p className={`mt-0.5 font-medium ${outcome.status === 'unsuitable' ? 'text-[color:var(--error)]' : ''}`}>{outcome.body}</p>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6">
        <Fact label="Policy outcome" wide>{outcome.heading}</Fact>
        <Fact label="Animal types">{typeText(evidence)}</Fact>
        <Fact label="Pet charge">{feeText(evidence)}</Fact>
        <Fact label="Number of pets">{countText(evidence)}</Fact>
        <Fact label="Weight or size limit">{weightText(evidence)}</Fact>
        <Fact label="Other restrictions" wide>
          {restrictions?.length ? (
            <ul className="space-y-1">
              {restrictions.map((restriction, index) => (
                <li key={`${restriction.text}-${index}`}>{restriction.supplierWording ? `Provider statement: “${restriction.text}”` : restriction.text}</li>
              ))}
            </ul>
          ) : evidence.restrictionsComplete ? 'No additional restrictions were returned.' : 'Additional restrictions were not specified.'}
        </Fact>
        {evidence.conflictStatements?.length ? (
          <Fact label="Conflicting statements" wide>
            <ul className="space-y-1">
              {evidence.conflictStatements.map((statement, index) => <li key={`${statement}-${index}`}>{statement}</li>)}
            </ul>
          </Fact>
        ) : null}
        <Fact label="Applies to">{scopeText(evidence.scope)}</Fact>
        <Fact label="Policy source">{source ?? 'Policy source could not be confirmed.'}</Fact>
        <Fact label="Policy checked">{checked ? `Checked ${checked}.` : 'Policy freshness was not provided.'}</Fact>
      </dl>

      {unresolved.length ? (
        <div className="mt-3 rounded-[var(--radius-control)] bg-[color:var(--warning-soft)] px-3 py-2 font-medium text-[color:var(--warning)]">
          <p className="font-bold">Confirm before booking</p>
          <p>Confirm {unresolved.join(', ')} with the provider or property.</p>
        </div>
      ) : null}

      <p className="mt-3 font-medium">
        {outcome.status === 'suitable'
          ? 'Final pet acceptance and charges are confirmed by the provider or property before booking.'
          : outcome.status === 'unsuitable'
            ? "Choose another hotel or confirm directly if the provider's policy has changed."
            : 'The provider or property confirms final pet acceptance and charges.'}
      </p>

      {confirmationNeeded && evidence.availability === 'error' && policy.canRetry && policy.onRetry ? (
        <button type="button" onClick={policy.onRetry} aria-label={`Try pet policy again for ${hotelName}`} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] px-3 text-sm font-bold text-[color:var(--text-1)] sm:w-auto">
          {actionLabel}
        </button>
      ) : confirmationNeeded && policy.confirmationHref ? (
        <a href={policy.confirmationHref} aria-label={`Confirm pet policy for ${hotelName} with ${providerName}`} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] px-3 text-sm font-bold text-[color:var(--text-1)] sm:w-auto">
          {actionLabel}
        </a>
      ) : null}
    </section>
  )
}
