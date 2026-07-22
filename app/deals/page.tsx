import type { Metadata } from 'next'
import { auth } from '@/auth'
import { getSubscription } from '@/lib/subscription'
import { getPaywallContext, getFreeUnlockedDealIds } from '@/lib/paywall'
import { getActiveDeals, type DealRow } from '@/lib/pipeline/dealDetection'
import { generateMockDeals } from '@/lib/pipeline/mock'
import { redirect } from 'next/navigation'
import { LandingNav } from '../components/LandingNav'
import { DealFeed, type ApiDeal } from './DealFeed'

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
    nights: row.nights, snapshotCount: row.snapshot_count,
    otaLinks: row.ota_links, headline: row.headline, isMock: row.is_mock,
    firstSeen: row.first_seen, updatedAt: row.updated_at, locked: false,
  }
}

type DealsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

function positiveInteger(value: string, max: number): number | undefined {
  if (!/^\d+$/.test(value)) return undefined
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max ? parsed : undefined
}

export default async function DealsPage({ searchParams }: DealsPageProps) {
  const queryParams = await searchParams
  const city = first(queryParams.city).trim().slice(0, 100)
  const minDiscount = positiveInteger(first(queryParams.min_discount), 100)
  const maxPriceCents = positiveInteger(first(queryParams.max_price_cents), 100_000_000)
  const minStars = positiveInteger(first(queryParams.min_stars), 5)
  const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(first(queryParams.date_from)) ? first(queryParams.date_from) : ''
  const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(first(queryParams.date_to)) ? first(queryParams.date_to) : ''
  const sort = first(queryParams.sort) === 'discount' ? 'discount' as const : undefined
  const hasReturnFilters = Boolean(city || minDiscount || maxPriceCents || minStars || dateFrom || dateTo || sort)
  const initialFilters = hasReturnFilters ? {
    city: city || undefined,
    minDiscount,
    maxPriceCents,
    minStars,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sort,
  } : undefined
  const session = await auth()
  if (session?.user?.id) {
    const sub = await getSubscription(session.user.id).catch(() => null)
    if (!sub?.onboardingDone) redirect('/onboarding')
  }

  // Pre-fetch initial deals server-side so the page renders immediately without a client round-trip
  const [rows, pwCtx, unlockedIds] = await Promise.all([
    getActiveDeals({ limit: 20, sort: 'newest', includeMock: false, minDiscount: 20 }).catch(() => [] as DealRow[]),
    getPaywallContext(),
    getFreeUnlockedDealIds(),
  ])

  let initialDeals: ApiDeal[]
  if (rows.length > 0) {
    initialDeals = rows.map(row => toApiDeal(row, !pwCtx.premium && !unlockedIds.has(row.id)))
  } else {
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
  }

  return (
    <>
      <LandingNav />
      <main className="mx-auto max-w-[1140px] px-5 pb-24 pt-10">
        <DealFeed initialDeals={initialDeals} initialFilters={initialFilters} />
      </main>
    </>
  )
}
