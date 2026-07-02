'use client'

import { useState } from 'react'

type FaqItem = {
  q: string
  a: string
}

const FAQS: FaqItem[] = [
  {
    q: 'How do you find deals?',
    a: 'We snapshot hotel prices across major marketplaces every day and track 60-day rolling medians. When a price drops to 70% or below its median — with at least 8 historical data points — we flag it as a deal.',
  },
  {
    q: 'Where do I actually book?',
    a: 'Directly on Expedia, Booking.com, Kiwi, or Trip.com. We surface the deal; you book on the platform you trust. We never handle your payment.',
  },
  {
    q: "What's included in the free plan?",
    a: 'Free members see 3 unlocked deals per week. The rest are blurred. You can browse the feed but need a Premium membership to see prices, hotel names, and marketplace links for members-only deals.',
  },
  {
    q: 'How does the free trial work?',
    a: 'You get 7 days of full Premium access — no charge until the trial ends. Cancel any time before day 7 and you pay nothing.',
  },
  {
    q: 'Can I cancel anytime?',
    a: "Yes. Cancel from your account page and you won't be charged for the next period. You keep Premium access through the end of your billing cycle.",
  },
  {
    q: 'Which cities do you track?',
    a: 'We currently track 20 markets: Miami, New York, Cancún, Paris, Rome, Barcelona, Lisbon, London, Tokyo, Bangkok, Dubai, Las Vegas, Orlando, San Juan, Tulum, Amsterdam, Athens, Punta Cana, Charlotte, and Nashville. More coming soon.',
  },
]

export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div className="divide-y divide-[color:var(--line-ivory)]">
      {FAQS.map((item, i) => (
        <div key={i}>
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            className="flex w-full items-center justify-between gap-4 py-5 text-left"
          >
            <span className="font-display text-[17px] font-bold text-[color:var(--ink)]">
              {item.q}
            </span>
            <span
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-[color:var(--line-white)] text-[color:var(--ink-soft)] transition-transform duration-[160ms]"
              style={{ transform: open === i ? 'rotate(45deg)' : 'rotate(0deg)' }}
              aria-hidden
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
          </button>
          <div
            className="overflow-hidden transition-all duration-[160ms]"
            style={{ maxHeight: open === i ? '400px' : '0px', opacity: open === i ? 1 : 0 }}
          >
            <p className="pb-5 text-[15px] leading-relaxed text-[color:var(--ink-soft)]">{item.a}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
