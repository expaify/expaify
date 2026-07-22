import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getDealById, getPriceHistory, type DealRow } from '@/lib/pipeline/dealDetection'
import { getFreeUnlockedDealIds, getPaywallContext } from '@/lib/paywall'
import { query } from '@/lib/db/client'
import { formatMoney } from '@/lib/money'
import { TrustLine } from '@/app/components/ui/TrustLine'
import { PriceSparkline } from '@/app/components/ui/PriceSparkline'
import { CompareRow } from '@/app/components/ui/CompareRow'
import { ShareButton } from '@/app/components/ui/ShareButton'
import DealScorePanel from '@/app/components/DealScorePanel'
import { scoreDeal } from '@/lib/scoring/scoreDeal'
import type { DealScore } from '@/lib/types'
import { timeAgo } from '@/lib/timeAgo'

type PageProps = { params: Promise<{ dealId: string }> }

function fmtDate(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtCheckedDate(iso?: string | null): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function fmtShort(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function addNights(dateStr: string, nights: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + nights)
  return fmtShort(d.toISOString())
}

function Fact({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">{label}</p>
      <p className={`mt-0.5 text-[13px] font-medium leading-5 ${muted ? 'text-[color:var(--text-3)]' : 'text-[color:var(--text-1)]'}`}>
        {value}
      </p>
    </div>
  )
}

function PropertyUnavailable() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-[560px] items-center px-4 py-8 sm:px-6">
      <section className="w-full rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-[color:var(--text-1)]">Property details unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">The provider did not return a property name, so expaify cannot confirm which hotel this rate belongs to.</p>
        <a href="/deals" className="btn btn-primary mt-6 inline-flex min-h-11 w-full items-center justify-center">Back to saved deals</a>
      </section>
    </main>
  )
}

function LockedDealDetail({ city, checkInWindow }: { city: string; checkInWindow: string }) {
  return (
    <div className="min-h-screen bg-[color:var(--bg)]">
      <nav className="border-b border-[color:var(--line-ivory)] bg-[color:var(--bg)]">
        <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-5">
          <a href="/" className="flex items-center gap-0.5 font-display text-[20px] font-bold text-[color:var(--ink)] no-underline">
            expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" aria-hidden />
          </a>
          <a href="/deals" className="text-[14px] font-medium text-[color:var(--ink-soft)] no-underline hover:text-[color:var(--ink)]">
            ← Back to deals
          </a>
        </div>
      </nav>

      <main className="mx-auto max-w-[560px] px-5 py-14">
        <section className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-8 text-center">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-[var(--radius-pill)] bg-[color:var(--gold)] px-3 py-1 font-display text-[12px] font-bold leading-none text-[color:var(--gold-text)]">
              Members
            </span>
            <span className="inline-flex items-center rounded-full border border-[color:var(--primary)] bg-[color:var(--primary-soft)] px-3 py-1 text-[11px] font-medium text-[color:var(--primary)]">
              {city}
            </span>
          </div>

          {/* Blurred stand-in for the hotel name and price — no real data behind it */}
          <div className="pointer-events-none mx-auto mt-4 max-w-[320px] select-none space-y-3 blur-[5px]" aria-hidden>
            <div className="mx-auto h-6 w-3/4 rounded bg-[color:var(--line-ivory)]" />
            <div className="mx-auto flex items-baseline justify-center gap-2">
              <div className="h-9 w-24 rounded-full bg-[color:var(--primary)]" />
              <div className="h-4 w-16 rounded-full bg-[color:var(--line-ivory)]" />
            </div>
          </div>

          <div className="mx-auto mt-6 flex max-w-[340px] flex-col items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <h1 className="font-display text-[22px] font-bold leading-snug text-[color:var(--ink)]">
              Members-only deal
            </h1>
            <p className="text-[14px] leading-6 text-[color:var(--ink-soft)]">
              This {city} deal ({checkInWindow}) is locked on the free plan. Premium unlocks the full feed, filters, watchlists, and email alerts — free for 7 days.
            </p>
            <a href="/join" className="btn btn-conversion min-h-[44px] px-6">
              Unlock with Premium
            </a>
            <a href="/deals" className="text-[13px] font-medium text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]">
              See this week&apos;s free deals
            </a>
          </div>
        </section>
      </main>
    </div>
  )
}

