import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getDealById, getPriceHistory, type DealRow } from '@/lib/pipeline/dealDetection'
import { getFreeUnlockedDealIds, getPaywallContext } from '@/lib/paywall'
import { query } from '@/lib/db/client'
import { formatMoney } from '@/lib/money'
import { DealChip } from '@/app/components/ui/DealChip'
import { TrustLine } from '@/app/components/ui/TrustLine'
import { PriceSparkline } from '@/app/components/ui/PriceSparkline'
import { PriceBlock } from '@/app/components/ui/PriceBlock'
import { StarRow } from '@/app/components/ui/StarRow'
import { ShareButton } from '@/app/components/ui/ShareButton'
import { TrackOnMount } from '@/app/components/TrackOnMount'
import DealScorePanel from '@/app/components/DealScorePanel'
import { PropertyPhoto } from '@/app/components/ui/PropertyPhoto'
import {
  NO_QUIET_STAY_EVIDENCE,
  QuietStayEvidenceLedger,
} from '@/app/components/ui/QuietStayEvidenceLedger'
import { scoreDeal } from '@/lib/scoring/scoreDeal'
import type { DealScore } from '@/lib/types'
import { timeAgo } from '@/lib/timeAgo'
import { HotelContinuityPrototype } from '@/app/components/research/HotelContinuityPrototype'
import { createContinuityFixture, parseContinuityFixture } from '@/app/components/research/hotelContinuityFixtures'
import { HotelDealCriteriaHandoff, HotelDealCriteriaSummary } from '@/app/components/HotelDealCriteria'
import {
  buildHotelBackUrl,
  hotelCriteriaContextStatus,
  resolveHotelResultsView,
  resolveHotelSearchCriteria,
  type HotelCriteriaContextStatus,
  type HotelSearchCriteriaV1,
} from '@/lib/hotels/searchCriteria'

