import { formatAbsoluteFreshness, validFreshnessDate } from '@/lib/providerFreshness'
import type { HotelAdmissionPresentation, HotelAdmissionRow } from '@/lib/types'
import {
  deriveGuestIdentityPresentation,
  HotelGuestIdentityRules,
  type GuestIdentityPresentation,
} from './HotelGuestIdentityRules'

const MAX_PROVIDER_NAME_LENGTH = 80

function resolveProvider(providerName: string): { Provider: string; provider: string } {
  const trimmed = providerName.trim()
  if (!trimmed || trimmed.length > MAX_PROVIDER_NAME_LENGTH) {
    return { Provider: 'The booking provider', provider: 'the booking provider' }
  }
  return { Provider: trimmed, provider: trimmed }
}

function provenanceLine(presentation: HotelAdmissionPresentation, Provider: string): string | null {
  if (presentation.state === 'loading') return null
  if (presentation.state === 'not_provided') return `Source: ${Provider}. Check-in eligibility not returned.`
  if (presentation.state === 'error') return `Source: ${Provider}. Check-in eligibility could not be checked.`
  const date = validFreshnessDate(presentation.fetchedAt)
  return date
    ? `Source: ${Provider}. Check-in eligibility fetched ${formatAbsoluteFreshness(date)}.`
    : `Source: ${Provider}. Check-in eligibility freshness not available.`
}

function statementLine(statement: HotelAdmissionRow['statements'][number]): string {
  const date = validFreshnessDate(statement.observedAt)
  return date
    ? `“${statement.sourceText}” — ${statement.sourceLabel}, observed ${formatAbsoluteFreshness(date)}`
    : `“${statement.sourceText}” — ${statement.sourceLabel}, observation date not available`
}

function omittedStatementLine(count: number, Provider: string): string {
  const noun = count === 1 ? 'statement' : 'statements'
  return `${Provider} returned ${count} more ${noun} for this rule. Check the property's full house rules before paying.`
}

type Variant = 'review' | 'card'

const rowLabelCls: Record<Variant, string> = {
  review: 'text-sm font-medium leading-5 text-[color:var(--text-1)]',
  card: 'text-xs font-medium leading-5 text-[color:var(--text-1)]',
}

const rowSentenceCls: Record<Variant, string> = {
  review: 'mt-1 break-words text-sm leading-6 text-[color:var(--text-1)]',
  card: 'mt-1 break-words text-xs leading-5 text-[color:var(--text-2)]',
}

const conflictingRowSentenceCls: Record<Variant, string> = {
  review: 'mt-1 break-words text-sm font-medium leading-6 text-[color:var(--warning)]',
  card: 'mt-1 break-words text-xs font-medium leading-5 text-[color:var(--warning)]',
}

const restrictionFooterCls: Record<Variant, string> = {
  review: 'mt-3 text-sm leading-6 text-[color:var(--text-2)]',
  card: 'mt-3 text-xs leading-5 text-[color:var(--text-2)]',
}

