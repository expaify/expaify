'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DealCard } from '../components/ui/DealCard'
import { LockedDealCard } from '../components/ui/LockedDealCard'
import { SearchBar } from '../components/ui/SearchBar'
import type { DealSearchFilters } from '@/lib/ai/dealSearchFilters'
import { CITY_DISPLAY_TO_SLUG } from '@/lib/cities'

const CITIES = [
  'Miami', 'New York', 'Cancún', 'Paris', 'Rome', 'Barcelona', 'Lisbon',
  'London', 'Tokyo', 'Bangkok', 'Dubai', 'Las Vegas', 'Orlando', 'San Juan',
  'Tulum', 'Amsterdam', 'Athens', 'Punta Cana', 'Charlotte', 'Nashville',
]

const DEFAULT_MIN_DISCOUNT = 20

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

const MAX_PRICE_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: 'Any price', value: null },
  { label: 'Under $100', value: 100_00 },
  { label: 'Under $150', value: 150_00 },
  { label: 'Under $200', value: 200_00 },
  { label: 'Under $300', value: 300_00 },
]

export type ApiDeal = {
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

type DealFetchOpts = {
  city: string
  minDiscount: number
  maxPriceCents: number | null
  minStars: number
  dateFrom: string
  dateTo: string
  sort: 'newest' | 'discount'
  offset: number
  append: boolean
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

type FilterOption = { label: string; selected: boolean; onSelect: () => void }

type FilterPillProps = {
  label: string
  activeLabel: string | null
  disabled: boolean
  options: FilterOption[]
  onClear: () => void
}

/** Outline pill that opens a popover of options. Active filters render as a
    teal fill with white text and an × that clears the filter. */
function FilterPill({ label, activeLabel, disabled, options, onClear }: FilterPillProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocPointer(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('touchstart', onDocPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('touchstart', onDocPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const active = activeLabel !== null

  return (
    <div ref={rootRef} className="relative">
      <span
        className={
          active
            ? 'inline-flex items-stretch rounded-[var(--radius-pill)] border-[1.5px] border-[color:var(--primary)] bg-[color:var(--primary)] text-white'
            : 'inline-flex items-stretch rounded-[var(--radius-pill)] border-[1.5px] border-[color:var(--line-white)] bg-[color:var(--surface)] text-[color:var(--ink)]'
        }
      >
        <button
          ref={btnRef}
          type="button"
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
          className={`flex min-h-[36px] items-center gap-1.5 rounded-l-[var(--radius-pill)] pl-4 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'pr-1' : 'rounded-r-[var(--radius-pill)] pr-3'}`}
        >
          {active ? activeLabel : label}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {active && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setOpen(false)
              onClear()
            }}
            aria-label={`Clear ${label.toLowerCase()} filter`}
            className="flex items-center rounded-r-[var(--radius-pill)] pl-1 pr-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </span>

      {open && (
        <div
          role="menu"
          aria-label={`${label} options`}
          className="absolute left-0 top-full z-30 mt-2 max-h-[320px] min-w-[176px] overflow-y-auto rounded-[var(--radius-input)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-card-hover)] min-[680px]:left-auto min-[680px]:right-0"
        >
          {options.map(opt => (
            <button
              key={opt.label}
              type="button"
              role="menuitemradio"
              aria-checked={opt.selected}
              onClick={() => {
                opt.onSelect()
                setOpen(false)
                btnRef.current?.focus()
              }}
              className={`block w-full rounded-[var(--radius-input)] px-3 py-2 text-left text-[13px] ${
                opt.selected
                  ? 'bg-[color:var(--primary-soft)] font-medium text-[color:var(--primary-deep)]'
                  : 'text-[color:var(--ink)] hover:bg-[color:var(--line-ivory)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const PAGE_SIZE = 12

type DealFeedProps = {
  initialDeals?: ApiDeal[]
  defaultCity?: string
}

export function DealFeed({ initialDeals, defaultCity }: DealFeedProps = {}) {
  const router = useRouter()
  const [deals, setDeals] = useState<ApiDeal[]>(initialDeals ?? [])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(!initialDeals)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState<'hotels' | 'flights'>('hotels')
  const [city, setCity] = useState(defaultCity ?? '')
  const [minDiscount, setMinDiscount] = useState(DEFAULT_MIN_DISCOUNT)
  const [maxPriceCents, setMaxPriceCents] = useState<number | null>(null)
  const [minStars, setMinStars] = useState(0)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sort, setSort] = useState<'newest' | 'discount'>('newest')
  const [offset, setOffset] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [premium, setPremium] = useState(false)

  const fetchDeals = useCallback(async (opts: DealFetchOpts) => {
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
    if (opts.dateFrom) params.set('date_from', opts.dateFrom)
    if (opts.dateTo) params.set('date_to', opts.dateTo)

    try {
      const res = await fetch(`/api/deals?${params}`)
      if (!res.ok) throw new Error('fetch failed')
      const data: { deals: ApiDeal[]; total: number; premium?: boolean } = await res.json()
      setDeals(prev => append ? [...prev, ...data.deals] : data.deals)
      // The API reports the page count, not the full set, so a full page is
      // the only reliable "there may be more" signal.
      setHasMore(data.deals.length === PAGE_SIZE)
      setPremium(Boolean(data.premium))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    // Skip initial fetch when deals were pre-fetched server-side
    if (initialDeals) return
    fetchDeals({ city, minDiscount, maxPriceCents, minStars, dateFrom, dateTo, sort, offset: 0, append: false })
    // Initial feed load only; filter changes call fetchDeals through applyFilter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyFilter(next: {
    city?: string
    minDiscount?: number
    maxPriceCents?: number | null
    minStars?: number
    dateFrom?: string
    dateTo?: string
    sort?: 'newest' | 'discount'
  }) {
    const nextCity = next.city ?? city
    const nextDiscount = next.minDiscount ?? minDiscount
    const nextMax = next.maxPriceCents !== undefined ? next.maxPriceCents : maxPriceCents
    const nextStars = next.minStars !== undefined ? next.minStars : minStars
    const nextDateFrom = next.dateFrom !== undefined ? next.dateFrom : dateFrom
    const nextDateTo = next.dateTo !== undefined ? next.dateTo : dateTo
    const nextSort = next.sort ?? sort
    setCity(nextCity)
    setMinDiscount(nextDiscount)
    setMaxPriceCents(nextMax)
    setMinStars(nextStars)
    setDateFrom(nextDateFrom)
    setDateTo(nextDateTo)
    setSort(nextSort)
    setOffset(0)
    fetchDeals({
      city: nextCity,
      minDiscount: nextDiscount,
      maxPriceCents: nextMax,
      minStars: nextStars,
      dateFrom: nextDateFrom,
      dateTo: nextDateTo,
      sort: nextSort,
      offset: 0,
      append: false,
    })
  }

  function handleSearchResult(result: DealSearchFilters) {
    applyFilter({
      city: result.city ?? '',
      minDiscount: result.min_discount ?? 0,
      maxPriceCents: result.max_price ? result.max_price * 100 : null,
      minStars: result.min_stars ?? 0,
      dateFrom: result.date_from ?? '',
      dateTo: result.date_to ?? '',
    })
  }

  function clearSearch() {
    applyFilter({ city: '', minDiscount: DEFAULT_MIN_DISCOUNT, maxPriceCents: null, minStars: 0, dateFrom: '', dateTo: '' })
  }

  function loadMore() {
    if (loading || loadingMore || error || !hasMore) return
    const nextOffset = offset + PAGE_SIZE
    setOffset(nextOffset)
    fetchDeals({ city, minDiscount, maxPriceCents, minStars, dateFrom, dateTo, sort, offset: nextOffset, append: true })
  }

  // Infinite scroll: a sentinel below the grid loads the next page when it
  // nears the viewport. New cards arrive as skeleton cards, never a spinner.
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef(loadMore)
  loadMoreRef.current = loadMore

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) loadMoreRef.current()
      },
      { rootMargin: '600px 0px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [activeTab, loading, error, deals.length])

  const hasActiveFilters = Boolean(city || minDiscount !== DEFAULT_MIN_DISCOUNT || maxPriceCents || minStars || dateFrom || dateTo)

  // SearchBar can set a max price that is not one of the popover options.
  const maxPriceLabel = maxPriceCents
    ? (MAX_PRICE_OPTIONS.find(o => o.value === maxPriceCents)?.label ?? `Under $${Math.round(maxPriceCents / 100)}`)
    : null
  const activeDiscount = DISCOUNT_OPTIONS.find(o => o.value === minDiscount)
  const activeStars = STARS_OPTIONS.find(o => o.value === minStars)

  const sortSegBase = 'rounded-[var(--radius-pill)] px-4 py-1.5 text-[13px] font-medium transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50'

  const gridClass = 'grid grid-cols-1 gap-6 min-[680px]:grid-cols-2 min-[1024px]:grid-cols-3'

  return (
    <>
      {/* Header: title left, premium filter pills right */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h2 className="text-h2 text-[color:var(--ink)]">Today&rsquo;s catches</h2>
          <p className="mt-1 text-[13px] text-[color:var(--ink-soft)]">
            Deals across 20 destinations, updated daily
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!defaultCity && (
            <FilterPill
              label="Destination"
              activeLabel={city || null}
              disabled={!premium}
              onClear={() => applyFilter({ city: '' })}
              options={[
                { label: 'All destinations', selected: !city, onSelect: () => applyFilter({ city: '' }) },
                ...CITIES.map(c => ({
                  label: c,
                  selected: city === c,
                  onSelect: () => {
                    const slug = CITY_DISPLAY_TO_SLUG[c]
                    if (slug) router.push(`/destinations/${slug}`)
                    else applyFilter({ city: c })
                  },
                })),
              ]}
            />
          )}
          <FilterPill
            label="Min discount"
            activeLabel={minDiscount !== DEFAULT_MIN_DISCOUNT ? (activeDiscount?.label ?? `${minDiscount}%+ off`) : null}
            disabled={!premium}
            onClear={() => applyFilter({ minDiscount: DEFAULT_MIN_DISCOUNT })}
            options={DISCOUNT_OPTIONS.map(o => ({
              label: o.label,
              selected: minDiscount === o.value,
              onSelect: () => applyFilter({ minDiscount: o.value }),
            }))}
          />
          <FilterPill
            label="Stars"
            activeLabel={minStars > 0 ? (activeStars?.label ?? `${minStars}★ & up`) : null}
            disabled={!premium}
            onClear={() => applyFilter({ minStars: 0 })}
            options={STARS_OPTIONS.map(o => ({
              label: o.label,
              selected: minStars === o.value,
              onSelect: () => applyFilter({ minStars: o.value }),
            }))}
          />
          <FilterPill
            label="Max price"
            activeLabel={maxPriceLabel}
            disabled={!premium}
            onClear={() => applyFilter({ maxPriceCents: null })}
            options={MAX_PRICE_OPTIONS.map(o => ({
              label: o.label,
              selected: maxPriceCents === o.value,
              onSelect: () => applyFilter({ maxPriceCents: o.value }),
            }))}
          />
        </div>
      </div>

      {/* Tab bar: Hotels active, Flights faint */}
      <div className="mb-6 mt-6 flex items-center gap-1">
        <button
          type="button"
          aria-pressed={activeTab === 'hotels'}
          onClick={() => setActiveTab('hotels')}
          className={
            activeTab === 'hotels'
              ? 'rounded-[var(--radius-pill)] bg-[color:var(--primary)] px-5 py-2 text-[13px] font-medium text-white'
              : 'rounded-[var(--radius-pill)] px-5 py-2 text-[13px] font-medium text-[color:var(--ink-faint)] hover:text-[color:var(--ink)]'
          }
        >
          Hotels
        </button>
        <button
          type="button"
          aria-pressed={activeTab === 'flights'}
          onClick={() => setActiveTab('flights')}
          className={
            activeTab === 'flights'
              ? 'rounded-[var(--radius-pill)] bg-[color:var(--primary)] px-5 py-2 text-[13px] font-medium text-white'
              : 'rounded-[var(--radius-pill)] px-5 py-2 text-[13px] font-medium text-[color:var(--ink-faint)] hover:text-[color:var(--ink)]'
          }
        >
          Flights
        </button>
      </div>

      {activeTab === 'flights' ? (
        <div className="py-24 text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto" aria-hidden>
            <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
          </svg>
          <h3 className="mt-4 text-h3 text-[color:var(--ink)]">Flight deals land soon.</h3>
          <p className="mt-2 text-[14px] text-[color:var(--ink-soft)]">Hotels first.</p>
        </div>
      ) : (
        <>
          {/* Natural language search */}
          <div className="mb-4">
            <SearchBar premium={premium} onResult={handleSearchResult} onClear={clearSearch} />
          </div>

          {/* Sort: segmented pill */}
          <div className={`flex flex-wrap items-center gap-3 ${!premium && !loading ? 'mb-2' : 'mb-8'}`}>
            <div
              role="group"
              aria-label="Sort deals"
              className="inline-flex rounded-[var(--radius-pill)] border-[1.5px] border-[color:var(--line-white)] bg-[color:var(--surface)] p-[3px]"
            >
              <button
                type="button"
                disabled={!premium}
                aria-pressed={sort === 'newest'}
                onClick={() => applyFilter({ sort: 'newest' })}
                className={`${sortSegBase} ${sort === 'newest' ? 'bg-[color:var(--primary)] text-white' : 'text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]'}`}
              >
                Newest
              </button>
              <button
                type="button"
                disabled={!premium}
                aria-pressed={sort === 'discount'}
                onClick={() => applyFilter({ sort: 'discount' })}
                className={`${sortSegBase} ${sort === 'discount' ? 'bg-[color:var(--primary)] text-white' : 'text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]'}`}
              >
                Biggest discount
              </button>
            </div>
          </div>

          {!premium && !loading && (
            <p className="mb-8 flex items-center gap-1.5 text-[12px] font-medium text-[color:var(--ink-soft)]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              Filters and sorting are included with Premium.{' '}
              <a href="/join" className="font-bold text-[color:var(--primary)] no-underline hover:underline">
                Unlock with Premium
              </a>
            </p>
          )}

          {/* Grid */}
          {loading ? (
            <div className={gridClass}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : error ? (
            <div className="py-20 text-center">
              <p className="font-display text-[20px] font-bold text-[color:var(--ink)]">Couldn&apos;t load deals right now.</p>
              <button
                type="button"
                onClick={() => fetchDeals({ city, minDiscount, maxPriceCents, minStars, dateFrom, dateTo, sort, offset: 0, append: false })}
                className="btn btn-primary mt-4 px-8"
              >
                Retry
              </button>
            </div>
          ) : deals.length === 0 ? (
            <>
              <div className={`${gridClass} opacity-30`}>
                {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
              <div className="mt-10 text-center">
                <p className="font-display text-[20px] font-bold text-[color:var(--ink)]">
                  {hasActiveFilters ? 'No deals match those filters.' : 'We’re building your feed.'}
                </p>
                <p className="mt-2 text-[14px] text-[color:var(--ink-soft)]">
                  {hasActiveFilters
                    ? 'Try widening your filters or clearing the search.'
                    : 'Check back in a few hours — our pipeline runs daily across 20 destinations.'}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className={gridClass}>
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
                {loadingMore && Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={`more-${i}`} />)}
              </div>
              <div ref={sentinelRef} aria-hidden className="h-px" />
            </>
          )}
        </>
      )}
    </>
  )
}
