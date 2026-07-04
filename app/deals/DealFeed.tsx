'use client'

import { useState, useCallback } from 'react'
import { DealCard } from '../components/ui/DealCard'
import { LockedDealCard } from '../components/ui/LockedDealCard'
import { SearchBar } from '../components/ui/SearchBar'

const CITIES = [
  'Miami', 'New York', 'Cancún', 'Paris', 'Rome', 'Barcelona', 'Lisbon',
  'London', 'Tokyo', 'Bangkok', 'Dubai', 'Las Vegas', 'Orlando', 'San Juan',
  'Tulum', 'Amsterdam', 'Athens', 'Punta Cana', 'Charlotte', 'Nashville',
]

const DISCOUNT_OPTIONS = [
  { label: 'Any discount', value: 0 },
  { label: '20%+ off', value: 20 },
  { label: '30%+ off', value: 30 },
  { label: '40%+ off', value: 40 },
]

const STARS_OPTIONS = [
  { label: 'Any stars', value: 0 },
  { label: '3★ & up', value: 3 },
  { label: '4★ & up', value: 4 },
  { label: '5★ only', value: 5 },
]

type ApiDeal = {
  id: string
  hotelId: string
  hotelName: string
  stars: number | null
  photoUrl: string | null
  city: string
  dealPriceCents: number
  medianPriceCents: number
  discountPct: number
  checkInWindow: string
  nights: number
  snapshotCount: number
  otaLinks: Record<string, string>
  headline: string | null
  isMock: boolean
  firstSeen: string | null
  locked: boolean
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] bg-[color:var(--surface)]">
      <div className="skeleton aspect-[3/2]" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-4 w-16 rounded-full" />
        <div className="skeleton h-5 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
        <div className="skeleton mt-2 h-8 w-24 rounded-full" />
      </div>
    </div>
  )
}

const PAGE_SIZE = 12