function Body({
  presentation,
  providerName,
  variant,
  HeadingTag,
  includeIdentityRules,
  identityHeadingId,
  identityPresentation,
}: {
  presentation: HotelAdmissionPresentation
  providerName: string
  variant: Variant
  HeadingTag: 'h4' | 'p'
  includeIdentityRules: boolean
  identityHeadingId?: string
  identityPresentation?: GuestIdentityPresentation
}) {
  const { Provider, provider } = resolveProvider(providerName)
  const bodyPrimaryCls = variant === 'review'
    ? 'mt-2 text-sm leading-6 text-[color:var(--text-1)]'
    : 'mt-2 text-xs leading-5 text-[color:var(--text-1)]'
  const bodySecondaryCls = variant === 'review'
    ? 'mt-2 text-sm leading-6 text-[color:var(--text-2)]'
    : 'mt-2 text-xs leading-5 text-[color:var(--text-2)]'
  const provenanceCls = `mt-2 break-words text-xs font-medium leading-5 ${
    presentation.state === 'error' ? 'text-[color:var(--error-text)]' : 'text-[color:var(--text-3)]'
  }`
  const provenance = provenanceLine(presentation, Provider)

  if (presentation.state === 'loading') {
    return <p className={bodyPrimaryCls}>Checking {includeIdentityRules ? 'check-in eligibility' : 'age, residency, and occupancy rules'}…</p>
  }

  if (presentation.state === 'error') {
    return (
      <>
        <p className={bodyPrimaryCls}>Check-in eligibility could not be checked with {provider}.</p>
        <p className={bodySecondaryCls}>
          This is not a statement that there are no rules. Confirm the check-in age, {includeIdentityRules ? 'ID, and ' : ''}occupancy rules with the property before paying.
        </p>
        {provenance ? <p className={provenanceCls}>{provenance}</p> : null}
      </>
    )
  }

  if (presentation.state === 'not_provided') {
    return (
      <>
        <p className={bodyPrimaryCls}>{Provider} has not told us this property&rsquo;s check-in age, {includeIdentityRules ? 'ID, or ' : 'local-resident, or '}occupancy rules.</p>
        <p className={bodySecondaryCls}>
          This is not a statement that there are no rules. Confirm with the property or the booking partner before paying.
        </p>
        {provenance ? <p className={provenanceCls}>{provenance}</p> : null}
      </>
    )
  }

  // reported
  return (
    <>
      <div className="mt-3 space-y-3">
        {presentation.rows.filter(row => row.family === 'checkin_age').map(row => (
          <RowRendered key={row.family} row={row} variant={variant} HeadingTag={HeadingTag} Provider={Provider} />
        ))}
        {includeIdentityRules ? (
          <HotelGuestIdentityRules
            presentation={identityPresentation ?? deriveGuestIdentityPresentation(presentation, providerName)}
            variant="card"
            headingId={identityHeadingId}
          />
        ) : null}
        {presentation.rows.filter(row => row.family !== 'checkin_age' && row.family !== 'checkin_identity').map(row => (
          <RowRendered key={row.family} row={row} variant={variant} HeadingTag={HeadingTag} Provider={Provider} />
        ))}
      </div>
      {presentation.coverageIncomplete ? (
        <p className="mt-2 text-xs font-medium leading-5 text-[color:var(--warning)]">
          {Provider} did not report the other check-in eligibility rules.
        </p>
      ) : null}
      {presentation.hasRestriction ? (
        <p className={restrictionFooterCls[variant]}>
          Confirm you meet these rules before you pay. The property makes the final admission decision at check-in.
        </p>
      ) : null}
      {provenance ? <p className={provenanceCls}>{provenance}</p> : null}
    </>
  )
}

