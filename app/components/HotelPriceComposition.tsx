import { formatMoney } from '@/lib/money'
import {
  buildHotelPriceComposition,
  getHotelPriceCompositionPresentation,
  type HotelPriceComposition as HotelPriceCompositionValue,
  type HotelChargePresentation,
} from '@/lib/hotels/priceDisclosure'
import type { HotelStayCostState } from '@/lib/types'

export type { HotelStayCostState } from '@/lib/types'

type Props = {
  headingId: string
  headingLevel?: 'h3' | 'h4'
  stayCostState: HotelStayCostState
  composition?: HotelPriceCompositionValue
  variant: 'price_scope' | 'handoff'
  boundaryCopy?: string
}

const fallbackComposition = buildHotelPriceComposition({
  offerId: 'unavailable',
  supplier: 'provider',
  stayCostState: 'nightly_only',
})
const fallbackPresentation = getHotelPriceCompositionPresentation(fallbackComposition)

export const hotelPriceCompositionScanCopy = fallbackPresentation.scanCopy
export const hotelPriceCompositionAriaLabel = fallbackPresentation.ariaLabel

export function getHotelPriceCompositionAccessibleSummary(
  composition: HotelPriceCompositionValue = fallbackComposition,
): string {
  return getHotelPriceCompositionPresentation(composition).ariaLabel
}

function introCopy(stayCostState: HotelStayCostState, priceUnavailable: boolean): string {
  if (stayCostState === 'provider_total' || stayCostState === 'partial_total') {
    return 'Review what the provider says is included and where each amount is collected.'
  }
  if (stayCostState === 'expaify_estimate') {
    return 'The displayed stay amount is an expaify estimate, not a provider total. Review both categories before continuing.'
  }
  return priceUnavailable
    ? 'No usable lodging price is available. Review any charge evidence before continuing.'
    : 'Only a nightly price is available. Review both categories before continuing.'
}

function CategoryRow({ presentation, category }: {
  presentation: HotelChargePresentation
  category: 'tax' | 'mandatory charge'
}) {
  const recordLabel = presentation.records.length === 1
    ? `Show 1 ${category} item`
    : `Show ${presentation.records.length} ${category} items`
  const recordCollectionCopy = (collection: 'online' | 'property' | 'split' | 'unknown' | undefined) => {
    if (collection === 'online') return 'Collected online'
    if (collection === 'property') return 'Pay at property'
    if (collection === 'split') return 'Split between online and property'
    if (collection === 'unknown') return 'Payment timing not confirmed'
    return null
  }
  return (
    <div className={`rounded-[var(--radius-control)] border bg-[color:var(--bg-raised)] px-3 py-2 ${
      presentation.conflicting
        ? 'border-[color:var(--gold)] bg-[color:var(--warning-soft)]'
        : 'border-[color:var(--border)]'
    }`}>
      <dt className="text-sm font-medium text-[color:var(--text-1)]">{presentation.label}</dt>
      <dd className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">
        <p className={presentation.conflicting ? 'text-[color:var(--warning)]' : undefined}>{presentation.stateCopy}</p>
        {presentation.relationshipCopy ? <p>{presentation.relationshipCopy}</p> : null}
        {presentation.collectionCopy ? <p>{presentation.collectionCopy}</p> : null}
        {presentation.provenanceCopy ? (
          <p className="mt-1 break-words text-xs leading-5 text-[color:var(--text-3)] [overflow-wrap:anywhere]">
            {presentation.provenanceCopy}
          </p>
        ) : null}
        {presentation.records.length > 1 ? (
          <details className="mt-1">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-[color:var(--text-1)]">
              {recordLabel}
            </summary>
            <ul className="space-y-2 pb-1">
              {presentation.records.map((record, index) => (
                <li key={record.id ?? `${record.name}-${index}`} className="break-words text-xs leading-5 [overflow-wrap:anywhere]">
                  <span className="font-medium text-[color:var(--text-1)]">{record.name}</span>
                  {record.amount ? ` · ${formatMoney(record.amount)}` : ''}
                  {record.basis ? ` · ${record.basis}` : ''}
                  {recordCollectionCopy(record.collection) ? ` · ${recordCollectionCopy(record.collection)}` : ''}
                  {record.sourceLabel ? ` · Source: ${record.sourceLabel}` : ''}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </dd>
    </div>
  )
}

export function HotelPriceCompositionScan({ composition = fallbackComposition }: {
  composition?: HotelPriceCompositionValue
}) {
  const presentation = getHotelPriceCompositionPresentation(composition)
  return (
    <p
      className={`mt-2 break-words text-xs font-medium leading-5 [overflow-wrap:anywhere] ${
        presentation.taxes.conflicting || presentation.mandatoryPropertyCharges.conflicting
          ? 'text-[color:var(--warning)]'
          : 'text-[color:var(--text-2)]'
      }`}
      aria-label={presentation.ariaLabel}
    >
      {presentation.scanCopy}
    </p>
  )
}

export function HotelPriceComposition({
  headingId,
  headingLevel = 'h3',
  stayCostState,
  composition = fallbackComposition,
  variant,
  boundaryCopy,
}: Props) {
  const isHandoff = variant === 'handoff'
  const Heading = headingLevel
  const presentation = getHotelPriceCompositionPresentation(composition)

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
        <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">
          {introCopy(stayCostState, composition.priceUnavailable)}
        </p>
      ) : null}
      <dl className="mt-2 grid gap-3 sm:grid-cols-2">
        <CategoryRow presentation={presentation.taxes} category="tax" />
        <CategoryRow presentation={presentation.mandatoryPropertyCharges} category="mandatory charge" />
      </dl>
      {boundaryCopy ? (
        <p className="mt-3 break-words text-sm font-medium leading-6 text-[color:var(--text-1)] [overflow-wrap:anywhere]">
          {boundaryCopy}
        </p>
      ) : null}
    </section>
  )
}