/* Streams in after the static content: the market lookup and the 60-day
   history query never block the hero, title, price, or CompareRow. */
async function PriceHistorySection({ deal }: { deal: DealRow }) {
  const mktRes = await query<{ id: number }>(
    'SELECT id FROM tracked_markets WHERE city = $1 LIMIT 1',
    [deal.city]
  ).catch(() => ({ rows: [] as { id: number }[] }))
  const marketId = mktRes.rows[0]?.id

  const history = await getPriceHistory(deal.hotel_id, marketId).catch(() => [])

  if (history.length < 3) {
    return (
      <section className="mt-8">
        <h3 className="text-h3 text-[color:var(--ink)]">Price history unavailable</h3>
        <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">Not enough historical checks are available to draw a chart.</p>
        <TrustLine snapshotCount={deal.snapshot_count} />
      </section>
    )
  }

  return (
    <section className="mt-8">
      <h3 className="text-h3 text-[color:var(--ink)]">60-day price history</h3>
      <div className="mt-4">
        <PriceSparkline
          history={history}
          dealPriceCents={deal.deal_price_cents}
          medianPriceCents={deal.median_price_cents}
        />
      </div>
      <div className="mt-3">
        <TrustLine snapshotCount={deal.snapshot_count} />
      </div>
    </section>
  )
}

function PriceHistorySkeleton() {
  return (
    <section className="mt-8" role="status" aria-live="polite">
      <span className="sr-only">Loading price history</span>
      <div aria-hidden="true"><div className="skeleton h-6 w-44 rounded-[var(--radius-input)]" /><div className="skeleton mt-4 h-[80px] w-full rounded-[var(--radius-input)]" /><div className="skeleton mt-3 h-3 w-64 rounded-full" /></div>
    </section>
  )
}

async function DealScoreSection({ deal }: { deal: DealRow }) {
  const mktRes = await query<{ id: number }>(
    'SELECT id FROM tracked_markets WHERE city = $1 LIMIT 1',
    [deal.city]
  ).catch(() => ({ rows: [] as { id: number }[] }))
  const marketId = mktRes.rows[0]?.id

  const rawHistory = await getPriceHistory(deal.hotel_id, marketId).catch(() => [])
  const pricePoints = rawHistory.map((h) => ({ date: h.date, priceCents: h.price_cents, currency: 'USD' as const }))

  let score: DealScore | null = null
  if (pricePoints.length > 0) {
    const offer = {
      id: deal.id,
      name: deal.hotel_name,
      area: deal.city,
      stars: deal.stars ?? 0,
      pricePerNight: { priceCents: deal.deal_price_cents, currency: 'USD' as const },
      deeplink: '',
      source: 'expaify',
    }
    score = scoreDeal(offer, pricePoints)
  }

  return <DealScorePanel score={score} loading={false} scope="hotel" priceNoun="nightly rate" unavailableCopy="We could not compare this nightly rate with enough recent hotel prices." />
}

