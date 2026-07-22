import type { Money, HotelEvidenceScope } from '@/lib/types'

export type HotelFundsPolicyState =
  | 'complete'
  | 'partial'
  | 'explicit_none'
  | 'not_returned'
  | 'conflicting'

export type HotelFundsObligationType =
  | 'authorization_hold'
  | 'refundable_deposit'
  | 'other_refundable_obligation'

export type HotelFundsAmount =
  | { kind: 'exact'; money: Money }
  | { kind: 'range'; min: Money; max: Money }
  | {
      kind: 'percentage'
      percent: number
      appliesTo: 'stay_price' | 'other_documented_basis'
      appliesToWording?: string
    }
  | { kind: 'variable'; providerWording: string }
  | { kind: 'not_returned' }

export type HotelFundsBasis =
  | 'per_stay'
  | 'per_night'
  | 'per_room'
  | 'per_person'
  | 'provider_defined'
  | 'not_returned'

export type HotelFundsEvidenceScope = HotelEvidenceScope | 'not_returned'

export type HotelFundsMissingField =
  | 'mechanism'
  | 'amount'
  | 'basis'
  | 'application_timing'
  | 'payment_method'
  | 'return_or_release'
  | 'scope'
  | 'source'

export interface HotelFundsEvidenceRecord {
  type?: HotelFundsObligationType
  amount?: HotelFundsAmount
  basis?: HotelFundsBasis
  applicationWording?: string
  paymentMethodWording?: string
  returnOrRelease?: {
    action: 'refund' | 'release'
    providerWording?: string
    issuerProcessingWording?: string
  }
  sourceLabel: string
  scope: HotelFundsEvidenceScope
}

export interface HotelFundsPolicyEvidence {
  state: HotelFundsPolicyState
  obligations: HotelFundsEvidenceRecord[]
  sourceLabel: string
  scope: HotelFundsEvidenceScope
  fetchedAt?: string
  missingFields?: HotelFundsMissingField[]
  conflictingRecords?: HotelFundsEvidenceRecord[]
}

export type HotelFundsPolicyLoadState = 'loading' | 'ready' | 'error'

type Props = {
  evidence?: HotelFundsPolicyEvidence | null
  loadState?: HotelFundsPolicyLoadState
  surface: 'hotel_detail' | 'book_handoff'
  partnerLabel?: string
  confirmHref?: string
  hotelName?: string
  sourceLabel: string
  variant: 'summary' | 'full'
}

const mechanismLabels: Record<HotelFundsObligationType, string> = {
  authorization_hold: 'Temporary card hold',
  refundable_deposit: 'Refundable deposit',
  other_refundable_obligation: 'Other refundable amount',
}

const scopeLabels: Record<HotelFundsEvidenceScope, string> = {
  property: 'Property-level policy',
  room: 'Room-level policy',
  rate: 'Rate-level policy',
  selected_stay: 'Selected-stay policy',
  not_returned: 'Scope not provided',
}

const scopePhrases: Partial<Record<HotelFundsEvidenceScope, string>> = {
  property: 'this property',
  room: 'this room',
  rate: 'this rate',
  selected_stay: 'this selected stay',
}

const missingFieldPhrases: Record<HotelFundsMissingField, string> = {
  mechanism: 'whether this is a hold or collected deposit',
  amount: 'the amount or calculation rule',
  basis: 'what the amount applies to',
  application_timing: 'when it is applied',
  payment_method: 'which payment methods it applies to',
  return_or_release: 'the refund or authorization-release conditions',
  scope: 'which property, room, rate, or stay the policy covers',
  source: 'the policy source',
}

const missingFieldOrder: HotelFundsMissingField[] = [
  'mechanism',
  'amount',
  'basis',
  'application_timing',
  'payment_method',
  'return_or_release',
  'scope',
  'source',
]

function defaultEvidence(sourceLabel: string): HotelFundsPolicyEvidence {
  return {
    state: 'not_returned',
    obligations: [],
    sourceLabel: sourceLabel.trim() || 'Hotel provider',
    scope: 'not_returned',
  }
}

