import type { Metadata } from 'next'
import { DealCard } from './components/ui/DealCard'
import { LockedDealCard } from './components/ui/LockedDealCard'
import { LandingNav } from './components/LandingNav'
import { FaqAccordion } from './components/FaqAccordion'

export const metadata: Metadata = {
  title: 'expaify — Never overpay for a hotel again',
  description:
    'We track 20 destinations daily and alert you the moment a hotel drops 30% below its normal price.',
}

// Sample deal for hero and dark band sections
const THREE_HOURS_AGO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

const HERO_DEAL = {
  id: 'demo-1',
  hotelName: 'Hotel Miramar Rooftop',
  city: 'Lisbon, Portugal',
  stars: 4,
  photoUrl: undefined,
  dealPrice: { priceCents: 18900, currency: 'USD' },
  medianPrice: { priceCents: 41000, currency: 'USD' },
  discountPct: 54,
  checkInWindow: 'Mar 12 – 14',
  snapshotCount: 43,
  links: {
    expedia: '#',
    booking: '#',
    kiwi: '#',
    trip: '#',
  },
  headline: '54% below its 60-day average',
  isMock: true,
  firstSeen: THREE_HOURS_AGO,
}

const TEASER_DEALS = [
  {
    id: 'teaser-1',
    hotelName: 'Kimpton Shorebreak Resort',
    city: 'Huntington Beach',
    stars: 4,
    dealPrice: { priceCents: 11200, currency: 'USD' },
    medianPrice: { priceCents: 19800, currency: 'USD' },
    discountPct: 43,
    checkInWindow: 'Oct 3 – 5',
    snapshotCount: 18,
    links: { expedia: '#', booking: '#', kiwi: '#', trip: '#' },
    headline: '43% below usual',
    isMock: true,
    firstSeen: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
]

export default function LandingPage() {
  return (
    <>
      <LandingNav />

      <main>
        {/* ── Hero ──────────────────────────────────────── */}
        <section className="mx-auto max-w-[1140px] px-5 pb-20 pt-16">
          <div className="flex flex-col items-center gap-12 min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-16">
            {/* Left */}
            <div className="flex max-w-[440px] flex-col items-start gap-6">
              <h1 className="font-display text-[36px] font-bold leading-[1.05] tracking-tight text-[color:var(--ink)] min-[400px]:text-[44px] min-[480px]:text-[52px]">
                Never overpay for a hotel again.
              </h1>
              <p className="text-[17px] leading-relaxed text-[color:var(--ink-soft)]">
                We watch prices across Expedia, Booking.com, Kiwi, and Trip.com — and tell you the moment a hotel drops 30%+ below normal.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a href="/join" className="btn btn-conversion px-6">
                  Join for free
                </a>
                <a
                  href="/deals"
                  className="text-[15px] font-medium text-[color:var(--ink-soft)] underline decoration-[color:var(--line-white)] underline-offset-2 transition-colors hover:text-[color:var(--ink)] hover:decoration-[color:var(--ink-soft)]"
                >
                  See live deals
                </a>
              </div>
              <p className="flex items-center gap-1.5 text-[13px] text-[color:var(--ink-faint)]">
                <span aria-hidden className="text-[color:var(--primary-soft)]">★★★★★</span>
                Trusted by 2,400+ deal hunters
              </p>
            </div>

            {/* Right — deal cards stack */}
            <div className="relative flex w-full max-w-[360px] flex-shrink-0 justify-center min-[900px]:justify-end">
              {/* Peeking card behind — hidden on very small screens */}
              <div
                className="absolute inset-0 top-3 mx-auto hidden w-[calc(100%-32px)] opacity-60 min-[380px]:block min-[900px]:rotate-[3deg]"
                aria-hidden
              >
                <LockedDealCard
                  placeholderName="Boutique Urban Stays"
                  placeholderCity="Paris · Oct 10 – 12"
                  stars={4}
                />
              </div>
              {/* Front card */}
              <div className="relative z-10 w-full min-[900px]:-rotate-2">
                <DealCard deal={HERO_DEAL} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Logo strip ──────────────────────────────── */}
        <section className="border-y border-[color:var(--line-ivory)] bg-[color:var(--surface)] py-6">
          <div className="mx-auto max-w-[1140px] px-5">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              <span className="text-[13px] text-[color:var(--ink-faint)]">Deals found across</span>
              {['Expedia', 'Booking.com', 'Kiwi', 'Trip.com'].map((name) => (
                <span
                  key={name}
                  className="font-display text-[15px] font-bold text-[color:var(--ink-faint)]"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Live teaser ─────────────────────────────── */}
        <section className="mx-auto max-w-[1140px] px-5 py-20">
          <div className="mb-8 flex items-baseline justify-between">
            <h2 className="font-display text-[30px] font-bold text-[color:var(--ink)]">
              Caught this week
            </h2>
            <a
              href="/deals"
              className="text-[14px] font-medium text-[color:var(--primary)] no-underline hover:underline"
            >
              See all deals →
            </a>
          </div>
          <div className="grid gap-6 min-[680px]:grid-cols-2 min-[1024px]:grid-cols-3">
            <DealCard deal={TEASER_DEALS[0]} href="/deals" />
            <LockedDealCard
              placeholderName="Beachfront All-Inclusive"
              placeholderCity="Cancún · Oct 7 – 11"
              stars={5}
            />
            <LockedDealCard
              placeholderName="Design District Boutique"
              placeholderCity="Miami · Sep 28 – 30"
              stars={4}
            />
          </div>
        </section>

        {/* ── How it works ────────────────────────────── */}
        <section id="how-it-works" className="bg-[color:var(--surface)] py-20">
          <div className="mx-auto max-w-[1140px] px-5">
            <h2 className="mb-12 text-center font-display text-[30px] font-bold text-[color:var(--ink)]">
              How it works
            </h2>
            <div className="grid gap-10 min-[640px]:grid-cols-3">
              {[
                {
                  n: '01',
                  title: 'We track prices daily',
                  body: 'Our pipeline snapshots hotel rates across 20 destinations every 24 hours, building a 60-day price history per property.',
                },
                {
                  n: '02',
                  title: 'We detect real drops',
                  body: 'A deal is only flagged when a price falls 30% below its rolling median — with at least 8 historical data points behind it.',
                },
                {
                  n: '03',
                  title: 'You book directly',
                  body: 'We show you where to book on Expedia, Booking.com, Kiwi, or Trip.com. You get the deal; they handle the booking.',
                },
              ].map(({ n, title, body }) => (
                <div key={n} className="flex flex-col gap-4">
                  <span
                    className="font-display text-[56px] font-bold leading-none"
                    style={{ color: 'var(--line-ivory)' }}
                    aria-hidden
                  >
                    {n}
                  </span>
                  <h3 className="font-display text-[20px] font-bold text-[color:var(--ink)]">
                    {title}
                  </h3>
                  <p className="text-[15px] leading-relaxed text-[color:var(--ink-soft)]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Dark band ───────────────────────────────── */}
        <section className="bg-[color:var(--ink)] py-20">
          <div className="mx-auto max-w-[1140px] px-5">
            <div className="flex flex-col items-center gap-12 min-[900px]:flex-row min-[900px]:items-center">
              {/* Text */}
              <div className="max-w-[440px] flex-shrink-0">
                <h2 className="font-display text-[36px] font-bold leading-[1.1] text-white min-[480px]:text-[44px]">
                  One deal.{' '}
                  <span className="text-[color:var(--primary-soft)]">Four marketplaces.</span>{' '}
                  Zero tabs.
                </h2>
                <p className="mt-6 text-[15px] leading-relaxed text-[color:var(--ink-faint-on-dark)]">
                  You always book directly with the marketplace — we just find the moment to strike.
                </p>
              </div>
              {/* Deal card on dark */}
              <div className="w-full max-w-[360px] flex-shrink-0">
                <DealCard deal={HERO_DEAL} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Pricing ─────────────────────────────────── */}
        <section id="pricing" className="mx-auto max-w-[1140px] px-5 py-20">
          <h2 className="mb-3 text-center font-display text-[30px] font-bold text-[color:var(--ink)]">
            Simple pricing
          </h2>
          <p className="mb-12 text-center text-[15px] text-[color:var(--ink-soft)]">
            Start free. Upgrade when a deal pays for itself.
          </p>

          <div className="mx-auto grid max-w-[760px] gap-6 min-[640px]:grid-cols-2">
            {/* Free */}
            <div className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-7">
              <div>
                <p className="text-[13px] font-medium uppercase tracking-wider text-[color:var(--ink-faint)]">
                  Free
                </p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-display text-[36px] font-bold text-[color:var(--ink)]">$0</span>
                  <span className="text-[15px] text-[color:var(--ink-faint)]">/ month</span>
                </div>
              </div>
              <ul className="flex flex-col gap-3">
                {[
                  '3 unlocked deals per week',
                  'Browse full feed (blurred)',
                  'No email alerts',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[14px] text-[color:var(--ink-soft)]">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="mt-0.5 flex-shrink-0 text-[color:var(--ink-faint)]"
                      aria-hidden
                    >
                      <path d="M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="/join" className="btn btn-conversion mt-auto w-full justify-center">
                Get started free
              </a>
            </div>

            {/* Premium — annual highlight */}
            <div
              className="flex flex-col gap-6 rounded-[var(--radius-card)] border-2 bg-[color:var(--surface)] p-7"
              style={{ borderColor: 'var(--primary)' }}
            >
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <p className="text-[13px] font-medium uppercase tracking-wider text-[color:var(--ink-faint)]">
                    Premium
                  </p>
                  <span className="rounded-[var(--radius-pill)] bg-[color:var(--gold)] px-2 py-0.5 font-display text-[11.5px] font-bold leading-none text-[color:var(--gold-text)]">
                    2 months free
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-display text-[36px] font-bold text-[color:var(--ink)]">$8</span>
                  <span className="text-[15px] text-[color:var(--ink-faint)]">/ month, billed annually</span>
                </div>
              </div>
              <ul className="flex flex-col gap-3">
                {[
                  'Unlimited unlocked deals',
                  'Instant + daily email alerts',
                  'Destination watchlist',
                  'Filter by discount, stars, price',
                  '7-day free trial',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[14px] text-[color:var(--ink)]">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="mt-0.5 flex-shrink-0"
                      style={{ color: 'var(--primary)' }}
                      aria-hidden
                    >
                      <path
                        d="M3 8l3.5 3.5L13 4.5"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="/join?plan=annual" className="btn btn-conversion mt-auto w-full justify-center">
                Start free trial
              </a>
              <p className="text-center text-[12px] text-[color:var(--ink-faint)]">
                Cancel anytime before day 7 — no charge.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-[13px] text-[color:var(--ink-faint)]">
            Monthly plan also available at $12/month.
          </p>
        </section>

        {/* ── FAQ ─────────────────────────────────────── */}
        <section id="faq" className="bg-[color:var(--surface)] py-20">
          <div className="mx-auto max-w-[720px] px-5">
            <h2 className="mb-10 text-center font-display text-[30px] font-bold text-[color:var(--ink)]">
              Questions
            </h2>
            <FaqAccordion />
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="bg-[color:var(--ink)] py-16">
        <div className="mx-auto max-w-[1140px] px-5">
          <div className="grid gap-10 min-[640px]:grid-cols-[auto_1fr_1fr_1fr]">
            {/* Brand */}
            <div className="flex flex-col gap-3">
              <a
                href="/"
                className="flex items-center gap-0.5 font-display text-[18px] font-bold leading-none text-white no-underline"
                aria-label="expaify home"
              >
                expaify
                <span className="h-[6px] w-[6px] rounded-full bg-[color:var(--accent)]" aria-hidden />
              </a>
              <p className="max-w-[180px] text-[13px] leading-relaxed text-[color:var(--ink-faint-on-dark)]">
                Never overpay for a hotel again.
              </p>
            </div>

            {/* Product */}
            <div>
              <p className="mb-3 text-[11.5px] font-medium uppercase tracking-wider text-[color:var(--ink-faint-on-dark)]">
                Product
              </p>
              <ul className="flex flex-col gap-2">
                {[
                  { label: 'Deals', href: '/deals' },
                  { label: 'Pricing', href: '#pricing' },
                  { label: 'How it works', href: '#how-it-works' },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} className="text-[14px] text-[color:var(--ink-faint-on-dark)] no-underline hover:text-white">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Account */}
            <div>
              <p className="mb-3 text-[11.5px] font-medium uppercase tracking-wider text-[color:var(--ink-faint-on-dark)]">
                Account
              </p>
              <ul className="flex flex-col gap-2">
                {[
                  { label: 'Login', href: '/login' },
                  { label: 'Join free', href: '/join' },
                  { label: 'FAQ', href: '#faq' },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} className="text-[14px] text-[color:var(--ink-faint-on-dark)] no-underline hover:text-white">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="mb-3 text-[11.5px] font-medium uppercase tracking-wider text-[color:var(--ink-faint-on-dark)]">
                Legal
              </p>
              <ul className="flex flex-col gap-2">
                {[
                  { label: 'Privacy', href: '/privacy' },
                  { label: 'Terms', href: '/terms' },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} className="text-[14px] text-[color:var(--ink-faint-on-dark)] no-underline hover:text-white">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-[rgba(255,255,255,0.08)] pt-8 min-[640px]:flex-row min-[640px]:items-center">
            <p className="text-[13px] text-[color:var(--ink-faint-on-dark)]">
              © 2026 expaify. All rights reserved.
            </p>
            <p className="text-[12px] text-[color:var(--ink-faint-on-dark)]">
              Prices change fast — always confirm at checkout.
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}
