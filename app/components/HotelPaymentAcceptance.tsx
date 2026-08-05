import type { Ref } from 'react'

// Presentation-layer types. DEV's normalizer (lib/hotels/paymentAcceptance.ts) targets this shape;
// see docs/pipeline/hotel-payment-method/03-design.md §4.2 for the authoritative contract.

export type HotelPaymentAcceptanceRowId =
  | 'card_required_at_property'
  | 'credit_card'
  | 'debit_card'
  | 'prepaid_card'
  | 'cash'
  | 'booking_gate_divergence'

export type HotelPaymentAcceptanceRowTone = 'confirmed_positive' | 'confirmed_negative' | 'not_confirmed' | 'conflicting'

export interface HotelPaymentAcceptanceRow {
  id: HotelPaymentAcceptanceRowId
  label: string
  tone: HotelPaymentAcceptanceRowTone
  sentence: string
}

export type HotelPaymentAcceptancePresentation =
  | { state: 'loading' }
  | { state: 'error' }
  | {
      state: 'ready'
      statusLine: string
      cardRequiredWarning: boolean
      rows: readonly HotelPaymentAcceptanceRow[]
      provenance: string
    }

export const HOTEL_PAYMENT_ACCEPTANCE_ROW_ORDER: readonly HotelPaymentAcceptanceRowId[] = [
  'card_required_at_property',
  'credit_card',
  'debit_card',
  'prepaid_card',
  'cash',
  'booking_gate_divergence',
]

const ROW_LABELS: Record<HotelPaymentAcceptanceRowId, string> = {
  card_required_at_property: 'Credit card required at the property',
  credit_card: 'Credit cards',
  debit_card: 'Debit cards',
  prepaid_card: 'Prepaid cards',
  cash: 'Cash',
  booking_gate_divergence: 'Same as what you needed to book?',
}

/** Row ids that render under the "Accepted at the property" sub-heading, in fixed order. */
export const HOTEL_PAYMENT_ACCEPTANCE_INSTRUMENT_ROWS: readonly HotelPaymentAcceptanceRowId[] = [
  'credit_card',
  'debit_card',
  'prepaid_card',
  'cash',
]

export function hotelPaymentAcceptanceRowLabel(id: HotelPaymentAcceptanceRowId): string {
  return ROW_LABELS[id]
}

const MAX_PROVIDER_NAME_LENGTH = 80

function resolveProvider(providerName: string): string {
  const trimmed = providerName.trim()
  return trimmed && trimmed.length <= MAX_PROVIDER_NAME_LENGTH ? trimmed : 'The booking provider'
}

/**
 * Builds the presentation for today's universal supply state: every reachable provider declares
 * HOTEL_PAYMENT_ACCEPTANCE_UNSUPPORTED (see docs/pipeline/hotel-payment-method/02-research.md §1.3), so
 * every offer renders all six facts as not_confirmed. DEV's normalizer in lib/hotels/paymentAcceptance.ts
 * replaces this call site with a real evidence+capability-driven deriver once any adapter can answer a
 * fact; the copy here is the exact §6.1 final copy from the design spec, not a placeholder.
 */
export function buildAllNotConfirmedHotelPaymentAcceptancePresentation(providerName: string): HotelPaymentAcceptancePresentation {
  const provider = resolveProvider(providerName)
  const rows: HotelPaymentAcceptanceRow[] = [
    {
      id: 'card_required_at_property',
      label: ROW_LABELS.card_required_at_property,
      tone: 'not_confirmed',
      sentence: `${provider} has not confirmed whether this property requires a credit card at check-in.`,
    },
    {
      id: 'credit_card',
      label: ROW_LABELS.credit_card,
      tone: 'not_confirmed',
      sentence: `${provider} has not confirmed whether credit cards are accepted at this property.`,
    },
    {
      id: 'debit_card',
      label: ROW_LABELS.debit_card,
      tone: 'not_confirmed',
      sentence: `${provider} has not confirmed whether debit cards are accepted at this property.`,
    },
    {
      id: 'prepaid_card',
      label: ROW_LABELS.prepaid_card,
      tone: 'not_confirmed',
      sentence: `${provider} has not confirmed whether prepaid cards are accepted at this property.`,
    },
    {
      id: 'cash',
      label: ROW_LABELS.cash,
      tone: 'not_confirmed',
      sentence: `${provider} has not confirmed whether cash is accepted at this property.`,
    },
    {
      id: 'booking_gate_divergence',
      label: ROW_LABELS.booking_gate_divergence,
      tone: 'not_confirmed',
      sentence: `${provider} has not confirmed whether the property accepts the same payment methods you used to book.`,
    },
  ]

  return {
    state: 'ready',
    statusLine: `${provider} has not confirmed payment acceptance at the property for this stay. None of the facts below come from a provider yet — confirm with the property before you travel.`,
    cardRequiredWarning: false,
    rows,
    provenance: `Source: ${provider} · Scope not confirmed`,
  }
}