function resolvedEvidence(evidence: HotelFundsPolicyEvidence | null | undefined, sourceLabel: string) {
  if (!evidence) return defaultEvidence(sourceLabel)
  if (!['complete', 'partial', 'explicit_none', 'not_returned', 'conflicting'].includes(evidence.state)) {
    return defaultEvidence(sourceLabel)
  }
  if (evidence.state === 'not_returned' && !evidence.sourceLabel.trim()) return defaultEvidence(sourceLabel)
  if (evidence.state === 'explicit_none') {
    if (evidence.obligations.length || evidence.scope === 'not_returned' || !evidence.sourceLabel.trim()) {
      return defaultEvidence(sourceLabel)
    }
  }
  if (evidence.state === 'complete' && evidence.obligations.length === 0) return defaultEvidence(sourceLabel)
  if (evidence.state === 'conflicting' && (evidence.conflictingRecords?.length ?? 0) < 2) {
    return evidence.obligations.length ? { ...evidence, state: 'partial' as const } : defaultEvidence(sourceLabel)
  }
  return evidence
}

function formatPolicyMoney(money: Money): string {
  const currency = money.currency.trim().toUpperCase()
  const amount = money.priceCents / 100
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: money.priceCents % 100 === 0 ? 0 : 2,
  }).format(amount)
  return `${formatted}\u00a0${currency}`
}

function basisPhrase(basis?: HotelFundsBasis): string {
  return {
    per_stay: 'per stay',
    per_night: 'per night',
    per_room: 'per room',
    per_person: 'per person',
    provider_defined: 'Basis not provided',
    not_returned: 'Basis not provided',
  }[basis ?? 'not_returned']
}

function amountAndBasis(record: HotelFundsEvidenceRecord): string {
  const amount = record.amount
  if (!amount || amount.kind === 'not_returned') return 'Amount not provided'
  if (amount.kind === 'exact') return `${formatPolicyMoney(amount.money)} ${basisPhrase(record.basis)}`
  if (amount.kind === 'range') {
    return `${formatPolicyMoney(amount.min)}–${formatPolicyMoney(amount.max)} ${basisPhrase(record.basis)}`
  }
  if (amount.kind === 'percentage') {
    return amount.appliesTo === 'stay_price'
      ? `${amount.percent}% of the provider's stay price`
      : `${amount.percent}% of ${amount.appliesToWording ?? 'the provider-documented basis'}`
  }
  return `Amount varies — ${amount.providerWording}`
}

function mechanismSummary(record: HotelFundsEvidenceRecord): string {
  if (!record.type) return 'Deposit or hold details are incomplete.'
  const amount = record.amount?.kind === 'variable' ? 'amount varies' : amountAndBasis(record)
  if (record.type === 'authorization_hold') return `Temporary card hold: ${amount}. Not part of the stay price.`
  if (record.type === 'refundable_deposit') return `Refundable deposit: ${amount}. Collected separately from the stay price.`
  return `Other refundable amount: ${amount}. Separate from the stay price.`
}

function summaryCopy(evidence: HotelFundsPolicyEvidence, loadState: HotelFundsPolicyLoadState): string {
  if (loadState === 'loading') return 'Checking deposit and hold policy…'
  if (loadState === 'error') return 'Deposit and hold policy could not be checked. Confirm before booking.'
  if (evidence.state === 'partial') return 'Deposit or hold details are incomplete. Confirm the missing information before booking.'
  if (evidence.state === 'not_returned') return 'Deposit and hold policy not provided. Additional available funds may still be required.'
  if (evidence.state === 'conflicting') return 'Deposit or hold details conflict. Confirm the amount and timing before booking.'
  if (evidence.state === 'explicit_none') {
    return `The provider reports no deposit or incidental hold for ${scopePhrases[evidence.scope]}.`
  }
  if (evidence.obligations.length === 1) return mechanismSummary(evidence.obligations[0])
  if (evidence.obligations.length === 2) {
    return `Additional funds reported: ${evidence.obligations.map(record => {
      const label = record.type ? mechanismLabels[record.type].toLowerCase() : 'unspecified obligation'
      return `${label} ${record.amount?.kind === 'variable' ? 'amount varies' : amountAndBasis(record)}`
    }).join('; ')}.`
  }
  return `Additional funds reported: ${evidence.obligations.length} separate refundable deposit or hold requirements. Review each before booking.`
}

