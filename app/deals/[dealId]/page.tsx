import type { Metadata } from 'next'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getDealById, getPriceHistory, type DealRow } from '@/lib/pipeline/dealDetection'
import { getFreeUnlockedDealIds, getPaywallContext } from '@/lib/paywall'
import { query } from '@/lib/db/client'
import { formatMoney } from '@/lib/money'
import { TrustLine } from '@/app/components/ui/TrustLine'
import { Icon } from '@/app/components/ui/icons/Icon'
import { PriceSparkline } from '@/app/components/ui/PriceSparkline'
import { ShareButton } from '@/app/components/ui/ShareButton'
import {
  HotelDecisionAnalytics,
  type HotelDecisionPriceFreshnessState,
  type HotelDecisionScoreState,
} from '@/app/components/HotelDecisionAnalytics'
import { WatchCityPill } from '@/app/components/ui/WatchCityPill'
import { getSubscription } from '@/lib/subscription'
import { TRACKED_MARKET_NAMES, TRACKED_MARKETS } from '@/lib/trackedMarkets'
import { FlightsToThisDeal } from '@/app/components/FlightsToThisDeal'
import DealScorePanel from '@/app/components/DealScorePanel'
import { PropertyPhoto } from '@/app/components/ui/PropertyPhoto'
import { Reveal } from '@/app/components/ui/Reveal'
import { AiDayPlanSection } from '@/app/components/AiDayPlanSection'
import { LocationQualitySection } from '@/app/components/LocationQualitySection'
import { AiDayPlanCardSkeleton } from '@/app/components/ui/AiDayPlanCard'
import HotelCancellationChoicesUnavailable from '@/app/components/HotelCancellationChoicesUnavailable'
import GuestReviewEvidence from '@/app/components/GuestReviewEvidence'
import {
  NO_QUIET_STAY_EVIDENCE,
  QuietStayEvidenceLedger,
} from '@/app/components/ui/QuietStayEvidenceLedger'
import {
  HotelDisruptionEvidenceLedger,
  NO_HOTEL_DISRUPTION_EVIDENCE,
} from '@/app/components/ui/HotelDisruptionNotice'
import { HotelEvChargingSection, PRODUCTION_EV_CHARGING_UNKNOWN } from '@/app/components/HotelEvCharging'
import type { DealScore } from '@/lib/types'
import { timeAgo } from '@/lib/timeAgo'
import { HotelContinuityPrototype } from '@/app/components/research/HotelContinuityPrototype'
import { createContinuityFixture, parseContinuityFixture } from '@/app/components/research/hotelContinuityFixtures'
import { WifiEvidenceLedger } from '@/app/components/research/WifiEvidenceLedger'
import {
  createWifiFixture,
  isWifiResearchPrototypeEnabled,
  parseWifiFixture,
} from '@/app/components/research/hotelWifiFixtures'
import { HotelDealCriteriaHandoff, HotelDealCriteriaSummary } from '@/app/components/HotelDealCriteria'
import {
  buildHotelBackUrl,
  hotelCriteriaContextStatus,
  resolveHotelResultsView,
  resolveHotelSearchCriteria,
  type HotelCriteriaContextStatus,
  type HotelSearchCriteriaV1,
} from '@/lib/hotels/searchCriteria'
import {
  createHotelDisruptionFixture,
  parseHotelDisruptionFixture,
} from '@/app/components/research/hotelDisruptionFixtures'
import { HotelSustainabilityCredentialEvidence } from '@/app/components/HotelSustainabilityCredentialEvidence'
import { createHotelPoolFixture, parseHotelPoolFixture } from '@/app/components/research/hotelPoolFixtures'
import { HotelPoolEvidenceLedger } from '@/app/components/ui/HotelPoolEvidenceLedger'
import {
  AccessibilityFitLedger,
  AccessibilityHandoffBoundary,
  createAccessibilityPresentation,
} from '@/app/components/ui/HotelAccessibilityFit'
import { HotelClimateEvidenceLedger } from '@/app/components/HotelClimateEvidence'
import { createUnsupportedHotelClimateEvidence } from '@/lib/hotels/climateEvidence'
import { CITY_DISPLAY_TO_SLUG } from '@/lib/cities'
import { DealDetailProviderHandoff } from '@/app/components/DealDetailProviderHandoff'
import type { HotelReviewEvidence } from '@/lib/types'

