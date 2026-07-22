import type { Metadata } from 'next'
import Link from 'next/link'
import { auth } from '@/auth'
import { getSubscription } from '@/lib/subscription'
import { getPaywallContext, getFreeUnlockedDealIds } from '@/lib/paywall'
import { getActiveDeals, type DealRow } from '@/lib/pipeline/dealDetection'
import { generateMockDeals } from '@/lib/pipeline/mock'
import { redirect } from 'next/navigation'
import { LandingNav } from '../components/LandingNav'
import { DealFeed, type ApiDeal } from './DealFeed'
import { HOTEL_DEAL_PAGE_SIZE } from '@/lib/deals/feedContract'
import { query } from '@/lib/db/client'
import {
  createHotelCriteriaVersion,
  hotelCriteriaFromDraft,
  resolveHotelResultsView,
  resolveHotelSearchCriteria,
} from '@/lib/hotels/searchCriteria'

export const metadata: Metadata = {
  title: 'Hotel deals today — expaify',
  description: 'We track 20 destinations daily and surface hotel deals 30–50% below their 60-day average price.',
}

function toApiDeal(row: DealRow, locked: boolean): ApiDeal {
  if (locked) {
    return {
      id: row.id, hotelId: row.hotel_id,
      hotelName: 'Members-only deal', stars: null, photoUrl: null,
      city: row.city, dealPriceCents: 0, medianPriceCents: 0,
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
    dealPriceCents: row.deal_price_cents, medianPriceCents: row.median_price_cents,
    discountPct: row.discount_pct, checkInWindow: row.check_in_window,
    checkInDate: row.check_in_date,
    nights: row.nights, snapshotCount: row.snapshot_count,
    otaLinks: row.ota_links, headline: row.headline, isMock: row.is_mock,
    firstSeen: row.first_seen, updatedAt: row.updated_at, locked: false,
  }
}

export default async function DealsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const requestedParams = await searchParams
  const session = await auth()
  if (session?.user?.id) {
    const sub = await getSubscription(session.user.id).catch(() => null)
    if (!sub?.onboardingDone) redirect('/onboarding')
  }

  const criteriaResolution = resolveHotelSearchCriteria(requestedParams)
  const requestedView = resolveHotelResultsView(requestedParams)
  if (criteriaResolution.status === 'invalid' || !requestedView) {
    return (
      <>
        <LandingNav />
        <main className="mx-auto max-w-[760px] px-5 py-16">
          <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-6 text-center">
            <h1 className="text-h2 text-[color:var(--text-1)]">We couldn&apos;t restore this search.</h1>
            <p className="mt-2 text-[14px] leading-6 text-[color:var(--text-2)]">The search link is incomplete or no longer valid.</p>
            <Link href="/deals" className="btn btn-primary mt-5 min-h-11 px-6">Start a new search</Link>
          </section>
        </main>
      </>
    )
  }

  const criteria = criteriaResolution.status === 'valid'
    ? criteriaResolution.criteria
    : hotelCriteriaFromDraft({ city: '', dateFrom: '', dateTo: '' }, createHotelCriteriaVersion(), 'deals_page')
  const requestedCity = criteria.destination.state === 'selected' ? criteria.destination.city : ''
  const requestedDateFrom = criteria.dates.semantic === 'checkin_window' ? criteria.dates.dateFrom : undefined
  const requestedDateTo = criteria.dates.semantic === 'checkin_window' ? criteria.dates.dateTo : undefined
  const pwCtx = await getPaywallContext()
  const market = requestedCity
    ? await query<{ id: number }>('SELECT id FROM tracked_markets WHERE city = $1 LIMIT 1', [requestedCity]).catch(() => ({ rows: [] as { id: number }[] }))
    : null
  const effectiveView = pwCtx.premium ? requestedView : { minDiscount: 20, maxPriceCents: null, minStars: 0, sort: 'newest' as const }

  // Pre-fetch the exact validated URL state so refresh/share never flash default results.
  const rowsRequest = requestedCity && !market?.rows[0]
    ? Promise.resolve([] as DealRow[])
    : getActiveDeals({
      limit: HOTEL_DEAL_PAGE_SIZE,
      sort: effectiveView.sort,
      includeMock: false,
      minDiscount: effectiveView.minDiscount,
      maxPriceCents: effectiveView.maxPriceCents ?? undefined,
      minStars: effectiveView.minStars || undefined,
      marketId: market?.rows[0]?.id,
      dateFrom: requestedDateFrom,
      dateTo: requestedDateTo,
    }).catch(() => [] as DealRow[])
  const [rows, unlockedIds] = await Promise.all([
    rowsRequest,
    getFreeUnlockedDealIds(),
  ])

  let initialDeals: ApiDeal[]
  if (rows.length > 0) {
    initialDeals = rows.map(row => toApiDeal(row, !pwCtx.premium && !unlockedIds.has(row.id)))
  } else if (
    criteria.destination.state === 'all' && criteria.dates.semantic === 'missing' &&
    effectiveView.minDiscount === 20 && effectiveView.maxPriceCents === null &&
    effectiveView.minStars === 0 && effectiveView.sort === 'newest'
  ) {
    // Fallback mock deals while real data accumulates
    initialDeals = generateMockDeals(3).map((d) => {
      const base: ApiDeal = {
        id: d.hotel_id,
        hotelId: d.hotel_id,
        hotelName: d.hotel_name,
        stars: d.stars,
        photoUrl: d.photo_url,
        city: '',
        dealPriceCents: d.deal_price_cents,
        medianPriceCents: d.median_price_cents,
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
    <>
      <LandingNav />
      <main className="mx-auto max-w-[1140px] px-5 pb-24 pt-10">
        <DealFeed
          key={criteria.criteriaVersion}
          initialDeals={initialDeals}
          premium={pwCtx.premium}
          initialCriteria={criteria}
          initialView={effectiveView}
        />
      </main>
    </>
  )
}
