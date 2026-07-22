'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DealCard } from '../components/ui/DealCard'
import { LockedDealCard } from '../components/ui/LockedDealCard'
import { track } from '@/lib/analytics'
import { HotelSearchCriteriaEditor, HotelSearchCriteriaSummary } from '../components/HotelSearchCriteria'
import {
  buildHotelDetailUrl,
  buildHotelDestinationUrl,
  buildHotelResultsUrl,
  createHotelCriteriaVersion,
  formatHotelCriteriaDates,
  hotelCriteriaFromDraft,
  hotelCriteriaToDraft,
  resultCountBucket,
  type HotelCriteriaDraft,
  type HotelResultsViewState,
  type HotelSearchCriteriaV1,
} from '@/lib/hotels/searchCriteria'
import { HOTEL_DEAL_PAGE_SIZE, type HotelDealSort } from '@/lib/deals/feedContract'
import {
  HotelResultStatus,
  HotelShortListHelper,
} from './HotelRecoveryUI'
import {
  formatDealCount,
  parseHotelResultMetadata,
  type HotelFilterKey,
  type HotelFilterState,
  type HotelResultMetadata,
} from './hotelFilterRecovery'

const CITIES = [
  'Miami', 'New York', 'Cancún', 'Paris', 'Rome', 'Barcelona', 'Lisbon',
  'London', 'Tokyo', 'Bangkok', 'Dubai', 'Las Vegas', 'Orlando', 'San Juan',
  'Tulum', 'Amsterdam', 'Athens', 'Punta Cana', 'Charlotte', 'Nashville',
]

const DEFAULT_MIN_DISCOUNT = 20

type SortKey = HotelDealSort
type SortAnalyticsValue = 'recently_found' | 'biggest_discount' | 'lowest_nightly_price'

const SORT_OPTIONS: ReadonlyArray<{
  key: SortKey
  label: string
  description: string
  analyticsValue: SortAnalyticsValue
}> = [
  {
    key: 'newest',
    label: 'Recently found',
    description: 'Deals expaify detected most recently',
    analyticsValue: 'recently_found',
  },
  {
    key: 'discount',
    label: 'Biggest discount',
    description: 'Largest drop from the usual nightly price',
    analyticsValue: 'biggest_discount',
  },
  {
    key: 'price',
    label: 'Lowest nightly price',
    description: 'Lowest current rate per night',
    analyticsValue: 'lowest_nightly_price',
  },
]

function getSortOption(key: SortKey) {
  return SORT_OPTIONS.find(option => option.key === key) ?? SORT_OPTIONS[0]
}

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
  checkInDate: string
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
  sort: SortKey
  offset: number
  append: boolean
  criteriaRequest?: HotelSearchCriteriaV1
}

type FeedSnapshot = HotelFilterState & { sort: SortKey; queryId?: string }

type UndoSnapshot = {
  target: FeedSnapshot
  kind: 'single' | 'reset'
}

type RequestBehavior = {
  focusOnSuccess?: boolean
  successKind?: 'single' | 'reset' | 'undo'
  undoOnSuccess?: UndoSnapshot
  preserveResultsOnFailure?: boolean
}

type DealsResponse = {
  deals: ApiDeal[]
  total: number
  premium?: boolean
  unfilteredTotal?: number
  resultMetadata?: unknown
  criteriaVersion?: string
}

function SkeletonCard() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-[var(--radius-card)] bg-[color:var(--surface)]">
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

type Personalization = {
  active: boolean
  watchlist: string[]
  minDiscountPct: 30 | 40 | 50
  alertPreference: 'instant' | 'daily' | 'off'
}

type DealFeedProps = {
  initialDeals?: ApiDeal[]
  initialResultMetadata?: HotelResultMetadata | null
  defaultCity?: string
  premium?: boolean
  personalization?: Personalization
  initialCriteria?: HotelSearchCriteriaV1
  initialView?: HotelResultsViewState
  initialError?: boolean
}