type PageProps = {
  params: Promise<{ dealId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

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

function LockedDealDetail({ city, checkInDate, checkInWindow, criteriaContext }: {
  city: string
  checkInDate: string | null
  checkInWindow: string
  criteriaContext: {
    criteria?: HotelSearchCriteriaV1
    status: HotelCriteriaContextStatus
    backHref: string
  }
}) {
  return (
    <div className="min-h-screen bg-[color:var(--bg)]">
      <nav className="border-b border-[color:var(--line-ivory)] bg-[color:var(--bg)]">
        <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-5">
          <a href="/" className="flex items-center gap-0.5 font-display text-[20px] font-bold text-[color:var(--ink)] no-underline">
            expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" aria-hidden />
          </a>
          <a
            href={criteriaContext.backHref}
            aria-label={criteriaContext.criteria ? 'Back to hotel results for this search' : 'Search hotel deals'}
            className="text-[14px] font-medium text-[color:var(--ink-soft)] no-underline hover:text-[color:var(--ink)]"
          >
            ← {criteriaContext.criteria ? 'Back to results' : 'Search hotel deals'}
          </a>
        </div>
      </nav>

      <main className="mx-auto max-w-[560px] px-5 py-14">
        <div className="mb-6 text-left">
          <HotelDealCriteriaSummary
            context={criteriaContext}
            deal={{ city, checkInDate }}
          />
        </div>
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
    <section className="mt-8" aria-hidden>
      <div className="skeleton h-6 w-44 rounded-[var(--radius-input)]" />
      <div className="skeleton mt-4 h-[80px] w-full rounded-[var(--radius-input)]" />
      <div className="skeleton mt-3 h-3 w-64 rounded-full" />
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

  return (
    <section className="mt-8">
      <DealScorePanel
        score={score}
        loading={false}
        scope="hotel"
        priceNoun="nightly rate"
        unavailableCopy="Not enough price history to score this deal yet."
      />
    </section>
  )
}

export default async function DealDetailPage({ params, searchParams }: PageProps) {
  const { dealId } = await params
  const researchParams = await searchParams

  const deal = await getDealById(dealId).catch(() => null)
  if (!deal) notFound()

  const criteriaResolution = resolveHotelSearchCriteria(researchParams)
  const resultsView = resolveHotelResultsView(researchParams)
  const criteria = criteriaResolution.status === 'valid' && resultsView ? criteriaResolution.criteria : undefined
  const contextStatus: HotelCriteriaContextStatus = criteria
    ? hotelCriteriaContextStatus(criteria, { city: deal.city, checkInDate: deal.check_in_date })
    : criteriaResolution.status === 'invalid' || !resultsView ? 'invalid' : 'missing'
  const backHref = criteria && resultsView ? buildHotelBackUrl(criteria, resultsView, researchParams) : '/deals'
  const criteriaContext = { criteria, status: contextStatus, backHref }

  // Server-side paywall: render the locked state instead of the deal for
  // free/anonymous visitors when this deal is outside the weekly unlock set.
  const pwCtx = await getPaywallContext()
  if (!pwCtx.premium) {
    const unlockedIds = await getFreeUnlockedDealIds()
    if (!unlockedIds.has(deal.id)) {
      return <LockedDealDetail city={deal.city} checkInDate={deal.check_in_date} checkInWindow={deal.check_in_window} criteriaContext={criteriaContext} />
    }
  }

  const savings = deal.median_price_cents - deal.deal_price_cents
  const showSavings = savings >= 2000

  const now = Date.now()
  const isExpired = deal.expires_at ? new Date(deal.expires_at).getTime() < now : false
  const updatedAtMs = deal.updated_at ? new Date(deal.updated_at).getTime() : NaN
  const updatedAgeHours = Number.isFinite(updatedAtMs) ? (now - updatedAtMs) / 3600000 : null
  const checkedAgo = timeAgo(deal.updated_at)
  const isAging = !isExpired && updatedAgeHours !== null && updatedAgeHours >= 30 && updatedAgeHours < 48
  const isStale = !isExpired && updatedAgeHours !== null && updatedAgeHours >= 48
  const foundAgo = timeAgo(deal.first_seen)

  // check-in / check-out derived
  const checkInDisplay = deal.check_in_date ? fmtShort(deal.check_in_date) : null
  const checkOutDisplay = deal.check_in_date ? addNights(deal.check_in_date, deal.nights ?? 1) : null
  const continuityFixtureId = parseContinuityFixture(researchParams.continuityFixture)
  const checkInMs = deal.check_in_date ? Date.parse(deal.check_in_date) : NaN
  const checkOutIso = Number.isFinite(checkInMs)
    ? new Date(checkInMs + (deal.nights ?? 1) * 86400000).toISOString()
    : null
  const continuityDisclosure = continuityFixtureId === 'control'
    ? null
    : createContinuityFixture(continuityFixtureId, deal.check_in_date, checkOutIso, now)
  const disclosureParam = Array.isArray(researchParams.continuityDisclosure)
    ? researchParams.continuityDisclosure[0]
    : researchParams.continuityDisclosure
  return (
    <div className="min-h-screen bg-[color:var(--bg)]">

      {/* Nav */}
      <nav className="border-b border-[color:var(--line-ivory)] bg-[color:var(--bg)]">
        <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-5">
          <a href="/" className="flex items-center gap-0.5 font-display text-[20px] font-bold text-[color:var(--ink)] no-underline">
            expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" aria-hidden />
          </a>
          <a href={backHref} aria-label={criteria ? 'Back to hotel results for this search' : 'Search hotel deals'} className="flex min-h-[44px] items-center text-caption font-medium text-[color:var(--ink-soft)] no-underline hover:text-[color:var(--ink)]">
            ← {criteria ? 'Back to results' : 'Search hotel deals'}
          </a>
        </div>
      </nav>

      <main className="mx-auto max-w-[760px] px-5 py-8">

        {/* Stale deal banner */}
        {isStale && (
          <div className="mb-4 rounded-[var(--radius-card)] border border-[color:var(--gold)] bg-[color:var(--surface)] px-4 py-3" role="status">
            <TrackOnMount event="deal_stale_banner_viewed" props={{ dealId: deal.id }} />
            <p className="text-[13px] font-bold text-[color:var(--ink)]">Price may be out of date</p>
            <p className="mt-0.5 text-[12px] leading-5 text-[color:var(--ink-soft)]">
              We haven&apos;t been able to re-verify this price since {fmtCheckedDate(deal.updated_at)}. Check the provider for the current price and availability.
            </p>
          </div>
        )}

        {/* Title block */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-h2 text-[color:var(--ink)]">{deal.hotel_name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption font-medium text-[color:var(--ink-soft)]">
              <StarRow stars={deal.stars ?? 0} />
              <span aria-hidden>·</span>
              <span>{deal.city}</span>
              <span aria-hidden>·</span>
              <span>{deal.check_in_window}</span>
              {foundAgo ? (
                <>
                  <span aria-hidden>·</span>
                  <span>Deal found {foundAgo}</span>
                </>
              ) : null}
              {isExpired && deal.expires_at && (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-[color:var(--error)]">Expired {fmtDate(deal.expires_at)}</span>
                </>
              )}
            </div>
          </div>
          <ShareButton />
        </div>

        {/* Price */}
        <section className="mt-6">
          <PriceBlock
            size="display"
            dealPrice={{ priceCents: deal.deal_price_cents, currency: 'USD' }}
            medianPrice={{ priceCents: deal.median_price_cents, currency: 'USD' }}
          />
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
            <DealChip discountPct={deal.discount_pct} />
          </div>
          {showSavings && (
            <p className="mt-2 text-[13px] font-medium text-[color:var(--primary)]">
              Save {formatMoney({ priceCents: savings, currency: 'USD' })}/night vs the usual price
            </p>
          )}
          {checkedAgo ? (
            <p className={`mt-2 text-caption leading-5 ${isAging ? 'font-semibold text-[color:var(--gold-text)]' : 'font-medium text-[color:var(--ink-soft)]'}`}>
              Price checked {checkedAgo}{isAging ? ' — verify with the provider' : ''}
            </p>
          ) : null}
          <p className="mt-2 text-caption font-medium leading-5 text-[color:var(--ink-soft)]">
            Nightly rate before taxes and fees. Taxes, fees, cancellation policy, and final total are confirmed by the provider.
          </p>
        </section>

        <div className="mt-8">
          <HotelDealCriteriaSummary context={criteriaContext} deal={{ city: deal.city, checkInDate: deal.check_in_date }} />
        </div>

        <section className="card mt-4 p-5">
          <h3 className="mb-3 text-[13px] font-bold text-[color:var(--ink)]">This deal</h3>
          <div className="grid grid-cols-2 gap-3 min-[680px]:grid-cols-4">
            <Fact label="Hotel" value={deal.hotel_name || 'Hotel name unavailable'} muted={!deal.hotel_name} />
            <Fact label="Area" value={deal.city || 'Area unavailable'} muted={!deal.city} />
            <Fact label="Check-in" value={checkInDisplay ?? 'Check-in unavailable'} muted={!checkInDisplay} />
            <Fact label="Check-out" value={checkOutDisplay ?? 'Check-out unavailable'} muted={!checkOutDisplay} />
            <Fact label="Nights" value={deal.nights != null ? String(deal.nights) : 'Nights unavailable'} muted={deal.nights == null} />
            <Fact label="Guests" value="Guest count unavailable" muted />
            <Fact label="Room or rate" value="Room or rate unavailable" muted />
            <Fact label="Price basis" value="Provider confirms final price and availability." />
          </div>
        </section>

        <TrackOnMount event="hotel_detail_viewed" props={{ deal_id: deal.id, context_status: contextStatus, ...(criteria ? { criteria_version: criteria.criteriaVersion } : {}) }} />

        {/* Deal score — computed from price history */}
        <Suspense fallback={null}>
          <DealScoreSection deal={deal} />
        </Suspense>

        <QuietStayEvidenceLedger evidence={NO_QUIET_STAY_EVIDENCE} />

        <div className="mt-8">
          <PropertyPhoto src={deal.photo_url} size="detail" loading="eager" />
        </div>

        {/* Primary action zone */}
        {isExpired ? (
          <div className="my-8 rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-4" role="status">
            <p className="text-[13px] font-bold text-[color:var(--ink)]">Deal expired</p>
            <p className="mt-1 text-[12px] leading-5 text-[color:var(--ink-soft)]">
              This saved deal may no longer be available at the shown price. Search again to find current options.
            </p>
            <a href={backHref} className="btn btn-primary mt-3 block w-full text-center">
              Search current deals
            </a>
          </div>
        ) : (
          <HotelDealCriteriaHandoff context={criteriaContext} deal={{ id: deal.id, city: deal.city, checkInDate: deal.check_in_date }} links={deal.ota_links ?? {}} />
        )}

        <HotelContinuityPrototype
          dealId={deal.id}
          hotelName={deal.hotel_name}
          fixtureId={continuityFixtureId}
          disclosure={continuityDisclosure}
          initiallyExpanded={disclosureParam === 'expanded'}
        />

        {/* Price history — streams in after the content above renders */}
        <Suspense fallback={<PriceHistorySkeleton />}>
          <PriceHistorySection deal={deal} />
        </Suspense>

        {/* Why this is a deal */}
        <section className="card mt-8 p-5">
          <h3 className="text-h3 text-[color:var(--ink)]">Why this is a deal</h3>
          <dl className="mt-4 space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[13px] text-[color:var(--ink-soft)]">Usual nightly rate</dt>
              <dd className="text-[15px] font-medium text-[color:var(--ink)]">
                {formatMoney({ priceCents: deal.median_price_cents, currency: 'USD' })}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[13px] text-[color:var(--ink-soft)]">Today&rsquo;s rate</dt>
              <dd className="font-display text-[18px] font-bold text-[color:var(--primary)]">
                {formatMoney({ priceCents: deal.deal_price_cents, currency: 'USD' })}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[13px] text-[color:var(--ink-soft)]">Price checks</dt>
              <dd className="text-[15px] font-medium text-[color:var(--ink)]">
                {deal.snapshot_count} snapshots over 60 days
              </dd>
            </div>
          </dl>
          {!isExpired && deal.expires_at ? (
            <p className="mt-4 border-t border-[color:var(--line-ivory)] pt-3 text-caption text-[color:var(--ink-faint)]">
              Expires {fmtDate(deal.expires_at)}
            </p>
          ) : null}
        </section>

      </main>
    </div>
  )
}
