import { MIN_QUALIFYING_DISCOUNT_PCT } from '@/lib/deals/threshold'
import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@/auth'
import { getSubscription } from '@/lib/subscription'
import { getPaywallContext, getFreeUnlockedDealIds } from '@/lib/paywall'
import { getActiveDeals, getTrackedHotels, getStableFreeTrackedHotelIds, type DealRow } from '@/lib/pipeline/dealDetection'
import { generateMockDeals } from '@/lib/pipeline/mock'
import { redirect } from 'next/navigation'
import { AppShell } from '../components/AppShell'
import { DealFeed, type ApiDeal } from './DealFeed'
import { buildDealPage, HOTEL_DEAL_PAGE_SIZE } from '@/lib/deals/feedContract'
import { query } from '@/lib/db/client'
import {
  deterministicHotelCriteriaVersion,
  hotelCriteriaFromDraft,
  resolveHotelResultsView,
  resolveHotelSearchCriteria,
} from '@/lib/hotels/searchCriteria'
import { parseHotelPoolFixture } from '@/app/components/research/hotelPoolFixtures'
import { buildPersonalization, resolveWatchlistMarketIds } from '@/lib/deals/personalization'
import { TRACKED_MARKETS } from '@/lib/trackedMarkets'

export const metadata: Metadata = {
  title: 'Hotel deals today — expaify',
  description: `We track ${TRACKED_MARKETS.length} destinations daily and surface hotel deals at least 30% below their 60-day median price.`,
  openGraph: {
    title: 'Hotel deals today — expaify',
    description: `We track ${TRACKED_MARKETS.length} destinations daily and surface hotel deals at least 30% below their 60-day median price.`,
    url: 'https://expaify.com/deals',
    type: 'website',
    images: [{ url: '/og.png', alt: 'Hotel deals today — expaify' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hotel deals today — expaify',
    description: `We track ${TRACKED_MARKETS.length} destinations daily and surface hotel deals at least 30% below their 60-day median price.`,
    images: ['/og.png'],
  },
  alternates: { canonical: 'https://expaify.com/deals' },
}

function toApiDeal(row: DealRow, locked: boolean): ApiDeal {
  if (locked) {
    return {
      id: row.id, hotelId: row.hotel_id,
      hotelName: 'Members-only deal', stars: null, photoUrl: null,
      city: row.city, dealPriceCents: 0, medianPriceCents: 0, currency: row.currency,
      discountPct: row.discount_pct, checkInWindow: row.check_in_window,
      checkInDate: row.check_in_date,
      nights: row.nights, snapshotCount: row.snapshot_count,
      otaLinks: {}, headline: null, isMock: row.is_mock,
      firstSeen: row.first_seen, updatedAt: row.updated_at, locked: true,
    }
  }
  return {
    id: row.id, hotelId: row.hotel_id, hotelName: row.hotel_name,
    stars: row.stars, photoUrl: row.photo_url, city: row.city,
    dealPriceCents: row.deal_price_cents, medianPriceCents: row.median_price_cents, currency: row.currency,
    discountPct: row.discount_pct, checkInWindow: row.check_in_window,
    checkInDate: row.check_in_date,
    nights: row.nights, snapshotCount: row.snapshot_count,
    otaLinks: row.ota_links, headline: row.headline, isMock: row.is_mock,
    firstSeen: row.first_seen, updatedAt: row.updated_at, locked: false,
  }
}

export default async function DealsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const requestedParams = await searchParams
  const poolFixtureId = process.env.NODE_ENV === 'production' ? null : parseHotelPoolFixture(requestedParams.poolFixture)
  const session = await auth()
  let sub: Awaited<ReturnType<typeof getSubscription>> | null = null
  if (session?.user?.id) {
    sub = await getSubscription(session.user.id).catch(() => null)
    if (!sub?.onboardingDone) {
      // Carry a city deep-linked from /login (e.g. "Get free alerts for
      // {city}") one hop further, so onboarding can start with the city the
      // user actually clicked instead of a blank destination grid.
      const cityParam = typeof requestedParams.city === 'string' ? requestedParams.city : undefined
      redirect(cityParam ? `/onboarding?city=${encodeURIComponent(cityParam)}` : '/onboarding')
    }
  }

  const criteriaResolution = resolveHotelSearchCriteria(requestedParams)
  const requestedView = resolveHotelResultsView(requestedParams)
  if (criteriaResolution.status === 'invalid' || !requestedView) {
    return (
      <AppShell>
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-[760px] px-5 py-16">
          <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-6 text-center">
            <h1 className="text-h2 text-[color:var(--text-1)]">We couldn&apos;t restore this search.</h1>
            <p className="mt-2 text-body leading-6 text-[color:var(--text-2)]">The search link is incomplete or no longer valid.</p>
            <Link href="/deals" className="btn btn-primary mt-5">Start a new search</Link>
          </section>
        </main>
      </AppShell>
    )
  }

  const criteria = criteriaResolution.status === 'valid'
    ? criteriaResolution.criteria
    : hotelCriteriaFromDraft(
      { city: '', dateFrom: '', dateTo: '' },
      deterministicHotelCriteriaVersion({ city: '', dateFrom: '', dateTo: '', source: 'deals_page' }),
      'deals_page',
    )
  const requestedCity = criteria.destination.state === 'selected' ? criteria.destination.city : ''
  const requestedDateFrom = criteria.dates.semantic === 'checkin_window' ? criteria.dates.dateFrom : undefined
  const requestedDateTo = criteria.dates.semantic === 'checkin_window' ? criteria.dates.dateTo : undefined
  const pwCtx = await getPaywallContext()

  // A real explicit city/date search -- not merely criteriaResolution.status
  // === 'valid', since DealFeed's own client-side fetches always carry an
  // already-minted criteriaVersion even for the default "no city, no dates"
  // view (see DealFeed.tsx's fetch builder). Checking the *resolved*
  // destination/dates state instead means a clean default view stays
  // personalized across those client refetches too, while an actual
  // city/date search (restored, shared, or picked via the UI) -- or the
  // "Show all deals" escape hatch -- always wins over an inferred watchlist
  // preference. See lib/deals/personalization.ts.
  const hasExplicitRequest = criteria.destination.state === 'selected' || criteria.dates.semantic === 'checkin_window'
  let personalization = buildPersonalization(sub, {
    signedIn: Boolean(session?.user?.id),
    onboardingDone: Boolean(sub?.onboardingDone),
    hasExplicitRequest,
    allOverride: requestedParams.all === '1',
  })
  const watchlistMarketIds = personalization?.active && personalization.watchlist.length > 0
    ? await resolveWatchlistMarketIds(personalization.watchlist)
    : []

  let initialError = false
  const market = requestedCity
    ? await query<{ id: number }>('SELECT id FROM tracked_markets WHERE city = $1 LIMIT 1', [requestedCity]).catch(() => {
        initialError = true
        return { rows: [] as { id: number }[] }
      })
    : null
  if (requestedCity && !market?.rows[0]) initialError = true
  const effectiveView = pwCtx.premium ? requestedView : { minDiscount: MIN_QUALIFYING_DISCOUNT_PCT, maxPriceCents: null, minStars: 0, sort: 'newest' as const }

  // Pre-fetch the exact validated URL state so refresh/share never flash default results.
  const rowsRequest = initialError
    ? Promise.resolve([] as DealRow[])
    : getActiveDeals({
      // Fetch one extra row so the client receives a trustworthy first-page
      // continuation boundary on its initial server render.
      limit: HOTEL_DEAL_PAGE_SIZE + 1,
      offset: 0,
      sort: effectiveView.sort,
      includeMock: false,
      minDiscount: effectiveView.minDiscount,
      maxPriceCents: effectiveView.maxPriceCents ?? undefined,
      minStars: effectiveView.minStars || undefined,
      marketId: market?.rows[0]?.id,
      marketIds: watchlistMarketIds.length > 0 ? watchlistMarketIds : undefined,
      dateFrom: requestedDateFrom,
      dateTo: requestedDateTo,
    }).catch(() => {
      initialError = true
      return [] as DealRow[]
    })
  let [rows, unlockedIds] = await Promise.all([
    rowsRequest,
    getFreeUnlockedDealIds(pwCtx.userId),
  ])

  // A watchlist filter that matched zero current deals used to leave a
  // signed-in user looking at total silence by default (no fallback until
  // they noticed and clicked "Show all deals"). Before personalization was
  // wired up, every signed-in user saw the full feed by default, so this is
  // a real regression, not the intended behavior -- fall back to the same
  // unfiltered feed a plain `?all=1` request would get, same as if
  // personalization had never applied. Scoped to exactly the same default
  // view this effect only ever had a chance to break: an explicit
  // city/date search already short-circuits personalization.active above,
  // so it can't land here.
  if (rows.length === 0 && !initialError && personalization?.active && watchlistMarketIds.length > 0) {
    const fallbackRows = await getActiveDeals({
      limit: HOTEL_DEAL_PAGE_SIZE + 1,
      offset: 0,
      sort: effectiveView.sort,
      includeMock: false,
      minDiscount: effectiveView.minDiscount,
      maxPriceCents: effectiveView.maxPriceCents ?? undefined,
      minStars: effectiveView.minStars || undefined,
    }).catch(() => [] as DealRow[])
    if (fallbackRows.length > 0) {
      rows = fallbackRows
      personalization = { ...personalization, active: false, fellBackToAll: true }
    }
  }

  const initialPage = buildDealPage(rows, 0, HOTEL_DEAL_PAGE_SIZE)
  let initialDeals: ApiDeal[]
  if (rows.length > 0) {
    initialDeals = initialPage.items.map(row => toApiDeal(row, !pwCtx.premium && !unlockedIds.has(row.id)))
  } else if (!initialError && !personalization?.active &&
    criteria.destination.state === 'all' && criteria.dates.semantic === 'missing' &&
    effectiveView.minDiscount === MIN_QUALIFYING_DISCOUNT_PCT && effectiveView.maxPriceCents === null &&
    effectiveView.minStars === 0 && effectiveView.sort === 'newest'
  ) {
    // No confirmed deals yet for the default (unfiltered) view. Prefer real,
    // currently-tracked hotels (real photo, real price) over fabricated
    // example cards — only fall back to generated mock deals if there's
    // truly no real snapshot data at all yet.
    //
    // Deliberately skipped while personalization is active: this fallback
    // is a global, unscoped cold-start placeholder (not filtered by
    // watchlist, and not worth extending to be -- see the real
    // tracked-hotel paywall-consistency bug this exact ranking query was
    // already fixed for once). A personalized user with zero real deals in
    // their watchlisted cities instead falls through to initialDeals = []
    // below, which DealFeed.tsx's own PersonalizedEmpty/
    // PersonalizedEmptyActions components (already built, just never
    // reachable until now) render correctly.
    const tracked = await getTrackedHotels({ limit: HOTEL_DEAL_PAGE_SIZE }).catch(() => [] as DealRow[])
    // Stable, id-based "is this specific tracked hotel free this week" set --
    // not array position -- so a direct link to this same row's own detail
    // page (which checks membership in this identical set) always agrees
    // with what this list just showed. See getStableFreeTrackedHotelIds's
    // own comment for the real bug this replaced.
    const stableFreeTrackedIds = tracked.length > 0
      ? await getStableFreeTrackedHotelIds({ limit: pwCtx.freeUnlockLimit }).catch(() => new Set<string>())
      : new Set<string>()
    initialDeals = tracked.length > 0
      ? tracked.map(row => toApiDeal(row, !pwCtx.premium && !stableFreeTrackedIds.has(row.id) && !unlockedIds.has(row.id)))
      : generateMockDeals(HOTEL_DEAL_PAGE_SIZE).map((d) => {
        const base: ApiDeal = {
          id: d.hotel_id,
          hotelId: d.hotel_id,
          hotelName: d.hotel_name,
          stars: d.stars,
          photoUrl: d.photo_url,
          city: '',
          dealPriceCents: d.deal_price_cents,
          medianPriceCents: d.median_price_cents,
          currency: 'USD',
          discountPct: d.discount_pct,
          checkInWindow: d.check_in_window,
          checkInDate: d.check_in_date,
          nights: d.nights,
          snapshotCount: d.snapshot_count,
          otaLinks: d.ota_links as Record<string, string>,
          headline: null,
          isMock: true,
          firstSeen: null,
          updatedAt: null,
          locked: false,
        }
        return base
      })
  } else {
    initialDeals = []
  }

  return (
    <AppShell>
      <main id="main-content" tabIndex={-1} className="reveal-scope mx-auto max-w-[1140px] px-5 pb-24 pt-10">
        <noscript>
          <style>{`.reveal-scope .reveal, .reveal-scope .reveal-bar { opacity: 1 !important; transform: none !important; width: var(--bar-target, 100%) !important; }`}</style>
        </noscript>
        <h1 className="sr-only">Hotel deals today — expaify</h1>
        <DealFeed
          key={criteria.criteriaVersion}
          initialDeals={initialDeals}
          premium={pwCtx.premium}
          signedIn={Boolean(pwCtx.userId)}
          freeUnlockedThisWeek={pwCtx.freeUnlockedThisWeek}
          freeUnlockLimit={pwCtx.freeUnlockLimit}
          initialCriteria={criteria}
          initialView={effectiveView}
          initialError={initialError}
          initialCoverage={rows.length > 0 ? { state: initialPage.coverage, nextOffset: initialPage.page.nextOffset } : null}
          poolFixtureId={poolFixtureId}
          personalization={personalization}
        />
      </main>
    </AppShell>
  )
}
