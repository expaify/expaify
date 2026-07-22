import { formatAbsoluteFreshness, validFreshnessDate } from '@/lib/providerFreshness'

export type RateRestrictionFamily = 'residency' | 'age' | 'membership' | 'refundability'

export type RateRestrictionCondition = {
  family: RateRestrictionFamily
  label: string
}

export type RateEligibilityPresentation =
  | { state: 'restricted'; conditions: readonly RateRestrictionCondition[]; coverageIncomplete?: boolean; fetchedAt?: string }
  | { state: 'clear'; fetchedAt?: string }
  | { state: 'not_provided'; fetchedAt?: string }
  | { state: 'loading' }
  | { state: 'error' }

type NormalizedPresentation =
  | { state: 'restricted'; conditions: RateRestrictionCondition[]; coverageIncomplete: boolean; fetchedAt?: string }
  | { state: 'clear'; fetchedAt?: string }
  | { state: 'not_provided'; fetchedAt?: string }
  | { state: 'loading' }
  | { state: 'error' }

export const RATE_ELIGIBILITY_NOT_PROVIDED: RateEligibilityPresentation = {
  state: 'not_provided',
}

const RESTRICTION_ORDER: readonly RateRestrictionFamily[] = [
  'residency',
  'age',
  'membership',
  'refundability',
]

function safeProviderName(providerName: string): string {
  const cleaned = providerName.trim()
  return cleaned && cleaned.length <= 80 ? cleaned : 'Hotel provider'
}

function normalizePresentation(value: RateEligibilityPresentation | null | undefined): NormalizedPresentation {
  if (!value || typeof value !== 'object' || typeof value.state !== 'string') {
    return { state: 'not_provided' }
  }

  if (value.state === 'loading' || value.state === 'error') return { state: value.state }
  if (value.state === 'clear') return { state: 'clear', fetchedAt: value.fetchedAt }
  if (value.state === 'not_provided') return { state: 'not_provided', fetchedAt: value.fetchedAt }

  if (value.state === 'restricted' && Array.isArray(value.conditions)) {
    const conditionsByFamily = new Map<RateRestrictionFamily, Set<string>>()
    let invalidConditionFound = false

    for (const condition of value.conditions as readonly unknown[]) {
      if (!condition || typeof condition !== 'object') {
        invalidConditionFound = true
        continue
      }
      const candidate = condition as Partial<RateRestrictionCondition>
      const family = candidate.family
      const label = typeof candidate.label === 'string' ? candidate.label.trim() : ''
      if (!family || !RESTRICTION_ORDER.includes(family) || !label) {
        invalidConditionFound = true
        continue
      }
      const labels = conditionsByFamily.get(family) ?? new Set<string>()
      labels.add(label)
      conditionsByFamily.set(family, labels)
    }

    const conditions = RESTRICTION_ORDER.flatMap(family => {
      const labels = conditionsByFamily.get(family)
      if (!labels || labels.size !== 1) return []
      return [{ family, label: [...labels][0] }]
    })
    const conflictingFamilyFound = [...conditionsByFamily.values()].some(labels => labels.size > 1)

    if (conditions.length > 0) {
      return {
        state: 'restricted',
        conditions,
        coverageIncomplete: value.coverageIncomplete === true || invalidConditionFound || conflictingFamilyFound,
        fetchedAt: value.fetchedAt,
      }
    }
  }

  return { state: 'not_provided' }
}

function fetchedMetadata(providerName: string, fetchedAt?: string): string {
  const date = validFreshnessDate(fetchedAt)
  if (!date) return `Source: ${providerName}. Rate-detail freshness not available.`
  return `Source: ${providerName}. Rate details fetched ${formatAbsoluteFreshness(date)}.`
}

export function getRateRestrictionsAccessibleSummary(
  eligibility: RateEligibilityPresentation | null | undefined,
  providerName: string,
  surface: 'card' | 'handoff',
): string {
  const provider = safeProviderName(providerName)
  const normalized = normalizePresentation(eligibility)

  if (normalized.state === 'restricted') {
    const count = normalized.conditions.length
    if (surface === 'card') {
      return count === 1
        ? `Rate restrictions: ${normalized.conditions[0].label}`
        : `Rate restrictions: ${count} conditions. Review the complete conditions before provider handoff.`
    }
    return `This rate has ${count} reported ${count === 1 ? 'condition' : 'conditions'}. The booking partner makes the final eligibility decision.`
  }

  if (normalized.state === 'clear') {
    return `${surface === 'card' ? 'Rate restrictions: ' : ''}${provider} reports no membership, residency, age, or non-refundable restriction for this rate.${surface === 'handoff' ? ' The booking partner confirms live terms.' : ''}`
  }

  if (normalized.state === 'loading') return 'Rate restrictions are being checked.'

  return surface === 'card'
    ? `Rate restrictions: ${provider} did not provide complete rate restrictions.`
    : `${provider} did not provide complete rate restrictions. Check the partner's terms before paying.`
}

