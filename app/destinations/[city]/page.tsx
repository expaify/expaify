import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CITY_SLUGS } from '@/lib/cities'
import { getActiveDeals, type DealRow } from '@/lib/pipeline/dealDetection'
import { DealFeed, type ApiDeal } from '@/app/deals/DealFeed'
import { getPaywallContext, getFreeUnlockedDealIds } from '@/lib/paywall'
import { query } from '@/lib/db/client'

function toApiDeal(row: DealRow, locked: boolean): ApiDeal {
  if (locked) {
    return {
      id: row.id, hotelId: row.hotel_id,
      hotelName: 'Members-only deal', stars: null, photoUrl: null,
      city: row.city, dealPriceCents: 0, medianPriceCents: 0,
      discountPct: row.discount_pct, checkInWindow: row.check_in_window,
      nights: row.nights, snapshotCount: row.snapshot_count,
      otaLinks: {}, headline: null, isMock: row.is_mock,
      firstSeen: row.first_seen, locked: true,
    }
  }
  return {
    id: row.id, hotelId: row.hotel_id, hotelName: row.hotel_name,
    stars: row.stars, photoUrl: row.photo_url, city: row.city,
    dealPriceCents: row.deal_price_cents, medianPriceCents: row.median_price_cents,
    discountPct: row.discount_pct, checkInWindow: row.check_in_window,
    nights: row.nights, snapshotCount: row.snapshot_count,
    otaLinks: row.ota_links, headline: row.headline, isMock: row.is_mock,
    firstSeen: row.first_seen, locked: false,
  }
}

type PageProps = { params: Promise<{ city: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params
  const displayName = CITY_SLUGS[city]
  if (!displayName) return {}
  return {
    title: `Hotel deals in ${displayName} — expaify`,
    description: `expaify tracks hotels in ${displayName} daily and surfaces deals 30–50% below their 60-day average price.`,
    openGraph: {
      title: `Hotel deals in ${displayName}`,
      description: `Track hotel deals in ${displayName} — updated daily.`,
      url: `https://expaify.com/destinations/${city}`,
    },
    alternates: { canonical: `https://expaify.com/destinations/${city}` },
  }
}

export default async function CityPage({ params }: PageProps) {
  const { city } = await params
  const displayName = CITY_SLUGS[city]
  if (!displayName) notFound()

  const marketRes = await query<{ id: number }>(
    'SELECT id FROM tracked_markets WHERE city = $1 LIMIT 1',
    [displayName]
  ).catch(() => ({ rows: [] as { id: number }[] }))
  const marketId = marketRes.rows[0]?.id

  const [rows, pwCtx, unlockedIds] = await Promise.all([
    marketId
      ? getActiveDeals({ marketId, limit: 20, sort: 'newest', includeMock: false }).catch(() => [] as DealRow[])
      : Promise.resolve([] as DealRow[]),
    getPaywallContext(),
    getFreeUnlockedDealIds(),
  ])

  const initialDeals: ApiDeal[] = rows.map(row => {
    const locked = !pwCtx.premium && !unlockedIds.has(row.id)
    return toApiDeal(row, locked)
  })

  return (
    <main className="mx-auto max-w-[1200px] px-4 pb-24 pt-8 sm:px-6 lg:px-8">
      <nav aria-label="breadcrumb" className="hidden md:flex items-center mb-6">
        <Link
          href="/deals"
          className="text-[13px] text-[color:var(--text-2)] hover:text-[color:var(--text-1)] transition-colors"
        >
          All destinations
        </Link>
        <span className="mx-2 text-[color:var(--text-3)]" aria-hidden="true">›</span>
        <span className="text-[13px] text-[color:var(--text-1)] font-medium" aria-current="page">
          {displayName}
        </span>
      </nav>

      <h1 className="text-h2 text-[color:var(--ink)] font-display mb-1">
        Hotel deals in {displayName}
      </h1>
      <p className="text-[13px] text-[color:var(--text-2)] mb-8">
        Updated daily · {initialDeals.length} deal{initialDeals.length !== 1 ? 's' : ''} found
      </p>

      {initialDeals.length > 0 ? (
        <DealFeed initialDeals={initialDeals} defaultCity={displayName} />
      ) : (
        <div className="mt-4 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] px-8 py-14 text-center">
          <p className="text-[15px] font-medium text-[color:var(--text-1)] mb-2">
            No deals in {displayName} right now.
          </p>
          <p className="text-[13px] text-[color:var(--text-2)] mb-6">
            We check daily — prices can drop overnight.
          </p>
          <Link
            href="/deals"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[color:var(--brand)] px-5 py-2.5 text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
          >
            See all destinations
          </Link>
        </div>
      )}
    </main>
  )
}
