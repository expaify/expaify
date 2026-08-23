import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CITY_SLUGS } from '@/lib/cities'
import { getActiveDeals, type DealRow } from '@/lib/pipeline/dealDetection'
import { DealFeed, type ApiDeal } from '@/app/deals/DealFeed'
import {
  deterministicHotelCriteriaVersion,
  hotelCriteriaFromDraft,
  resolveHotelResultsView,
  resolveHotelSearchCriteria,
} from '@/lib/hotels/searchCriteria'
import { getPaywallContext, getFreeUnlockedDealIds } from '@/lib/paywall'
import { query } from '@/lib/db/client'
import { auth } from '@/auth'
import { getSubscription, isPremium } from '@/lib/subscription'
import { WatchCityCta } from '@/app/components/WatchCityCta'
import { TRACKED_MARKETS, TRACKED_MARKET_NAMES } from '@/lib/trackedMarkets'
import { WatchCityPill } from '@/app/components/ui/WatchCityPill'
import { Reveal } from '@/app/components/ui/Reveal'
import { DESTINATION_CONTENT } from '@/lib/destinationContent'
import { DestinationSeoContent } from './DestinationSeoContent'
import { TrackOnMount } from '@/app/components/TrackOnMount'
import { TrackedLink } from '@/app/components/TrackedLink'

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

type PageProps = {
  params: Promise<{ city: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city } = await params
  const displayName = CITY_SLUGS[city]
  if (!displayName) return {}
  const content = DESTINATION_CONTENT[city]
  const title = content?.seo_title ?? `Hotel deals in ${displayName} — expaify`
  const description = content?.seo_description ?? `expaify tracks hotels in ${displayName} daily and surfaces deals at least 30% below their 60-day median price.`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://expaify.com/destinations/${city}`,
      type: 'website',
      images: [{ url: '/og.png', alt: `${displayName} hotel deals from expaify` }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/og.png'] },
    alternates: { canonical: `https://expaify.com/destinations/${city}` },
  }
}