export function HotelCardEligibilityLine({
  eligibility,
}: {
  eligibility: RateEligibilityPresentation | null | undefined
}) {
  const normalized = normalizePresentation(eligibility)
  const restricted = normalized.state === 'restricted'
  const clear = normalized.state === 'clear'
  const text = restricted
    ? normalized.conditions.length === 1
      ? normalized.conditions[0].label
      : `Restricted rate · ${normalized.conditions.length} conditions`
    : clear
      ? 'No reported rate restrictions'
      : normalized.state === 'loading'
        ? 'Checking rate restrictions…'
        : 'Restrictions not provided'
  const tone = restricted
    ? 'border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]'
    : clear
      ? 'border-[color:var(--border)] bg-[color:var(--bg-muted)] text-[color:var(--text-2)]'
      : 'border-[color:var(--border)] bg-[color:var(--bg-raised)] text-[color:var(--text-2)]'
  const isLive = normalized.state === 'loading' || normalized.state === 'error'

  return (
    <div
      className={`mt-3 min-w-0 rounded-[var(--radius-control)] border px-3 py-2 text-xs font-bold leading-5 ${tone}`}
      role={isLive ? 'status' : undefined}
      aria-live={isLive ? 'polite' : undefined}
      aria-atomic={isLive ? 'true' : undefined}
    >
      <span className="block break-words">{text}</span>
    </div>
  )
}

export function HotelRateRestrictionsSection({
  eligibility,
  providerName,
}: {
  eligibility: RateEligibilityPresentation | null | undefined
  providerName: string
}) {
  const provider = safeProviderName(providerName)
  const normalized = normalizePresentation(eligibility)
  const isLive = normalized.state === 'loading' || normalized.state === 'error'
  const restricted = normalized.state === 'restricted'

  return (
    <section
      aria-labelledby="hotel-rate-restrictions-title"
      className={`mt-5 rounded-lg border bg-[color:var(--bg-raised)] px-4 py-3 sm:px-5 sm:py-4 ${
        restricted ? 'border-[color:var(--border-strong)]' : 'border-[color:var(--border)]'
      }`}
      role={isLive ? 'status' : undefined}
      aria-live={isLive ? 'polite' : undefined}
      aria-atomic={isLive ? 'true' : undefined}
    >
      <h3 id="hotel-rate-restrictions-title" className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-3)]">
        Rate restrictions
      </h3>

      {restricted ? (
        <div className="mt-2 space-y-2 text-sm font-bold leading-6 text-[color:var(--text-1)]">
          {normalized.conditions.map(condition => <p key={condition.family}>{condition.label}</p>)}
        </div>
      ) : (
        <p className="mt-2 text-sm font-bold leading-6 text-[color:var(--text-1)]">
          {normalized.state === 'loading' ? 'Checking rate restrictions…' : normalized.state === 'clear' ? 'No reported rate restrictions' : 'Restrictions not provided'}
        </p>
      )}

      {restricted && normalized.coverageIncomplete ? (
        <p className="mt-2 text-xs font-medium leading-5 text-[color:var(--warning)]">
          Other eligibility details not provided by {provider}.
        </p>
      ) : null}

      {normalized.state !== 'loading' ? (
        <>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">
            {restricted
              ? 'Confirm you meet every listed condition before continuing. The booking partner makes the final eligibility decision.'
              : normalized.state === 'clear'
                ? `${provider} reports no membership, residency, age, or non-refundable restriction for this rate. The booking partner confirms live terms.`
                : normalized.state === 'error'
                  ? `${provider} could not provide complete rate restrictions. Check membership, residency, age, and refund terms before paying.`
                  : `${provider} did not provide complete rate restrictions. Check membership, residency, age, and refund terms before paying.`}
          </p>

          <p className={`mt-2 break-words text-xs font-medium leading-5 ${normalized.state === 'error' ? 'text-[color:var(--error)]' : 'text-[color:var(--text-3)]'}`}>
            {normalized.state === 'error'
              ? `Source: ${provider}. Rate restrictions could not be checked.`
              : fetchedMetadata(provider, normalized.fetchedAt)}
          </p>
        </>
      ) : null}
    </section>
  )
}