function RowRendered({
  row,
  variant,
  HeadingTag,
  Provider,
}: {
  row: HotelAdmissionRow
  variant: Variant
  HeadingTag: 'h4' | 'p'
  Provider: string
}) {
  const sentenceCls = row.rowState === 'conflicting' ? conflictingRowSentenceCls[variant] : rowSentenceCls[variant]
  return (
    <div className="border-t border-[color:var(--border)] pt-3 first:border-t-0 first:pt-0">
      <HeadingTag className={rowLabelCls[variant]}>{row.label}</HeadingTag>
      <p className={sentenceCls}>{row.sentence}</p>
      {row.statements.length > 0 ? (
        <ul className="mt-1.5 space-y-1.5">
          {row.statements.map(statement => (
            <li key={statement.id}>
              <p className="break-words text-xs leading-5 text-[color:var(--text-2)]">{statementLine(statement)}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {row.omittedStatementCount > 0 ? (
        <p className="mt-2 text-xs font-medium leading-5 text-[color:var(--warning)]">
          {omittedStatementLine(row.omittedStatementCount, Provider)}
        </p>
      ) : null}
    </div>
  )
}

function isRestricted(presentation: HotelAdmissionPresentation): boolean {
  return presentation.state === 'reported' && presentation.hasRestriction
}

function isLive(presentation: HotelAdmissionPresentation): boolean {
  return presentation.state === 'loading' || presentation.state === 'error'
}

export function HotelAdmissionPolicySection({
  presentation,
  providerName,
  includeIdentityRules = true,
}: {
  presentation: HotelAdmissionPresentation
  providerName: string
  includeIdentityRules?: boolean
}) {
  const restricted = isRestricted(presentation)
  const live = isLive(presentation)

  return (
    <section
      aria-labelledby="hotel-admission-policy-title"
      className={`mt-5 min-w-0 rounded-[var(--radius-control)] border bg-[color:var(--bg-raised)] px-4 py-3 sm:px-5 sm:py-4 ${
        live ? 'min-h-[4.5rem]' : ''
      } ${restricted ? 'border-[color:var(--border-strong)]' : 'border-[color:var(--border)]'}`}
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
      aria-atomic={live ? 'true' : undefined}
    >
      <h3 id="hotel-admission-policy-title" className="text-xs font-medium uppercase tracking-wide text-[color:var(--text-3)]">
        Check-in eligibility
      </h3>
      <Body presentation={presentation} providerName={providerName} variant="review" HeadingTag="h4" includeIdentityRules={includeIdentityRules} />
    </section>
  )
}

export function HotelAdmissionPolicyCardBlock({
  presentation,
  providerName,
  identityHeadingId,
  identityPresentation,
}: {
  presentation: HotelAdmissionPresentation
  providerName: string
  identityHeadingId?: string
  identityPresentation?: GuestIdentityPresentation
}) {
  const restricted = isRestricted(presentation)
  const live = isLive(presentation)

  return (
    <div
      role="group"
      aria-label="Check-in eligibility"
      className={`min-w-0 rounded-[var(--radius-card)] border bg-[color:var(--bg-raised)] px-3.5 py-3 ${
        live ? 'min-h-[3.5rem]' : ''
      } ${restricted ? 'border-[color:var(--border-strong)]' : 'border-[color:var(--border)]'}`}
      aria-live={live ? 'polite' : undefined}
      aria-atomic={live ? 'true' : undefined}
    >
      <p className="font-medium text-[color:var(--text-1)]">Check-in eligibility</p>
      <Body
        presentation={presentation}
        providerName={providerName}
        variant="card"
        HeadingTag="p"
        includeIdentityRules
        identityHeadingId={identityHeadingId}
        identityPresentation={identityPresentation}
      />
      {presentation.state !== 'reported' ? (
        <div className="mt-3">
          <HotelGuestIdentityRules
            presentation={identityPresentation ?? deriveGuestIdentityPresentation(presentation, providerName)}
            variant="card"
            headingId={identityHeadingId}
          />
        </div>
      ) : null}
    </div>
  )
}

const CHIP_COPY: Record<string, { text: string; ariaLabel: string }> = {
  checkin_age: {
    text: 'Check-in: age {N}+',
    ariaLabel: 'Check-in eligibility: this property requires guests to be {N} or older at check-in.',
  },
  checkin_identity: {
    text: 'Check-in ID/card rule—details',
    ariaLabel: 'The provider reported an identification or cardholder rule but did not specify who it applies to in structured data. Open hotel details for provider wording.',
  },
  local_guest_restriction: {
    text: 'Check-in: resident rules',
    ariaLabel: 'Check-in eligibility: this property has reported a local-resident or registration-ID rule.',
  },
  occupancy_admission: {
    text: 'Check-in: occupancy rules',
    ariaLabel: 'Check-in eligibility: this property has reported a restriction on who may occupy a room.',
  },
}

function ageFromSentence(sentence: string): string {
  const match = sentence.match(/be (\d+) or older/)
  return match ? match[1] : ''
}

function restrictedAccessibleLabel(row: HotelAdmissionRow): string {
  if (row.family === 'checkin_age') {
    const age = ageFromSentence(row.sentence)
    return `Check-in eligibility: this property requires guests to be ${age} or older at check-in.`
  }
  return CHIP_COPY[row.family].ariaLabel
}

function chipCopyForRestrictedRows(restrictedRows: readonly HotelAdmissionRow[]): { text: string; ariaLabel: string } {
  if (restrictedRows.length === 1) {
    const row = restrictedRows[0]
    if (row.family === 'checkin_age') {
      const age = ageFromSentence(row.sentence)
      return { text: `Check-in: age ${age}+`, ariaLabel: restrictedAccessibleLabel(row) }
    }
    return { text: CHIP_COPY[row.family].text, ariaLabel: restrictedAccessibleLabel(row) }
  }
  return {
    text: `Check-in: ${restrictedRows.length} property rules`,
    ariaLabel: `Check-in eligibility: ${restrictedRows.length} property rules reported. Open details for the full statements.`,
  }
}

export function HotelAdmissionCardChip({
  presentation,
  includeIdentityRules = true,
}: {
  presentation: HotelAdmissionPresentation
  includeIdentityRules?: boolean
}) {
  if (presentation.state !== 'reported' || !presentation.hasRestriction) return null
  const restrictedRows = presentation.rows.filter(row => (
    row.rowState === 'restricted' && (includeIdentityRules || row.family !== 'checkin_identity')
  ))
  if (restrictedRows.length === 0) return null

  const { text, ariaLabel } = chipCopyForRestrictedRows(restrictedRows)

  return (
    <span
      aria-label={ariaLabel}
      className="mt-1.5 inline-flex min-h-7 max-w-full items-center rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] px-2 py-1 text-xs font-medium leading-4 text-[color:var(--warning)]"
    >
      <span className="break-words whitespace-normal">{text}</span>
    </span>
  )
}

export function getAdmissionAccessibleSummary(
  presentation: HotelAdmissionPresentation,
  providerName: string,
): string {
  const { Provider, provider } = resolveProvider(providerName)

  if (presentation.state === 'loading') return 'Checking check-in eligibility…'
  if (presentation.state === 'error') return `Check-in eligibility could not be checked with ${provider}.`
  if (presentation.state === 'not_provided') {
    return `${Provider} has not told us this property's check-in age, ID, or occupancy rules.`
  }

  const restrictedRows = presentation.rows.filter(row => row.rowState === 'restricted')
  if (restrictedRows.length === 0) {
    return `${Provider} did not report a check-in eligibility restriction for this property.`
  }
  return chipCopyForRestrictedRows(restrictedRows).ariaLabel
}
