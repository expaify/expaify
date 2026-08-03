export type HotelStayCostState =
  | 'provider_total'
  | 'partial_total'
  | 'expaify_estimate'
  | 'nightly_only'

type Props = {
  headingId: string
  headingLevel?: 'h3' | 'h4'
  stayCostState: HotelStayCostState
  variant: 'price_scope' | 'handoff'
  boundaryCopy?: string
}

const TAX_SCAN_STATUS = 'not confirmed'
const MANDATORY_CHARGE_SCAN_STATUS = 'not confirmed'

export const hotelPriceCompositionScanCopy =
  `Taxes: ${TAX_SCAN_STATUS} · Mandatory property charges: ${MANDATORY_CHARGE_SCAN_STATUS}`

export const hotelPriceCompositionAriaLabel =
  `Taxes: ${TAX_SCAN_STATUS}. Mandatory property charges: ${MANDATORY_CHARGE_SCAN_STATUS}.`

export function getHotelPriceCompositionAccessibleSummary(): string {
  return hotelPriceCompositionAriaLabel
}

function relationshipCopy(stayCostState: HotelStayCostState): string {
  return stayCostState === 'provider_total' || stayCostState === 'partial_total'
    ? 'Inclusion not confirmed.'
    : 'No provider total is available to confirm inclusion.'
}

function introCopy(stayCostState: HotelStayCostState): string {
  if (stayCostState === 'provider_total' || stayCostState === 'partial_total') {
    return 'Review what the provider says is included and where each amount is collected.'
  }

  if (stayCostState === 'expaify_estimate') {
    return 'The displayed stay amount is an expaify estimate, not a provider total. Review both categories before continuing.'
  }

  return 'Only a nightly price is available. Review both categories before continuing.'
}

function CategoryRow({ label, stayCostState }: { label: string; stayCostState: HotelStayCostState }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3 py-2">
      <dt className="text-sm font-medium text-[color:var(--text-1)]">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">
        <p>Not confirmed for this selected offer.</p>
        <p>{relationshipCopy(stayCostState)}</p>
        <p>Payment timing not confirmed.</p>
      </dd>
    </div>
  )
}

export function HotelPriceCompositionScan() {
  return (
    <p
      className="mt-2 break-words text-xs font-medium leading-5 text-[color:var(--text-2)] [overflow-wrap:anywhere]"
      aria-label={hotelPriceCompositionAriaLabel}
    >
      {hotelPriceCompositionScanCopy}
    </p>
  )
}

export function HotelPriceComposition({
  headingId,
  headingLevel = 'h3',
  stayCostState,
  variant,
  boundaryCopy,
}: Props) {
  const isHandoff = variant === 'handoff'
  const Heading = headingLevel

  return (
    <section
      aria-labelledby={headingId}
      className={isHandoff
        ? 'mt-4 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4'
        : 'mt-3'}
    >
      <Heading
        id={headingId}
        className={isHandoff
          ? 'text-base font-medium text-[color:var(--text-1)]'
          : 'font-medium text-[color:var(--text-1)]'}
      >
        Taxes and mandatory charges
      </Heading>
      {isHandoff ? (
        <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">{introCopy(stayCostState)}</p>
      ) : null}
      <dl className="mt-2 grid gap-3 sm:grid-cols-2">
        <CategoryRow label="Taxes" stayCostState={stayCostState} />
        <CategoryRow label="Mandatory property charges" stayCostState={stayCostState} />
      </dl>
      {boundaryCopy ? (
        <p className="mt-3 break-words text-sm font-medium leading-6 text-[color:var(--text-1)] [overflow-wrap:anywhere]">
          {boundaryCopy}
        </p>
      ) : null}
    </section>
  )
}
