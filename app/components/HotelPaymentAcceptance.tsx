import type { Ref } from 'react'
import type {
  HotelPaymentAcceptancePresentation,
  HotelPaymentAcceptanceRow,
} from '@/lib/types'
import { HOTEL_PAYMENT_ACCEPTANCE_INSTRUMENT_ORDER } from '@/lib/hotels/paymentAcceptance'

export type {
  HotelPaymentAcceptanceCapability,
  HotelPaymentAcceptanceConflict,
  HotelPaymentAcceptanceEvidence,
  HotelPaymentAcceptancePresentation,
  HotelPaymentAcceptanceRow,
  HotelPaymentAcceptanceRowId,
  HotelPaymentAcceptanceRowTone,
} from '@/lib/types'

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
            {HOTEL_PAYMENT_ACCEPTANCE_INSTRUMENT_ORDER.map(id => {
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
