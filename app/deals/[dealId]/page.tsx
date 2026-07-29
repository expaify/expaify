import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getDealById, getPriceHistory, type DealRow } from '@/lib/pipeline/dealDetection'
import { getFreeUnlockedDealIds, getPaywallContext } from '@/lib/paywall'
import { query } from '@/lib/db/client'
import { formatMoney } from '@/lib/money'
import { TrustLine } from '@/app/components/ui/TrustLine'
import { PriceSparkline } from '@/app/components/ui/PriceSparkline'
import { ShareButton } from '@/app/components/ui/ShareButton'
import {
  HotelDecisionAnalytics,
  type HotelDecisionPriceFreshnessState,
  type HotelDecisionScoreState,
} from '@/app/components/HotelDecisionAnalytics'
import { WatchCityPill } from '@/app/components/ui/WatchCityPill'
import { getSubscription } from '@/lib/subscription'
import { TRACKED_MARKET_NAMES } from '@/lib/trackedMarkets'
import DealScorePanel from '@/app/components/DealScorePanel'
import { PropertyPhoto } from '@/app/components/ui/PropertyPhoto'
import { notProvidedHotelDocumentReadiness } from '@/lib/providers/hotelDocumentReadiness'
import {
  NO_QUIET_STAY_EVIDENCE,
  QuietStayEvidenceLedger,
} from '@/app/components/ui/QuietStayEvidenceLedger'
import { scoreDeal } from '@/lib/scoring/scoreDeal'
import type { DealScore, HotelOffer } from '@/lib/types'
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
            aria-label={criteriaContext.criteria ? 'Back to hotel results for this search' : 'Back to saved deals'}
            className="text-[14px] font-medium text-[color:var(--ink-soft)] no-underline hover:text-[color:var(--ink)]"
          >
            ← {criteriaContext.criteria ? 'Back to results' : 'Back to saved deals'}
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
      <section>
        <h3 className="text-h3 text-[color:var(--ink)]">Price history</h3>
        <p className="mt-2 text-sm text-[color:var(--text-2)]">Not enough historical checks are available to draw a chart.</p>
        <div className="mt-3">
        <TrustLine snapshotCount={deal.snapshot_count} />
        </div>
      </section>
    )
  }

  return (
    <section>
      <h3 className="text-h3 text-[color:var(--ink)]">Price history</h3>
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
    <section aria-hidden>
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
    const offer: HotelOffer = {
      id: deal.id,
      name: deal.hotel_name,
      area: deal.city,
      stars: deal.stars ?? 0,
      pricePerNight: { priceCents: deal.deal_price_cents, currency: 'USD' as const },
      deeplink: '',
      source: 'expaify',
      documentReadiness: notProvidedHotelDocumentReadiness('Hotel provider'),
      fundsPolicy: { state: 'not_returned', obligations: [], sourceLabel: 'expaify', scope: 'not_returned' },
    }
    score = scoreDeal(offer, pricePoints)
  }

  return (
    <div>
      <DealScorePanel
        score={score}
        loading={false}
        scope="hotel"
        priceNoun="nightly rate"
        unavailableCopy="We could not compare this nightly rate with enough recent hotel prices."
      />
    </div>
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

  // Watch pill: premium sessions only, and only for tracked markets (defensive).
  const sub = pwCtx.premium && pwCtx.userId
    ? await getSubscription(pwCtx.userId).catch(() => null)
    : null
  const showWatchPill = !!sub && TRACKED_MARKET_NAMES.includes(deal.city)

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
  const checkOutDisplay = deal.check_in_date && deal.nights != null ? addNights(deal.check_in_date, deal.nights) : null
  const datesIncomplete = !checkInDisplay || !checkOutDisplay || deal.nights == null || deal.nights <= 0
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

  const priceFreshnessState: HotelDecisionPriceFreshnessState = isExpired
    ? 'expired'
    : isStale
      ? 'stale'
      : isAging
        ? 'aging'
        : checkedAgo
          ? 'fresh'
          : 'unknown'
  const scoreState: HotelDecisionScoreState = deal.snapshot_count <= 0
    ? 'unavailable'
    : deal.snapshot_count < 10
      ? 'low_confidence'
      : 'confident'

  return (
    <div className="min-h-screen bg-[color:var(--bg)]">
      <nav className="border-b border-[color:var(--line-ivory)] bg-[color:var(--bg)]">
        <div className="mx-auto flex h-16 max-w-[1140px] items-center px-5">
          <a href="/" className="flex items-center gap-0.5 font-display text-[20px] font-bold text-[color:var(--ink)] no-underline">
            expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" aria-hidden />
          </a>
          <div className="flex items-center gap-4">
            <a href="/deals" className="flex min-h-[44px] items-center text-caption font-medium text-[color:var(--ink-soft)] no-underline hover:text-[color:var(--ink)]">
              ← Back to deals
            </a>
            <a
              href="/account#alerts"
              aria-label="Your account"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[color:var(--ink-soft)] no-underline hover:text-[color:var(--ink)]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
              </svg>
            </a>
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-[1080px] px-4 py-5 sm:px-6 sm:py-8">
        <a
          href={backHref}
          aria-label={criteria ? 'Back to hotel results for this search' : 'Back to saved deals'}
          data-hotel-back
          className="inline-flex min-h-11 items-center text-sm font-medium text-[color:var(--text-2)] no-underline hover:text-[color:var(--text-1)] focus-visible:rounded-[var(--radius-control)]"
        >
          ← {criteria ? 'Back to results' : 'Back to saved deals'}
        </a>

        <div className="mt-4 space-y-4">
          <section aria-labelledby="saved-hotel-title" data-hotel-decision-section="property_stay" data-hotel-decision-position="1" className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6">
            <p className="text-caption font-bold uppercase tracking-wide text-[color:var(--brand)]">Saved hotel deal</p>
            <h1 id="saved-hotel-title" className="mt-2 break-words font-display text-2xl font-bold leading-tight text-[color:var(--text-1)] sm:text-3xl">{deal.hotel_name}</h1>
            <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-2)]">Area: {deal.city}</p>
            <p className="mt-1 text-xs leading-5 text-[color:var(--text-3)]">Provider supplied an area, not a street address.</p>
            <dl className="mt-5 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
              <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5">
                <dt className="text-caption font-bold uppercase tracking-wide text-[color:var(--text-3)]">Check-in</dt>
                <dd className="mt-1 text-sm font-medium text-[color:var(--text-1)]">{checkInDisplay ?? 'Check-in not provided'}</dd>
              </div>
              <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5">
                <dt className="text-caption font-bold uppercase tracking-wide text-[color:var(--text-3)]">Check-out</dt>
                <dd className="mt-1 text-sm font-medium text-[color:var(--text-1)]">{checkOutDisplay ?? 'Check-out not provided'}</dd>
              </div>
              <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5">
                <dt className="text-caption font-bold uppercase tracking-wide text-[color:var(--text-3)]">Nights</dt>
                <dd className="mt-1 text-sm font-medium text-[color:var(--text-1)]">{deal.nights != null ? `${deal.nights} ${deal.nights === 1 ? 'night' : 'nights'}` : 'Night count not provided'}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm leading-6 text-[color:var(--text-2)]">
              {checkInDisplay && checkOutDisplay && deal.nights != null
                ? 'Rate shown for this stay context; the provider confirms room-level details.'
                : 'Stay dates are incomplete. Choose or confirm dates with the provider before comparing room options.'}
            </p>
          </section>

          <section aria-labelledby="saved-price-score-title" data-hotel-decision-section="price_deal_score" data-hotel-decision-position="2" className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6">
            <h2 id="saved-price-score-title" className="text-xl font-bold text-[color:var(--text-1)] sm:text-2xl">Price and Deal Score</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4">
                <p className="text-caption font-bold uppercase tracking-wide text-[color:var(--text-3)]">Observed nightly rate</p>
                <p className="mt-2 break-words font-display text-3xl font-bold tabular-nums text-[color:var(--text-1)] sm:text-4xl">{formatMoney({ priceCents: deal.deal_price_cents, currency: 'USD' })}</p>
                <p className="mt-1 text-sm text-[color:var(--text-2)]">per night before taxes and fees</p>
                <p className="mt-2 text-xs text-[color:var(--text-2)]">Rate observed from a booking partner.</p>
                {isExpired && deal.expires_at ? (
                  <p className="mt-3 text-sm font-medium text-[color:var(--error-text)]">This saved rate expired {fmtDate(deal.expires_at)}. It is shown for reference only.</p>
                ) : isStale ? (
                  <p className="mt-3 text-sm font-medium text-[color:var(--warning)]">Price may be out of date. We have not rechecked it since {fmtCheckedDate(deal.updated_at)}.</p>
                ) : isAging && checkedAgo ? (
                  <p className="mt-3 text-sm font-medium text-[color:var(--warning)]">Price checked {checkedAgo}. Confirm the current rate with the provider.</p>
                ) : checkedAgo ? (
                  <p className="mt-3 text-sm text-[color:var(--text-2)]">Price checked {checkedAgo}.</p>
                ) : (
                  <p className="mt-3 text-sm font-medium text-[color:var(--warning)]">Last-checked time not provided.</p>
                )}
              </div>
              <Suspense fallback={<DealScorePanel score={null} loading scope="hotel" priceNoun="nightly rate" unavailableCopy="We could not compare this nightly rate with enough recent hotel prices." />}>
                <DealScoreSection deal={deal} />
              </Suspense>
            </div>
          </section>

          <section aria-labelledby="saved-hotel-fit-title" data-hotel-decision-section="hotel_fit" data-hotel-decision-position="3" className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6">
            <h2 id="saved-hotel-fit-title" className="text-xl font-bold text-[color:var(--text-1)] sm:text-2xl">Hotel fit</h2>
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5">
                <dt className="text-caption font-bold uppercase tracking-wide text-[color:var(--text-3)]">Hotel class</dt>
                <dd className="mt-1 text-sm font-medium text-[color:var(--text-1)]">{deal.stars != null ? `${deal.stars}-star hotel class from a booking partner` : 'Hotel class not provided'}</dd>
              </div>
              <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5">
                <dt className="text-caption font-bold uppercase tracking-wide text-[color:var(--text-3)]">Guest rating</dt>
                <dd className="mt-1 text-sm font-medium text-[color:var(--text-1)]">Guest rating not provided</dd>
                <p className="mt-2 text-xs leading-5 text-[color:var(--text-2)]">This provider did not return guest-rating evidence.</p>
              </div>
            </dl>
          </section>

          <section aria-labelledby="saved-provider-title" data-hotel-decision-section="provider_handoff" data-hotel-decision-position="4" className="rounded-[var(--radius-card)] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] p-4 sm:p-6">
            <h2 id="saved-provider-title" className="text-xl font-bold text-[color:var(--text-1)] sm:text-2xl">Check rooms with provider</h2>
            {isExpired ? (
              <div className="mt-4" role="status">
                <p className="text-sm font-bold text-[color:var(--text-1)]">Saved rate expired</p>
                <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">This observed nightly rate is no longer current. Search again before inspecting room options.</p>
                <a href="/deals" className="btn btn-primary mt-4 inline-flex min-h-11 w-full items-center justify-center text-center">Search current deals</a>
              </div>
            ) : (
              <HotelDealCriteriaHandoff context={criteriaContext} deal={{ id: deal.id, city: deal.city, checkInDate: deal.check_in_date }} links={deal.ota_links ?? {}} hotelName={deal.hotel_name} datesIncomplete={datesIncomplete} />
            )}
          </section>

          <section aria-labelledby="saved-supporting-title" data-hotel-decision-section="supporting_evidence" data-hotel-decision-position="5" className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6">
            <h2 id="saved-supporting-title" className="text-xl font-bold text-[color:var(--text-1)] sm:text-2xl">Supporting evidence</h2>
            <div className="mt-5 space-y-6">
              {deal.photo_url ? <PropertyPhoto src={deal.photo_url} size="detail" loading="lazy" /> : null}
              <HotelDealCriteriaSummary context={criteriaContext} deal={{ city: deal.city, checkInDate: deal.check_in_date }} />
              <QuietStayEvidenceLedger evidence={NO_QUIET_STAY_EVIDENCE} />
              <HotelContinuityPrototype dealId={deal.id} hotelName={deal.hotel_name} fixtureId={continuityFixtureId} disclosure={continuityDisclosure} initiallyExpanded={disclosureParam === 'expanded'} />
              <Suspense fallback={<PriceHistorySkeleton />}>
                <PriceHistorySection deal={deal} />
              </Suspense>
              <details className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-2">
                <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-[color:var(--brand)]">Show offer details</summary>
                <dl className="border-t border-[color:var(--border)] py-3">
                  <dt className="text-caption font-bold uppercase tracking-wide text-[color:var(--text-3)]">Offer reference</dt>
                  <dd className="mt-2 break-all font-mono text-xs text-[color:var(--text-2)]">{deal.id}</dd>
                </dl>
                <p className="pb-3 text-xs text-[color:var(--text-3)]">Use this reference if you contact expaify support.</p>
              </details>
              <div className="flex flex-wrap items-center gap-3">
                <ShareButton />
                {showWatchPill && sub ? <WatchCityPill city={deal.city} initialWatching={sub.watchlist.includes(deal.city)} initialCount={sub.watchlist.length} /> : null}
              </div>
              {foundAgo ? <p className="text-xs text-[color:var(--text-3)]">Deal found {foundAgo}.</p> : null}
            </div>
          </section>
        </div>
        <HotelDecisionAnalytics
          hotelId={deal.id}
          entrySource="saved"
          hasDates={!datesIncomplete}
          hasVerifiedGuestRating={false}
          scoreState={scoreState}
          priceFreshnessState={priceFreshnessState}
          viewedProps={{ deal_id: deal.id, context_status: contextStatus, ...(criteria ? { criteria_version: criteria.criteriaVersion } : {}) }}
        />
      </main>
    </div>
  )
}