function joinList(values: string[]): string {
  if (values.length <= 1) return values[0] ?? ''
  if (values.length === 2) return `${values[0]} and ${values[1]}`
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`
}

function scopeCaution(scope: HotelFundsEvidenceScope): string | null {
  if (scope === 'property') return 'Confirm this applies to your selected room and rate.'
  if (scope === 'room') return 'Confirm this applies to your selected rate and stay.'
  if (scope === 'rate') return 'Confirm this applies to your selected room and stay.'
  return null
}

function sourceCopy(record: Pick<HotelFundsPolicyEvidence, 'sourceLabel' | 'scope' | 'fetchedAt'>, noEvidence = false) {
  const source = record.sourceLabel.trim()
  const sourcePrefix = source ? `Source: ${source}` : 'Source not provided'
  if (noEvidence) return `Source checked: ${source} · Scope not provided`
  const checked = record.fetchedAt && !Number.isNaN(new Date(record.fetchedAt).getTime())
    ? ` · Checked ${new Date(record.fetchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : ''
  return `${sourcePrefix} · ${scopeLabels[record.scope]}${checked}`
}

function impactCopy(type?: HotelFundsObligationType): string {
  if (type === 'authorization_hold') return 'This is a temporary authorization, not part of the stay price, but it can reduce your available card balance.'
  if (type === 'refundable_deposit') return "This is collected separately from the stay price and may be refundable under the provider's stated conditions."
  if (type === 'other_refundable_obligation') return 'The provider describes this as a refundable amount collected separately from the stay price.'
  return 'The provider did not identify whether money is temporarily authorized or collected.'
}

function applicationLabel(type?: HotelFundsObligationType) {
  if (type === 'authorization_hold') return 'When the hold is placed'
  if (type === 'refundable_deposit') return 'When the deposit is collected'
  return 'When it applies'
}

function returnLabel(type?: HotelFundsObligationType) {
  if (type === 'authorization_hold') return 'Authorization release'
  if (type === 'refundable_deposit') return 'Deposit refund'
  return 'Refund'
}

function returnCopy(record: HotelFundsEvidenceRecord): string | null {
  const wording = record.returnOrRelease?.providerWording
  if (!wording) return null
  return record.type === 'authorization_hold'
    ? `The provider says the property releases the authorization ${wording}.`
    : `The provider says the property processes the refund ${wording}.`
}

function timingCaveat(record: HotelFundsEvidenceRecord): string | null {
  if (!record.returnOrRelease) return null
  if (record.type === 'authorization_hold') {
    return "Your bank or card issuer controls when the funds become available again. The provider's timing is not a guaranteed funds-availability date."
  }
  return "Your bank or card issuer may take additional time to make the funds available. The provider's timing is not a guaranteed funds-availability date."
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium leading-5 text-[color:var(--text-1)] [overflow-wrap:anywhere]">{value}</dd>
    </div>
  )
}

function ObligationCard({ record, heading }: { record: HotelFundsEvidenceRecord; heading?: string }) {
  const release = returnCopy(record)
  const caveat = timingCaveat(record)
  return (
    <article className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5">
      {heading ? <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--text-3)]">{heading}</p> : null}
      <h4 className={`${heading ? 'mt-1' : ''} text-sm font-bold leading-5 text-[color:var(--text-1)]`}>
        {record.type ? mechanismLabels[record.type] : 'Deposit or hold mechanism not provided'}
      </h4>
      <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">{impactCopy(record.type)}</p>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {record.amount ? <Fact label="Amount" value={amountAndBasis(record)} /> : null}
        {record.applicationWording ? <Fact label={applicationLabel(record.type)} value={record.applicationWording} /> : null}
        {record.paymentMethodWording ? <Fact label="Payment method" value={record.paymentMethodWording} /> : null}
        {release ? <Fact label={returnLabel(record.type)} value={release} /> : null}
      </dl>
      {record.returnOrRelease?.issuerProcessingWording ? (
        <p className="mt-3 break-words text-sm leading-6 text-[color:var(--text-2)] [overflow-wrap:anywhere]">
          The provider also says: {record.returnOrRelease.issuerProcessingWording}
        </p>
      ) : null}
      {caveat ? <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">{caveat}</p> : null}
      {heading ? <p className="mt-3 break-words border-t border-[color:var(--border)] pt-3 text-xs font-medium leading-5 text-[color:var(--text-3)] [overflow-wrap:anywhere]">{sourceCopy(record)}</p> : null}
    </article>
  )
}

export function getHotelFundsPolicyAccessibleSuffix(
  evidence: HotelFundsPolicyEvidence | null | undefined,
  loadState: HotelFundsPolicyLoadState = 'ready',
  sourceLabel = 'Hotel provider',
): string {
  const resolved = resolvedEvidence(evidence, sourceLabel)
  if (loadState === 'loading') return 'Deposit and hold policy is still being checked; confirm with the booking partner.'
  if (loadState === 'error') return 'Deposit and hold policy could not be checked.'
  if (resolved.state === 'complete') return 'Additional-funds policy reported; review details before provider handoff.'
  if (resolved.state === 'partial') return 'Deposit or hold details are incomplete.'
  if (resolved.state === 'explicit_none') return `Provider reports no deposit or incidental hold for ${scopePhrases[resolved.scope]}.`
  if (resolved.state === 'conflicting') return 'Deposit or hold details conflict.'
  return 'Deposit and hold policy was not provided.'
}

export default function HotelFundsPolicyPanel({
  evidence,
  loadState = 'ready',
  surface,
  partnerLabel,
  confirmHref,
  hotelName,
  sourceLabel,
  variant,
}: Props) {
  const resolved = resolvedEvidence(evidence, sourceLabel)
  const displayedState = loadState === 'error' ? 'error' : loadState === 'loading' ? 'loading' : resolved.state
  const warningState = ['partial', 'not_returned', 'conflicting', 'error'].includes(displayedState)
  const summary = summaryCopy(resolved, loadState)
  const summaryClasses = warningState
    ? 'border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]'
    : 'border-[color:var(--border)] bg-[color:var(--bg-raised)]'

  if (variant === 'summary') {
    return (
      <div
        role={loadState === 'loading' || loadState === 'error' ? 'status' : undefined}
        aria-live={loadState === 'loading' || loadState === 'error' ? 'polite' : undefined}
        aria-busy={loadState === 'loading' ? 'true' : undefined}
        className={`mt-3 rounded-[var(--radius-control)] border px-3 py-2 text-xs font-medium leading-5 text-[color:var(--text-2)] ${summaryClasses}`}
      >
        <p>{summary}</p>
      </div>
    )
  }

  const panelTone = displayedState === 'error'
    ? 'border-[color:var(--border-strong)] bg-[color:var(--error-soft)]'
    : warningState
      ? 'border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]'
      : displayedState === 'explicit_none'
        ? 'border-[color:var(--border)] bg-[color:var(--bg-raised)]'
        : 'border-[color:var(--border)] bg-[color:var(--bg-surface)]'
  const headingId = `hotel-funds-policy-${surface}-${hotelName?.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'offer'}`
  const showConfirmation = surface === 'book_handoff' && Boolean(confirmHref) && (
    loadState === 'error'
    || resolved.state === 'partial'
    || resolved.state === 'not_returned'
    || resolved.state === 'conflicting'
    || ((resolved.state === 'complete' || resolved.state === 'explicit_none') && resolved.scope !== 'selected_stay')
  )
  const confirmationLabel = partnerLabel ? `Confirm policy with ${partnerLabel}` : 'Confirm policy with booking partner'
  const confirmationDestination = partnerLabel ?? 'booking partner'
  const caution = scopeCaution(resolved.scope)
  const missingFacts = missingFieldOrder
    .filter(field => resolved.missingFields?.includes(field))
    .map(field => missingFieldPhrases[field])

  return (
    <section
      aria-labelledby={headingId}
      role={loadState === 'loading' || loadState === 'error' ? 'status' : undefined}
      aria-live={loadState === 'loading' || loadState === 'error' ? 'polite' : undefined}
      aria-busy={loadState === 'loading' ? 'true' : undefined}
      className={`rounded-[var(--radius-card)] border p-3.5 sm:p-5 ${panelTone}`}
    >
      <h3 id={headingId} className="text-base font-bold leading-6 text-[color:var(--text-1)] sm:text-lg">
        Additional funds at the property
      </h3>

      {loadState === 'loading' ? (
        <>
          <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-1)]">Checking deposit and hold policy…</p>
          <div className="mt-4 space-y-3" aria-hidden="true">
            <div className="skeleton h-3 w-2/3 rounded-full" />
            <div className="skeleton h-3 w-full rounded-full" />
            <div className="skeleton h-3 w-5/6 rounded-full" />
          </div>
        </>
      ) : loadState === 'error' ? (
        <>
          <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-1)]">Policy check unavailable</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">Deposit and hold policy could not be checked.</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">Confirm with the property or booking partner before booking.</p>
        </>
      ) : resolved.state === 'not_returned' ? (
        <>
          <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-1)]">Policy not provided</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">The provider did not supply a deposit or incidental-hold policy for this offer.</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">Confirm whether this property requires additional available funds before booking.</p>
        </>
      ) : resolved.state === 'explicit_none' ? (
        <>
          <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-1)]">No deposit or hold reported</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">The provider reports no deposit or incidental hold for {scopePhrases[resolved.scope]}.</p>
        </>
      ) : resolved.state === 'conflicting' ? (
        <>
          <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-1)]">Policy details conflict</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">The provider information contains different deposit or hold details. expaify cannot determine which applies.</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">Confirm the amount, timing, and policy for your selected room and rate before booking.</p>
          <h4 className="mt-4 text-sm font-bold leading-5 text-[color:var(--text-1)]">Conflicting provider details</h4>
          <div className="mt-3 space-y-3">
            {resolved.conflictingRecords?.map((record, index) => (
              <ObligationCard key={`${record.sourceLabel}-${index}`} record={record} heading={`Provider detail ${index + 1}`} />
            ))}
          </div>
        </>
      ) : (
        <>
          {resolved.state === 'partial' ? (
            <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-1)]">The provider returned some deposit or hold details, but the policy is incomplete.</p>
          ) : null}
          <div className="mt-4 space-y-3">
            {resolved.obligations.map((record, index) => <ObligationCard key={`${record.sourceLabel}-${index}`} record={record} />)}
          </div>
          {resolved.state === 'partial' && missingFacts.length ? (
            <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--text-1)]">The provider did not return {joinList(missingFacts)}. Confirm before booking.</p>
          ) : null}
          {new Set(resolved.obligations.flatMap(record => {
            if (record.amount?.kind === 'exact') return record.amount.money.currency
            if (record.amount?.kind === 'range') return [record.amount.min.currency, record.amount.max.currency]
            return []
          })).size > 1 ? (
            <p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">These amounts use different currencies and are not combined.</p>
          ) : null}
        </>
      )}

      {loadState === 'ready' ? (
        <>
          {caution ? <p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">{caution}</p> : null}
          <p className="mt-3 break-words border-t border-[color:var(--border)] pt-3 text-xs font-medium leading-5 text-[color:var(--text-3)] [overflow-wrap:anywhere]">
            {sourceCopy(resolved, resolved.state === 'not_returned')}
          </p>
        </>
      ) : null}

      {showConfirmation ? (
        <a
          href={confirmHref}
          target="_blank"
          rel="noopener noreferrer sponsored"
          aria-label={`${confirmationLabel} for ${hotelName ?? 'this hotel'}. Opens ${confirmationDestination} in a new tab. Deposit or hold details may still require confirmation with the property.`}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] px-4 text-center text-sm font-medium text-[color:var(--text-1)] hover:bg-[color:var(--brand-soft)] focus-visible:border-[color:var(--border-focus)] sm:w-auto"
        >
          {confirmationLabel}
        </a>
      ) : null}
    </section>
  )
}
