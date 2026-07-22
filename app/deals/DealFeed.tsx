'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DealCard } from '../components/ui/DealCard'
import { LockedDealCard } from '../components/ui/LockedDealCard'
import { SearchBar } from '../components/ui/SearchBar'
import type { DealSearchFilters } from '@/lib/ai/dealSearchFilters'
import { CITY_DISPLAY_TO_SLUG } from '@/lib/cities'
import { track } from '@/lib/analytics'

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
  updatedAt: string | null
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
  // Full-set count from the API when it provides one; enables the
  // "N deals are hidden by your filters" line in the filtered-empty state.
  const [unfilteredTotal, setUnfilteredTotal] = useState<number | null>(null)
  // Remounts SearchBar on Clear-all so its internal input state resets too.
  const [searchKey, setSearchKey] = useState(0)

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
      const data: { deals: ApiDeal[]; total: number; premium?: boolean; unfilteredTotal?: number } = await res.json()
      setDeals(prev => append ? [...prev, ...data.deals] : data.deals)
      // The API reports the page count, not the full set, so a full page is
      // the only reliable "there may be more" signal.
      setHasMore(data.deals.length === PAGE_SIZE)
      setPremium(Boolean(data.premium))
      setUnfilteredTotal(typeof data.unfilteredTotal === 'number' ? data.unfilteredTotal : null)
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
    // On a city-scoped feed the city resets to the page's city, never '' —
    // a Miami page must not silently become an all-cities feed.
    applyFilter({ city: defaultCity ?? '', minDiscount: DEFAULT_MIN_DISCOUNT, maxPriceCents: null, minStars: 0, dateFrom: '', dateTo: '' })
  }

  function handleClearAll() {
    track('feed_clear_all_clicked', { source: 'empty_state' })
    focusGridOnLoad.current = true
    setSearchKey(k => k + 1)
    clearSearch()
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

  // After Clear-all resolves, the empty block unmounts; move focus to the
  // results grid so keyboard users aren't dropped to <body>.
  const gridRef = useRef<HTMLDivElement>(null)
  const focusGridOnLoad = useRef(false)
  useEffect(() => {
    if (!loading && focusGridOnLoad.current) {
      focusGridOnLoad.current = false
      gridRef.current?.focus()
    }
  }, [loading])

  // On a city-scoped feed the fixed city is not "a filter the user applied".
  const cityFiltered = city !== (defaultCity ?? '')
  const hasActiveFilters = Boolean(cityFiltered || minDiscount !== DEFAULT_MIN_DISCOUNT || maxPriceCents || minStars || dateFrom || dateTo)

  // SearchBar can set a max price that is not one of the popover options.
  const maxPriceLabel = maxPriceCents
    ? (MAX_PRICE_OPTIONS.find(o => o.value === maxPriceCents)?.label ?? `Under $${Math.round(maxPriceCents / 100)}`)
    : null
  const activeDiscount = DISCOUNT_OPTIONS.find(o => o.value === minDiscount)
  const activeStars = STARS_OPTIONS.find(o => o.value === minStars)

  // Removable chips for the filtered-empty block — one per active filter,
  // reusing the header pills' active labels. The fixed city on a city-scoped
  // feed gets no chip.
  function removeChip(filter: string, patch: Parameters<typeof applyFilter>[0]) {
    track('feed_filter_chip_removed', { filter })
    applyFilter(patch)
  }
  const fmtChipDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const activeChips: Array<{ key: string; label: string; onRemove: () => void }> = []
  if (cityFiltered && city && !defaultCity) {
    activeChips.push({ key: 'city', label: city, onRemove: () => removeChip('city', { city: '' }) })
  }
  if (minDiscount !== DEFAULT_MIN_DISCOUNT) {
    activeChips.push({
      key: 'minDiscount',
      label: activeDiscount?.label ?? `${minDiscount}%+ off`,
      onRemove: () => removeChip('minDiscount', { minDiscount: DEFAULT_MIN_DISCOUNT }),
    })
  }
  if (minStars > 0) {
    activeChips.push({
      key: 'minStars',
      label: activeStars?.label ?? `${minStars}★ & up`,
      onRemove: () => removeChip('minStars', { minStars: 0 }),
    })
  }
  if (maxPriceCents && maxPriceLabel) {
    activeChips.push({ key: 'maxPrice', label: maxPriceLabel, onRemove: () => removeChip('maxPrice', { maxPriceCents: null }) })
  }
  if (dateFrom || dateTo) {
    const label = dateFrom && dateTo
      ? `${fmtChipDate(dateFrom)} – ${fmtChipDate(dateTo)}`
      : dateFrom ? `From ${fmtChipDate(dateFrom)}` : `Until ${fmtChipDate(dateTo)}`
    activeChips.push({ key: 'dates', label, onRemove: () => removeChip('dates', { dateFrom: '', dateTo: '' }) })
  }
  const activeFilterCount = [
    cityFiltered,
    minDiscount !== DEFAULT_MIN_DISCOUNT,
    Boolean(maxPriceCents),
    minStars > 0,
    Boolean(dateFrom || dateTo),
  ].filter(Boolean).length

  const isColdSample = deals.length > 0 && deals.every(d => d.isMock)
  const showFilteredEmpty = !loading && !error && deals.length === 0 && hasActiveFilters
  const showColdEmpty = !loading && !error && !hasActiveFilters && (isColdSample || deals.length === 0)

  // Empty-state view events — once per mount, guarded.
  const firedEmptyView = useRef({ filtered: false, cold: false })
  useEffect(() => {
    if (activeTab !== 'hotels') return
    if (showFilteredEmpty && !firedEmptyView.current.filtered) {
      firedEmptyView.current.filtered = true
      const props: Record<string, number> = { activeFilterCount }
      if (typeof unfilteredTotal === 'number' && unfilteredTotal > 0) props.hiddenCount = unfilteredTotal
      track('feed_empty_filtered_viewed', props)
    }
    if (showColdEmpty && !firedEmptyView.current.cold) {
      firedEmptyView.current.cold = true
      track('feed_empty_cold_viewed', { sampleCount: isColdSample ? deals.length : 0 })
    }
  }, [activeTab, showFilteredEmpty, showColdEmpty, isColdSample, deals.length, activeFilterCount, unfilteredTotal])

  const toCardDeal = (deal: ApiDeal) => ({
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
    updatedAt: deal.updatedAt,
  })

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
            <SearchBar key={searchKey} premium={premium} onResult={handleSearchResult} onClear={clearSearch} />
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
          ) : showFilteredEmpty ? (
            <div role="status" className="mx-auto max-w-[480px] py-16 text-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto" aria-hidden>
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
              </svg>
              <h3 className="mt-4 font-display text-[20px] font-bold text-[color:var(--ink)]">
                No deals match your filters
              </h3>
              {typeof unfilteredTotal === 'number' && unfilteredTotal > 0 && (
                <p className="mt-1 text-[13px] text-[color:var(--ink-soft)]">
                  {unfilteredTotal} deal{unfilteredTotal !== 1 ? 's are' : ' is'} hidden by your filters
                </p>
              )}
              <p className="mt-2 text-[14px] text-[color:var(--ink-soft)]">
                Remove a filter, or clear them all to see everything that&rsquo;s live.
              </p>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {activeChips.map(chip => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.onRemove}
                    aria-label={`Remove filter: ${chip.label}`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-pill)] border-[1.5px] border-[color:var(--primary)] bg-[color:var(--primary)] px-4 text-[13px] font-medium text-white"
                  >
                    {chip.label}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                ))}
              </div>

              <button type="button" onClick={handleClearAll} className="btn btn-primary mt-6 min-h-[44px] px-8">
                Clear all filters
              </button>

              {defaultCity && (
                <Link href="/deals" className="mt-3 block text-[13px] font-medium text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]">
                  See all destinations
                </Link>
              )}
            </div>
          ) : showColdEmpty ? (
            <>
              <div role="status" className="mx-auto max-w-[480px] pt-10 text-center">
                <h3 className="font-display text-[20px] font-bold text-[color:var(--ink)]">
                  We&rsquo;re building your feed.
                </h3>
                <p className="mt-2 text-[14px] text-[color:var(--ink-soft)]">
                  Our tracker sweeps hotel prices across 20 destinations once a day.
                  Real deals appear here after the next sweep — check back soon.
                </p>
              </div>

              {isColdSample && (
                <section aria-label="Example deals" className="mt-12">
                  <div className="mb-6 border-t border-[color:var(--line-ivory)] pt-8">
                    <h3 className="text-h3 text-[color:var(--ink)]">Example deals</h3>
                    <p className="mt-1 text-[13px] text-[color:var(--ink-soft)]">
                      Here&rsquo;s what expaify surfaces once tracking completes. These use
                      sample hotels and prices — they&rsquo;re not bookable.
                    </p>
                  </div>
                  <div ref={gridRef} tabIndex={-1} className={gridClass}>
                    {deals.map(deal => (
                      <DealCard key={deal.id} deal={toCardDeal(deal)} />
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <>
              <div ref={gridRef} tabIndex={-1} className={gridClass}>
                {deals.map(deal =>
                  deal.locked ? (
                    <LockedDealCard
                      key={deal.id}
                      placeholderName="Members-only deal"
                      placeholderCity={deal.city}
                      stars={deal.stars ?? 4}
                      photoUrl={deal.photoUrl ?? undefined}
                      joinHref="/join"
                      updatedAt={deal.updatedAt}
                    />
                  ) : (
                    <DealCard
                      key={deal.id}
                      href={deal.isMock ? undefined : `/deals/${deal.id}`}
                      deal={toCardDeal(deal)}
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