type Props = {
  presentation: HotelPaymentAcceptancePresentation
  rootRef?: Ref<HTMLElement>
}

const rowSentenceCls = 'mt-1 break-words text-sm leading-6 text-[color:var(--text-1)]'
const conflictingRowSentenceCls = 'mt-1 break-words text-sm font-medium leading-6 text-[color:var(--warning)]'

function Row({ row }: { row: HotelPaymentAcceptanceRow }) {
  const conflicting = row.tone === 'conflicting'
  return (
    <li
      className={
        conflicting
          ? '-mx-2.5 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] p-2.5'
          : 'border-t border-[color:var(--border)] pt-3 first:border-t-0 first:pt-0'
      }
    >
      <p className="text-sm font-medium leading-5 text-[color:var(--text-1)]">{row.label}</p>
      <p className={conflicting ? conflictingRowSentenceCls : rowSentenceCls}>{row.sentence}</p>
    </li>
  )
}

function isLive(presentation: HotelPaymentAcceptancePresentation): boolean {
  return presentation.state === 'loading' || presentation.state === 'error'
}

function isWarningToned(presentation: HotelPaymentAcceptancePresentation): boolean {
  if (presentation.state !== 'ready') return false
  return presentation.cardRequiredWarning || presentation.rows.some(row => row.tone === 'conflicting')
}

export function HotelPaymentAcceptanceSection({ presentation, rootRef }: Props) {
  const live = isLive(presentation)
  const warning = isWarningToned(presentation)
  const panelTone = warning
    ? 'border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]'
    : 'border-[color:var(--border)] bg-[color:var(--bg-raised)]'

  return (
    <section
      ref={rootRef}
      aria-labelledby="hotel-payment-acceptance-title"
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
      aria-busy={presentation.state === 'loading' ? 'true' : undefined}
      className={`mt-5 rounded-[var(--radius-card)] border p-3.5 sm:p-5 ${
        presentation.state === 'ready' ? panelTone : 'border-[color:var(--border)] bg-[color:var(--bg-raised)]'
      }`}
    >
      <h3 id="hotel-payment-acceptance-title" className="text-base font-medium leading-6 text-[color:var(--text-1)] sm:text-lg">
        Payment accepted at the property
      </h3>

      {presentation.state === 'loading' ? (
        <>
          <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-1)]">Checking payment acceptance…</p>
          <div className="mt-4 space-y-3" aria-hidden="true">
            <div className="skeleton h-3 w-2/3 rounded-full" />
            <div className="skeleton h-3 w-full rounded-full" />
            <div className="skeleton h-3 w-5/6 rounded-full" />
          </div>
        </>
      ) : presentation.state === 'error' ? (
        <>
          <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-1)]">Payment acceptance could not be checked.</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            Confirm accepted payment methods with the property or booking partner before you travel.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">{presentation.statusLine}</p>
          {presentation.cardRequiredWarning ? (
            <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--warning)]">
              Bring a credit card. Properties that require one at check-in will refuse a debit or prepaid card for this purpose even if it paid for the stay.
            </p>
          ) : null}

          <ul className="mt-4 space-y-3">
            {presentation.rows
              .filter(row => row.id === 'card_required_at_property')
              .map(row => <Row key={row.id} row={row} />)}
          </ul>

          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-[color:var(--text-3)]">Accepted at the property</p>
          <ul className="mt-3 space-y-3">
            {HOTEL_PAYMENT_ACCEPTANCE_INSTRUMENT_ROWS.map(id => {
              const row = presentation.rows.find(candidate => candidate.id === id)
              return row ? <Row key={row.id} row={row} /> : null
            })}
          </ul>

          <ul className="mt-4 space-y-3">
            {presentation.rows
              .filter(row => row.id === 'booking_gate_divergence')
              .map(row => <Row key={row.id} row={row} />)}
          </ul>

          <p className="mt-3 break-words border-t border-[color:var(--border)] pt-3 text-xs font-medium leading-5 text-[color:var(--text-3)] [overflow-wrap:anywhere]">
            {presentation.provenance}
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-[color:var(--text-3)] [overflow-wrap:anywhere]">
            This does not cover the deposit or incidental hold amount — see Deposits and card holds above.
          </p>
        </>
      )}
    </section>
  )
}

export default HotelPaymentAcceptanceSection
