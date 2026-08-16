import type { Metadata } from 'next'
import { DealCard } from './components/ui/DealCard'
import { LockedDealCard } from './components/ui/LockedDealCard'
import { LandingNav } from './components/LandingNav'
import { FaqAccordion } from './components/FaqAccordion'
import { CITY_SLUGS } from '@/lib/cities'
import { getActiveDeals, getTrackedHotels, type DealRow } from '@/lib/pipeline/dealDetection'
import { DEAL_THRESHOLD, MIN_SNAPSHOTS } from '@/lib/pipeline/dealRules'

export const metadata: Metadata = {
  title: 'expaify — Never overpay for a hotel again',
  description:
    'We track 20 destinations daily and alert you the moment a hotel drops 30% below its normal price.',
}

// getActiveDeals() is a cheap, indexed query (limit 3) with no upstream cache —
// without this the page renders once at build time and never reflects new deals.
export const revalidate = 300

type DealCardDeal = {
  id: string
  hotelName: string
  city: string
  stars: number
  photoUrl?: string
  dealPrice: { priceCents: number; currency: string }
  medianPrice: { priceCents: number; currency: string }
  discountPct: number
  checkInWindow: string
  snapshotCount: number
  links: { expedia?: string; booking?: string; kiwi?: string; trip?: string; bookingSearchUrl?: string }
  headline?: string
  isMock?: boolean
  firstSeen?: string
  updatedAt?: string | null
}

function rowToCard(row: DealRow): DealCardDeal {
  const ota = (row.ota_links ?? {}) as Record<string, string>
  return {
    id: row.id,
    hotelName: row.hotel_name,
    city: row.city,
    stars: row.stars ?? 3,
    photoUrl: row.photo_url ?? undefined,
    dealPrice: { priceCents: row.deal_price_cents, currency: 'USD' },
    medianPrice: { priceCents: row.median_price_cents, currency: 'USD' },
    discountPct: row.discount_pct,
    checkInWindow: row.check_in_window,
    snapshotCount: row.snapshot_count,
    links: {
      expedia: ota['expedia'] ?? ota['Expedia'],
      booking: ota['booking'] ?? ota['Booking.com'],
      kiwi: ota['kiwi'] ?? ota['Kiwi'],
      trip: ota['trip'] ?? ota['Trip.com'],
      bookingSearchUrl: ota['bookingSearchUrl'],
    },
    headline: row.headline ?? undefined,
    isMock: row.is_mock,
    firstSeen: row.first_seen ?? undefined,
    updatedAt: row.updated_at,
  }
}

const THREE_HOURS_AGO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

/** Example cards must never show a check-in window that has already passed. */
function exampleCheckInWindow(daysOut: number, nights: number): string {
  const start = new Date(Date.now() + daysOut * 24 * 60 * 60 * 1000)
  const end = new Date(start.getTime() + nights * 24 * 60 * 60 * 1000)
  const format = (date: Date) =>
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return start.getUTCMonth() === end.getUTCMonth()
    ? `${format(start)} – ${end.getUTCDate()}`
    : `${format(start)} – ${format(end)}`
}

const MOCK_HERO: DealCardDeal = {
  id: 'demo-1',
  hotelName: 'Riverside Rooftop Hotel',
  city: 'Lisbon, Portugal',
  stars: 4,
  dealPrice: { priceCents: 18900, currency: 'USD' },
  medianPrice: { priceCents: 41000, currency: 'USD' },
  discountPct: 54,
  checkInWindow: exampleCheckInWindow(38, 2),
  snapshotCount: 43,
  links: { expedia: '#', booking: '#', kiwi: '#', trip: '#' },
  headline: '54% below its 60-day median',
  isMock: true,
  firstSeen: THREE_HOURS_AGO,
  updatedAt: null,
}

const MOCK_TEASER: DealCardDeal = {
  id: 'teaser-1',
  hotelName: 'Shorebreak Coast Hotel',
  city: 'Huntington Beach',
  stars: 4,
  dealPrice: { priceCents: 11200, currency: 'USD' },
  medianPrice: { priceCents: 19800, currency: 'USD' },
  discountPct: 43,
  checkInWindow: exampleCheckInWindow(61, 2),
  snapshotCount: 18,
  links: { expedia: '#', booking: '#', kiwi: '#', trip: '#' },
  headline: '43% below usual',
  isMock: true,
  firstSeen: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  updatedAt: null,
}