export function DealFeed({ initialDeals, initialResultMetadata = null, defaultCity, premium: premiumProp = false, personalization, initialCriteria, initialView, initialError = false }: DealFeedProps = {}) {
  const router = useRouter()
  const [deals, setDeals] = useState<ApiDeal[]>(initialDeals ?? [])
  const [hasMore, setHasMore] = useState((initialDeals?.length ?? 0) === HOTEL_DEAL_PAGE_SIZE)
  const [loading, setLoading] = useState(!initialDeals)
  const [error, setError] = useState(initialError)
  const [initialLoadError, setInitialLoadError] = useState(initialError)
  const [activeTab, setActiveTab] = useState<'hotels' | 'flights'>('hotels')
  const [city, setCity] = useState(initialCriteria?.destination.state === 'selected' ? initialCriteria.destination.city : defaultCity ?? '')
  const [minDiscount, setMinDiscount] = useState(initialView?.minDiscount ?? DEFAULT_MIN_DISCOUNT)
  const [maxPriceCents, setMaxPriceCents] = useState<number | null>(initialView?.maxPriceCents ?? null)
  const [minStars, setMinStars] = useState(initialView?.minStars ?? 0)
  const [dateFrom, setDateFrom] = useState(initialCriteria?.dates.semantic === 'checkin_window' ? initialCriteria.dates.dateFrom ?? '' : '')
  const [dateTo, setDateTo] = useState(initialCriteria?.dates.semantic === 'checkin_window' ? initialCriteria.dates.dateTo ?? '' : '')
  const [appliedSort, setAppliedSort] = useState<SortKey>(initialView?.sort ?? 'newest')
  const [previousSort, setPreviousSort] = useState<SortKey>(initialView?.sort ?? 'newest')
  const [pendingSort, setPendingSort] = useState<SortKey | null>(null)
  const [failedSort, setFailedSort] = useState<SortKey | null>(null)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [premiumExplanationOpen, setPremiumExplanationOpen] = useState(false)
  const [offset, setOffset] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [premium, setPremium] = useState(premiumProp)
  const [resultMetadata, setResultMetadata] = useState<HotelResultMetadata | null>(() => {
    if (!initialResultMetadata) return null
    return parseHotelResultMetadata(initialResultMetadata, {
      city: defaultCity ?? '',
      minDiscount: DEFAULT_MIN_DISCOUNT,
      minStars: 0,
      maxPriceCents: null,
      dateFrom: '',
      dateTo: '',
    }, defaultCity)
  })
  const [lastChangedKey, setLastChangedKey] = useState<HotelFilterKey | null>(null)
  const [pendingRecoveryKey, setPendingRecoveryKey] = useState<HotelFilterKey | 'reset' | 'undo' | 'retry' | null>(null)
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null)
  const [undoError, setUndoError] = useState(false)
  const [statusAnnouncement, setStatusAnnouncement] = useState('')
  const [criteria, setCriteria] = useState<HotelSearchCriteriaV1>(() => initialCriteria ?? hotelCriteriaFromDraft(
    { city: defaultCity ?? '', dateFrom: '', dateTo: '' }, createHotelCriteriaVersion(), defaultCity ? 'destination_page' : 'deals_page',
  ))
  const [criteriaEditorOpen, setCriteriaEditorOpen] = useState(false)
  const [criteriaEntryPoint, setCriteriaEntryPoint] = useState<'summary' | 'empty_state'>('summary')
  const [criteriaUpdating, setCriteriaUpdating] = useState(false)
  const [criteriaUpdateError, setCriteriaUpdateError] = useState(false)
  const [failedCriteriaDraft, setFailedCriteriaDraft] = useState<HotelCriteriaDraft | null>(null)
  const failedCriteriaVersionRef = useRef<string | null>(null)
  const retryCriteriaRef = useRef<HTMLButtonElement>(null)
  const viewedCriteriaVersionsRef = useRef(new Set<string>())
  const gridRef = useRef<HTMLDivElement>(null)
  const resultStatusRef = useRef<HTMLDivElement>(null)
  const sortControlRef = useRef<HTMLElement>(null)
  const sortTriggerRef = useRef<HTMLButtonElement>(null)
  const sortMenuRef = useRef<HTMLDivElement>(null)
  const sortOptionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const premiumExplanationRef = useRef<HTMLDivElement>(null)
  const sortViewedRef = useRef(false)
  const pendingSortEventRef = useRef<{ from: SortKey; to: SortKey; startedAt: number } | null>(null)
  const requestSequenceRef = useRef(0)
  const requestAbortRef = useRef<AbortController | null>(null)
  const retryBehaviorRef = useRef<RequestBehavior | null>(null)

  const personalizationActive = Boolean(personalization?.active)

  useEffect(() => {
    if (criteriaUpdating || initialLoadError) return
    const view = { minDiscount, maxPriceCents, minStars, sort: appliedSort }
    if (window.location.pathname === '/deals') {
      window.history.replaceState(null, '', buildHotelResultsUrl(criteria, view))
    } else if (defaultCity && window.location.pathname.startsWith('/destinations/')) {
      window.history.replaceState(null, '', buildHotelDestinationUrl(criteria, view))
    }
  }, [appliedSort, criteria, criteriaUpdating, defaultCity, initialLoadError, maxPriceCents, minDiscount, minStars])

  const fetchDeals = useCallback(async (opts: DealFetchOpts, behavior: RequestBehavior = {}) => {
    const { append } = opts
    const sequence = ++requestSequenceRef.current
    requestAbortRef.current?.abort()
    const controller = new AbortController()
    requestAbortRef.current = controller
    if (!append) {
      setLoading(true)
      setResultMetadata(null)
    } else setLoadingMore(true)
    setError(false)
    setUndoError(false)

    const params = new URLSearchParams({
      limit: String(HOTEL_DEAL_PAGE_SIZE),
      offset: String(opts.offset),
      min_discount: String(opts.minDiscount),
      sort: opts.sort,
    })
    if (opts.city) params.set('city', opts.city)
    if (opts.maxPriceCents) params.set('max_price_cents', String(opts.maxPriceCents))
    if (opts.minStars > 0) params.set('min_stars', String(opts.minStars))
    if (opts.dateFrom) params.set('date_from', opts.dateFrom)
    if (opts.dateTo) params.set('date_to', opts.dateTo)
    const requestCriteria = opts.criteriaRequest ?? criteria
    params.set('criteriaSchema', String(requestCriteria.schemaVersion))
    params.set('criteriaVersion', requestCriteria.criteriaVersion)
    params.set('criteriaSource', requestCriteria.source)
    // Outside the personalized view, ask the API to skip stored preferences so
    // later pages match the unpersonalized first paint.
    if (!personalizationActive) params.set('all', '1')

    try {
      const res = await fetch(`/api/deals?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error('fetch failed')
      const data: DealsResponse = await res.json()
      if (sequence !== requestSequenceRef.current) return false
      if (data.criteriaVersion !== requestCriteria.criteriaVersion) throw new Error('criteria version mismatch')
      setInitialLoadError(false)
      const requestedFilters: HotelFilterState = {
        city: opts.city,
        minDiscount: opts.minDiscount,
        minStars: opts.minStars,
        maxPriceCents: opts.maxPriceCents,
        dateFrom: opts.dateFrom,
        dateTo: opts.dateTo,
      }
      const parsedMetadata = parseHotelResultMetadata(data.resultMetadata, requestedFilters, defaultCity)
      if (parsedMetadata?.inventoryKind === 'live') {
        if (parsedMetadata.filteredTotal === 0 && data.deals.length > 0) throw new Error('invalid result metadata')
        if (parsedMetadata.filteredTotal > 0 && parsedMetadata.filteredTotal <= 3 && data.deals.length === 0) throw new Error('invalid result metadata')
      }
      // Criteria applies commit the response, criteria object, links, and URL
      // together in the caller after the echoed version is verified.
      if (opts.criteriaRequest) return data
      setDeals(prev => append ? [...prev, ...data.deals] : data.deals)
      if (!append) setResultMetadata(parsedMetadata)
      // The API reports the page count, not the full set, so a full page is
      // the only reliable "there may be more" signal.
      setHasMore(data.deals.length === HOTEL_DEAL_PAGE_SIZE)
      setPremium(Boolean(data.premium))
      if (behavior.undoOnSuccess) setUndoSnapshot(behavior.undoOnSuccess)
      if (behavior.successKind === 'undo') {
        setCity(opts.city)
        setMinDiscount(opts.minDiscount)
        setMinStars(opts.minStars)
        setMaxPriceCents(opts.maxPriceCents)
        setDateFrom(opts.dateFrom)
        setDateTo(opts.dateTo)
        setAppliedSort(opts.sort)
        setUndoSnapshot(null)
      }
      if (!append) {
        const count = parsedMetadata?.inventoryKind === 'live' ? parsedMetadata.filteredTotal : null
        const countCopy = count === null ? null : `${formatDealCount(count)} ${count === 1 ? 'matches' : 'match'}.`
        if (behavior.successKind === 'single') setStatusAnnouncement(countCopy ? `Filter removed. ${countCopy}` : 'Deals updated.')
        else if (behavior.successKind === 'reset') setStatusAnnouncement(countCopy ? `Filters reset. ${countCopy}` : 'Filters reset.')
        else if (behavior.successKind === 'undo') setStatusAnnouncement(countCopy ? `Filter change undone. ${countCopy}` : 'Filter change undone.')
        else setStatusAnnouncement(countCopy ?? '')
        retryBehaviorRef.current = null
      }
      if (behavior.focusOnSuccess) window.requestAnimationFrame(() => resultStatusRef.current?.focus())
      return data
    } catch (caught) {
      if (sequence !== requestSequenceRef.current || (caught instanceof DOMException && caught.name === 'AbortError')) return false
      if (behavior.preserveResultsOnFailure) {
        setUndoError(true)
        setStatusAnnouncement('')
      } else {
        if (!initialDeals) setInitialLoadError(true)
        setError(true)
        setResultMetadata(null)
        setStatusAnnouncement('Deals couldn’t be updated. Your selected filters are still shown.')
        retryBehaviorRef.current = behavior
      }
      return false
    } finally {
      if (sequence === requestSequenceRef.current) {
        setLoading(false)
        setLoadingMore(false)
        setPendingRecoveryKey(null)
      }
    }
  }, [criteria, defaultCity, initialDeals, personalizationActive])

  useEffect(() => {
    // Skip initial fetch when deals were pre-fetched server-side
    if (initialDeals) return
    fetchDeals({ city, minDiscount, maxPriceCents, minStars, dateFrom, dateTo, sort: appliedSort, offset: 0, append: false })
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
  }, recovery?: { key: HotelFilterKey | 'reset'; kind: 'single' | 'reset' }) {
    const currentFilters: HotelFilterState = { city, minDiscount, maxPriceCents, minStars, dateFrom, dateTo }
    const nextCity = next.city ?? city
    const nextDiscount = next.minDiscount ?? minDiscount
    const nextMax = next.maxPriceCents !== undefined ? next.maxPriceCents : maxPriceCents
    const nextStars = next.minStars !== undefined ? next.minStars : minStars
    const nextDateFrom = next.dateFrom !== undefined ? next.dateFrom : dateFrom
    const nextDateTo = next.dateTo !== undefined ? next.dateTo : dateTo
    const nextFilters: HotelFilterState = {
      city: nextCity,
      minDiscount: nextDiscount,
      maxPriceCents: nextMax,
      minStars: nextStars,
      dateFrom: nextDateFrom,
      dateTo: nextDateTo,
    }
    const changedKeys: HotelFilterKey[] = []
    if (nextCity !== city) changedKeys.push('city')
    if (nextDiscount !== minDiscount) changedKeys.push('minDiscount')
    if (nextStars !== minStars) changedKeys.push('minStars')
    if (nextMax !== maxPriceCents) changedKeys.push('maxPrice')
    if (nextDateFrom !== dateFrom) changedKeys.push('dateFrom')
    if (nextDateTo !== dateTo) changedKeys.push('dateTo')
    setSortMenuOpen(false)
    setPremiumExplanationOpen(false)
    setFailedSort(null)
    setCity(nextCity)
    setMinDiscount(nextDiscount)
    setMaxPriceCents(nextMax)
    setMinStars(nextStars)
    setDateFrom(nextDateFrom)
    setDateTo(nextDateTo)
    setOffset(0)
    setLastChangedKey(changedKeys.length === 1 ? changedKeys[0] : null)
    setStatusAnnouncement('')
    setUndoError(false)
    if (recovery) setPendingRecoveryKey(recovery.key)
    else setUndoSnapshot(null)
    void fetchDeals({ ...nextFilters, sort: appliedSort, offset: 0, append: false }, recovery ? {
      focusOnSuccess: true,
      successKind: recovery.kind,
      undoOnSuccess: {
        target: { ...currentFilters, sort: appliedSort, queryId: resultMetadata?.queryId },
        kind: recovery.kind,
      },
    } : {})
  }

  async function applyCriteriaDraft(draft: HotelCriteriaDraft, retryVersion?: string) {
    if (criteriaUpdating) return
    setCriteriaUpdating(true)
    setCriteriaUpdateError(false)
    setCriteriaEditorOpen(false)
    setStatusAnnouncement('')
    const proposedVersion = retryVersion ?? createHotelCriteriaVersion()
    const nextCriteria = hotelCriteriaFromDraft(draft, proposedVersion, 'edit')
    const response = await fetchDeals({
      city: draft.city,
      minDiscount,
      maxPriceCents,
      minStars,
      dateFrom: draft.dateFrom,
      dateTo: draft.dateTo,
      sort: appliedSort,
      offset: 0,
      append: false,
      criteriaRequest: nextCriteria,
    }, { preserveResultsOnFailure: true })
    setCriteriaUpdating(false)
    if (!response) {
      setUndoError(false)
      setFailedCriteriaDraft(draft)
      failedCriteriaVersionRef.current = proposedVersion
      setCriteriaUpdateError(true)
      window.requestAnimationFrame(() => retryCriteriaRef.current?.focus())
      return
    }

    const previousDraft = hotelCriteriaToDraft(criteria)
    const changedFields = [
      previousDraft.city !== draft.city ? 'destination' : null,
      previousDraft.dateFrom !== draft.dateFrom ? 'date_from' : null,
      previousDraft.dateTo !== draft.dateTo ? 'date_to' : null,
    ].filter((field): field is string => field !== null).sort().join(',')
    setDeals(response.deals)
    setResultMetadata(parseHotelResultMetadata(response.resultMetadata, {
      city: draft.city,
      minDiscount,
      maxPriceCents,
      minStars,
      dateFrom: draft.dateFrom,
      dateTo: draft.dateTo,
    }, defaultCity))
    setHasMore(response.deals.length === HOTEL_DEAL_PAGE_SIZE)
    setPremium(Boolean(response.premium))
    setCity(draft.city)
    setDateFrom(draft.dateFrom)
    setDateTo(draft.dateTo)
    setOffset(0)
    setCriteria(nextCriteria)
    setFailedCriteriaDraft(null)
    failedCriteriaVersionRef.current = null
    setUndoError(false)
    setStatusAnnouncement(`Results updated for ${nextCriteria.destination.state === 'selected' ? nextCriteria.destination.city : 'All destinations'}. ${formatHotelCriteriaDates(nextCriteria.dates)}. Guests and rooms not captured.`)
    track('hotel_criteria_edit_applied', {
      changed_fields: changedFields,
      previous_version: criteria.criteriaVersion,
      criteria_version: proposedVersion,
      result_count_bucket: resultCountBucket(response.deals.length),
    })
    router.push(buildHotelResultsUrl(nextCriteria, { minDiscount, maxPriceCents, minStars, sort: appliedSort }))
    window.requestAnimationFrame(() => resultStatusRef.current?.focus())
  }

  function openCriteriaEditor(entryPoint: 'summary' | 'empty_state' = 'summary') {
    setCriteriaEntryPoint(entryPoint)
    setCriteriaEditorOpen(true)
  }

  function retryCriteriaUpdate() {
    if (failedCriteriaDraft) void applyCriteriaDraft(failedCriteriaDraft, failedCriteriaVersionRef.current ?? undefined)
  }

  function removeRecoveryFilter(key: HotelFilterKey, source: 'promoted' | 'review_filters') {
    track('feed_filter_chip_removed', { filter: key, source })
    const next: Parameters<typeof applyFilter>[0] = {}
    if (key === 'city') next.city = defaultCity ?? ''
    else if (key === 'minDiscount') next.minDiscount = DEFAULT_MIN_DISCOUNT
    else if (key === 'minStars') next.minStars = 0
    else if (key === 'maxPrice') next.maxPriceCents = null
    else if (key === 'dateFrom') next.dateFrom = ''
    else next.dateTo = ''
    applyFilter(next, { key, kind: 'single' })
  }

  function undoRecovery() {
    if (!undoSnapshot || pendingRecoveryKey) return
    setPendingRecoveryKey('undo')
    setUndoError(false)
    const target = undoSnapshot.target
    void fetchDeals({ ...target, offset: 0, append: false }, {
      focusOnSuccess: true,
      successKind: 'undo',
      preserveResultsOnFailure: true,
    })
  }

  function retryFilters() {
    if (pendingRecoveryKey) return
    setPendingRecoveryKey('retry')
    const behavior = retryBehaviorRef.current ?? { focusOnSuccess: true }
    void fetchDeals({ city, minDiscount, maxPriceCents, minStars, dateFrom, dateTo, sort: appliedSort, offset: 0, append: false }, {
      ...behavior,
      focusOnSuccess: true,
    })
  }

  async function requestSort(target: SortKey) {
    if (pendingSort || target === appliedSort) return

    const sequence = ++requestSequenceRef.current
    requestAbortRef.current?.abort()
    const controller = new AbortController()
    requestAbortRef.current = controller
    const sortFrom = appliedSort
    const startedAt = window.performance.now()
    setSortMenuOpen(false)
    setPremiumExplanationOpen(false)
    setFailedSort(null)
    setPendingSort(target)
    setResultMetadata(null)
    setUndoSnapshot(null)
    setUndoError(false)
    setStatusAnnouncement('')
    setLastChangedKey(null)
    setOffset(0)
    sortTriggerRef.current?.focus()

    const params = new URLSearchParams({
      limit: String(HOTEL_DEAL_PAGE_SIZE),
      offset: '0',
      min_discount: String(minDiscount),
      sort: target,
    })
    if (city) params.set('city', city)
    if (maxPriceCents) params.set('max_price_cents', String(maxPriceCents))
    if (minStars > 0) params.set('min_stars', String(minStars))
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    params.set('criteriaSchema', String(criteria.schemaVersion))
    params.set('criteriaVersion', criteria.criteriaVersion)
    params.set('criteriaSource', criteria.source)
    if (!personalizationActive) params.set('all', '1')

    try {
      const res = await fetch(`/api/deals?${params}`, { signal: controller.signal })
      if (!res.ok) throw new Error('fetch failed')
      const data: DealsResponse = await res.json()
      if (sequence !== requestSequenceRef.current) return
      if (data.criteriaVersion !== criteria.criteriaVersion) throw new Error('criteria version mismatch')
      const parsedMetadata = parseHotelResultMetadata(data.resultMetadata, {
        city, minDiscount, maxPriceCents, minStars, dateFrom, dateTo,
      }, defaultCity)
      if (parsedMetadata?.inventoryKind === 'live') {
        if (parsedMetadata.filteredTotal === 0 && data.deals.length > 0) throw new Error('invalid result metadata')
        if (parsedMetadata.filteredTotal > 0 && parsedMetadata.filteredTotal <= 3 && data.deals.length === 0) throw new Error('invalid result metadata')
      }
      setDeals(data.deals)
      setResultMetadata(parsedMetadata)
      setHasMore(data.deals.length === HOTEL_DEAL_PAGE_SIZE)
      setPremium(Boolean(data.premium))
      setPreviousSort(sortFrom)
      pendingSortEventRef.current = { from: sortFrom, to: target, startedAt }
      setAppliedSort(target)
      setPendingSort(null)
    } catch (caught) {
      if (sequence !== requestSequenceRef.current || (caught instanceof DOMException && caught.name === 'AbortError')) return
      setFailedSort(target)
      setPendingSort(null)
    }
  }

  function loadMore() {
    if (loading || loadingMore || error || !hasMore) return
    const nextOffset = offset + HOTEL_DEAL_PAGE_SIZE
    setOffset(nextOffset)
    fetchDeals({ city, minDiscount, maxPriceCents, minStars, dateFrom, dateTo, sort: appliedSort, offset: nextOffset, append: true })
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

  const hasCityFilter = defaultCity ? city !== defaultCity : Boolean(city)
  const hasActiveFilters = Boolean(hasCityFilter || minDiscount !== DEFAULT_MIN_DISCOUNT || maxPriceCents || minStars || dateFrom || dateTo)
  const hasSecondaryFilters = Boolean(minDiscount !== DEFAULT_MIN_DISCOUNT || maxPriceCents || minStars)
  const isColdSampleFeed = deals.length > 0 && deals.every(d => d.isMock)

  // SearchBar can set a max price that is not one of the popover options.
  const maxPriceLabel = maxPriceCents
    ? (MAX_PRICE_OPTIONS.find(o => o.value === maxPriceCents)?.label ?? `Under $${Math.round(maxPriceCents / 100)}`)
    : null
  const activeDiscount = DISCOUNT_OPTIONS.find(o => o.value === minDiscount)
  const activeStars = STARS_OPTIONS.find(o => o.value === minStars)
  const activeFilters: HotelFilterState = { city, minDiscount, maxPriceCents, minStars, dateFrom, dateTo }

  const gridClass = 'grid grid-cols-1 gap-6 min-[680px]:grid-cols-2 min-[1024px]:grid-cols-3'
  const resultsUrl = defaultCity && criteria.source === 'destination_page'
    ? buildHotelDestinationUrl(criteria, { minDiscount, maxPriceCents, minStars, sort: appliedSort })
    : buildHotelResultsUrl(criteria, { minDiscount, maxPriceCents, minStars, sort: appliedSort })

  const echoLinkClass = 'font-medium text-[color:var(--primary)] no-underline hover:underline'

  const realDealCount = deals.filter(deal => !deal.isMock).length
  const isMockFeed = deals.length > 0 && realDealCount === 0
  const trustedMetadata = resultMetadata?.inventoryKind === 'live' && premium && !isMockFeed
    ? resultMetadata
    : null
  const recoveryOptions = trustedMetadata?.recoveryOptions ?? []
  const promotedOption = lastChangedKey && ['minDiscount', 'minStars', 'maxPrice'].includes(lastChangedKey)
    ? recoveryOptions.find(option => option.filterKey === lastChangedKey) ?? null
    : null
  const verifiedShortList = trustedMetadata && trustedMetadata.filteredTotal >= 1 && trustedMetadata.filteredTotal <= 3
  const showShortListHelper = Boolean(verifiedShortList && promotedOption)
  const displayedSort = pendingSort ?? appliedSort
  const appliedSortOption = getSortOption(appliedSort)
  const displayedSortOption = getSortOption(displayedSort)
  const sortControlDisabled = loading || error || deals.length === 0 || isMockFeed
  const resultStatusMessage = loading
    ? (initialDeals && deals.length > 0 ? 'Updating deals for these filters.' : 'Loading hotel deals.')
    : error
      ? ''
      : statusAnnouncement || (trustedMetadata && hasActiveFilters
        ? `${formatDealCount(trustedMetadata.filteredTotal)} ${trustedMetadata.filteredTotal === 1 ? 'matches' : 'match'} your filters.`
        : '')

  function viewportBand(): 'mobile_375' | 'desktop_1280' | 'other' {
    if (window.innerWidth <= 479) return 'mobile_375'
    if (window.innerWidth >= 1024) return 'desktop_1280'
    return 'other'
  }

  function serializedFilterState(): string {
    const discountBucket = [0, 20, 30, 40].includes(minDiscount) ? minDiscount : 'other'
    let maxPriceBucket: 'any' | 'under_100' | 'under_150' | 'under_200' | 'under_300' | 'other' = 'other'
    if (maxPriceCents === null) maxPriceBucket = 'any'
    else if (maxPriceCents === 100_00) maxPriceBucket = 'under_100'
    else if (maxPriceCents === 150_00) maxPriceBucket = 'under_150'
    else if (maxPriceCents === 200_00) maxPriceBucket = 'under_200'
    else if (maxPriceCents === 300_00) maxPriceBucket = 'under_300'
    const starsBucket = [0, 3, 4, 5].includes(minStars) ? minStars : 'other'

    return JSON.stringify({
      city_active: Boolean(city),
      min_discount: discountBucket,
      max_price_bucket: maxPriceBucket,
      min_stars: starsBucket,
      date_from_active: Boolean(dateFrom),
      date_to_active: Boolean(dateTo),
      personalization_active: personalizationActive,
    })
  }

  function sharedSortAnalytics() {
    return {
      premium_eligible: premium,
      loaded_result_count: realDealCount,
      viewport_band: viewportBand(),
      filter_state: serializedFilterState(),
    }
  }

  function sortTransition(from: SortKey, to: SortKey) {
    return `${getSortOption(from).analyticsValue}>${getSortOption(to).analyticsValue}`
  }

  function openSortMenu(focus: 'checked' | 'last' = 'checked') {
    if (sortControlDisabled || pendingSort) return
    setPremiumExplanationOpen(false)
    setSortMenuOpen(true)
    window.setTimeout(() => {
      const index = focus === 'last' ? SORT_OPTIONS.length - 1 : SORT_OPTIONS.findIndex(option => option.key === displayedSort)
      sortOptionRefs.current[index]?.focus()
    }, 0)
  }

  function closeSortMenu(returnFocus: boolean) {
    setSortMenuOpen(false)
    if (returnFocus) window.setTimeout(() => sortTriggerRef.current?.focus(), 0)
  }

  function activateSortOption(target: SortKey) {
    if (target === appliedSort) {
      closeSortMenu(true)
      return
    }
    if (!premium) {
      const from = appliedSort
      track('hotel_sort_disabled_attempted', {
        sort_from: getSortOption(from).analyticsValue,
        sort_to: getSortOption(target).analyticsValue,
        sort_transition: sortTransition(from, target),
        ...sharedSortAnalytics(),
        premium_eligible: false,
      })
      setSortMenuOpen(false)
      setPremiumExplanationOpen(true)
      window.setTimeout(() => premiumExplanationRef.current?.focus(), 0)
      return
    }
    void requestSort(target)
  }

  function handleSortOptionKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null
    if (event.key === 'ArrowDown') nextIndex = (index + 1) % SORT_OPTIONS.length
    else if (event.key === 'ArrowUp') nextIndex = (index - 1 + SORT_OPTIONS.length) % SORT_OPTIONS.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = SORT_OPTIONS.length - 1
    else if (event.key === 'Escape') {
      event.preventDefault()
      closeSortMenu(true)
      return
    } else if (event.key === 'Tab') {
      setSortMenuOpen(false)
      return
    }
    if (nextIndex !== null) {
      event.preventDefault()
      sortOptionRefs.current[nextIndex]?.focus()
    }
  }

  function dismissPremiumExplanation() {
    setPremiumExplanationOpen(false)
    window.setTimeout(() => sortTriggerRef.current?.focus(), 0)
  }

  function trackCardOpen(position: number) {
    const current = getSortOption(appliedSort).analyticsValue
    const previous = getSortOption(previousSort).analyticsValue
    track('hotel_result_card_opened', {
      current_sort: current,
      previous_sort: previous,
      sort_transition: `${previous}>${current}`,
      ...sharedSortAnalytics(),
      card_position: position,
    })
  }

  useEffect(() => {
    if (!loading && !error && deals.length === 0 && hasActiveFilters) {
      track('feed_empty_filtered_viewed')
    }
  }, [deals.length, error, hasActiveFilters, loading])

  useEffect(() => {
    if (!loading && !error && isColdSampleFeed) {
      track('feed_empty_cold_viewed')
    }
  }, [error, isColdSampleFeed, loading])

  useEffect(() => {
    if (loading || error || criteriaUpdating || viewedCriteriaVersionsRef.current.has(criteria.criteriaVersion)) return
    viewedCriteriaVersionsRef.current.add(criteria.criteriaVersion)
    track('hotel_results_viewed', {
      criteria_version: criteria.criteriaVersion,
      result_state: isColdSampleFeed ? 'sample' : deals.length === 0 ? 'empty' : 'populated',
      destination_present: criteria.destination.state === 'selected',
      date_state: criteria.dates.semantic,
      occupancy_state: criteria.occupancy.state,
      room_state: criteria.occupancy.state,
    })
  }, [criteria, criteriaUpdating, deals.length, error, isColdSampleFeed, loading])

  useEffect(() => {
    if (!sortMenuOpen) return
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (sortControlRef.current && !sortControlRef.current.contains(event.target as Node)) {
        setSortMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [sortMenuOpen])

  useEffect(() => {
    if (!premiumExplanationOpen) return
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') dismissPremiumExplanation()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  })

  useEffect(() => {
    const element = sortControlRef.current
    if (!element || sortViewedRef.current || activeTab !== 'hotels' || loading || error || isMockFeed || realDealCount === 0) return
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || sortViewedRef.current) return
      sortViewedRef.current = true
      track('hotel_sort_control_viewed', {
        current_sort: getSortOption(appliedSort).analyticsValue,
        ...sharedSortAnalytics(),
      })
      observer.disconnect()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [activeTab, appliedSort, error, isMockFeed, loading, realDealCount])

  useEffect(() => {
    const pendingEvent = pendingSortEventRef.current
    if (!pendingEvent || pendingSort !== null || pendingEvent.to !== appliedSort) return
    const animationFrame = window.requestAnimationFrame(() => {
      pendingSortEventRef.current = null
      track('hotel_sort_changed', {
        sort_from: getSortOption(pendingEvent.from).analyticsValue,
        sort_to: getSortOption(pendingEvent.to).analyticsValue,
        sort_transition: sortTransition(pendingEvent.from, pendingEvent.to),
        ...sharedSortAnalytics(),
        request_ms: Math.max(0, Math.round(window.performance.now() - pendingEvent.startedAt)),
      })
    })
    return () => window.cancelAnimationFrame(animationFrame)
  }, [appliedSort, deals, pendingSort])

  // Preference echo: the subtitle reflects the onboarded user's stored
  // watchlist and threshold; plain text + link, never styled as a filter pill.
  let subtitle: React.ReactNode
  if (!personalization) {
    subtitle = 'Deals across 20 destinations, updated daily'
  } else if (!personalization.active) {
    subtitle = (
      <>
        Showing all destinations, updated daily ·{' '}
        <a href="/deals" className={echoLinkClass}>Use my preferences</a>
      </>
    )
  } else {
    const list = personalization.watchlist
    const cityFragment =
      list.length === 0
        ? 'all destinations'
        : list.length <= 3
          ? list.join(', ')
          : `${list.slice(0, 2).join(', ')} + ${list.length - 2} more`
    subtitle = (
      <>
        Watching {cityFragment} · {personalization.minDiscountPct}%+ off ·{' '}
        <a href="/deals?all=1" className={echoLinkClass}>Show all deals</a>
      </>
    )
  }

  return (
    <>
      {/* Results heading */}
      <div>
        <div>
          <h2 className="text-h2 text-[color:var(--ink)]">Today&rsquo;s catches</h2>
          <p className="mt-1 text-[13px] text-[color:var(--ink-soft)]">{subtitle}</p>
        </div>
      </div>

      {activeTab === 'hotels' ? (
        <>
          <HotelSearchCriteriaSummary
            criteria={criteria}
            surface="results"
            status={criteriaUpdating ? 'updating' : 'ready'}
            onEdit={() => openCriteriaEditor('summary')}
            className="mt-6"
          />

          {criteriaUpdateError ? (
            <section role="alert" className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--error)] bg-[color:var(--error-soft)] p-4 text-[color:var(--text-1)]">
              <h3 className="text-[14px] font-bold">We couldn&apos;t update these results.</h3>
              <p className="mt-1 text-[13px] leading-5">Your previous search is still showing.</p>
              <div className="mt-3 flex flex-col gap-2 min-[420px]:flex-row">
                <button ref={retryCriteriaRef} type="button" onClick={retryCriteriaUpdate} className="btn btn-primary min-h-11 px-5">Retry update</button>
                <button type="button" onClick={() => openCriteriaEditor('summary')} className="btn btn-outline min-h-11 px-5">Edit search</button>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {/* Tab bar: Hotels active, Flights faint */}
      <div className="mb-6 mt-6 flex items-center gap-1">
        <button
          type="button"
          aria-pressed={activeTab === 'hotels'}
          onClick={() => {
            setUndoSnapshot(null)
            setUndoError(false)
            setActiveTab('hotels')
          }}
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
          onClick={() => {
            setUndoSnapshot(null)
            setUndoError(false)
            setActiveTab('flights')
          }}
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
          <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Result filters">
            <FilterPill
              label="Min discount"
              activeLabel={minDiscount !== DEFAULT_MIN_DISCOUNT ? (activeDiscount?.label ?? `${minDiscount}%+ off`) : null}
              disabled={!premium || criteriaUpdating}
              onClear={() => applyFilter({ minDiscount: DEFAULT_MIN_DISCOUNT })}
              options={DISCOUNT_OPTIONS.map(o => ({ label: o.label, selected: minDiscount === o.value, onSelect: () => applyFilter({ minDiscount: o.value }) }))}
            />
            <FilterPill
              label="Stars"
              activeLabel={minStars > 0 ? (activeStars?.label ?? `${minStars}★ & up`) : null}
              disabled={!premium || criteriaUpdating}
              onClear={() => applyFilter({ minStars: 0 })}
              options={STARS_OPTIONS.map(o => ({ label: o.label, selected: minStars === o.value, onSelect: () => applyFilter({ minStars: o.value }) }))}
            />
            <FilterPill
              label="Max price"
              activeLabel={maxPriceLabel}
              disabled={!premium || criteriaUpdating}
              onClear={() => applyFilter({ maxPriceCents: null })}
              options={MAX_PRICE_OPTIONS.map(o => ({ label: o.label, selected: maxPriceCents === o.value, onSelect: () => applyFilter({ maxPriceCents: o.value }) }))}
            />
          </div>

          <section
            ref={sortControlRef}
            aria-labelledby="hotel-sort-label"
            className="relative mb-8 grid min-w-0 grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr] sm:items-start"
          >
            <div className="relative w-full sm:w-auto">
              <span id="hotel-sort-label" className="mb-1.5 block text-[12px] font-bold leading-5 text-[var(--text-1)]">
                Sort hotel deals
              </span>
              <button
                ref={sortTriggerRef}
                type="button"
                disabled={sortControlDisabled}
                aria-disabled={pendingSort ? true : undefined}
                aria-haspopup="menu"
                aria-expanded={sortMenuOpen}
                aria-controls="hotel-sort-menu"
                aria-describedby="hotel-sort-status"
                onClick={() => {
                  if (pendingSort) return
                  if (sortMenuOpen) closeSortMenu(false)
                  else openSortMenu()
                }}
                onKeyDown={event => {
                  if (pendingSort) return
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault()
                    openSortMenu(event.key === 'ArrowUp' ? 'last' : 'checked')
                  }
                }}
                className={`flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-[var(--radius-control)] border bg-[var(--bg-surface)] px-4 text-left text-sm font-bold text-[var(--text-1)] hover:border-[var(--border-hover)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-[17rem] ${sortMenuOpen ? 'border-[var(--border-focus)]' : 'border-[var(--border-strong)]'}`}
              >
                <span className="min-w-0">Sort by: {displayedSortOption.label}</span>
                {pendingSort ? (
                  <svg className="h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg className={`h-4 w-4 shrink-0 transition-transform ${sortMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                )}
              </button>

              {sortMenuOpen ? (
                <div
                  ref={sortMenuRef}
                  id="hotel-sort-menu"
                  role="menu"
                  aria-label="Sort hotel deals"
                  className="absolute left-0 top-full z-30 mt-2 w-full min-w-0 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-raised)] p-1 shadow-[var(--shadow-lift)] sm:w-[22rem]"
                >
                  {SORT_OPTIONS.map((option, index) => {
                    const selected = displayedSort === option.key
                    const locked = !premium && option.key !== 'newest'
                    return (
                      <button
                        key={option.key}
                        ref={element => { sortOptionRefs.current[index] = element }}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selected}
                        aria-disabled={locked ? true : undefined}
                        onClick={() => activateSortOption(option.key)}
                        onKeyDown={event => handleSortOptionKeyDown(event, index)}
                        className={`flex min-h-11 w-full items-start gap-3 rounded-[calc(var(--radius-control)-0.125rem)] px-3 py-2.5 text-left hover:bg-[var(--bg-muted)] focus-visible:outline-offset-[-2px] ${selected ? 'bg-[var(--brand-soft)]' : ''}`}
                      >
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[var(--brand)]" aria-hidden="true">
                          {selected ? <span className="h-2 w-2 rounded-full bg-current" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold leading-5 text-[var(--text-1)]">{option.label}</span>
                          <span className="block text-[12px] leading-5 text-[var(--text-2)]">{option.description}</span>
                        </span>
                        {locked ? (
                          <span className="flex shrink-0 items-center gap-1 pt-0.5 text-[12px] font-bold leading-5 text-[var(--text-1)]">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="5" y="11" width="14" height="10" rx="2" />
                              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                            </svg>
                            Premium
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>

            <div id="hotel-sort-status" role="status" aria-live="polite" aria-atomic="true" className="min-h-5 text-[12px] leading-5 text-[var(--text-2)] sm:pt-6 sm:text-right">
              {loading && deals.length === 0 ? (
                <p>Loading hotel deals…</p>
              ) : pendingSort ? (
                <p>Sorting by {displayedSortOption.label}…</p>
              ) : isMockFeed ? (
                <p>Sorting is available with live deals.</p>
              ) : deals.length === 0 && !error ? (
                <p>No deals to sort.</p>
              ) : realDealCount > 0 ? (
                <>
                  <p>Sorted by {appliedSortOption.label} · {realDealCount} {realDealCount === 1 ? 'deal' : 'deals'} loaded</p>
                  {appliedSort === 'price' ? <p className="font-medium text-[var(--text-1)]">Nightly prices before taxes and fees</p> : null}
                </>
              ) : null}
            </div>

            {premiumExplanationOpen ? (
              <div
                ref={premiumExplanationRef}
                tabIndex={-1}
                role="region"
                aria-label="Premium sorting"
                className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-muted)] p-3 text-[var(--text-1)] sm:col-start-1 sm:w-[22rem]"
              >
                <p className="text-sm font-bold">Premium sorting</p>
                <p className="mt-1 text-[13px] leading-5">Sorting options are included with Premium. Your results are currently sorted by Recently found.</p>
                <div className="mt-3 flex flex-col items-stretch gap-2 min-[420px]:flex-row">
                  <a href="/join" className="btn btn-primary min-h-11 px-5">See Premium</a>
                  <button type="button" onClick={dismissPremiumExplanation} className="btn btn-outline min-h-11 px-5">Not now</button>
                </div>
              </div>
            ) : failedSort ? (
              <div role="alert" className="rounded-[var(--radius-control)] border border-[var(--error)] bg-[var(--error-soft)] p-3 text-[var(--text-1)] sm:col-start-1 sm:w-[22rem]">
                <p className="text-sm font-bold">Couldn&apos;t apply that sort. Try again.</p>
                <p className="mt-1 text-[13px] leading-5">Your results are still sorted by {appliedSortOption.label}.</p>
                <button type="button" onClick={() => void requestSort(failedSort)} className="btn btn-outline mt-3 min-h-11 px-5">Retry</button>
              </div>
            ) : null}
          </section>

          <div aria-busy={loading || Boolean(pendingSort)}>
            <HotelResultStatus
              statusRef={resultStatusRef}
              message={resultStatusMessage}
              undoLabel={undoSnapshot?.kind === 'reset' ? 'Undo filter reset' : undoSnapshot ? 'Undo filter change' : undefined}
              undoPending={pendingRecoveryKey === 'undo'}
              undoError={undoError}
              onUndo={undoSnapshot ? undoRecovery : undefined}
            />

          {criteriaUpdating && deals.length > 0 ? (
            <>
              <div className={`${gridClass} mb-6`} aria-label="Loading updated hotel deals">
                {Array.from({ length: Math.min(Math.max(deals.length, 3), 6) }).map((_, i) => <SkeletonCard key={`criteria-${i}`} />)}
              </div>
              <div inert aria-hidden="true" className={`${gridClass} pointer-events-none opacity-60 transition-opacity duration-150`}>
                {deals.map(deal => deal.locked ? (
                  <LockedDealCard key={deal.id} placeholderName="Members-only deal" placeholderCity={deal.city} stars={deal.stars ?? 4} photoUrl={deal.photoUrl ?? undefined} joinHref="/join" />
                ) : (
                  <DealCard key={deal.id} deal={{ id: deal.id, hotelName: deal.hotelName, city: deal.city, stars: deal.stars ?? 3, photoUrl: deal.photoUrl ?? undefined, dealPrice: { priceCents: deal.dealPriceCents, currency: 'USD' }, medianPrice: { priceCents: deal.medianPriceCents, currency: 'USD' }, discountPct: deal.discountPct, checkInWindow: deal.checkInWindow, snapshotCount: deal.snapshotCount, links: deal.otaLinks, headline: deal.headline ?? undefined, isMock: deal.isMock, firstSeen: deal.firstSeen ?? undefined, updatedAt: deal.updatedAt }} />
                ))}
              </div>
            </>
          ) : pendingSort ? (
            <div className={gridClass} aria-busy="true" aria-label="Hotel deals">
              {Array.from({ length: Math.min(Math.max(deals.length, 1), 6) }).map((_, i) => <SkeletonCard key={`sort-${i}`} />)}
            </div>
          ) : loading ? (
            <div className={gridClass} aria-busy="true" aria-label="Hotel deals">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : error ? (
            <section role="alert" className="mx-auto max-w-[640px] rounded-[var(--radius-card)] border border-[color:var(--error)] bg-[color:var(--error-soft)] px-5 py-8 text-left sm:px-8 sm:py-10">
              <h3 ref={gridRef} tabIndex={-1} className="text-h3 text-[color:var(--text-1)] focus:outline-none">{initialLoadError ? 'Couldn\'t load hotel deals.' : 'We couldn\'t update these deals'}</h3>
              <p className="mt-2 text-[14px] leading-6 text-[color:var(--text-2)]">{initialLoadError ? 'Check your connection and try again.' : 'We couldn\'t check this filter combination. Try the same filters again.'}</p>
              <button
                type="button"
                disabled={pendingRecoveryKey === 'retry'}
                onClick={retryFilters}
                className="btn btn-primary mt-5 min-h-11 px-8"
              >
                {pendingRecoveryKey === 'retry' ? 'Retrying…' : 'Retry'}
              </button>
            </section>
          ) : deals.length === 0 && personalization?.active && !hasActiveFilters ? (
            <PersonalizedEmpty personalization={personalization} premium={premium} />
          ) : deals.length === 0 && hasActiveFilters ? (
            <section className="mx-auto max-w-[640px] rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-5 py-10 text-center">
              <h3 className="text-h3 text-[color:var(--text-1)]">No hotel deals match this search</h3>
              <p className="mt-2 text-[14px] leading-6 text-[color:var(--text-2)]">Try another destination or check-in window. Your price and rating filters may also hide available deals.</p>
              <div className="mt-5 flex flex-col items-stretch justify-center gap-3 min-[420px]:flex-row">
                <button type="button" onClick={() => openCriteriaEditor('empty_state')} className="btn btn-primary min-h-11 px-6">Edit search</button>
                {hasSecondaryFilters ? <button type="button" onClick={() => applyFilter({ minDiscount: DEFAULT_MIN_DISCOUNT, minStars: 0, maxPriceCents: null })} className="btn btn-outline min-h-11 px-6">Clear price and rating filters</button> : <Link href="/deals" className="btn btn-outline min-h-11 px-6">See all destinations</Link>}
              </div>
            </section>
          ) : deals.length === 0 ? (
            <section className="mx-auto max-w-[640px] rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-5 py-8 text-left sm:px-8 sm:py-10">
              <h3 className="text-h3 text-[color:var(--text-1)]">No current hotel deals yet</h3>
              <p className="mt-2 text-[14px] leading-6 text-[color:var(--text-2)]">We check tracked hotel prices daily. New current deals will appear here after the next sweep.</p>
            </section>
          ) : (
            <>
              {isColdSampleFeed ? (
                <div className="mb-8 space-y-6">
                  <section role="status" className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] px-5 py-6">
                    <p className="font-display text-[20px] font-bold text-[color:var(--ink)]">We&apos;re building your feed</p>
                    <p className="mt-2 max-w-[720px] text-[14px] leading-6 text-[color:var(--ink-soft)]">
                      These example deals show what expaify will surface after tracking completes. They use sample hotels and prices and aren&apos;t bookable.
                    </p>
                  </section>
                  <div className="border-t border-[color:var(--line-ivory)] pt-6">
                    <h3 className="text-h3 text-[color:var(--ink)]">Example deals</h3>
                    <p className="mt-1 text-[13px] leading-5 text-[color:var(--ink-soft)]">
                      Example deals
                    </p>
                  </div>
                </div>
              ) : null}
              {showShortListHelper && promotedOption ? (
                <HotelShortListHelper
                  filters={activeFilters}
                  option={promotedOption}
                  pending={pendingRecoveryKey === promotedOption.filterKey}
                  onRemove={() => removeRecoveryFilter(promotedOption.filterKey, 'promoted')}
                />
              ) : null}
              <div ref={gridRef} tabIndex={-1} aria-busy="false" className={`${gridClass} outline-none`}>
                {deals.map((deal, index) =>
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
                      href={deal.isMock ? undefined : buildHotelDetailUrl(deal.id, resultsUrl)}
                      onOpen={deal.isMock ? undefined : () => trackCardOpen(index + 1)}
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
                        updatedAt: deal.updatedAt,
                      }}
                    />
                  )
                )}
                {loadingMore && Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={`more-${i}`} />)}
              </div>
              <div ref={sentinelRef} aria-hidden className="h-px" />
            </>
          )}
          </div>

          {criteriaEditorOpen ? (
            <HotelSearchCriteriaEditor
              open
              criteria={criteria}
              cities={CITIES}
              surface="results"
              entryPoint={criteriaEntryPoint}
              submitting={criteriaUpdating}
              initialDraft={criteriaUpdateError ? failedCriteriaDraft ?? undefined : undefined}
              onClose={() => setCriteriaEditorOpen(false)}
              onSubmit={draft => void applyCriteriaDraft(draft)}
            />
          ) : null}
        </>
      )}
    </>
  )
}

/** Honest zero-result answer for the personalized feed — no ghost skeletons,
    no mock cards, and a plan-aware footer line. */
function PersonalizedEmpty({ personalization, premium }: { personalization: Personalization; premium: boolean }) {
  const { watchlist, minDiscountPct: pct, alertPreference } = personalization
  const headline =
    watchlist.length >= 2
      ? `No ${pct}%+ deals in your ${watchlist.length} destinations right now.`
      : watchlist.length === 1
        ? `No ${pct}%+ deals in ${watchlist[0]} right now.`
        : `No ${pct}%+ deals right now.`

  return (
    <div className="py-20 text-center">
      <p className="font-display text-[20px] font-bold text-[color:var(--ink)]">{headline}</p>
      <p className="mt-2 text-[14px] text-[color:var(--ink-soft)]">
        Your bar is set at {pct}%+ off — drops that big are rare, and we check every destination daily. New deals land here the moment one clears it.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <a href="/deals?all=1" className="btn btn-primary px-8">
          Show all deals
        </a>
        <a href="/account" className="btn btn-outline px-8">
          Edit preferences
        </a>
      </div>
      {!premium ? (
        <p className="mt-5 text-[13px] text-[color:var(--ink-soft)]">
          Want an email the moment a match appears? Alerts are included with Premium.{' '}
          <a href="/join" className="font-bold text-[color:var(--primary)] no-underline hover:underline">
            Start Premium
          </a>
        </p>
      ) : alertPreference !== 'off' ? (
        <p className="mt-5 text-[13px] text-[color:var(--ink-soft)]">You&rsquo;ll get an email as soon as a match appears.</p>
      ) : null}
    </div>
  )
}
