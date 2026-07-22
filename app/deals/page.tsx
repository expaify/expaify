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

export default async function DealsPage() {
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
    // Clearly disclosed, non-bookable samples while real data accumulates.
    initialDeals = generateMockDeals(3).map((d): ApiDeal => {
      return {
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
        otaLinks: {},
        headline: null,
        isMock: true,
        firstSeen: null,
        updatedAt: null,
        locked: false,
      }
    })
  }

  return (
    <>
      <LandingNav />
      <main className="mx-auto max-w-[1140px] px-5 pb-24 pt-10">
        <DealFeed initialDeals={initialDeals} initialPremium={pwCtx.premium} />
      </main>
    </>
  )
}
