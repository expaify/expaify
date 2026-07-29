'use client'

import { useRef, useState } from 'react'

const partnerLabelWrapCls = 'min-w-0 [overflow-wrap:anywhere]'

export type HotelLoyaltyEligibilityPartner = {
  /** Display label already resolved by getHotelPartnerIdentity. */
  label: string
  /** True only when the host matched a known partner domain. */
  named: boolean
}

export type HotelLoyaltyEligibilityDisclosureProps = {
  partner: HotelLoyaltyEligibilityPartner
  /** Fires once, on the first closed → open transition. */
  onOpen?: () => void
}

export function HotelLoyaltyEligibilityDisclosure({
  partner,
  onOpen,
}: HotelLoyaltyEligibilityDisclosureProps) {
  const [open, setOpen] = useState(false)
  const hasOpenedRef = useRef(false)
  const named = partner.named && !!partner.label
  const partnerLabel = named ? partner.label : 'Your booking partner'

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
        aria-controls="hotel-loyalty-eligibility-panel"
        onClick={handleToggle}
        className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] py-2 text-left text-sm font-medium leading-6 text-[color:var(--brand)] hover:text-[color:var(--brand-hover)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
      >
        <span>Will this stay earn points or status?</span>
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
        <section id="hotel-loyalty-eligibility-panel" aria-labelledby="hotel-loyalty-eligibility-heading" className="mt-2 grid gap-3">
          <h3 id="hotel-loyalty-eligibility-heading" className="sr-only">Will this stay earn points or status</h3>

          <p className="text-sm leading-6 text-[color:var(--text-2)]">
            expaify checks the price. It cannot confirm what a stay earns or what a property will honor.
          </p>

          <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 sm:px-4 sm:py-4">
            <h4 className={`text-sm font-medium leading-5 text-[color:var(--text-1)] ${partnerLabelWrapCls}`}>
              {named ? `${partnerLabel} sells this rate` : 'Your booking partner sells this rate'}
            </h4>
            <p className={`mt-2 text-sm leading-6 text-[color:var(--text-2)] ${partnerLabelWrapCls}`}>
              You are booking with a third-party partner, not with the hotel brand directly. The partner can tell you what the rate includes and whether its checkout accepts a membership number. It cannot tell you whether the stay will earn points or count toward status.
            </p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-3)]">
              Entering a membership number at checkout passes it to the property. It does not decide whether the stay earns — your program&rsquo;s rules do.
            </p>
          </div>

          <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 sm:px-4 sm:py-4">
            <h4 className="text-sm font-medium leading-5 text-[color:var(--text-1)]">Your loyalty program decides what you earn</h4>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
              Points and elite-night credit are set by your program&rsquo;s rules about the booking channel and the rate. Ask your program whether a third-party booking on this rate earns points or qualifying nights — before you book if it matters to your decision.
            </p>
          </div>

          <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 sm:px-4 sm:py-4">
            <h4 className="text-sm font-medium leading-5 text-[color:var(--text-1)]">The property decides what you get on arrival</h4>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
              Status recognition, upgrades, breakfast, lounge access, and late checkout are decided by the property at check-in and depend on availability. No one can guarantee them in advance. After booking, use your confirmation to contact the property and ask what it can provide.
            </p>
          </div>
        </section>
      ) : null}
    </div>
  )
}