export default async function DealDetailPage({ params }: PageProps) {
  const { dealId } = await params

  const deal = await getDealById(dealId).catch(() => null)
  if (!deal) notFound()
  if (!deal.hotel_name?.trim()) return <PropertyUnavailable />

  // Server-side paywall: render the locked state instead of the deal for
  // free/anonymous visitors when this deal is outside the weekly unlock set.
  const pwCtx = await getPaywallContext()
  if (!pwCtx.premium) {
    const unlockedIds = await getFreeUnlockedDealIds()
    if (!unlockedIds.has(deal.id)) {
      return <LockedDealDetail city={deal.city} checkInWindow={deal.check_in_window} />
    }
  }

  const now = Date.now()
  const isExpired = deal.expires_at ? new Date(deal.expires_at).getTime() < now : false
  const updatedAtMs = deal.updated_at ? new Date(deal.updated_at).getTime() : NaN
  const updatedAgeHours = Number.isFinite(updatedAtMs) ? (now - updatedAtMs) / 3600000 : null
  const checkedAgo = timeAgo(deal.updated_at)
  const isAging = !isExpired && updatedAgeHours !== null && updatedAgeHours >= 30 && updatedAgeHours < 48
  const isStale = !isExpired && updatedAgeHours !== null && updatedAgeHours >= 48
  const validOtaLinks = Object.fromEntries(Object.entries(deal.ota_links ?? {}).filter(([, href]) => {
    try { return ['http:', 'https:'].includes(new URL(href).protocol) } catch { return false }
  }))
  const hasOtaLinks = Object.keys(validOtaLinks).length > 0
  const hasValidPrice = Number.isInteger(deal.deal_price_cents) && deal.deal_price_cents > 0

  // check-in / check-out derived
  const checkInDisplay = deal.check_in_date ? fmtShort(deal.check_in_date) : null
  const checkOutDisplay = deal.check_in_date && Number.isInteger(deal.nights) && deal.nights > 0 ? addNights(deal.check_in_date, deal.nights) : null

  return (
    <div className="min-h-screen bg-[color:var(--bg)]">

      <nav className="border-b border-[color:var(--line-ivory)] bg-[color:var(--bg)]">
        <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-5">
          <a href="/" className="flex items-center gap-0.5 font-display text-[20px] font-bold text-[color:var(--ink)] no-underline">
            expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" aria-hidden />
          </a>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-[1080px] px-4 py-5 sm:px-6 sm:py-8">
        <a href="/deals" className="inline-flex min-h-11 items-center text-sm font-medium text-[color:var(--text-2)] no-underline hover:text-[color:var(--text-1)]">← Back to saved deals</a>
        <div className="mt-4 space-y-4">
          <section aria-labelledby="property-stay-title" className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--brand)]">Saved hotel deal</p>
            <h1 id="property-stay-title" className="mt-2 break-words font-display text-2xl font-bold leading-tight text-[color:var(--text-1)] sm:text-3xl">{deal.hotel_name}</h1>
            <div className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5">
              <p className="text-caption font-bold uppercase tracking-wide text-[color:var(--text-3)]">Search area</p>
              <p className="mt-1 font-medium text-[color:var(--text-1)]">{deal.city || 'Confirm with provider'}</p>
              <p className="mt-1 text-xs leading-5 text-[color:var(--warning)]">Only the searched destination is available. Confirm the property location with the provider.</p>
            </div>
            {checkInDisplay || checkOutDisplay || deal.nights ? (
              <dl className="mt-3 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
                <Fact label="Check-in" value={checkInDisplay ?? 'Check-in not provided'} muted={!checkInDisplay} />
                <Fact label="Check-out" value={checkOutDisplay ?? 'Check-out not provided'} muted={!checkOutDisplay} />
                <Fact label="Nights" value={deal.nights > 0 ? `${deal.nights} night${deal.nights === 1 ? '' : 's'}` : 'Night count not provided'} muted={!deal.nights} />
              </dl>
            ) : <div className="mt-3 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5"><p className="font-medium text-[color:var(--text-1)]">Stay dates not provided</p></div>}
            <p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">{checkInDisplay && checkOutDisplay && deal.nights > 0 ? 'Rate shown for this stay context; the provider confirms room-level details.' : 'Stay dates are incomplete. Choose or confirm dates with the provider before comparing room options.'}</p>
          </section>

          <section aria-labelledby="price-score-title" className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6">
            <h2 id="price-score-title" className="text-xl font-bold text-[color:var(--text-1)]">Price and Deal Score</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4">
                <p className="text-caption font-bold uppercase tracking-wide text-[color:var(--text-3)]">Observed nightly rate</p>
                {hasValidPrice ? <p className="mt-2 font-display text-3xl font-bold tabular-nums text-[color:var(--text-1)] sm:text-4xl">{formatMoney({ priceCents: deal.deal_price_cents, currency: 'USD' })}</p> : <p className="mt-2 text-xl font-bold text-[color:var(--error)]">Price unavailable</p>}
                <p className="mt-1 text-xs text-[color:var(--text-2)]">per night before taxes and fees</p>
                <p className="mt-2 text-sm text-[color:var(--text-2)]">Rate observed from a booking partner</p>
                <p className={`mt-1 text-sm leading-6 ${isExpired ? 'font-medium text-[color:var(--error)]' : isAging || isStale || !checkedAgo ? 'font-medium text-[color:var(--warning)]' : 'text-[color:var(--text-2)]'}`}>
                  {isExpired && deal.expires_at ? `This saved rate expired ${fmtDate(deal.expires_at)}. It is shown for reference only.` : isStale ? `Price may be out of date. We have not rechecked it since ${fmtCheckedDate(deal.updated_at)}.` : checkedAgo ? `Price checked ${checkedAgo}.${isAging ? ' Confirm the current rate with the provider.' : ''}` : 'Last-checked time not provided.'}
                </p>
              </div>
              <Suspense fallback={<div role="status" aria-live="polite" className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4">Checking recent price history</div>}>
                <DealScoreSection deal={deal} />
              </Suspense>
            </div>
          </section>

          <section aria-labelledby="hotel-fit-title" className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6">
            <h2 id="hotel-fit-title" className="text-xl font-bold text-[color:var(--text-1)]">Hotel fit</h2>
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5"><dt className="text-caption font-bold uppercase tracking-wide text-[color:var(--text-3)]">Hotel class</dt><dd className="mt-2 text-sm text-[color:var(--text-2)]">Hotel class not provided</dd></div>
              <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5"><dt className="text-caption font-bold uppercase tracking-wide text-[color:var(--text-3)]">Guest rating</dt><dd className="mt-2 text-sm text-[color:var(--text-2)]">Guest rating not provided<span className="mt-1 block text-xs text-[color:var(--text-3)]">This provider did not return guest-rating evidence.</span></dd></div>
            </dl>
          </section>

          <section aria-labelledby="room-check-title" className="rounded-[var(--radius-card)] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] p-4 sm:p-6">
            <h2 id="room-check-title" className="text-xl font-bold text-[color:var(--text-1)]">Check rooms with provider</h2>
        {isExpired ? (
          <div className="mt-3" role="status"><p className="font-bold text-[color:var(--error)]">Saved rate expired</p><p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">This observed nightly rate is no longer current. Search again before inspecting room options.</p><a href="/deals" className="btn btn-primary mt-4 block min-h-11 w-full text-center">
              Search current deals
            </a></div>
        ) : hasValidPrice && hasOtaLinks ? (
          <div className="mt-3"><p className="text-sm leading-6 text-[color:var(--text-2)]">The provider confirms room details, live availability, final total, taxes and fees, cancellation policy, and terms. Confirm the property location there before choosing a room.</p><div className="mt-4"><CompareRow links={validOtaLinks} size="primary" hotelName={deal.hotel_name} /></div><p className="mt-3 text-xs leading-5 text-[color:var(--text-3)]">Opens the provider in a new tab. Your expaify page stays open.</p></div>
        ) : (
          <div className="mt-3" role="status"><p className="font-bold text-[color:var(--text-1)]">{hasValidPrice ? 'Provider link unavailable' : 'Room check unavailable'}</p><p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">{hasValidPrice ? 'You can review this hotel here, but expaify does not have a valid provider link for room inspection.' : 'A trustworthy nightly rate is required before expaify can send this hotel selection to a provider.'}</p><a href="/deals" className="mt-3 inline-flex min-h-11 items-center font-medium text-[color:var(--brand)]">Search current deals</a></div>
        )}
          </section>

          <section aria-labelledby="supporting-title" className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6">
            <h2 id="supporting-title" className="text-xl font-bold text-[color:var(--text-1)]">Supporting evidence</h2>
            {deal.photo_url ? <img src={deal.photo_url} alt="" className="mt-4 h-44 w-full rounded-[var(--radius-card)] object-cover sm:h-64" decoding="async" /> : null}
            <Suspense fallback={<PriceHistorySkeleton />}><PriceHistorySection deal={deal} /></Suspense>
            <details className="mt-6 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5"><summary className="min-h-11 cursor-pointer font-medium text-[color:var(--text-1)]">Show offer details</summary><p className="mt-3 text-caption font-bold uppercase tracking-wide text-[color:var(--text-3)]">Offer reference</p><p className="mt-1 break-all font-mono text-xs text-[color:var(--text-2)]">{deal.id}</p><p className="mt-2 text-xs text-[color:var(--text-3)]">Use this reference if you contact expaify support.</p></details>
            <div className="mt-4"><ShareButton /></div>
          </section>
        </div>
      </main>
    </div>
  )
}