type PageProps = {
  params: Promise<{ dealId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { dealId } = await params
  const deal = await getDealById(dealId)
  if (!deal) notFound()

  const title = `${deal.hotel_name} in ${deal.city} — expaify`
  const description = `${deal.discount_pct}% below its usual price for ${deal.check_in_window} in ${deal.city}.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://expaify.com/deals/${dealId}`,
    },
    alternates: { canonical: `https://expaify.com/deals/${dealId}` },
  }
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

function singleRateProvider(links: Record<string, string>): string | null {
  const providers = [
    links.expedia ? 'Expedia' : null,
    links.booking ? 'Booking.com' : null,
    links.kiwi ? 'Kiwi' : null,
    links.trip ? 'Trip.com' : null,
  ].filter((provider): provider is string => provider !== null)

  return providers.length === 1 ? providers[0] : null
}

function comparisonBasisCopy(links: Record<string, string>): string {
  return `USD figure from ${singleRateProvider(links) ?? 'the rate provider'}. If the property prices in another currency, this is their conversion at a rate we don't receive.`
}

export function DealDetailCity({ city }: { city: string }) {
  const citySlug = CITY_DISPLAY_TO_SLUG[city]

  if (!citySlug) return <>{city}</>

  return (
    <a
      href={`/destinations/${citySlug}`}
      className="text-[color:var(--brand)] underline decoration-1 underline-offset-2 hover:text-[color:var(--brand-hover)] focus-visible:rounded-sm"
    >
      {city}
    </a>
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
          <a href="/" className="flex items-center gap-0.5 font-display text-xl font-bold text-[color:var(--ink)] no-underline">
            expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" aria-hidden />
          </a>
          <a
            href={criteriaContext.backHref}
            aria-label={criteriaContext.criteria ? 'Back to hotel results for this search' : 'Back to saved deals'}
            className="text-sm font-medium text-[color:var(--ink-soft)] no-underline hover:text-[color:var(--ink)]"
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
            <span className="rounded-[var(--radius-pill)] bg-[color:var(--gold)] px-3 py-1 font-display text-xs font-bold leading-none text-[color:var(--gold-text)]">
              Members
            </span>
            <span className="inline-flex items-center rounded-full border border-[color:var(--primary)] bg-[color:var(--primary-soft)] px-3 py-1 text-xs font-medium text-[color:var(--primary)]">
              {city}
            </span>
          </div>

          {/* Blurred stand-in for the hotel name and price — no real data behind it */}
          <div className="pointer-events-none mx-auto mt-4 max-w-[320px] select-none space-y-3 blur-[5px]" aria-hidden>
            <div className="mx-auto h-6 w-3/4 rounded-[var(--radius-pill)] bg-[color:var(--line-ivory)]" />
            <div className="mx-auto flex items-baseline justify-center gap-2">
              <div className="h-9 w-24 rounded-full bg-[color:var(--primary)]" />
              <div className="h-4 w-16 rounded-full bg-[color:var(--line-ivory)]" />
            </div>
          </div>

          <div className="mx-auto mt-6 flex max-w-[340px] flex-col items-center gap-3">
            <Icon name="premium_unlocked" size={24} className="text-[color:var(--gold-deep)]" />
            <h1 className="font-display text-xl font-bold leading-snug text-[color:var(--ink)]">
              Members-only deal
            </h1>
            <p className="text-sm leading-6 text-[color:var(--ink-soft)]">
              This {city} deal ({checkInWindow}) is locked on the free plan. Premium unlocks the full feed, filters, watchlists, and email alerts — free for 7 days.
            </p>
            <a href="/join" className="btn btn-conversion min-h-[44px] px-6">
              Unlock with Premium
            </a>
            <a href="/deals" className="text-sm font-medium text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]">
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

  const history = await getPriceHistory(deal.hotel_id, marketId, deal.currency).catch(() => [])

  if (history.length < 3) {
    return (
      <section id="price-history">
        <h3 className="text-h3 text-[color:var(--ink)]">Price history</h3>
        <p className="mt-2 text-sm text-[color:var(--text-2)]">Not enough historical checks are available to draw a chart.</p>
        <div className="mt-3">
        <TrustLine snapshotCount={deal.snapshot_count} />
        </div>
        <p className="mt-3 text-xs text-[color:var(--text-3)]">The USD figure was set when this rate was checked and is not re-converted since.</p>
      </section>
    )
  }

  return (
    <section id="price-history">
      <h3 className="text-h3 text-[color:var(--ink)]">Price history</h3>
      <Reveal className="mt-4">
        <PriceSparkline
          history={history}
          dealPriceCents={deal.deal_price_cents}
          medianPriceCents={deal.median_price_cents}
        />
      </Reveal>
      <div className="mt-3">
        <TrustLine snapshotCount={deal.snapshot_count} />
      </div>
      <p className="mt-3 text-xs text-[color:var(--text-3)]">The USD figure was set when this rate was checked and is not re-converted since.</p>
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

  const rawHistory = await getPriceHistory(deal.hotel_id, marketId, deal.currency).catch(() => [])
  // A saved deal already carries the canonical raw-snapshot economics used by
  // the feed. Do not recalculate a second median from the day-averaged chart.
  const confidence: DealScore['confidence'] = deal.snapshot_count >= 8 ? 'high' : 'low'
  const verdict: DealScore['verdict'] = confidence === 'low'
    ? 'Typical'
    : deal.discount_pct >= 30
      ? 'Great'
      : deal.discount_pct >= 15
        ? 'Good'
        : 'Typical'
  const score: DealScore = {
    percentile: 50,
    pctVsMedian: -deal.discount_pct,
    medianCents: deal.median_price_cents,
    currency: deal.currency,
    verdict,
    confidence,
    explanation: '',
    sampleSize: deal.snapshot_count,
  }

  // The Deal Score verdict and the price-history chart further down the page
  // describe the exact same underlying data (same getPriceHistory query),
  // but previously had no link between them -- a user who wanted to see the
  // actual prices behind a Great/Good/Typical verdict had no path from one
  // to the other. Only offer the jump when a real chart will actually be
  // there to land on (matches PriceHistorySection's own >= 3 threshold).
  const hasChartableHistory = rawHistory.length >= 3

  return (
    <div>
      <DealScorePanel
        score={score}
        loading={false}
        scope="hotel"
        priceNoun="nightly rate"
        unavailableCopy="We could not compare this nightly rate with enough recent hotel prices."
        canonicalEvidence={{
          medianCents: deal.median_price_cents,
          pctVsMedian: -deal.discount_pct,
          sampleSize: deal.snapshot_count,
          windowDays: 60,
          explanation: `${formatMoney({ priceCents: deal.deal_price_cents, currency: 'USD' })} — ${deal.discount_pct}% below the usual ${formatMoney({ priceCents: deal.median_price_cents, currency: 'USD' })} nightly rate over the last 60 days.`,
        }}
      />
      {hasChartableHistory ? (
        <a
          href="#price-history"
          className="mt-2 inline-flex items-center text-xs font-medium text-[color:var(--brand)] underline decoration-1 underline-offset-2 hover:text-[color:var(--brand-hover)]"
        >
          See the price history behind this score
        </a>
      ) : null}
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
    const unlockedIds = await getFreeUnlockedDealIds(pwCtx.userId)
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
  const disruptionFixtureId = process.env.NODE_ENV === 'production'
    ? null
    : parseHotelDisruptionFixture(researchParams.disruptionFixture)
  const disruptionEvidence = disruptionFixtureId
    ? createHotelDisruptionFixture(disruptionFixtureId)
    : NO_HOTEL_DISRUPTION_EVIDENCE
  const poolFixtureId = process.env.NODE_ENV === 'production'
    ? null
    : parseHotelPoolFixture(researchParams.poolFixture)
  const poolEvidence = poolFixtureId
    ? createHotelPoolFixture(poolFixtureId, deal.check_in_date, checkOutIso?.slice(0, 10))
    : null
  const wifiFixtureId = isWifiResearchPrototypeEnabled()
    ? parseWifiFixture(researchParams.wifiFixture)
    : 'control'
  const wifiEvidence = createWifiFixture(wifiFixtureId)

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
  // Accessibility criteria continuity and provider-backed room/rate evidence are
  // not in the saved-deal contract yet. Production therefore renders the honest
  // no-selection fallback and cannot emit positive or mismatch claims.
  const accessibility = createAccessibilityPresentation()
  const dealDetailIa = process.env.NEXT_PUBLIC_DEAL_DETAIL_IA === '1' || process.env.NEXT_PUBLIC_DEAL_DETAIL_IA === 'true'
  let reviewEvidence: HotelReviewEvidence | undefined
  if (deal.review_evidence) {
    try {
      reviewEvidence = typeof deal.review_evidence === 'string'
        ? JSON.parse(deal.review_evidence) as HotelReviewEvidence
        : deal.review_evidence as HotelReviewEvidence
    } catch {
      reviewEvidence = undefined
    }
  }
  const hasReviewEvidence = Boolean(
    reviewEvidence?.state === 'ready'
    && reviewEvidence.provenance !== 'unavailable'
    && reviewEvidence.provenance !== 'inferred'
    && reviewEvidence.score
    && Number.isFinite(reviewEvidence.score.value)
    && Number.isFinite(reviewEvidence.score.scaleMax)
  )

  if (dealDetailIa) {
    const hasStayNotes = Boolean(poolEvidence || disruptionFixtureId || wifiEvidence)
    const trackedMarket = TRACKED_MARKETS.find(m => m.city === deal.city)
    return (
      <div className="min-h-screen bg-[color:var(--bg)]">
        <nav className="border-b border-[color:var(--line-ivory)] bg-[color:var(--bg)]">
          <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-5">
            <a href="/" className="flex items-center gap-0.5 font-display text-xl font-bold text-[color:var(--ink)] no-underline">expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" aria-hidden /></a>
            <a href="/account#alerts" aria-label="Your account" className="inline-flex min-h-11 items-center text-sm font-medium text-[color:var(--text-2)]">Your account</a>
          </div>
        </nav>
        <main className="mx-auto w-full max-w-[1080px] px-4 py-5 sm:px-6 sm:py-8">
          <a href={backHref} className="inline-flex min-h-11 items-center text-sm font-medium text-[color:var(--text-2)] no-underline hover:text-[color:var(--text-1)]">← {criteria ? 'Back to results' : 'Back to saved deals'}</a>
          <div className="mt-4 space-y-4">
            <section id="deal-hero" aria-labelledby="deal-detail-title" className="overflow-hidden rounded-[var(--radius-card)] bg-[color:var(--bg-surface)] shadow-[var(--shadow-card-rest)]">
              {deal.photo_url ? <PropertyPhoto src={deal.photo_url} size="detail" loading="eager" imageClassName="motion-safe:transition-transform motion-safe:duration-500 hover:scale-[1.02]" /> : null}
              <div className="p-4 sm:p-6">
                <p className="text-caption font-medium uppercase tracking-wide text-[color:var(--brand)]">Saved hotel deal</p>
                <h1 id="deal-detail-title" className="mt-2 break-words font-display text-2xl font-bold leading-tight text-[color:var(--text-1)] sm:text-3xl">{deal.hotel_name}</h1>
                <p className="mt-2 text-small font-medium text-[color:var(--ink-soft)]"><DealDetailCity city={deal.city} />{deal.stars != null ? ` · ${deal.stars}-star hotel` : ''}</p>
                <p className="mt-3 text-small text-[color:var(--ink-soft)]">{checkInDisplay ?? 'Check-in not provided'} to {checkOutDisplay ?? 'check-out not provided'}{deal.nights > 0 ? ` · ${deal.nights} ${deal.nights === 1 ? 'night' : 'nights'}` : ''}</p>
                <div className="mt-5 grid items-start gap-6 min-[1024px]:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
                  <div>
                    <Suspense fallback={<DealScorePanel score={null} loading scope="hotel" priceNoun="nightly rate" unavailableCopy="We could not compare this nightly rate with enough recent hotel prices." />}><DealScoreSection deal={deal} /></Suspense>
                    <div className="mt-5 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)]/55 p-4 text-caption leading-5 text-[color:var(--ink-faint)]">
                      <p>Provider supplied an area, not a street address.</p>
                      <p className="mt-1">{comparisonBasisCopy(deal.ota_links ?? {})}</p>
                    </div>
                  </div>
                  <aside className="rounded-[var(--radius-card)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-card-hover)] min-[1024px]:sticky min-[1024px]:top-6">
                    <p className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Nightly rate</p>
                    <p className="mt-2 break-words text-display font-bold text-[color:var(--ink)] text-tabular">{formatMoney({ priceCents: deal.deal_price_cents, currency: 'USD' })}</p>
                    <p className="mt-2 text-small text-[color:var(--ink-soft)]"><span className="line-through text-tabular">{formatMoney({ priceCents: deal.median_price_cents, currency: 'USD' })}</span> usual</p>
                    <span className="mt-3 inline-flex rounded-[var(--radius-pill)] bg-[color:var(--accent)] px-3 py-1.5 text-small font-bold text-[color:var(--ink)]">{deal.discount_pct}% off</span>
                    <p className="mt-3 text-caption text-[color:var(--ink-faint)]">60-day median · {deal.snapshot_count} {deal.snapshot_count === 1 ? 'check' : 'checks'}{checkedAgo ? ` · checked ${checkedAgo}` : ''}</p>
                    <div className="mt-5"><DealDetailProviderHandoff dealId={deal.id} city={deal.city} links={deal.ota_links ?? {}} backHref={backHref} expired={isExpired} stickyPrice={{ priceCents: deal.deal_price_cents, currency: 'USD' }} heroId="deal-hero" /></div>
                  </aside>
                </div>
                <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3 py-1.5 text-xs font-medium text-[color:var(--text-2)]">Cancellation: check on OTA</span></div>
              </div>
            </section>

            <section className="rounded-[var(--radius-card)] bg-[color:var(--bg-surface)] p-4 shadow-[var(--shadow-card-rest)] sm:p-6"><Suspense fallback={<PriceHistorySkeleton />}><PriceHistorySection deal={deal} /></Suspense></section>

            <section aria-labelledby="place-context-title" className="rounded-[var(--radius-card)] bg-[color:var(--bg-muted)]/45 p-4 sm:p-6">
              <h2 id="place-context-title" className="text-xl font-medium text-[color:var(--text-1)] sm:text-2xl">Place context</h2>
              <div className="mt-4 space-y-5"><Suspense fallback={null}><LocationQualitySection hotelName={deal.hotel_name} city={deal.city} /></Suspense><HotelDealCriteriaSummary context={criteriaContext} deal={{ city: deal.city, checkInDate: deal.check_in_date }} /><HotelContinuityPrototype dealId={deal.id} hotelName={deal.hotel_name} fixtureId={continuityFixtureId} disclosure={continuityDisclosure} initiallyExpanded={disclosureParam === 'expanded'} /></div>
            </section>

            {hasReviewEvidence ? <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6"><GuestReviewEvidence evidence={reviewEvidence} /></section> : null}
            <Suspense fallback={<AiDayPlanCardSkeleton />}><AiDayPlanSection city={deal.city} /></Suspense>

            {hasStayNotes ? (
              <details className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-4 py-2 sm:px-6">
                <summary className="min-h-11 cursor-pointer py-3 text-base font-medium text-[color:var(--text-1)]">Stay notes</summary>
                <div className="space-y-4 border-t border-[color:var(--border)] py-4">{poolEvidence ? <HotelPoolEvidenceLedger evidence={poolEvidence} /> : null}{disruptionFixtureId ? <HotelDisruptionEvidenceLedger evidence={disruptionEvidence} analyticsKey={deal.id} fixture /> : null}{wifiEvidence ? <WifiEvidenceLedger evidence={wifiEvidence} idSuffix="deal-detail-ia" /> : null}</div>
              </details>
            ) : null}

            <details className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-4 py-2 sm:px-6"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-[color:var(--brand)]">Show offer details</summary><dl className="border-t border-[color:var(--border)] py-3"><dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Offer reference</dt><dd className="mt-2 break-all font-mono text-xs text-[color:var(--text-2)]">{deal.id}</dd></dl></details>
            <footer className="space-y-3 px-1 py-3"><p className="text-xs leading-5 text-[color:var(--text-3)]">Amenity and room details can change. Confirm cancellation, accessibility, and room type on the booking site before you pay.</p>{trackedMarket && !isExpired && !datesIncomplete ? <a href={`/flights?destination=${encodeURIComponent(trackedMarket.iata)}&depart=${encodeURIComponent(deal.check_in_date)}`} className="inline-flex min-h-11 items-center text-sm font-medium text-[color:var(--brand)] underline underline-offset-2">Search flights to {deal.city}</a> : null}<div className="flex flex-wrap items-center gap-3"><ShareButton />{showWatchPill && sub ? <WatchCityPill city={deal.city} initialWatching={sub.watchlist.includes(deal.city)} initialCount={sub.watchlist.length} /> : null}</div>{foundAgo ? <p className="text-xs text-[color:var(--text-3)]">Deal found {foundAgo}.</p> : null}</footer>
          </div>
          <HotelDecisionAnalytics hotelId={deal.id} entrySource="saved" hasDates={!datesIncomplete} hasVerifiedGuestRating={hasReviewEvidence} scoreState={scoreState} priceFreshnessState={priceFreshnessState} viewedProps={{ deal_id: deal.id, context_status: contextStatus, detail_ia: true, ...(criteria ? { criteria_version: criteria.criteriaVersion } : {}) }} />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg)]">
      <nav className="border-b border-[color:var(--line-ivory)] bg-[color:var(--bg)]">
        <div className="mx-auto flex h-16 max-w-[1140px] items-center px-5">
          <a href="/" className="flex items-center gap-0.5 font-display text-xl font-bold text-[color:var(--ink)] no-underline">
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
            <p className="text-caption font-medium uppercase tracking-wide text-[color:var(--brand)]">Saved hotel deal</p>
            <h1 id="saved-hotel-title" className="mt-2 break-words font-display text-2xl font-bold leading-tight text-[color:var(--text-1)] sm:text-3xl">{deal.hotel_name}</h1>
            <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-2)]">Area: <DealDetailCity city={deal.city} /></p>
            <p className="mt-1 text-xs leading-5 text-[color:var(--text-3)]">Provider supplied an area, not a street address.</p>
            <dl className="mt-5 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
              <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5">
                <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Check-in</dt>
                <dd className="mt-1 text-sm font-medium text-[color:var(--text-1)]">{checkInDisplay ?? 'Check-in not provided'}</dd>
              </div>
              <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5">
                <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Check-out</dt>
                <dd className="mt-1 text-sm font-medium text-[color:var(--text-1)]">{checkOutDisplay ?? 'Check-out not provided'}</dd>
              </div>
              <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5">
                <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Nights</dt>
                <dd className="mt-1 text-sm font-medium text-[color:var(--text-1)]">{deal.nights != null ? `${deal.nights} ${deal.nights === 1 ? 'night' : 'nights'}` : 'Night count not provided'}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm leading-6 text-[color:var(--text-2)]">
              {checkInDisplay && checkOutDisplay && deal.nights != null
                ? 'Rate shown for these dates. No room is selected, and room-level accessibility fit is not confirmed. Climate details are confirmed only where the evidence below says “For this room and rate.”'
                : 'Stay dates are incomplete. Choose or confirm dates with the provider before comparing room options. No room is selected, and room-level accessibility fit is not confirmed.'}
            </p>
          </section>

          <section aria-labelledby="saved-price-score-title" data-hotel-decision-section="price_deal_score" data-hotel-decision-position="2" className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6">
            <h2 id="saved-price-score-title" className="text-xl font-medium text-[color:var(--text-1)] sm:text-2xl">Price and Deal Score</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4">
                <p className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Observed nightly rate</p>
                <p className="mt-2 break-words font-display text-3xl font-bold tabular-nums text-[color:var(--text-1)] sm:text-4xl">{formatMoney({ priceCents: deal.deal_price_cents, currency: 'USD' })}</p>
                <p className="mt-1 text-sm text-[color:var(--text-2)]">per night before taxes and fees</p>
                <p className="mt-2 text-xs text-[color:var(--text-2)]">Rate observed from a booking partner.</p>
                <p className="mt-2 text-xs text-[color:var(--text-3)]">{comparisonBasisCopy(deal.ota_links ?? {})}</p>
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

          <HotelCancellationChoicesUnavailable headingLevel="h2" />

          <section aria-labelledby="saved-hotel-fit-title" data-hotel-decision-section="hotel_fit" data-hotel-decision-position="3" className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6">
            <h2 id="saved-hotel-fit-title" className="text-xl font-medium text-[color:var(--text-1)] sm:text-2xl">Hotel fit</h2>
            <dl className="mt-4 grid grid-cols-1 gap-4">
              <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5">
                <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Hotel class</dt>
                <dd className="mt-1 text-sm font-medium text-[color:var(--text-1)]">{deal.stars != null ? `${deal.stars}-star hotel class from a booking partner` : 'Hotel class not provided'}</dd>
              </div>
            </dl>
            {poolEvidence ? <HotelPoolEvidenceLedger evidence={poolEvidence} /> : null}
            <div className="mt-4">
              <GuestReviewEvidence />
            </div>
            <HotelClimateEvidenceLedger evidence={createUnsupportedHotelClimateEvidence(deal.id, 'saved-deal-contract')} />
            <HotelEvChargingSection evidence={PRODUCTION_EV_CHARGING_UNKNOWN} offerId={deal.id} />
            <HotelDisruptionEvidenceLedger
              evidence={disruptionEvidence}
              analyticsKey={deal.id}
              fixture={disruptionFixtureId !== null}
            />
            <AccessibilityFitLedger presentation={accessibility} hotelName={deal.hotel_name} criteriaValid={criteriaResolution.status !== 'invalid'} />
            <QuietStayEvidenceLedger evidence={NO_QUIET_STAY_EVIDENCE} />
            <HotelSustainabilityCredentialEvidence />
          </section>

          {wifiEvidence ? <WifiEvidenceLedger evidence={wifiEvidence} idSuffix="deal-detail" /> : null}

          <section aria-labelledby="saved-provider-title" data-hotel-decision-section="provider_handoff" data-hotel-decision-position="4" className="rounded-[var(--radius-card)] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] p-4 sm:p-6">
            <h2 id="saved-provider-title" className="text-xl font-medium text-[color:var(--text-1)] sm:text-2xl">Check rooms with provider</h2>
            {!isExpired ? <AccessibilityHandoffBoundary presentation={accessibility} /> : null}
            {isExpired ? (
              <div className="mt-4" role="status">
                <p className="text-sm font-medium text-[color:var(--text-1)]">Saved rate expired</p>
                <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">This observed nightly rate is no longer current. Search again before inspecting room options.</p>
                <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">Room availability was not checked by expaify.</p>
                <a href="/deals" className="btn btn-primary mt-4 inline-flex min-h-11 w-full items-center justify-center text-center">Search current deals</a>
              </div>
            ) : (
              <HotelDealCriteriaHandoff
                context={criteriaContext}
                deal={{
                  id: deal.id,
                  city: deal.city,
                  checkInDate: deal.check_in_date,
                  checkInDisplay,
                  checkOutDisplay,
                  nights: deal.nights,
                }}
                links={deal.ota_links ?? {}}
                hotelName={deal.hotel_name}
                datesIncomplete={datesIncomplete}
                disruptionEvidence={disruptionEvidence}
                disruptionFixture={disruptionFixtureId !== null}
                poolEvidence={poolEvidence ?? undefined}
                accessibility={accessibility}
              />
            )}
          </section>

          {!isExpired && !datesIncomplete && TRACKED_MARKETS.find(m => m.city === deal.city) ? (
            <FlightsToThisDeal
              destinationIata={TRACKED_MARKETS.find(m => m.city === deal.city)!.iata}
              checkInDate={deal.check_in_date}
              nights={deal.nights}
            />
          ) : null}

          <section aria-labelledby="saved-supporting-title" data-hotel-decision-section="supporting_evidence" data-hotel-decision-position="5" className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6">
            <h2 id="saved-supporting-title" className="text-xl font-medium text-[color:var(--text-1)] sm:text-2xl">Supporting evidence</h2>
            <div className="mt-5 space-y-6">
              {deal.photo_url ? <PropertyPhoto src={deal.photo_url} size="detail" loading="lazy" /> : null}
              <Suspense fallback={null}>
                <LocationQualitySection hotelName={deal.hotel_name} city={deal.city} />
              </Suspense>
              <HotelDealCriteriaSummary context={criteriaContext} deal={{ city: deal.city, checkInDate: deal.check_in_date }} />
              <HotelContinuityPrototype dealId={deal.id} hotelName={deal.hotel_name} fixtureId={continuityFixtureId} disclosure={continuityDisclosure} initiallyExpanded={disclosureParam === 'expanded'} />
              <Suspense fallback={<PriceHistorySkeleton />}>
                <PriceHistorySection deal={deal} />
              </Suspense>
              <Suspense fallback={<AiDayPlanCardSkeleton />}>
                <AiDayPlanSection city={deal.city} />
              </Suspense>
              <details className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-2">
                <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-[color:var(--brand)]">Show offer details</summary>
                <dl className="border-t border-[color:var(--border)] py-3">
                  <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Offer reference</dt>
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