export default async function CityPage({ params, searchParams }: PageProps) {
  const { city } = await params
  const requestedParams = await searchParams
  const displayName = CITY_SLUGS[city]
  if (!displayName) notFound()
  const content = DESTINATION_CONTENT[city]
  const trackedMarket = TRACKED_MARKETS.find(market => market.city === displayName)

  const criteriaResolution = resolveHotelSearchCriteria(requestedParams)
  const requestedView = resolveHotelResultsView(requestedParams)
  const restoredCriteria = criteriaResolution.status === 'valid' ? criteriaResolution.criteria : undefined
  if (
    criteriaResolution.status === 'invalid' || !requestedView ||
    (restoredCriteria && (restoredCriteria.destination.state !== 'selected' || restoredCriteria.destination.city !== displayName))
  ) {
    return (
      <main className="mx-auto max-w-[760px] px-5 py-16">
        <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-6 text-center">
          <h1 className="text-h2 text-[color:var(--text-1)]">We couldn&apos;t restore this search.</h1>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">The search link is incomplete or no longer valid.</p>
          <Link href={`/destinations/${city}`} className="btn btn-primary mt-5 min-h-11 px-6">Start a new search</Link>
        </section>
      </main>
    )
  }

  const criteria = restoredCriteria ?? hotelCriteriaFromDraft(
    { city: displayName, dateFrom: '', dateTo: '' },
    deterministicHotelCriteriaVersion({ city: displayName, dateFrom: '', dateTo: '', source: 'destination_page' }),
    'destination_page',
  )
  const pwCtx = await getPaywallContext()
  const effectiveView = pwCtx.premium ? requestedView : { minDiscount: 30, maxPriceCents: null, minStars: 0, sort: 'newest' as const }
  let initialError = false

  const marketRes = await query<{ id: number }>(
    'SELECT id FROM tracked_markets WHERE city = $1 LIMIT 1',
    [displayName]
  ).catch(() => {
    initialError = true
    return { rows: [] as { id: number }[] }
  })
  const marketId = marketRes.rows[0]?.id
  if (!marketId) initialError = true

  const session = await auth().catch(() => null)

  const [rows, unlockedIds, sub] = await Promise.all([
    marketId
      ? getActiveDeals({
          marketId,
          limit: 20,
          sort: effectiveView.sort,
          includeMock: false,
          minDiscount: effectiveView.minDiscount,
          maxPriceCents: effectiveView.maxPriceCents ?? undefined,
          minStars: effectiveView.minStars || undefined,
          dateFrom: criteria.dates.semantic === 'checkin_window' ? criteria.dates.dateFrom : undefined,
          dateTo: criteria.dates.semantic === 'checkin_window' ? criteria.dates.dateTo : undefined,
        }).catch(() => {
          initialError = true
          return [] as DealRow[]
        })
      : Promise.resolve([] as DealRow[]),
    getFreeUnlockedDealIds(pwCtx.userId),
    session?.user?.id ? getSubscription(session.user.id).catch(() => null) : Promise.resolve(null),
  ])

  const showWatchPill = !!sub && isPremium(sub.status) && TRACKED_MARKET_NAMES.includes(displayName)

  const initialDeals: ApiDeal[] = rows.map(row => {
    const locked = !pwCtx.premium && !unlockedIds.has(row.id)
    return toApiDeal(row, locked)
  })
  const premium = sub ? isPremium(sub.status) : false
  const watchlist = sub?.watchlist ?? []
  const watchTier = !session?.user?.id ? 'anonymous' : premium ? 'premium' : 'free'
  const isWatching = watchlist.includes(displayName)
  const cityEntries = Object.entries(CITY_SLUGS)
  const currentCityIndex = cityEntries.findIndex(([slug]) => slug === city)
  const nearbyDestinations = [
    ...cityEntries.slice(currentCityIndex + 1),
    ...cityEntries.slice(0, currentCityIndex),
  ].slice(0, 4)

  const structuredData = content ? {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `https://expaify.com/destinations/${city}#webpage`,
        url: `https://expaify.com/destinations/${city}`,
        name: content.seo_title,
        description: content.seo_description,
      },
      {
        '@type': 'FAQPage',
        '@id': `https://expaify.com/destinations/${city}#faq`,
        mainEntity: content.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://expaify.com/' },
          { '@type': 'ListItem', position: 2, name: 'Destinations', item: 'https://expaify.com/deals' },
          { '@type': 'ListItem', position: 3, name: displayName, item: `https://expaify.com/destinations/${city}` },
        ],
      },
    ],
  } : null

  return (
    <main className="reveal-scope mx-auto max-w-[1200px] px-4 pb-24 pt-8 sm:px-6 lg:px-8">
      <noscript>
        <style>{`.reveal-scope .reveal, .reveal-scope .reveal-bar { opacity: 1 !important; transform: none !important; width: var(--bar-target, 100%) !important; }`}</style>
      </noscript>
      {content ? <TrackOnMount event="destination_hub_view" props={{ city: displayName }} /> : null}
      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
        />
      ) : null}
      <nav aria-label="breadcrumb" className="hidden md:flex items-center mb-6">
        <Link
          href="/"
          className="text-sm text-[color:var(--text-2)] hover:text-[color:var(--text-1)] transition-colors"
        >
          Home
        </Link>
        <span className="mx-2 text-[color:var(--text-3)]" aria-hidden="true">›</span>
        <Link
          href="/deals"
          className="text-sm text-[color:var(--text-2)] hover:text-[color:var(--text-1)] transition-colors"
        >
          Destinations
        </Link>
        <span className="mx-2 text-[color:var(--text-3)]" aria-hidden="true">›</span>
        <span className="text-sm text-[color:var(--text-1)] font-medium" aria-current="page">
          {displayName}
        </span>
      </nav>

      {trackedMarket ? (
        <Reveal>
          <div className="relative h-[260px] overflow-hidden rounded-[var(--radius-card)] bg-[color:var(--primary)] sm:h-[360px]">
            <img
              src={trackedMarket.photoUrl}
              alt={trackedMarket.photoAlt}
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" aria-hidden />
            <h1 className="absolute inset-x-0 bottom-0 p-6 font-display text-h2 text-white sm:p-8">
              {content?.h1 ?? `Hotel deals in ${displayName} today`}
            </h1>
          </div>
        </Reveal>
      ) : (
        <h1 className="text-h2 text-[color:var(--ink)] font-display mb-1">
          {content?.h1 ?? `Hotel deals in ${displayName} today`}
        </h1>
      )}
      {showWatchPill && sub && (
        <div className="mb-3 mt-2">
          <WatchCityPill
            city={displayName}
            initialWatching={sub.watchlist.includes(displayName)}
            initialCount={sub.watchlist.length}
          />
        </div>
      )}
      <p className="text-sm text-[color:var(--text-2)] mb-8">
        {initialDeals.length === 0
          ? 'Checked daily — no active deals right now'
          : `Updated daily · ${initialDeals.length} deal${initialDeals.length !== 1 ? 's' : ''} found`}
      </p>
      {content ? (
        <Reveal>
          <p className="mb-10 max-w-[820px] text-body leading-7 text-[color:var(--text-2)]">{content.intro}</p>
        </Reveal>
      ) : null}

      <DealFeed key={criteria.criteriaVersion} initialDeals={initialDeals} defaultCity={displayName} premium={pwCtx.premium} signedIn={Boolean(pwCtx.userId)} freeUnlockedThisWeek={pwCtx.freeUnlockedThisWeek} freeUnlockLimit={pwCtx.freeUnlockLimit} initialCriteria={criteria} initialView={effectiveView} initialError={initialError} />
      {initialDeals.length === 0 && !initialError ? (
        <div className="mt-6 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-8 text-center">
          <p className="mb-4 text-sm text-[color:var(--text-2)]">Get notified when a current {displayName} deal appears.</p>
          <TrackedLink
            href="/login?intent=free"
            analyticsEvent="destination_cta_free_alerts"
            analyticsProps={{ city: displayName }}
            className="btn btn-conversion min-h-11 px-5"
          >
            Get free alerts for {displayName}
          </TrackedLink>
          <WatchCityCta city={displayName} tier={watchTier} watching={isWatching} watchlist={watchlist} />
        </div>
      ) : null}

      {content ? <DestinationSeoContent city={displayName} content={content} relatedDestinations={nearbyDestinations} /> : null}

      <Reveal>
        <section className="mt-10 border-t border-[color:var(--border)] pt-8" aria-labelledby="nearby-destinations-heading">
          <h2 id="nearby-destinations-heading" className="text-body font-bold text-[color:var(--text-1)]">
            Explore more destinations
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {nearbyDestinations.map(([slug, name]) => (
              <Link
                key={slug}
                href={`/destinations/${slug}`}
                className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-4 py-3 text-sm font-medium text-[color:var(--text-1)] transition-colors hover:bg-[color:var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--text-3)]"
              >
                {name}
              </Link>
            ))}
          </div>
        </section>
      </Reveal>
    </main>
  )
}