export default async function LandingPage() {
  const rows = await getActiveDeals({
    limit: 3,
    sort: 'discount',
    includeMock: false,
    minDiscount: 20,
  }).catch(() => [] as DealRow[])

  // Statistically-confirmed deals (30%+ below an 8-snapshot median) can take
  // days to accumulate for a given market even once real snapshots are
  // flowing. Rather than showing fabricated example cards while that builds
  // up, fill any remaining slots with real, currently-tracked hotels — real
  // photo, real price, real booking links, just not (yet) a confirmed deal.
  // Fetch a few extra so the (still-blurred) locked teaser cards below can
  // use a real photo too instead of an empty "Photo unavailable" box.
  let combinedRows = rows
  let lockedTeaserPool: Array<{ photoUrl: string | null; discountPct: number }> = []
  if (combinedRows.length < 3) {
    const tracked = await getTrackedHotels({ limit: 5 }).catch(() => [] as DealRow[])
    const needed = Math.max(0, 2 - combinedRows.length)
    combinedRows = [...combinedRows, ...tracked.slice(0, needed)]
    lockedTeaserPool = tracked.slice(needed).map(row => ({ photoUrl: row.photo_url, discountPct: row.discount_pct }))
  }

  const realDeals = combinedRows.map(rowToCard)
  const heroCard = realDeals[0] ?? MOCK_HERO
  const teaserCard = realDeals[1] ?? MOCK_TEASER
  const hasReal = realDeals.length > 0
  return (
    <>
      <LandingNav />

      <main>
        {/* ── Hero ──────────────────────────────────────── */}
        <section className="mx-auto max-w-[1140px] px-5 pb-20 pt-16">
          <div className="flex flex-col items-center gap-12 min-[900px]:flex-row min-[900px]:items-center min-[900px]:gap-16">
            {/* Left */}
            <div className="flex max-w-[440px] flex-col items-start gap-6">
              <h1 className="text-display text-[color:var(--ink)]">
                Never overpay for a hotel again.
              </h1>
              <p className="text-body text-[color:var(--ink-soft)]">
                We watch prices across Expedia, Booking.com, Kiwi, and Trip.com — and tell you the moment a hotel drops 30%+ below normal.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a href="/join" className="btn btn-conversion btn-lg">
                  Join for free
                </a>
                <a
                  href="/deals"
                  className="text-body font-medium text-[color:var(--ink-soft)] underline decoration-[color:var(--line-white)] underline-offset-2 transition-colors hover:text-[color:var(--ink)] hover:decoration-[color:var(--ink-soft)]"
                >
                  See live deals
                </a>
              </div>
              <p className="flex items-center gap-1.5 text-small font-semibold text-[color:var(--ink)]">
                <span aria-hidden className="text-[color:var(--primary)]">★★★★★</span>
                Trusted by 2,400+ deal hunters
              </p>
            </div>

            {/* Right — deal cards stack */}
            <div className="flex w-full max-w-[360px] justify-center">
              <div className="relative w-full">
                {/* Peeking card behind — hidden on very small screens */}
                <div
                  className="absolute -inset-x-4 -top-4 hidden opacity-60 min-[380px]:block min-[900px]:-inset-x-6 min-[900px]:-top-6"
                  aria-hidden
                  inert
                >
                  <LockedDealCard
                    placeholderName="Boutique Urban Stays"
                    placeholderCity="Paris · Oct 10 – 12"
                    stars={4}
                    discountPct={lockedTeaserPool[0]?.discountPct ?? MOCK_HERO.discountPct}
                    photoUrl={lockedTeaserPool[0]?.photoUrl ?? undefined}
                  />
                </div>
                {/* Front card */}
                <div className="relative z-10">
                  <DealCard deal={heroCard} href={hasReal ? '/deals' : undefined} photoLoading="eager" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Logo strip ──────────────────────────────── */}
        <section className="border-y border-[color:var(--line-ivory)] bg-[color:var(--surface)] py-6">
          <div className="mx-auto max-w-[1140px] px-5">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              <span className="text-small text-[color:var(--ink-faint)]">Deals found across</span>
              {['Expedia', 'Booking.com', 'Kiwi', 'Trip.com'].map((name) => (
                <span
                  key={name}
                  className="font-display text-body font-bold text-[color:var(--ink-faint)]"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Live teaser ─────────────────────────────── */}
        <section className="mx-auto max-w-[1140px] px-5 py-20">
          <div className="mb-8 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <h2 className="text-h2 text-[color:var(--ink)]">
              {hasReal ? 'Live deals right now' : 'Caught this week'}
            </h2>
            <a
              href="/deals"
              className="text-small font-medium text-[color:var(--primary)] no-underline hover:underline"
            >
              See all deals →
            </a>
          </div>
          <div className="grid gap-6 min-[680px]:grid-cols-2 min-[1024px]:grid-cols-3">
            <DealCard deal={teaserCard} href="/deals" />
            {realDeals[2] ? (
              <DealCard deal={realDeals[2]} href="/deals" />
            ) : (
              <LockedDealCard
                placeholderName="Beachfront All-Inclusive"
                placeholderCity="Cancún · Oct 7 – 11"
                stars={5}
                discountPct={lockedTeaserPool[1]?.discountPct ?? MOCK_TEASER.discountPct}
                photoUrl={lockedTeaserPool[1]?.photoUrl ?? undefined}
              />
            )}
            <LockedDealCard
              placeholderName="Design District Boutique"
              placeholderCity="Miami · Sep 28 – 30"
              stars={4}
              discountPct={lockedTeaserPool[2]?.discountPct ?? MOCK_HERO.discountPct}
              photoUrl={lockedTeaserPool[2]?.photoUrl ?? undefined}
            />
          </div>
        </section>

        {/* ── Destinations ────────────────────────────── */}
        <section className="border-y border-[color:var(--line-ivory)] bg-[color:var(--surface)] py-20">
          <div className="mx-auto max-w-[1140px] px-5">
            <h2 className="text-h2 mb-3 text-center text-[color:var(--ink)]">
              Browse by destination
            </h2>
            <p className="text-body mb-12 text-center text-[color:var(--ink-soft)]">
              Explore the destinations expaify tracks for hotel price drops.
            </p>
            <div className="grid grid-cols-2 gap-3 min-[640px]:grid-cols-4 min-[1024px]:grid-cols-5">
              {Object.entries(CITY_SLUGS).map(([slug, name]) => (
                <a
                  key={slug}
                  href={`/destinations/${slug}`}
                  className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] px-5 py-3 text-center text-small font-medium text-[color:var(--ink-soft)] no-underline transition-colors hover:text-[color:var(--primary)]"
                >
                  {name}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ────────────────────────────── */}
        <section id="how-it-works" className="bg-[color:var(--surface)] py-20">
          <div className="mx-auto max-w-[1140px] px-5">
            <h2 className="text-h2 mb-12 text-center text-[color:var(--ink)]">
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
                  body: `A deal is only flagged when a price drops to ${Math.round(DEAL_THRESHOLD * 100)}% or below its rolling 60-day median — with at least ${MIN_SNAPSHOTS} price checks behind it.`,
                },
                {
                  n: '03',
                  title: 'You book directly',
                  body: 'We show you where to book on Expedia, Booking.com, Kiwi, or Trip.com. You get the deal; they handle the booking.',
                },
              ].map(({ n, title, body }) => (
                <div key={n} className="flex flex-col gap-4">
                  <span
                    className="text-display leading-none"
                    style={{ color: 'var(--line-ivory)' }}
                    aria-hidden
                  >
                    {n}
                  </span>
                  <h3 className="text-h3 text-[color:var(--ink)]">
                    {title}
                  </h3>
                  <p className="text-body text-[color:var(--ink-soft)]">{body}</p>
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
                <h2 className="text-display text-[color:var(--text-inverse)]">
                  One deal.{' '}
                  <span className="text-[color:var(--primary-soft)]">Four marketplaces.</span>{' '}
                  Zero tabs.
                </h2>
                <p className="text-body mt-6 text-[color:var(--ink-faint-on-dark)]">
                  You always book directly with the marketplace — we just find the moment to strike.
                </p>
              </div>
              {/* Deal card on dark */}
              <div className="w-full max-w-[360px] flex-shrink-0">
                <DealCard deal={heroCard} href={hasReal ? '/deals' : undefined} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Pricing ─────────────────────────────────── */}
        <section id="pricing" className="mx-auto max-w-[1140px] px-5 py-20">
          <h2 className="text-h2 mb-3 text-center text-[color:var(--ink)]">
            Simple pricing
          </h2>
          <p className="text-body mb-12 text-center text-[color:var(--ink-soft)]">
            Start free. Upgrade when a deal pays for itself.
          </p>

          <div className="mx-auto grid max-w-[760px] gap-6 min-[640px]:grid-cols-2">
            {/* Free */}
            <div className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-7">
              <div>
                <p className="text-small font-medium uppercase tracking-wider text-[color:var(--ink-faint)]">
                  Free
                </p>
                <div className="mt-2 flex flex-wrap items-baseline gap-1">
                  <span className="text-stat text-[color:var(--ink)]">$0</span>
                  <span className="text-body text-[color:var(--ink-faint)]">/ month</span>
                </div>
              </div>
              <ul className="flex flex-col gap-3">
                {[
                  '3 unlocked deals per week',
                  'Browse full feed (blurred)',
                  'No email alerts',
                ].map((f) => (
                  <li key={f} className="text-small flex items-start gap-2.5 text-[color:var(--ink-soft)]">
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
                  <p className="text-small font-medium uppercase tracking-wider text-[color:var(--ink-faint)]">
                    Premium
                  </p>
                  <span className="rounded-[var(--radius-pill)] bg-[color:var(--gold)] px-2 py-0.5 font-display text-caption font-bold leading-none text-[color:var(--gold-text)]">
                    2 months free
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-baseline gap-1">
                  <span className="text-stat text-[color:var(--ink)]">$8</span>
                  <span className="text-body text-[color:var(--ink-faint)]">/ month, billed annually</span>
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
                  <li key={f} className="text-small flex items-start gap-2.5 text-[color:var(--ink)]">
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
              <p className="text-caption text-center text-[color:var(--ink-faint)]">
                Cancel anytime before day 7 — no charge.
              </p>
            </div>
          </div>

          <p className="text-small mt-6 text-center text-[color:var(--ink-faint)]">
            Monthly plan also available at $12/month.
          </p>
        </section>

        {/* ── FAQ ─────────────────────────────────────── */}
        <section id="faq" className="bg-[color:var(--surface)] py-20">
          <div className="mx-auto max-w-[720px] px-5">
            <h2 className="text-h2 mb-10 text-center text-[color:var(--ink)]">
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
                className="text-h3 flex items-center gap-0.5 leading-none text-[color:var(--text-inverse)] no-underline"
                aria-label="expaify home"
              >
                expaify
                <span className="h-2 w-2 rounded-[var(--radius-pill)] bg-[color:var(--primary-soft)]" aria-hidden />
              </a>
              <p className="text-small max-w-[180px] text-[color:var(--ink-faint-on-dark)]">
                Never overpay for a hotel again.
              </p>
              <div className="flex items-center gap-3">
                <a
                  href="https://x.com/Expaifycom"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="expaify on X"
                  className="text-[color:var(--ink-faint-on-dark)] transition-colors hover:text-[color:var(--text-inverse)]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="https://www.tiktok.com/@expaify"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="expaify on TikTok"
                  className="text-[color:var(--ink-faint-on-dark)] transition-colors hover:text-[color:var(--text-inverse)]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M16.6 5.82a4.28 4.28 0 0 1-.53-2.9h-3.03v13.44a2.6 2.6 0 1 1-2.6-2.6c.19 0 .38.02.56.06V10.8a5.6 5.6 0 1 0 4.9 5.56V8.94a7.24 7.24 0 0 0 4.24 1.36V7.28a4.28 4.28 0 0 1-3.54-1.46z" />
                  </svg>
                </a>
                <a
                  href="https://www.facebook.com/expaify"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="expaify on Facebook"
                  className="text-[color:var(--ink-faint-on-dark)] transition-colors hover:text-[color:var(--text-inverse)]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
                  </svg>
                </a>
                <a
                  href="https://www.instagram.com/expaify"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="expaify on Instagram"
                  className="text-[color:var(--ink-faint-on-dark)] transition-colors hover:text-[color:var(--text-inverse)]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" />
                  </svg>
                </a>
                <a
                  href="https://www.youtube.com/@expaify"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="expaify on YouTube"
                  className="text-[color:var(--ink-faint-on-dark)] transition-colors hover:text-[color:var(--text-inverse)]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.017 3.017 0 0 0 2.121 2.136c1.872.505 9.377.505 9.377.505s7.505 0 9.377-.505a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Product */}
            <div>
              <p className="text-caption mb-3 font-medium uppercase tracking-wider text-[color:var(--ink-faint-on-dark)]">
                Product
              </p>
              <ul className="flex flex-col gap-2">
                {[
                  { label: 'Deals', href: '/deals' },
                  { label: 'Pricing', href: '#pricing' },
                  { label: 'How it works', href: '#how-it-works' },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} className="text-small text-[color:var(--ink-faint-on-dark)] no-underline hover:text-[color:var(--text-inverse)]">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Account */}
            <div>
              <p className="text-caption mb-3 font-medium uppercase tracking-wider text-[color:var(--ink-faint-on-dark)]">
                Account
              </p>
              <ul className="flex flex-col gap-2">
                {[
                  { label: 'Login', href: '/login' },
                  { label: 'Join free', href: '/join' },
                  { label: 'FAQ', href: '#faq' },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} className="text-small text-[color:var(--ink-faint-on-dark)] no-underline hover:text-[color:var(--text-inverse)]">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="text-caption mb-3 font-medium uppercase tracking-wider text-[color:var(--ink-faint-on-dark)]">
                Legal
              </p>
              <ul className="flex flex-col gap-2">
                {[
                  { label: 'Privacy', href: '/privacy' },
                  { label: 'Terms', href: '/terms' },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} className="text-small text-[color:var(--ink-faint-on-dark)] no-underline hover:text-[color:var(--text-inverse)]">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-[color:color-mix(in_srgb,var(--surface)_8%,transparent)] pt-8 min-[640px]:flex-row min-[640px]:items-center">
            <p className="text-small text-[color:var(--ink-faint-on-dark)]">
              © 2026 expaify. All rights reserved.
            </p>
            <p className="text-caption text-[color:var(--ink-faint-on-dark)]">
              Prices change fast — always confirm at checkout.
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}
