'use client'

import { useState } from 'react'
import { TRACKED_MARKET_NAMES } from '@/lib/trackedMarkets'

type FaqItem = {
  q: string
  a: string
}

const cityList = `${TRACKED_MARKET_NAMES.slice(0, -1).join(', ')}, and ${TRACKED_MARKET_NAMES.at(-1)}`

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
    a: 'Free members get 3 unlocked deals per week, plus a daily email digest for 1 watchlist city. The rest of the feed is blurred — Premium unlocks unlimited deals, instant alerts, and up to 10 watchlist cities.',
  },
  {
    q: 'How does the free trial work?',
    a: 'You get 7 days of full Premium access. No charge until day 8 if you cancel first.',
  },
  {
    q: 'Can I cancel anytime?',
    a: "Yes. Cancel from your account page and you won't be charged for the next period. You keep Premium access through the end of your billing cycle.",
  },
  {
    q: 'Which cities do you track?',
    a: `We currently track ${TRACKED_MARKET_NAMES.length} markets: ${cityList}. More coming soon.`,
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
            <span className="text-h3 text-[color:var(--ink)]">
              {item.q}
            </span>
            <span
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[var(--radius-pill)] border border-[color:var(--line-white)] text-[color:var(--ink-soft)] transition-transform duration-[160ms]"
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
            <p className="text-body pb-5 text-[color:var(--ink-soft)]">{item.a}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
