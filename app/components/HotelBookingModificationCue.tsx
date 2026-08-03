export type HotelBookingModificationPartner = {
  /** Verified display label, or the literal fallback "booking partner". */
  label: string
  /** True only for an allowlisted partner-domain match. */
  named: boolean
}

export type HotelBookingModificationCueProps = {
  partner: HotelBookingModificationPartner
}

export function HotelBookingModificationCue({ partner }: HotelBookingModificationCueProps) {
  const named = partner.named && partner.label.trim().length > 0
  const owner = named ? partner.label : 'booking partner'

  return (
    <section
      aria-labelledby="hotel-booking-modification-title"
      data-hotel-modification-policy="tier_1_unknown"
      className="w-full min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] p-4"
    >
      <h3
        id="hotel-booking-modification-title"
        className="break-words font-display text-small font-bold leading-5 text-[color:var(--text-1)]"
      >
        Changes after booking
      </h3>
      <p className="mt-2 break-words text-small font-medium leading-5 text-[color:var(--text-1)] [overflow-wrap:anywhere]">
        Before payment, check the selected rate and room terms for date, guest, and room changes.
      </p>
      <p className="mt-2 break-words text-small leading-5 text-[color:var(--text-2)] [overflow-wrap:anywhere]">
        A change may depend on availability and may change the price, taxes, or fees, or require cancellation and rebooking.
      </p>
      <p className="mt-2 min-w-0 break-words text-small leading-5 text-[color:var(--text-2)] [overflow-wrap:anywhere]">
        After booking, use your {owner}{named ? '' : '’s'} confirmation for the booking reference and change or support instructions. expaify cannot change the reservation.
      </p>
    </section>
  )
}