export function DealFeed() {
  const [deals, setDeals] = useState<ApiDeal[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState<'hotels' | 'flights'>('hotels')
  const [city, setCity] = useState('')
  const [minDiscount, setMinDiscount] = useState(20)
  const [maxPriceCents, setMaxPriceCents] = useState<number | null>(null)
  const [minStars, setMinStars] = useState(0)
  const [sort, setSort] = useState<'newest' | 'discount'>('newest')
  const [offset, setOffset] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [initialised, setInitialised] = useState(false)

  const fetchDeals = useCallback(async (
    opts: { city: string; minDiscount: number; maxPriceCents: number | null; minStars: number; sort: 'newest' | 'discount'; offset: number; append: boolean }
  ) => {
    const { append } = opts
    if (!append) setLoading(true)
    else setLoadingMore(true)
    setError(false)

    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(opts.offset),
      min_discount: String(opts.minDiscount),
      sort: opts.sort,
    })
    if (opts.city) params.set('city', opts.city)
    if (opts.maxPriceCents) params.set('max_price_cents', String(opts.maxPriceCents))
    if (opts.minStars > 0) params.set('min_stars', String(opts.minStars))

    try {
      const res = await fetch(`/api/deals?${params}`)
      if (!res.ok) throw new Error('fetch failed')
      const data: { deals: ApiDeal[]; total: number } = await res.json()
      setDeals(prev => append ? [...prev, ...data.deals] : data.deals)
      setTotal(data.total)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // Fetch on first render
  if (!initialised) {
    setInitialised(true)
    fetchDeals({ city, minDiscount, maxPriceCents, minStars, sort, offset: 0, append: false })
  }

  function applyFilter(next: { city?: string; minDiscount?: number; maxPriceCents?: number | null; minStars?: number; sort?: 'newest' | 'discount' }) {
    const nextCity = next.city ?? city
    const nextDiscount = next.minDiscount ?? minDiscount
    const nextMax = next.maxPriceCents !== undefined ? next.maxPriceCents : maxPriceCents
    const nextStars = next.minStars !== undefined ? next.minStars : minStars
    const nextSort = next.sort ?? sort
    setCity(nextCity)
    setMinDiscount(nextDiscount)
    setMaxPriceCents(nextMax)
    setMinStars(nextStars)
    setSort(nextSort)
    setOffset(0)
    fetchDeals({ city: nextCity, minDiscount: nextDiscount, maxPriceCents: nextMax, minStars: nextStars, sort: nextSort, offset: 0, append: false })
  }

  function handleSearchResult(result: { city?: string; maxPriceCents?: number; minDiscount?: number }) {
    applyFilter({
      city: result.city ?? '',
      minDiscount: result.minDiscount ?? 0,
      maxPriceCents: result.maxPriceCents ?? null,
    })
  }

  function clearSearch() {
    applyFilter({ city: '', minDiscount: 20, maxPriceCents: null })
  }

  function loadMore() {
    const nextOffset = offset + PAGE_SIZE
    setOffset(nextOffset)
    fetchDeals({ city, minDiscount, maxPriceCents, minStars, sort, offset: nextOffset, append: true })
  }

  const pillBase = 'rounded-[var(--radius-pill)] px-4 py-2 text-[13px] font-medium transition-colors duration-100 cursor-pointer'
  const pillActive = `${pillBase} bg-[color:var(--primary)] text-white`
  const pillInactive = `${pillBase} bg-white border border-[color:var(--line-ivory)] text-[color:var(--ink)] hover:border-[color:var(--primary-soft)]`

  return (
    <>
      {/* Tab bar */}
      <div className="mt-4 mb-6 flex gap-2">
        {(['hotels', 'flights'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={
              activeTab === tab
                ? 'rounded-[var(--radius-pill)] bg-[color:var(--primary)] px-5 py-2 text-[13px] font-medium text-white'
                : 'rounded-[var(--radius-pill)] border border-[color:var(--line-ivory)] bg-white px-5 py-2 text-[13px] font-medium text-[color:var(--ink)] hover:border-[color:var(--primary-soft)]'
            }
          >
            {tab === 'hotels' ? 'Hotels' : 'Flights'}
          </button>
        ))}
      </div>

      {activeTab === 'flights' ? (
        <div className="py-24 text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
          </svg>
          <h2 className="mt-4 font-display text-[24px] font-bold text-[color:var(--ink)]">Coming soon</h2>
          <p className="mx-auto mt-2 max-w-[340px] text-[14px] text-[color:var(--ink-soft)]">
            We&apos;re working on flight deals across our 20 destinations. Sign up for alerts and we&apos;ll let you know when they&apos;re live.
          </p>
          <a href="/account" className="btn btn-primary mt-6 inline-block px-8">
            Get notified
          </a>
        </div>
      ) : (
        <>
          {/* Natural language search */}
          <div className="mb-4">
            <SearchBar onResult={handleSearchResult} onClear={clearSearch} />
          </div>

          {/* Filter bar */}
          <div className="mb-8 flex flex-wrap gap-2">
            <select
              aria-label="Filter by destination"
              value={city}
              onChange={e => applyFilter({ city: e.target.value })}
              className="appearance-none rounded-[var(--radius-pill)] border border-[color:var(--line-ivory)] bg-white px-4 py-2 text-[13px] font-medium text-[color:var(--ink)] cursor-pointer"
            >
              <option value="">All destinations</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              aria-label="Minimum discount"
              value={minDiscount}
              onChange={e => applyFilter({ minDiscount: Number(e.target.value) })}
              className="appearance-none rounded-[var(--radius-pill)] border border-[color:var(--line-ivory)] bg-white px-4 py-2 text-[13px] font-medium text-[color:var(--ink)] cursor-pointer"
            >
              {DISCOUNT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <select
              aria-label="Minimum star rating"
              value={minStars}
              onChange={e => applyFilter({ minStars: Number(e.target.value) })}
              className="appearance-none rounded-[var(--radius-pill)] border border-[color:var(--line-ivory)] bg-white px-4 py-2 text-[13px] font-medium text-[color:var(--ink)] cursor-pointer"
            >
              {STARS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <button
              type="button"
              onClick={() => applyFilter({ sort: 'newest' })}
              className={sort === 'newest' ? pillActive : pillInactive}
            >
              Newest
            </button>
            <button
              type="button"
              onClick={() => applyFilter({ sort: 'discount' })}
              className={sort === 'discount' ? pillActive : pillInactive}
            >
              Biggest discount
            </button>
          </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-6 grid-cols-1 min-[480px]:grid-cols-2 min-[900px]:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="py-20 text-center">
          <p className="font-display text-[20px] font-bold text-[color:var(--ink)]">Couldn&apos;t load deals right now.</p>
          <button
            type="button"
            onClick={() => fetchDeals({ city, minDiscount, maxPriceCents, minStars, sort, offset: 0, append: false })}
            className="btn btn-primary mt-4 px-8"
          >
            Retry
          </button>
        </div>
      ) : deals.length === 0 ? (
        <>
          <div className="grid gap-6 grid-cols-1 min-[480px]:grid-cols-2 min-[900px]:grid-cols-3 opacity-30">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <div className="mt-10 text-center">
            <p className="font-display text-[20px] font-bold text-[color:var(--ink)]">We&apos;re building your feed.</p>
            <p className="mt-2 text-[14px] text-[color:var(--ink-soft)]">
              Check back in a few hours — our pipeline runs daily across 20 destinations.
            </p>
          </div>
        </>
      ) : (
        <div className="grid gap-6 grid-cols-1 min-[480px]:grid-cols-2 min-[900px]:grid-cols-3">
          {deals.map(deal =>
            deal.locked ? (
              <LockedDealCard
                key={deal.id}
                placeholderName="Members-only deal"
                placeholderCity={deal.city}
                stars={deal.stars ?? 4}
                photoUrl={deal.photoUrl ?? undefined}
                joinHref="/join"
              />
            ) : (
              <DealCard
                key={deal.id}
                href={deal.isMock ? undefined : `/deals/${deal.id}`}
                deal={{
                  id: deal.id,
                  hotelName: deal.hotelName,
                  city: deal.city,
                  stars: deal.stars ?? 3,
                  photoUrl: deal.photoUrl ?? undefined,
                  dealPrice: { priceCents: deal.dealPriceCents, currency: 'USD' },
                  medianPrice: { priceCents: deal.medianPriceCents, currency: 'USD' },
                  discountPct: deal.discountPct,
                  checkInWindow: deal.checkInWindow,
                  snapshotCount: deal.snapshotCount,
                  links: deal.otaLinks,
                  headline: deal.headline ?? undefined,
                  isMock: deal.isMock,
                  firstSeen: deal.firstSeen ?? undefined,
                }}
              />
            )
          )}
        </div>
      )}

          {/* Load more */}
          {!loading && !error && total !== null && deals.length < total && (
            <div className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="btn btn-primary px-8 disabled:opacity-60"
              >
                {loadingMore ? 'Loading…' : 'Load 12 more deals'}
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
