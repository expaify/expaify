'use client'

import { useRef, useState } from 'react'

const partnerLabelWrapCls = 'min-w-0 [overflow-wrap:anywhere]'

export type HotelBookingOwnershipPartner = {
  /** Display label already resolved by getHotelPartnerIdentity; "booking partner" when unresolved. */
  label: string
  /** True only when the host matched a known partner domain. */
  named: boolean
}

/**
 * Verified, monitored expaify product-support destination.
 * Null until product/operations confirms one — see design spec §8. Never infer, never guess a path.
 */
export type ExpaifyIssueRoute = {
  href: string
  destinationType: 'help_center' | 'mailto'
} | null

export type HotelBookingOwnershipDisclosureProps = {
  partner: HotelBookingOwnershipPartner
  /** Defaults to null. Passing a value is gated on design spec §8 sign-off. */
  expaifyIssueRoute?: ExpaifyIssueRoute
  /** Fires once, on the first closed → open transition. */
  onOpen?: () => void
  /** Fires on activation of an owner-attributed help link. */
  onContactClick?: (owner: 'partner' | 'expaify', destinationType: 'help_center' | 'mailto') => void
}

export function HotelBookingOwnershipDisclosure({
  partner,
  expaifyIssueRoute = null,
  onOpen,
  onContactClick,
}: HotelBookingOwnershipDisclosureProps) {
  const [open, setOpen] = useState(false)
  const hasOpenedRef = useRef(false)
  const named = partner.named && !!partner.label
  const partnerLabel = named ? partner.label : 'your booking partner'

  const handleToggle = () => {
    setOpen((current) => {
      const next = !current
      if (next && !hasOpenedRef.current) {
        hasOpenedRef.current = true
        onOpen?.()
      }
      return next
    })
  }

  return (
    <div className="mt-4 border-t border-[color:var(--border)] pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="hotel-booking-ownership-panel"
        onClick={handleToggle}
        className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] py-2 text-left text-sm font-medium leading-6 text-[color:var(--brand)] hover:text-[color:var(--brand-hover)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
      >
        <span>Who handles my booking?</span>
        <svg
          aria-hidden="true"
          focusable="false"
          className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <section id="hotel-booking-ownership-panel" aria-labelledby="hotel-booking-ownership-heading" className="mt-2 grid gap-3 sm:grid-cols-2">
          <h3 id="hotel-booking-ownership-heading" className="sr-only">Who handles my booking</h3>

          <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 sm:px-4 sm:py-4">
            <h4 className={`text-sm font-medium leading-5 text-[color:var(--text-1)] ${partnerLabelWrapCls}`}>
              {named ? `${partnerLabel} manages your reservation` : 'Your booking partner manages your reservation'}
            </h4>
            <p className={`mt-2 text-sm leading-6 text-[color:var(--text-2)] ${partnerLabelWrapCls}`}>
              After checkout, {partnerLabel} provides your confirmation and is your first contact for reservation status, changes, cancellations, refunds, payment questions, or a missing confirmation. Use the contact details in your confirmation or on the site where you complete the booking.
            </p>
            {!named ? (
              <p className="mt-2 text-sm leading-6 text-[color:var(--text-3)]">
                Not sure which company that is? Check the confirmation you receive, your card statement, or your browser history after checkout.
              </p>
            ) : null}
          </div>

          <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 sm:px-4 sm:py-4">
            <h4 className="text-sm font-medium leading-5 text-[color:var(--text-1)]">expaify helps with the deal and handoff</h4>
            {expaifyIssueRoute === null ? (
              <>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
                  expaify can help only with what it shows here: the hotel, the price, or the booking link on this page. expaify cannot access, change, cancel, or refund a reservation completed with the booking partner.
                </p>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-3)]">
                  If something on this page looks wrong, note the offer reference under &ldquo;Show offer details&rdquo; before you continue.
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
                  Contact expaify if the hotel, price, or booking link shown here looks wrong. expaify cannot access, change, cancel, or refund a reservation completed with the booking partner.
                </p>
                <a
                  href={expaifyIssueRoute.href}
                  rel={expaifyIssueRoute.destinationType === 'help_center' ? 'noopener' : undefined}
                  aria-label="Report an expaify issue with this deal or link"
                  onClick={() => onContactClick?.('expaify', expaifyIssueRoute.destinationType)}
                  className="mt-3 inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-[color:var(--border)] px-4 text-sm font-medium text-[color:var(--text-1)] hover:border-[color:var(--border-hover)] hover:bg-[color:var(--brand-soft)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
                >
                  Report an expaify issue
                </a>
              </>
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}
