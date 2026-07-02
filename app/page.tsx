'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { DealScore, HotelOffer, NormalizedFare, ProviderIssueStatus, ProviderNotice } from '@/lib/types'
import { resolveToIATA } from '@/lib/airports/resolve'
import { getNearby } from '@/lib/airports/nearby'
import AirportInput from './components/AirportInput'
import HotelCard from './components/HotelCard'
import FlightResults from '@/components/flights/FlightResults'
import { sortFlights } from '@/lib/search/sortFlights'
import { getTripInspiration, type TripInspirationItem } from '@/lib/search/tripInspiration'

type View = 'form' | 'results'
type TripType = 'roundtrip' | 'oneway'
type SearchIntent = 'flights' | 'hotels' | 'trip'
type SortBy = 'price' | 'deal' | 'estimatedTotal' | 'duration'
type ActiveTab = 'flights' | 'hotels'
type HotelAvailability = 'idle' | 'loading' | 'available' | 'empty' | 'unavailable' | 'skipped'
type InventoryStatus = 'checking' | 'available' | 'empty' | 'unavailable' | 'not_checked'
type InventoryKind = 'Flights' | 'Hotels'
type AirportSelectionSource = 'selected' | 'resolved'
type RecentSearch = { origin: string; dest: string; originDisplay: string; destDisplay: string }
type DateFieldErrors = { depart?: string; returnDate?: string }
type SelectedInspiration = {
  item: TripInspirationItem
  origin: string
  originDisplay: string
  depart: string
  returnDate: string
  fallbackOrigin: boolean
}
type SearchCriteria = {
  origin: string
  dest: string
  originDisplay: string
  destDisplay: string
  depart: string
  returnDate: string
  passengers: number
  tripType: TripType
  flexDates: boolean
}
type AlertSignupResponse =
  | { ok: true; data: { message: string } }
  | { ok: false; reason: string }

const delays = ['', 'delay-75', 'delay-150', 'delay-225', 'delay-300']
const searchIntentOptions: Array<{ value: SearchIntent; label: string; description: string }> = [
  { value: 'flights', label: 'Flights', description: 'Rank current fares' },
  { value: 'hotels', label: 'Hotels', description: 'Check stays for the trip dates' },
  { value: 'trip', label: 'Flight + hotel', description: 'Review both when available' },
]

function activeTabForIntent(intent: SearchIntent): ActiveTab {
  return intent === 'hotels' ? 'hotels' : 'flights'
}

function labelForIntent(intent: SearchIntent): string {
  if (intent === 'hotels') return 'Hotel search'
  if (intent === 'trip') return 'Flight + hotel search'
  return 'Flight search'
}

function submitLabelForIntent(intent: SearchIntent): string {
  if (intent === 'hotels') return 'Search hotels'
  if (intent === 'trip') return 'Search flights and hotels'
  return 'Search flights'
}

function loadingLabelForIntent(intent: SearchIntent): string {
  if (intent === 'hotels') return 'Checking hotel options...'
  if (intent === 'trip') return 'Checking flights and hotels...'
  return 'Scanning fares...'
}

function IconPlane({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12l-7-7v4L2 12v2l12 3v4l7-7z" fill="currentColor" />
    </svg>
  )
}

function IconSwap({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m4 4l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconCalendar({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 9h18M8 2v4m8-4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function IconMoon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20.5 15.1A8.5 8.5 0 018.9 3.5a8.5 8.5 0 1011.6 11.6z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconSun({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function dedup(fares: NormalizedFare[]): NormalizedFare[] {
  const best = new Map<string, NormalizedFare>()

  for (const fare of fares) {
    const key = `${fare.price.currency}:${fare.carrier}:${fare.origin}:${fare.destination}:${fare.depart.slice(0, 16)}`
    const existing = best.get(key)
    if (!existing || fare.price.priceCents < existing.price.priceCents) {
      best.set(key, fare)
    }
  }

  return Array.from(best.values()).sort((a, b) =>
    a.price.currency.localeCompare(b.price.currency) ||
    a.price.priceCents - b.price.priceCents
  )
}

function isValidDateParam(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function todayIso() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function validateTravelDates(criteria: Pick<SearchCriteria, 'depart' | 'returnDate' | 'tripType'>, minimumDate = todayIso()): DateFieldErrors {
  const errors: DateFieldErrors = {}
  const depart = criteria.depart.trim()
  const returnDate = criteria.tripType === 'roundtrip' ? criteria.returnDate.trim() : ''

  if (!depart) {
    errors.depart = 'Choose a departure date before searching.'
  } else if (!isValidDateParam(depart)) {
    errors.depart = 'Use a valid departure date before searching.'
  } else if (depart < minimumDate) {
    errors.depart = 'Departure date cannot be in the past. Choose today or a future date.'
  }

  if (criteria.tripType === 'roundtrip') {
    if (!returnDate) {
      errors.returnDate = 'Choose a return date, or switch to one way.'
    } else if (!isValidDateParam(returnDate)) {
      errors.returnDate = 'Use a valid return date before searching.'
    } else if (!errors.depart && returnDate < depart) {
      errors.returnDate = 'Return date must be on or after the departure date.'
    }
  }

  return errors
}

function parsePositivePassengerCount(value: string | null): number | null {
  const parsed = Number(value ?? '1')
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 9 ? parsed : null
}

function themeLabel(theme: TripInspirationItem['theme']): string {
  return theme
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatSuggestedMonth(value: string): string {
  const [year, month] = value.split('-').map(Number)
  if (!year || !month) return value
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
}

function shortDateRange(depart: string, returnDate: string): string {
  const departDate = new Date(`${depart}T00:00:00.000Z`)
  const returnValue = new Date(`${returnDate}T00:00:00.000Z`)
  if (Number.isNaN(departDate.getTime()) || Number.isNaN(returnValue.getTime())) {
    return [depart, returnDate].filter(Boolean).join(' - ')
  }
  const month = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(departDate)
  const startDay = departDate.getUTCDate()
  const endDay = returnValue.getUTCDate()
  const year = returnValue.getUTCFullYear()
  return `${month} ${startDay}-${endDay}, ${year}`
}

function addDaysIso(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

function firstValidFridayForMonth(monthValue: string, minimumDate = todayIso()): string {
  const [year, month] = monthValue.split('-').map(Number)
  const safeYear = year || new Date(`${minimumDate}T00:00:00.000Z`).getUTCFullYear()
  const safeMonth = month && month >= 1 && month <= 12 ? month - 1 : new Date(`${minimumDate}T00:00:00.000Z`).getUTCMonth()
  const candidate = new Date(Date.UTC(safeYear, safeMonth, 1))

  while (candidate.getUTCDay() !== 5) {
    candidate.setUTCDate(candidate.getUTCDate() + 1)
  }

  while (candidate.toISOString().slice(0, 10) < minimumDate && candidate.getUTCMonth() === safeMonth) {
    candidate.setUTCDate(candidate.getUTCDate() + 7)
  }

  if (candidate.getUTCMonth() !== safeMonth) {
    const nextMonth = new Date(Date.UTC(safeYear, safeMonth + 1, 1))
    while (nextMonth.getUTCDay() !== 5) {
      nextMonth.setUTCDate(nextMonth.getUTCDate() + 1)
    }
    return nextMonth.toISOString().slice(0, 10)
  }

  return candidate.toISOString().slice(0, 10)
}

function originDisplayForInspiration(originIata: string): string {
  if (originIata === 'NYC') return 'New York area'
  return originIata
}

function buildSearchParams(criteria: SearchCriteria, state: { activeTab?: ActiveTab; sortBy?: SortBy; filterStops?: number | null } = {}) {
  const params = new URLSearchParams()
  params.set('origin', criteria.origin.trim())
  if (criteria.dest.trim()) params.set('dest', criteria.dest.trim())
  if (criteria.depart) params.set('depart', criteria.depart)
  if (criteria.returnDate && criteria.tripType === 'roundtrip') params.set('return', criteria.returnDate)
  params.set('passengers', String(criteria.passengers))
  params.set('trip', criteria.tripType)
  if (criteria.flexDates && criteria.depart) params.set('flex', '1')
  if (state.activeTab && state.activeTab !== 'flights') params.set('tab', state.activeTab)
  if (state.sortBy && state.sortBy !== 'deal') params.set('sort', state.sortBy)
  if (state.filterStops !== undefined && state.filterStops !== null) params.set('stops', String(state.filterStops))
  return params
}

function parseCriteriaFromUrl(params: URLSearchParams): { criteria: SearchCriteria | null; error: string | null; activeTab: ActiveTab; sortBy: SortBy; filterStops: number | null } {
  const hasSearchState = ['origin', 'dest', 'depart', 'return', 'passengers', 'trip', 'flex', 'tab', 'sort', 'stops'].some(key => params.has(key))
  const activeTabParam = params.get('tab')
  const sortParam = params.get('sort')
  const stopsParam = params.get('stops')
  const activeTab: ActiveTab = activeTabParam === 'hotels' ? 'hotels' : 'flights'
  const sortBy: SortBy = sortParam === 'price' || sortParam === 'estimatedTotal' || sortParam === 'duration' ? sortParam : 'deal'
  const filterStops = stopsParam === '0' || stopsParam === '1' ? Number(stopsParam) : null

  if (!hasSearchState) {
    return { criteria: null, error: null, activeTab, sortBy, filterStops }
  }

  if (activeTabParam && activeTabParam !== 'flights' && activeTabParam !== 'hotels') {
    return { criteria: null, error: 'The results tab in this link is not valid. Choose flights or hotels.', activeTab, sortBy, filterStops }
  }
  if (sortParam && sortParam !== 'deal' && sortParam !== 'price' && sortParam !== 'estimatedTotal' && sortParam !== 'duration') {
    return { criteria: null, error: 'The sort option in this link is not valid. Choose best deal, lowest price, shortest duration, or lowest estimated total.', activeTab, sortBy, filterStops }
  }
  if (stopsParam && stopsParam !== '0' && stopsParam !== '1') {
    return { criteria: null, error: 'The stops filter in this link is not valid. Choose all, nonstop, or one stop.', activeTab, sortBy, filterStops }
  }

  const originRaw = params.get('origin')?.trim() ?? ''
  if (!originRaw) {
    return { criteria: null, error: 'This search link is missing an origin. Add a city, ZIP, or airport code to search.', activeTab, sortBy, filterStops }
  }

  let originIATA: string
  let destIATA = ''
  try {
    originIATA = resolveToIATA(originRaw)
    const destRaw = params.get('dest')?.trim() ?? ''
    if (destRaw) destIATA = resolveToIATA(destRaw)
  } catch {
    return { criteria: null, error: 'This search link has an airport or ZIP we could not recognize. Correct the route and search again.', activeTab, sortBy, filterStops }
  }

  const depart = params.get('depart')?.trim() ?? ''
  const returnDate = params.get('return')?.trim() ?? ''
  if (depart && !isValidDateParam(depart)) {
    return { criteria: null, error: 'The departure date in this link is not valid. Use a calendar date before searching.', activeTab, sortBy, filterStops }
  }
  if (returnDate && !isValidDateParam(returnDate)) {
    return { criteria: null, error: 'The return date in this link is not valid. Use a calendar date before searching.', activeTab, sortBy, filterStops }
  }
  if (depart && returnDate && returnDate < depart) {
    return { criteria: null, error: 'The return date in this link is before the departure date. Correct the dates to search.', activeTab, sortBy, filterStops }
  }

  const passengers = parsePositivePassengerCount(params.get('passengers'))
  if (passengers === null) {
    return { criteria: null, error: 'The passenger count in this link is not valid. Choose 1 to 9 passengers.', activeTab, sortBy, filterStops }
  }

  const tripParam = params.get('trip')
  if (tripParam && tripParam !== 'roundtrip' && tripParam !== 'oneway') {
    return { criteria: null, error: 'The trip type in this link is not valid. Choose round trip or one way.', activeTab, sortBy, filterStops }
  }
  if (tripParam === 'oneway' && returnDate) {
    return { criteria: null, error: 'This link mixes one-way travel with a return date. Remove the return date or switch to round trip.', activeTab, sortBy, filterStops }
  }
  if (params.has('flex') && params.get('flex') !== '1' && params.get('flex') !== '0') {
    return { criteria: null, error: 'The flexible dates setting in this link is not valid.', activeTab, sortBy, filterStops }
  }

  const tripType: TripType = tripParam === 'oneway' ? 'oneway' : 'roundtrip'
  const dateErrors = validateTravelDates({ depart, returnDate, tripType })
  if (dateErrors.depart) {
    return { criteria: null, error: `The departure date in this link needs attention. ${dateErrors.depart}`, activeTab, sortBy, filterStops }
  }
  if (dateErrors.returnDate) {
    return { criteria: null, error: `The return date in this link needs attention. ${dateErrors.returnDate}`, activeTab, sortBy, filterStops }
  }

  const criteria: SearchCriteria = {
    origin: originIATA,
    dest: destIATA,
    originDisplay: originIATA,
    destDisplay: destIATA,
    depart,
    returnDate: tripType === 'roundtrip' ? returnDate : '',
    passengers,
    tripType,
    flexDates: params.get('flex') === '1',
  }

  return { criteria, error: null, activeTab, sortBy, filterStops }
}

function HotelSkeleton() {
  return (
    <div className="card overflow-hidden rounded-[var(--radius-card)] p-3">
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] gap-3">
        <div className="h-16 w-16 rounded-[var(--radius-control)] shimmer" />
        <div className="min-w-0 space-y-2">
          <div className="h-4 w-4/5 rounded-[var(--radius-control)] shimmer" />
          <div className="h-4 w-2/3 rounded-[var(--radius-control)] shimmer" />
          <div className="h-3 w-24 rounded-[var(--radius-control)] shimmer" />
        </div>
        <div className="h-12 w-24 rounded-[var(--radius-control)] shimmer" />
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="h-7 w-32 rounded-full shimmer" />
        <div className="h-10 w-28 rounded-[var(--radius-control)] shimmer" />
      </div>
    </div>
  )
}

function ThemeToggle() {
  const [light, setLight] = useState(false)

  useEffect(() => {
    setLight(document.documentElement.classList.contains('light'))
  }, [])

  function toggle() {
    const next = !light
    setLight(next)
    document.documentElement.classList.toggle('light', next)
    localStorage.setItem('theme', next ? 'light' : 'dark')
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="fixed top-4 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900"
    >
      {light ? <IconMoon /> : <IconSun />}
    </button>
  )
}

function SiteFooter({
  variant,
  showResultsLink = false,
  showRoutesLink = true,
}: {
  variant: 'light' | 'dark'
  showResultsLink?: boolean
  showRoutesLink?: boolean
}) {
  const isDark = variant === 'dark'
  const shellClass = isDark
    ? 'border-white/10 bg-white/[0.025] text-gray-500'
    : 'border-slate-200 bg-white/70 text-slate-500'
  const headingClass = isDark ? 'text-gray-200' : 'text-slate-950'
  const bodyClass = isDark ? 'text-gray-500' : 'text-slate-600'
  const linkClass = isDark
    ? 'text-gray-300 hover:text-white focus-visible:text-white'
    : 'text-slate-700 hover:text-slate-950 focus-visible:text-slate-950'

  return (
    <footer className={`mt-8 rounded-2xl border px-4 py-5 shadow-sm sm:px-5 ${shellClass}`}>
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="max-w-3xl">
          <p className={`font-display text-sm font-extrabold ${headingClass}`}>expaify trust notes</p>
          <div className={`mt-2 grid gap-2 text-xs font-medium leading-5 sm:grid-cols-3 ${bodyClass}`}>
            <p>Fares and hotel rates can change after provider handoff; final price and availability are set by the provider.</p>
            <p>Deal Scores compare current prices with recent route history and avoid strong claims when history is thin.</p>
            <p>Outbound provider links may include affiliate markers. For booking, payment, or trip changes, use the provider support channel.</p>
          </div>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold">
          <a className={`rounded-md underline-offset-4 hover:underline ${linkClass}`} href="#search">
            Search
          </a>
          {showResultsLink && (
            <a className={`rounded-md underline-offset-4 hover:underline ${linkClass}`} href="#results">
              Results
            </a>
          )}
          {showRoutesLink && (
            <a className={`rounded-md underline-offset-4 hover:underline ${linkClass}`} href="#trip-inspiration">
              Inspiration
            </a>
          )}
        </nav>
      </div>
    </footer>
  )
}

function ResultsStatePanel({
  eyebrow,
  title,
  children,
  action,
  secondaryAction,
  tone = 'default',
}: {
  eyebrow: string
  title: string
  children: ReactNode
  action?: ReactNode
  secondaryAction?: ReactNode
  tone?: 'default' | 'warning' | 'error'
}) {
  const toneClasses = tone === 'error'
    ? 'border-[var(--error)]/25 bg-[var(--error-soft)]'
    : tone === 'warning'
      ? 'border-[var(--warning)]/25 bg-[var(--warning-soft)]'
      : 'border-[var(--border)] bg-[var(--bg-surface)]'
  const eyebrowClasses = tone === 'error'
    ? 'text-[var(--error)]'
    : tone === 'warning'
      ? 'text-[var(--warning)]'
      : 'text-[var(--text-2)]'

  return (
    <section
      className={`rounded-[var(--radius-card)] border px-4 py-5 shadow-[var(--shadow-card)] animate-fade-in sm:px-5 sm:py-6 ${toneClasses}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-wide ${eyebrowClasses}`}>
            {eyebrow}
          </p>
          <h2 className="mt-1 font-display text-lg font-bold leading-7 text-[var(--text-1)] sm:text-xl">
            {title}
          </h2>
          <div className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-2)]">
            {children}
          </div>
        </div>
        {(action || secondaryAction) && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-36">
            {action}
            {secondaryAction}
          </div>
        )}
      </div>
    </section>
  )
}

function isHotelNotice(notice: ProviderNotice): boolean {
  return notice.provider.toLowerCase().includes('hotel')
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function inventoryBadge(status: InventoryStatus, count: number): string {
  if (status === 'available') return String(count)
  if (status === 'checking') return 'Checking'
  if (status === 'empty') return 'None'
  if (status === 'unavailable') return 'Issue'
  return 'Not checked'
}

function inventorySummary(kind: InventoryKind, status: InventoryStatus, count: number): string {
  const lower = kind.toLowerCase().slice(0, -1)
  if (status === 'available') return pluralize(count, lower)
  if (status === 'checking') return `${kind} checking`
  if (status === 'empty') return `No ${kind.toLowerCase()} returned`
  if (status === 'unavailable') return `${kind} unavailable`
  return `${kind} not checked`
}

function inventoryAriaLabel(kind: InventoryKind, status: InventoryStatus, count: number, notCheckedReason?: string): string {
  const summary = status === 'available'
    ? `${pluralize(count, kind.toLowerCase().slice(0, -1))} available`
    : status === 'empty'
      ? `no ${kind.toLowerCase()} returned`
      : status === 'unavailable'
        ? `${kind.toLowerCase()} unavailable`
        : status === 'checking'
          ? `${kind.toLowerCase()} checking`
          : `${kind.toLowerCase()} not checked${notCheckedReason ? `, ${notCheckedReason}` : ''}`

  return `${kind} tab, ${summary}`
}

function liveInventoryLabel(kind: InventoryKind, status: InventoryStatus, count: number): string {
  if (status === 'available') return `${pluralize(count, kind.toLowerCase().slice(0, -1))} available`
  return inventorySummary(kind, status, count)
}

function statusBadgeClass(status: InventoryStatus, active: boolean): string {
  if (status === 'checking') return 'bg-[var(--brand-soft)] text-indigo-300'
  if (status === 'available') return active ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-gray-500'
  if (status === 'empty') return 'bg-white/5 text-gray-400'
  if (status === 'unavailable') return 'bg-[var(--warning-soft)] text-amber-300'
  return 'bg-white/[0.03] text-gray-600'
}

function hotelNotCheckedCopy(criteria: Pick<SearchCriteria, 'dest' | 'depart' | 'returnDate' | 'tripType'>, intent: SearchIntent): string {
  if (!criteria.dest.trim()) return 'Add a destination to check hotel availability.'
  if (!criteria.depart || !criteria.returnDate || criteria.tripType !== 'roundtrip') {
    return 'Add departure and return dates to check hotel availability.'
  }
  if (intent === 'flights') return 'Choose a hotel or flight + hotel search to check hotel availability.'
  return 'Hotel availability was not checked for this search.'
}

function inventoryHelperCopy(
  kind: InventoryKind,
  status: InventoryStatus,
  criteria: SearchCriteria,
  intent: SearchIntent
): { title: string; body: string; action: 'none' | 'edit' | 'retry-edit' | 'change-dates-hotels' } {
  if (kind === 'Flights') {
    if (status === 'checking') {
      return {
        title: 'Flights are still checking',
        body: 'You can keep reviewing hotels while flight availability finishes.',
        action: 'none',
      }
    }
    if (status === 'empty') {
      return {
        title: 'No flights returned',
        body: 'No flights were returned for this route. Edit the route, dates, or flexibility options.',
        action: 'edit',
      }
    }
    if (status === 'unavailable') {
      return {
        title: 'Flights unavailable',
        body: 'Flight inventory was not confirmed because a provider is unavailable. Retry this search or edit trip details.',
        action: 'retry-edit',
      }
    }
    return {
      title: 'Flights not checked',
      body: 'Choose a flight or flight + hotel search to check flight availability.',
      action: 'edit',
    }
  }

  if (status === 'checking') {
    return {
      title: 'Hotels are still checking',
      body: 'You can keep reviewing flights while hotel availability finishes.',
      action: 'none',
    }
  }
  if (status === 'empty') {
    return {
      title: 'No hotels returned',
      body: 'No hotels were returned for these dates. Change dates or broaden the stay area.',
      action: 'change-dates-hotels',
    }
  }
  if (status === 'unavailable') {
    return {
      title: 'Hotels unavailable',
      body: 'Hotel inventory was not confirmed because the provider is unavailable. Retry this search or edit trip details.',
      action: 'retry-edit',
    }
  }
  return {
    title: 'Hotels not checked',
    body: hotelNotCheckedCopy(criteria, intent),
    action: 'edit',
  }
}

function PriceCalendar({
  prices,
  selected,
  onSelect,
}: {
  prices: Record<string, number>
  selected: string
  onSelect: (date: string) => void
}) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const monthStartOffset = new Date(year, month, 1).getDay()
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, index - monthStartOffset + 1)
    return date.getMonth() === month ? date.toISOString().slice(0, 10) : null
  })
  const values = Object.values(prices).filter((value) => value > 0)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-3)]">
        Cheapest days - {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
      </p>
      <div className="grid grid-cols-7 gap-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="py-0.5 text-center text-[9px] font-bold text-[var(--text-3)]">
            {day}
          </div>
        ))}
        {days.map((date, index) => {
          if (!date) return <div key={index} />

          const price = prices[date]
          const ratio = price ? (price - min) / range : null
          const bg =
            ratio === null
              ? 'bg-transparent'
              : ratio < 0.25
                ? 'bg-emerald-500/25'
                : ratio < 0.5
                  ? 'bg-yellow-500/20'
                  : 'bg-red-500/15'
          const isSelected = date === selected

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              className={`rounded-[var(--radius-control)] py-1.5 text-center transition-all ${bg} ${
                isSelected ? 'ring-2 ring-[var(--brand)]' : 'hover:ring-1 hover:ring-[var(--border-strong)]'
              }`}
            >
              <div className="text-[11px] font-bold text-[var(--text-1)]">
                {new Date(`${date}T12:00`).getDate()}
              </div>
              {price && <div className="text-[9px] font-semibold text-[var(--text-2)]">${Math.round(price / 100)}</div>}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-end gap-3">
        <span className="flex items-center gap-1 text-[9px] font-semibold text-[var(--text-3)]">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/40" />
          Cheap
        </span>
        <span className="flex items-center gap-1 text-[9px] font-semibold text-[var(--text-3)]">
          <span className="inline-block h-2 w-2 rounded-sm bg-red-500/30" />
          Expensive
        </span>
      </div>
    </div>
  )
}

function SelectedInspirationSummary({
  selected,
  passengers,
}: {
  selected: SelectedInspiration
  passengers: number
}) {
  const details = [
    `${selected.originDisplay} to ${selected.item.destinationCity} (${selected.item.destinationIata})`,
    shortDateRange(selected.depart, selected.returnDate),
    'Flexible dates',
    passengers === 1 ? '1 traveler' : `${passengers} travelers`,
  ].join(' · ')

  return (
    <div
      className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--brand-soft)] px-4 py-3 text-sm leading-6 text-[var(--text-2)]"
      aria-live="polite"
    >
      <p className="font-bold text-[var(--text-1)]">Ready to check live fares and hotels for this trip.</p>
      <p className="mt-1 font-semibold">{details}</p>
      {selected.fallbackOrigin && (
        <p className="mt-1 text-xs font-semibold text-[var(--text-3)]">
          Using New York area as the origin for this idea.
        </p>
      )}
      <p className="mt-1 text-xs font-medium leading-5 text-[var(--text-3)]">
        The price hint is historical. expaify checks current fares, hotels, and Deal Score after you search.
      </p>
    </div>
  )
}

function TripInspirationHomeRail({
  items,
  hasResolvedOrigin,
  selected,
  recentSearches,
  passengers,
  error,
  onSelect,
  onRecentSearch,
}: {
  items: TripInspirationItem[]
  hasResolvedOrigin: boolean
  selected: SelectedInspiration | null
  recentSearches: RecentSearch[]
  passengers: number
  error: string | null
  onSelect: (item: TripInspirationItem) => void
  onRecentSearch: (recent: RecentSearch) => void
}) {
  const heading = hasResolvedOrigin ? 'Trip inspiration' : 'Trip inspiration from major hubs'
  const body = hasResolvedOrigin
    ? 'Pick an idea to prefill a live search. Prices are historical hints until you search.'
    : 'Add your origin for more relevant ideas. These are examples that become live searches after you choose dates.'

  return (
    <section
      id="trip-inspiration"
      aria-labelledby="trip-inspiration-heading"
      className="mx-auto w-full max-w-7xl px-4 pb-7 sm:px-6 lg:px-8"
    >
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="trip-inspiration-heading" className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--text-3)]">
            {heading}
          </h2>
          <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[var(--text-2)]">
            {body}
          </p>
        </div>
        <p className="text-xs font-semibold text-[var(--text-3)]">Live fares checked after search.</p>
      </div>

      {error ? (
        <div
          className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-medium leading-6 text-[var(--text-2)]"
          role="status"
        >
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-medium leading-6 text-[var(--text-2)]">
          No trip ideas are available for this origin yet. Enter a destination or search anywhere to check live options.
        </div>
      ) : (
        <div className="flex snap-x gap-3 overflow-x-auto pb-2 scrollbar-hide lg:grid lg:grid-cols-4 lg:overflow-visible">
          {items.map(item => {
            const isSelected = selected?.item.id === item.id
            const month = formatSuggestedMonth(item.suggestedMonth)
            const nightRange = `${item.minNights}-${item.maxNights} nights`
            const priceLabel = item.priceHintUsd
              ? `Past low hint: about $${item.priceHintUsd}`
              : null
            const accessiblePrice = item.priceHintUsd
              ? ` Past low hint about ${item.priceHintUsd} dollars, not a live fare.`
              : ''

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                aria-pressed={isSelected}
                aria-label={`Use ${item.label} trip to ${item.destinationCity}, ${item.destinationCountry} in ${month} for ${item.minNights} to ${item.maxNights} nights.${accessiblePrice} Checks flights and hotels after search.`}
                className={`flex min-h-[10.5rem] w-[17rem] max-w-[calc(100vw-2rem)] shrink-0 snap-start flex-col items-start justify-between rounded-[var(--radius-card)] border bg-[var(--bg-raised)] p-4 text-left shadow-[var(--shadow-card)] transition-colors hover:border-[var(--border-hover)] focus-visible:outline-none lg:w-auto lg:min-h-[11rem] ${
                  isSelected
                    ? 'border-[var(--brand)] bg-[var(--brand-soft)] shadow-[var(--shadow-lift)]'
                    : 'border-[var(--border)]'
                }`}
              >
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="rounded-full bg-[var(--bg-muted)] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text-2)]">
                    {themeLabel(item.theme)}
                  </span>
                  {isSelected && (
                    <span className="rounded-full bg-[var(--brand)] px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--text-inverse)]">
                      Selected
                    </span>
                  )}
                </span>
                <span className="mt-3 block w-full">
                  <span className="block font-display text-base font-extrabold leading-tight text-[var(--text-1)]">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-sm font-bold leading-5 text-[var(--text-1)]">
                    {item.destinationCity}, {item.destinationCountry}
                  </span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--text-2)]">
                    {month} · {nightRange}
                  </span>
                  {priceLabel && (
                    <span className="mt-1 block text-xs font-bold leading-5 text-[var(--warning)]">
                      {priceLabel}
                    </span>
                  )}
                  <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--text-2)]">
                    Checks flights and hotels
                  </span>
                </span>
                <span className="mt-3 text-xs font-extrabold text-[var(--brand)]">
                  Use this trip
                </span>
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <div className="mt-4">
          <SelectedInspirationSummary selected={selected} passengers={passengers} />
        </div>
      )}

      {recentSearches.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-3)]">Recent searches</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {recentSearches.map(recent => (
              <button
                key={recent.origin + recent.dest}
                type="button"
                onClick={() => onRecentSearch(recent)}
                className="inline-flex min-h-9 max-w-full items-center rounded-full border border-[var(--border)] bg-[var(--bg-raised)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--brand-soft)] hover:text-[var(--text-1)]"
              >
                {recent.originDisplay || recent.origin} → {recent.destDisplay || recent.dest}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export default function Home() {
  const [view, setView] = useState<View>('form')
  const [searchIntent, setSearchIntent] = useState<SearchIntent>('trip')
  const [tripType, setTripType] = useState<TripType>('roundtrip')
  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('')
  const [originDisplay, setOriginDisplay] = useState('')
  const [destDisplay, setDestDisplay] = useState('')
  const [originSelectionSource, setOriginSelectionSource] = useState<AirportSelectionSource | null>(null)
  const [destSelectionSource, setDestSelectionSource] = useState<AirportSelectionSource | null>(null)
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const [depart, setDepart] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [passengers, setPassengers] = useState(1)
  const [flexDates, setFlexDates] = useState(false)
  const [selectedInspiration, setSelectedInspiration] = useState<SelectedInspiration | null>(null)
  const [flights, setFlights] = useState<NormalizedFare[]>([])
  const [hotels, setHotels] = useState<HotelOffer[]>([])
  const [scores, setScores] = useState<Record<string, DealScore | null>>({})
  const [hotelScores, setHotelScores] = useState<Record<string, DealScore | null>>({})
  const [scoreLoading, setScoreLoading] = useState<Set<string>>(new Set())
  const [hotelScoreLoading, setHotelScoreLoading] = useState<Set<string>>(new Set())
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [dateErrors, setDateErrors] = useState<DateFieldErrors>({})
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [providerNotices, setProviderNotices] = useState<ProviderNotice[]>([])
  const [hotelAvailability, setHotelAvailability] = useState<HotelAvailability>('idle')
  const [hotelAvailabilityMessage, setHotelAvailabilityMessage] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>('deal')
  const [filterStops, setFilterStops] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('flights')
  const [copied, setCopied] = useState(false)
  const [alertEmail, setAlertEmail] = useState('')
  const [alertSent, setAlertSent] = useState(false)
  const [alertLoading, setAlertLoading] = useState(false)
  const [alertError, setAlertError] = useState<string | null>(null)
  const [calendarPrices, setCalendarPrices] = useState<Record<string, number>>({})
  const progressKey = useRef<number>(0)
  const previousInventoryAnnouncement = useRef('')
  const [inventoryAnnouncement, setInventoryAnnouncement] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const parsed = parseCriteriaFromUrl(params)
    setActiveTab(parsed.activeTab)
    setSearchIntent(parsed.activeTab === 'hotels' ? 'hotels' : 'trip')
    setSortBy(parsed.sortBy)
    setFilterStops(parsed.filterStops)

    if (parsed.error) {
      const rawOrigin = params.get('origin')?.trim() ?? ''
      const rawDest = params.get('dest')?.trim() ?? ''
      const rawDepart = params.get('depart')?.trim() ?? ''
      const rawReturn = params.get('return')?.trim() ?? ''
      const rawPassengers = parsePositivePassengerCount(params.get('passengers'))
      const rawTrip = params.get('trip')
      setOrigin('')
      setOriginDisplay(rawOrigin)
      setDest('')
      setDestDisplay(rawDest)
      setOriginSelectionSource(null)
      setDestSelectionSource(null)
      if (!rawDepart || isValidDateParam(rawDepart)) setDepart(rawDepart)
      if (!rawReturn || isValidDateParam(rawReturn)) setReturnDate(rawReturn)
      if (rawPassengers !== null) setPassengers(rawPassengers)
      if (rawTrip === 'oneway' || rawTrip === 'roundtrip') setTripType(rawTrip)
      setFlexDates(params.get('flex') === '1')
      setDateErrors(validateTravelDates({
        depart: rawDepart,
        returnDate: rawReturn,
        tripType: rawTrip === 'oneway' ? 'oneway' : 'roundtrip',
      }))
      setFormError(parsed.error)
      setView('form')
      return
    }

    if (parsed.criteria) {
      setOrigin(parsed.criteria.origin)
      setOriginDisplay(parsed.criteria.originDisplay)
      setDest(parsed.criteria.dest)
      setDestDisplay(parsed.criteria.destDisplay)
      setOriginSelectionSource('resolved')
      setDestSelectionSource(parsed.criteria.dest ? 'resolved' : null)
      setDepart(parsed.criteria.depart)
      setReturnDate(parsed.criteria.returnDate)
      setPassengers(parsed.criteria.passengers)
      setTripType(parsed.criteria.tripType)
      setFlexDates(parsed.criteria.flexDates)
      setView('form')
    }
  }, [])

  useEffect(() => {
    if (tripType === 'oneway') {
      setDateErrors(prev => ({ ...prev, returnDate: undefined }))
    }
  }, [tripType])

  useEffect(() => {
    if (!origin || !dest) {
      setCalendarPrices({})
      return
    }

    fetch(`/api/calendar?origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(dest)}`)
      .then(response => response.json())
      .then(data => setCalendarPrices(data as Record<string, number>))
      .catch(() => {})
  }, [origin, dest])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('expaify_recent')
      if (stored) setRecentSearches(JSON.parse(stored) as RecentSearch[])
    } catch {}
  }, [])

  function fireScore(fare: NormalizedFare) {
    setScoreLoading(prev => new Set(prev).add(fare.id))

    fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fare }),
    })
      .then(response => response.ok ? response.json() as Promise<DealScore> : Promise.reject())
      .then(score => setScores(prev => ({ ...prev, [fare.id]: score })))
      .catch(() => setScores(prev => ({ ...prev, [fare.id]: null })))
      .finally(() => {
        setScoreLoading(prev => {
          const next = new Set(prev)
          next.delete(fare.id)
          return next
        })
      })
  }

  function fireHotelScore(hotel: HotelOffer) {
    setHotelScoreLoading(prev => new Set(prev).add(hotel.id))

    const params = new URLSearchParams({
      type: 'hotel',
      hotelId: hotel.id,
      pricePerNightCents: String(hotel.pricePerNight.priceCents),
      currency: hotel.pricePerNight.currency,
    })

    fetch(`/api/score?${params.toString()}`)
      .then(response => response.ok ? response.json() as Promise<DealScore> : Promise.reject())
      .then(score => setHotelScores(prev => ({ ...prev, [hotel.id]: score })))
      .catch(() => setHotelScores(prev => ({ ...prev, [hotel.id]: null })))
      .finally(() => {
        setHotelScoreLoading(prev => {
          const next = new Set(prev)
          next.delete(hotel.id)
          return next
        })
      })
  }

  function currentCriteria(): SearchCriteria {
    return {
      origin,
      dest,
      originDisplay,
      destDisplay,
      depart,
      returnDate,
      passengers,
      tripType,
      flexDates,
    }
  }

  function syncUrl(criteria: SearchCriteria, state: { activeTab?: ActiveTab; sortBy?: SortBy; filterStops?: number | null } = {}) {
    const url = new URL(window.location.href)
    url.search = buildSearchParams(criteria, {
      activeTab: state.activeTab ?? activeTab,
      sortBy: state.sortBy ?? sortBy,
      filterStops: state.filterStops ?? filterStops,
    }).toString()
    window.history.replaceState(null, '', url.toString())
  }

  async function runSearch(searchCriteria = currentCriteria(), options: { activeTab?: ActiveTab; updateUrl?: boolean } = {}) {
    const normalized: SearchCriteria = {
      ...searchCriteria,
      origin: searchCriteria.origin.trim(),
      dest: searchCriteria.dest.trim(),
      originDisplay: searchCriteria.originDisplay || searchCriteria.origin.trim(),
      destDisplay: searchCriteria.destDisplay || searchCriteria.dest.trim(),
      returnDate: searchCriteria.tripType === 'roundtrip' ? searchCriteria.returnDate : '',
    }
    if (!normalized.origin) {
      setFormError(normalized.originDisplay.trim() ? 'Choose a valid origin airport from the list.' : 'Add an origin to search.')
      setDateErrors({})
      setView('form')
      return
    }
    if (!normalized.dest && normalized.destDisplay.trim()) {
      setFormError('Choose a valid destination airport from the list.')
      setDateErrors({})
      setView('form')
      return
    }
    const nextDateErrors = validateTravelDates(normalized)
    if (nextDateErrors.depart || nextDateErrors.returnDate) {
      setDateErrors(nextDateErrors)
      setFormError('Correct the highlighted date fields before searching.')
      setView('form')
      return
    }

    setIsSearching(true)
    setFormError(null)
    setDateErrors({})
    setOriginSelectionSource('selected')
    if (normalized.dest) setDestSelectionSource('selected')
    const entry = {
      origin: normalized.origin,
      dest: normalized.dest,
      originDisplay: normalized.originDisplay,
      destDisplay: normalized.destDisplay,
    }
    setRecentSearches(prev => {
      const deduped = [entry, ...prev.filter(r => !(r.origin === entry.origin && r.dest === entry.dest))].slice(0, 5)
      try {
        localStorage.setItem('expaify_recent', JSON.stringify(deduped))
      } catch {}
      return deduped
    })
    setError(null)
    setSuggestion(null)
    setProviderNotices([])
    setHotelAvailability(searchIntent !== 'flights' && normalized.dest && normalized.depart && normalized.returnDate && normalized.tripType === 'roundtrip' ? 'loading' : 'skipped')
    setHotelAvailabilityMessage(null)
    setFlights([])
    setHotels([])
    setScores({})
    setHotelScores({})
    setScoreLoading(new Set())
    setHotelScoreLoading(new Set())
    setAlertEmail('')
    setAlertSent(false)
    setView('results')
    const nextActiveTab = options.activeTab ?? activeTabForIntent(searchIntent)
    setActiveTab(nextActiveTab)
    progressKey.current += 1
    if (options.updateUrl) syncUrl(normalized, { activeTab: nextActiveTab })

    try {
      const params = buildSearchParams(normalized)

      const response = await fetch(`/api/search?${params.toString()}`)
      if (!response.ok || !response.body) {
        let message = 'Search failed'
        try {
          const data = await response.json() as { error?: string }
          if (data.error) message = data.error
        } catch {}
        throw new Error(message)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      const accumulated: NormalizedFare[] = []
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue

          try {
            const message = JSON.parse(line) as {
              type: string
              data?: unknown
              message?: string
              provider?: string
              status?: string
            }
            if (message.type === 'flights' && Array.isArray(message.data)) {
              const newFares = message.data as NormalizedFare[]
              accumulated.push(...newFares)
              setFlights(dedup(accumulated))
              newFares.forEach(fireScore)
            } else if (message.type === 'hotels' && Array.isArray(message.data)) {
              const newHotels = message.data as HotelOffer[]
              setHotels(newHotels)
              setHotelAvailability(newHotels.length > 0 ? 'available' : 'empty')
              newHotels.forEach(fireHotelScore)
            } else if (message.type === 'hotel-status' && typeof message.status === 'string') {
              const status = message.status as HotelAvailability
              if (['available', 'empty', 'unavailable', 'skipped'].includes(status)) {
                setHotelAvailability(status)
                setHotelAvailabilityMessage(typeof message.message === 'string' ? message.message : null)
              }
            } else if (message.type === 'suggestion' && typeof message.message === 'string') {
              setSuggestion(message.message)
            } else if (message.type === 'notice' && typeof message.message === 'string') {
              const status = (
                message.status === 'no_supply' ||
                message.status === 'malformed_response' ||
                message.status === 'unavailable'
                  ? message.status
                  : 'unavailable'
              ) satisfies ProviderIssueStatus
              const notice: ProviderNotice = {
                provider: typeof message.provider === 'string' ? message.provider : 'Provider',
                status,
                message: message.message,
              }
              setProviderNotices(prev => (
                prev.some(item =>
                  item.provider === notice.provider &&
                  item.status === notice.status &&
                  item.message === notice.message
                ) ? prev : [...prev, notice]
              ))
            } else if (message.type === 'done') {
              setIsSearching(false)
            }
          } catch {
            // Skip malformed NDJSON lines without failing the whole search.
          }
        }
      }

      setIsSearching(false)
    } catch (e) {
      setError(e instanceof Error && e.message !== 'Search failed' ? e.message : 'Something went wrong. Please try again.')
      setIsSearching(false)
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runSearch(currentCriteria(), { updateUrl: true })
  }

  async function handleAlertSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!alertEmail || !origin.trim() || !dest.trim() || flights.length === 0) return

    setAlertLoading(true)
    setAlertError(null)
    setAlertSent(false)

    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: alertEmail,
          origin: origin.trim(),
          dest: dest.trim(),
          thresholdCents: Math.min(...flights.map(fare => fare.price.priceCents)),
        }),
      })
      const data = await response.json() as AlertSignupResponse

      if (response.ok && data.ok) {
        setAlertSent(true)
      } else {
        setAlertError(data.ok ? 'Price alert signup is unavailable right now. Please try again.' : data.reason || 'Price alert signup is unavailable right now. Please try again.')
      }
    } catch {
      setAlertError('Price alert signup is unavailable right now. Please try again.')
    } finally {
      setAlertLoading(false)
    }
  }

  function handleShare() {
    const url = new URL(window.location.href)
    url.search = buildSearchParams(currentCriteria(), { activeTab, sortBy, filterStops }).toString()
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleActiveTabChange(tab: ActiveTab) {
    setActiveTab(tab)
    syncUrl(currentCriteria(), { activeTab: tab })
  }

  function focusDepartField() {
    window.setTimeout(() => {
      document.getElementById('depart')?.focus()
    }, 0)
  }

  function handleEditSearch(nextIntent?: SearchIntent, focusDates = false) {
    if (nextIntent) setSearchIntent(nextIntent)
    setView('form')
    if (focusDates) focusDepartField()
  }

  function handleTryFlexibleDates() {
    const criteria = { ...currentCriteria(), flexDates: true }
    if (!criteria.depart || (criteria.tripType === 'roundtrip' && !criteria.returnDate)) {
      handleEditSearch(undefined, true)
      return
    }

    setFlexDates(true)
    void runSearch(criteria, { updateUrl: true, activeTab: 'flights' })
  }

  function handleSearchAnywhere() {
    const criteria = {
      ...currentCriteria(),
      dest: '',
      destDisplay: '',
    }
    setSelectedInspiration(null)
    setDest('')
    setDestDisplay('')
    setDestSelectionSource(null)
    void runSearch(criteria, { updateUrl: true, activeTab: 'flights' })
  }

  function handleTryNearbyOrigin(iata: string) {
    const criteria = {
      ...currentCriteria(),
      origin: iata,
      originDisplay: iata,
    }
    setSelectedInspiration(null)
    setOrigin(iata)
    setOriginDisplay(iata)
    setOriginSelectionSource('selected')
    void runSearch(criteria, { updateUrl: true, activeTab: 'flights' })
  }

  function handleHotelChangeDates() {
    handleEditSearch(activeTab === 'hotels' ? 'hotels' : searchIntent, true)
  }

  function handleSearchHotelsNearby() {
    handleEditSearch(searchIntent === 'flights' ? 'hotels' : searchIntent, false)
  }

  function handleSearchIntentChange(intent: SearchIntent) {
    setSelectedInspiration(null)
    setSearchIntent(intent)
    setFormError(null)
    if (intent !== 'hotels') return
    setDateErrors(prev => ({ ...prev, returnDate: undefined }))
  }

  function setSortByAndUrl(value: SortBy | ((previous: SortBy) => SortBy)) {
    setSortBy(previous => {
      const next = typeof value === 'function' ? value(previous) : value
      syncUrl(currentCriteria(), { sortBy: next })
      return next
    })
  }

  function setFilterStopsAndUrl(value: number | null | ((previous: number | null) => number | null)) {
    setFilterStops(previous => {
      const next = typeof value === 'function' ? value(previous) : value
      syncUrl(currentCriteria(), { filterStops: next })
      return next
    })
  }

  function handleSwap() {
    const tmpIata = origin
    const tmpDisplay = originDisplay
    const tmpSource = originSelectionSource
    setSelectedInspiration(null)
    setOrigin(dest)
    setOriginDisplay(destDisplay)
    setOriginSelectionSource(dest ? destSelectionSource : null)
    setDest(tmpIata)
    setDestDisplay(tmpDisplay)
    setDestSelectionSource(tmpIata ? tmpSource : null)
  }

  function handleTripInspirationSelect(item: TripInspirationItem) {
    const fallbackOrigin = !origin.trim()
    const nextOrigin = fallbackOrigin ? item.originIata : origin
    const nextOriginDisplay = fallbackOrigin
      ? originDisplayForInspiration(item.originIata)
      : originDisplay || originDisplayForInspiration(origin)
    const nextDepart = firstValidFridayForMonth(item.suggestedMonth)
    const nextReturnDate = addDaysIso(nextDepart, item.minNights)
    const nextDestDisplay = `${item.destinationCity} (${item.destinationIata})`

    setOrigin(nextOrigin)
    setOriginDisplay(nextOriginDisplay)
    setOriginSelectionSource(nextOrigin ? 'selected' : null)
    setDest(item.destinationIata)
    setDestDisplay(nextDestDisplay)
    setDestSelectionSource('selected')
    setDepart(nextDepart)
    setReturnDate(nextReturnDate)
    setTripType('roundtrip')
    setFlexDates(true)
    setSearchIntent('trip')
    setFormError(null)
    setDateErrors({})
    setSelectedInspiration({
      item,
      origin: nextOrigin,
      originDisplay: nextOriginDisplay,
      depart: nextDepart,
      returnDate: nextReturnDate,
      fallbackOrigin,
    })
  }

  function handleRecentSearchSelect(recent: RecentSearch) {
    setSelectedInspiration(null)
    setOrigin(recent.origin)
    setDest(recent.dest)
    setOriginDisplay(recent.originDisplay)
    setDestDisplay(recent.destDisplay)
    setOriginSelectionSource(recent.origin ? 'selected' : null)
    setDestSelectionSource(recent.dest ? 'selected' : null)
    setFormError(null)
  }

  const filteredFlights = useMemo(() => {
    let list = [...flights]
    if (filterStops !== null) list = list.filter(fare => fare.stops === filterStops)
    return list
  }, [flights, filterStops])

  const visibleScoresSettled = useMemo(
    () => filteredFlights.every(fare => Object.prototype.hasOwnProperty.call(scores, fare.id)),
    [filteredFlights, scores]
  )

  const rankingUpdating =
    sortBy === 'deal' &&
    filteredFlights.length > 0 &&
    (isSearching || scoreLoading.size > 0 || !visibleScoresSettled)

  const displayFlights = useMemo(() => {
    return sortFlights(filteredFlights, sortBy, scores, { deferDealSort: rankingUpdating })
  }, [filteredFlights, sortBy, scores, rankingUpdating])

  const routeLabel = [originDisplay || origin, destDisplay || dest].filter(Boolean).join(' → ')
  const originError = formError === 'Choose a valid origin airport from the list.' ? formError : null
  const destError = formError === 'Choose a valid destination airport from the list.' ? formError : null
  const originNearbyAvailable = Boolean(origin && getNearby(origin).length > 0)
  const destNearbyAvailable = Boolean(dest && getNearby(dest).length > 0)
  const visibleReturnDate = tripType === 'roundtrip' ? returnDate : ''
  const searchSummaryLabel = labelForIntent(searchIntent)
  const resultContext = [
    searchSummaryLabel,
    routeLabel || 'Anywhere',
    depart && visibleReturnDate ? `${depart} - ${visibleReturnDate}` : depart,
    passengers === 1 ? '1 traveler' : `${passengers} travelers`,
  ].filter(Boolean).join(' · ')
  const greatCount = Object.values(scores).filter(score => score?.verdict === 'Great').length
  const submittedCriteria = currentCriteria()
  const flightProviderIssue = providerNotices.some(notice =>
    !isHotelNotice(notice) && (notice.status === 'unavailable' || notice.status === 'malformed_response')
  )
  const flightStatus: InventoryStatus = flights.length > 0
    ? 'available'
    : searchIntent === 'hotels'
      ? 'not_checked'
      : isSearching
        ? 'checking'
        : flightProviderIssue
          ? 'unavailable'
          : 'empty'
  const hotelDetailsMissing = !dest.trim() || !depart || !returnDate || tripType !== 'roundtrip'
  const hotelStatus: InventoryStatus = hotels.length > 0
    ? 'available'
    : searchIntent === 'flights' || hotelAvailability === 'skipped' || hotelDetailsMissing
      ? 'not_checked'
      : isSearching && hotelAvailability === 'loading'
        ? 'checking'
        : hotelAvailability === 'unavailable'
          ? 'unavailable'
          : hotelAvailability === 'empty'
            ? 'empty'
            : 'not_checked'
  const inventoryStatuses: Record<ActiveTab, InventoryStatus> = {
    flights: flightStatus,
    hotels: hotelStatus,
  }
  const inventoryCounts: Record<ActiveTab, number> = {
    flights: flights.length,
    hotels: hotels.length,
  }
  const inventoryKinds: Record<ActiveTab, InventoryKind> = {
    flights: 'Flights',
    hotels: 'Hotels',
  }
  const flightSummary = inventorySummary('Flights', flightStatus, flights.length)
  const hotelSummary = inventorySummary('Hotels', hotelStatus, hotels.length)
  const travelerSummary = passengers === 1 ? '1 traveler' : `${passengers} travelers`
  const resultInventorySummary = `${flightSummary} · ${hotelSummary} · ${travelerSummary}`
  const inactiveTab: ActiveTab = activeTab === 'flights' ? 'hotels' : 'flights'
  const inactiveStatus = inventoryStatuses[inactiveTab]
  const inactiveHelper = inactiveStatus === 'available'
    ? null
    : inventoryHelperCopy(inventoryKinds[inactiveTab], inactiveStatus, submittedCriteria, searchIntent)
  const hotelUnavailableCopy =
    hotelStatus === 'unavailable'
      ? 'Hotel inventory was not confirmed because the provider is unavailable. Retry this search or edit trip details.'
      : hotelStatus === 'not_checked'
        ? hotelNotCheckedCopy(submittedCriteria, searchIntent)
        : hotelStatus === 'empty'
          ? hotelAvailabilityMessage ?? 'No hotels were returned for these dates. Change dates or broaden the stay area.'
          : 'Hotel availability is still loading.'
  const hotelEmptyTitle =
    hotelStatus === 'empty'
      ? 'No hotels returned'
      : hotelStatus === 'unavailable'
        ? 'Hotels unavailable'
        : !dest.trim()
          ? 'Hotel destination needed'
          : (!depart || !returnDate || tripType !== 'roundtrip')
            ? 'Hotel dates needed'
            : 'Hotels not checked'
  const inspirationOrigin = selectedInspiration?.fallbackOrigin ? '' : origin
  const inspirationState = useMemo(() => {
    try {
      return { items: getTripInspiration(inspirationOrigin), error: null as string | null }
    } catch {
      return { items: [] as TripInspirationItem[], error: 'Trip ideas are unavailable right now. You can still search live fares and hotels.' }
    }
  }, [inspirationOrigin])

  useEffect(() => {
    if (view !== 'results' || error) return

    const nextAnnouncement = [
      liveInventoryLabel('Flights', flightStatus, flights.length),
      liveInventoryLabel('Hotels', hotelStatus, hotels.length),
    ].join('. ')

    if (previousInventoryAnnouncement.current && previousInventoryAnnouncement.current !== nextAnnouncement) {
      setInventoryAnnouncement(nextAnnouncement)
    }
    previousInventoryAnnouncement.current = nextAnnouncement
  }, [error, flightStatus, flights.length, hotelStatus, hotels.length, view])

  function handleInventoryTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, tab: ActiveTab) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

    event.preventDefault()
    const tabs: ActiveTab[] = ['flights', 'hotels']
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const currentIndex = tabs.indexOf(tab)
    const nextTab = tabs[(currentIndex + direction + tabs.length) % tabs.length]
    const nextDisabled = inventoryStatuses[nextTab] === 'not_checked' && activeTab !== nextTab

    if (!nextDisabled) {
      handleActiveTabChange(nextTab)
      window.setTimeout(() => document.getElementById(`${nextTab}-results-tab`)?.focus(), 0)
    }
  }

  if (view === 'form') {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[#f5f7fb] text-slate-950">
        <ThemeToggle />

        <div id="search" className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex min-h-10 items-center justify-between pr-12">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
                <IconPlane />
              </span>
              <div>
                <p className="font-display text-xl font-extrabold leading-none tracking-tight text-slate-950">expaify</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">Travel deal intelligence</p>
              </div>
            </div>
          </header>

          <div className="grid flex-1 items-start gap-4 py-4 sm:gap-8 sm:py-8 lg:grid-cols-[minmax(0,0.86fr)_minmax(620px,1.14fr)] lg:items-center lg:py-10">
            <section className="hidden max-w-xl animate-fade-up lg:block">
              <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-slate-950 lg:text-6xl">
                Find flight deals.
              </h1>
              <p className="mt-4 text-base font-medium text-slate-500">
                Fares scored against 90-day route history.
              </p>
            </section>

            <section className="animate-fade-up delay-75 rounded-[1rem] border border-[var(--border)] bg-[var(--bg-raised)] p-3 shadow-[var(--shadow-card)] sm:rounded-[1.75rem] sm:p-4 sm:shadow-[0_24px_70px_rgba(15,23,42,0.13)]">
              <div className="mb-3 px-1 pt-1 sm:px-2">
                <h1 className="font-display text-base font-extrabold tracking-tight text-[var(--text-1)] lg:text-lg">Search</h1>
              </div>

              <fieldset className="mb-3 sm:mb-4">
                <legend className="sr-only">Search intent</legend>
                <div className="grid grid-cols-3 gap-1 rounded-[var(--radius-control)] bg-[var(--bg-muted)] p-1">
                  {searchIntentOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSearchIntentChange(option.value)}
                      aria-pressed={searchIntent === option.value}
                      className={`min-h-10 rounded-[var(--radius-control)] border px-2 py-2 text-center text-[0.8125rem] font-bold leading-4 transition-colors focus-visible:outline-none sm:min-h-[4.25rem] sm:px-3 sm:py-2.5 sm:text-left sm:text-sm ${
                        searchIntent === option.value
                          ? 'border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-1)] shadow-sm'
                          : 'border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]'
                      }`}
                    >
                      <span className="block">{option.label}</span>
                      <span className="mt-0.5 hidden text-xs font-semibold leading-4 text-[var(--text-3)] sm:block">
                        {option.description}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <form onSubmit={handleSearch} className="space-y-3 sm:space-y-4">
                <fieldset>
                  <legend className="sr-only">Trip type</legend>
                  <div className="flex rounded-[var(--radius-control)] bg-[var(--bg-muted)] p-1">
                    {(['roundtrip', 'oneway'] as TripType[]).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => { setTripType(type); setSelectedInspiration(null); setFormError(null) }}
                        aria-pressed={tripType === type}
                        className={`min-h-10 flex-1 rounded-[var(--radius-control)] border px-3 py-2 text-sm font-bold transition-colors sm:min-h-11 ${
                          tripType === type
                            ? 'border-[var(--border)] bg-[var(--bg-raised)] text-[var(--text-1)] shadow-sm'
                            : 'border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]'
                        }`}
                      >
                        {type === 'roundtrip' ? 'Round trip' : 'One way'}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 items-end gap-2 sm:gap-3 lg:grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)]">
                <div>
                  <label htmlFor="origin" className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-3)]">From</label>
                  <AirportInput
                    id="origin"
                    value={origin}
                    displayValue={originDisplay}
                    onChange={(iata, display) => { setSelectedInspiration(null); setOrigin(iata); setOriginDisplay(display); setOriginSelectionSource(iata ? 'selected' : null); setFormError(null); setDateErrors({}) }}
                    placeholder="City or airport"
                    required
                    selectionKind={originSelectionSource}
                    error={originError}
                    nearbyAvailable={originNearbyAvailable}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSwap}
                  aria-label="Swap origin and destination"
                    className="mx-auto flex h-10 w-10 rotate-90 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-2)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] sm:h-11 sm:w-11 lg:rotate-0"
                >
                  <IconSwap />
                </button>

                <div>
                  <label htmlFor="dest" className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-3)]">To</label>
                  <AirportInput
                    id="dest"
                    value={dest}
                    displayValue={destDisplay}
                    onChange={(iata, display) => { setSelectedInspiration(null); setDest(iata); setDestDisplay(display); setDestSelectionSource(iata ? 'selected' : null); setFormError(null); setDateErrors({}) }}
                    placeholder="City or airport"
                    selectionKind={destSelectionSource}
                    error={destError}
                    nearbyAvailable={destNearbyAvailable}
                  />
                </div>
              </div>

                <div className={`grid gap-2 sm:gap-3 ${tripType === 'roundtrip' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label htmlFor="depart" className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-3)]">Depart</label>
                  <div className="relative">
                      <IconCalendar className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
                    <input
                      id="depart"
                      type="date"
                      value={depart}
                      min={todayIso()}
                      aria-invalid={dateErrors.depart ? 'true' : 'false'}
                      aria-describedby={dateErrors.depart ? 'depart-error' : undefined}
                      onChange={event => { setSelectedInspiration(null); setDepart(event.target.value); setFormError(null); setDateErrors(prev => ({ ...prev, depart: undefined })) }}
                      className={`min-h-[3.25rem] w-full rounded-[var(--radius-control)] border bg-[var(--bg-surface)] py-3.5 pl-11 pr-4 text-[0.9375rem] font-semibold text-[var(--text-1)] transition-[border-color,box-shadow,background] [color-scheme:light] focus:bg-[var(--bg-raised)] focus:outline-none focus:ring-4 ${
                        dateErrors.depart
                          ? 'border-[var(--border-strong)] focus:border-[var(--border-strong)] focus:ring-[var(--error-soft)]'
                          : 'border-[var(--border)] focus:border-[var(--border-focus)] focus:ring-indigo-500/10'
                      }`}
                    />
                  </div>
                  {dateErrors.depart && (
                    <p id="depart-error" className="mt-1.5 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--error-soft)] px-3 py-2 text-sm font-semibold leading-5 text-[var(--error)]" role="alert">
                      {dateErrors.depart}
                    </p>
                  )}
                </div>

                {tripType === 'roundtrip' && (
                  <div>
                    <label htmlFor="return-date" className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-3)]">Return</label>
                    <div className="relative">
                        <IconCalendar className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
                      <input
                        id="return-date"
                        type="date"
                        value={returnDate}
                        min={depart || todayIso()}
                        aria-invalid={dateErrors.returnDate ? 'true' : 'false'}
                        aria-describedby={dateErrors.returnDate ? 'return-date-error' : undefined}
                        onChange={event => { setSelectedInspiration(null); setReturnDate(event.target.value); setFormError(null); setDateErrors(prev => ({ ...prev, returnDate: undefined })) }}
                        className={`min-h-[3.25rem] w-full rounded-[var(--radius-control)] border bg-[var(--bg-surface)] py-3.5 pl-11 pr-4 text-[0.9375rem] font-semibold text-[var(--text-1)] transition-[border-color,box-shadow,background] [color-scheme:light] focus:bg-[var(--bg-raised)] focus:outline-none focus:ring-4 ${
                          dateErrors.returnDate
                            ? 'border-[var(--border-strong)] focus:border-[var(--border-strong)] focus:ring-[var(--error-soft)]'
                            : 'border-[var(--border)] focus:border-[var(--border-focus)] focus:ring-indigo-500/10'
                        }`}
                      />
                    </div>
                    {dateErrors.returnDate && (
                      <p id="return-date-error" className="mt-1.5 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--error-soft)] px-3 py-2 text-sm font-semibold leading-5 text-[var(--error)]" role="alert">
                        {dateErrors.returnDate}
                      </p>
                    )}
                  </div>
                )}
              </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="flex min-h-11 cursor-pointer select-none items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-left text-sm font-semibold text-[var(--text-1)] sm:min-h-14 sm:px-4">
                    <span className="min-w-0">
                      <span className="block text-xs leading-4 sm:text-sm sm:leading-5">{flexDates ? 'Flexible dates on' : 'Flexible dates off'}</span>
                      <span className="hidden text-xs font-medium text-[var(--text-3)] sm:block">Search nearby dates when possible</span>
                    </span>
                    <input
                      type="checkbox"
                      aria-label="Flexible dates"
                      checked={flexDates}
                      onChange={e => { setSelectedInspiration(null); setFlexDates(e.target.checked) }}
                      className="h-5 w-5 rounded border-slate-300 bg-white accent-indigo-600"
                    />
                  </label>

                  <div className="flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm font-semibold text-[var(--text-1)] sm:min-h-14 sm:px-4">
                    <span className="min-w-0">
                      <span className="block text-xs leading-4 sm:text-sm sm:leading-5">{passengers === 1 ? '1 traveler' : `${passengers} travelers`}</span>
                      <span className="hidden text-xs font-medium text-[var(--text-3)] sm:block">Passengers</span>
                    </span>
                    <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => { setPassengers(p => Math.max(1, p - 1)); setFormError(null) }}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-raised)] text-base font-bold text-[var(--text-2)] transition-colors hover:border-[var(--border-strong)] disabled:opacity-35 sm:h-9 sm:w-9"
                        disabled={passengers <= 1}
                        aria-label="Remove passenger"
                      >
                        -
                      </button>
                      <span className="w-4 text-center text-sm font-extrabold tabular-nums text-[var(--text-1)] sm:w-5">{passengers}</span>
                      <button
                        type="button"
                        onClick={() => { setPassengers(p => Math.min(9, p + 1)); setFormError(null) }}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-raised)] text-base font-bold text-[var(--text-2)] transition-colors hover:border-[var(--border-strong)] disabled:opacity-35 sm:h-9 sm:w-9"
                        disabled={passengers >= 9}
                        aria-label="Add passenger"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {formError && (
                  <div className="rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--error-soft)] px-3 py-2 text-sm font-semibold leading-5 text-[var(--error)]" role="alert">
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[0.875rem] bg-slate-950 px-6 py-4 font-display text-[0.9375rem] font-bold text-white shadow-[0_14px_30px_rgba(15,23,42,0.22)] transition-[opacity,transform,box-shadow] hover:opacity-95 hover:shadow-[0_18px_36px_rgba(15,23,42,0.26)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={isSearching}
                >
                {isSearching ? (
                  <>
                    <span className="spinner" />
                    {loadingLabelForIntent(searchIntent)}
                  </>
                ) : (
                  <>
                    {searchIntent !== 'hotels' && <IconPlane className="text-indigo-200" />}
                    {submitLabelForIntent(searchIntent)}
                  </>
                )}
              </button>
              {Object.keys(calendarPrices).length > 0 && (
                <section className="space-y-2" aria-labelledby="fare-calendar-heading">
                  <h2 id="fare-calendar-heading" className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-3)]">
                    Fare calendar
                  </h2>
                  <PriceCalendar prices={calendarPrices} selected={depart} onSelect={setDepart} />
                </section>
              )}
            </form>
          </section>
          </div>

          <TripInspirationHomeRail
            items={inspirationState.items}
            hasResolvedOrigin={Boolean(origin.trim()) && !selectedInspiration?.fallbackOrigin}
            selected={selectedInspiration}
            recentSearches={recentSearches}
            passengers={passengers}
            error={inspirationState.error}
            onSelect={handleTripInspirationSelect}
            onRecentSearch={handleRecentSearchSelect}
          />
          <SiteFooter variant="light" />
        </div>
      </main>
    )
  }

  return (
    <main id="search" className="min-h-screen bg-[#07091A]">
      <ThemeToggle />

      {isSearching && <div key={progressKey.current} className="search-progress-bar" />}

      <header className="sticky top-0 z-20 border-b border-white/8 bg-[#07091A]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 pr-16 sm:gap-4 sm:pr-4">
          <button
            type="button"
            onClick={() => setView('form')}
            className="font-display shrink-0 text-lg font-extrabold tracking-tighter text-white transition-opacity hover:opacity-70 sm:text-xl"
          >
            expaify
          </button>

          <button
            type="button"
            onClick={() => setView('form')}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-left transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/[0.05] sm:gap-3 sm:px-4"
          >
            <IconPlane className="shrink-0 text-indigo-400" />
            <span className="truncate text-sm font-semibold text-gray-200">
              {routeLabel || 'Anywhere'}
            </span>
            {depart && (
              <span className="hidden shrink-0 text-sm text-gray-500 sm:inline">
                {depart}{visibleReturnDate ? ` - ${visibleReturnDate}` : ''}
              </span>
            )}
            <span className="ml-auto shrink-0 text-xs font-medium text-gray-600">
              Edit
            </span>
          </button>
        </div>
      </header>

      <div id="results" className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 flex flex-col gap-3 animate-fade-in sm:flex-row sm:items-start">
          {isSearching ? (
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 dot-pulse" />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 dot-pulse-2" />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 dot-pulse-3" />
              </div>
              <p className="text-sm text-gray-400">{loadingLabelForIntent(searchIntent)}</p>
            </div>
          ) : error ? (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-200">Search needs attention</p>
              <p className="mt-0.5 truncate text-xs font-medium text-gray-500">
                {resultContext}
              </p>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-200">
                {searchSummaryLabel} · {routeLabel || 'Anywhere'}
              </p>
              <p className="mt-0.5 text-xs font-medium text-gray-500">
                {resultInventorySummary}
              </p>
              {greatCount > 0 && (
                <p className="mt-0.5 text-xs font-semibold text-emerald-400">
                  {greatCount} great deal{greatCount === 1 ? '' : 's'}
                </p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={handleShare}
            className="btn-pill flex min-h-10 items-center gap-1.5 self-start sm:ml-auto"
            title="Copy link"
          >
            {copied ? (
              <>
                <span className="text-emerald-400">✓</span>
                Copied!
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
                </svg>
                Share
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mb-6">
            <ResultsStatePanel
              eyebrow="Search error"
              title="We could not complete this search"
              tone="error"
              action={(
                <button
                  type="button"
                  onClick={() => void runSearch()}
                  className="btn-primary min-h-12 whitespace-nowrap px-5 py-3 text-sm"
                >
                  Retry search
                </button>
              )}
              secondaryAction={(
                <button
                  type="button"
                  onClick={() => setView('form')}
                  className="btn-pill min-h-11 w-full px-4 py-2.5 text-sm"
                >
                  Edit search
                </button>
              )}
            >
              <p>{error}</p>
              <p className="mt-2 text-xs font-medium leading-5 text-[var(--text-3)]">
                {resultContext}
              </p>
            </ResultsStatePanel>
          </div>
        )}

        {!error && (
          <>
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {inventoryAnnouncement}
            </div>

            <div
              className="mb-6 grid grid-cols-2 border-b border-white/8 sm:flex sm:overflow-x-auto scrollbar-hide"
              role="tablist"
              aria-label="Search result inventory"
            >
              {(['flights', 'hotels'] as ActiveTab[]).map(tab => {
                const active = activeTab === tab
                const status = inventoryStatuses[tab]
                const count = inventoryCounts[tab]
                const kind = inventoryKinds[tab]
                const disabled = status === 'not_checked' && !active
                const notCheckedReason = tab === 'hotels'
                  ? hotelNotCheckedCopy(submittedCriteria, searchIntent).replace(/\.$/, '').toLowerCase()
                  : 'choose a flight or flight + hotel search'
                return (
                  <button
                    key={tab}
                    id={`${tab}-results-tab`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls={`${tab}-results-panel`}
                    aria-label={inventoryAriaLabel(kind, status, count, status === 'not_checked' ? notCheckedReason : undefined)}
                    tabIndex={active ? 0 : -1}
                    onClick={() => {
                      if (!disabled) handleActiveTabChange(tab)
                    }}
                    onKeyDown={event => handleInventoryTabKeyDown(event, tab)}
                    disabled={disabled}
                    aria-disabled={disabled}
                    className={`relative min-h-14 px-3 py-3 text-left text-sm font-bold transition-colors focus-visible:outline-none sm:min-h-11 sm:px-5 ${
                      disabled
                        ? 'cursor-not-allowed text-gray-700'
                        : active ? 'text-gray-100' : 'text-gray-600 hover:text-gray-300'
                    }`}
                  >
                    <span className="block sm:inline">{kind}</span>
                    <span className={`mt-1 inline-flex w-fit items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold sm:ml-2 sm:mt-0 ${statusBadgeClass(status, active)}`}>
                      {inventoryBadge(status, count)}
                    </span>
                    {active && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-t-full bg-indigo-400" />
                    )}
                  </button>
                )
              })}
            </div>

            {inactiveHelper && (
              <div className="mb-6 rounded-[var(--radius-card)] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-gray-500">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-300">{inactiveHelper.title}</p>
                    <p className="mt-0.5">{inactiveHelper.body}</p>
                  </div>
                  {inactiveHelper.action !== 'none' && (
                    <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
                      {(inactiveHelper.action === 'retry-edit') && (
                        <button
                          type="button"
                          onClick={() => void runSearch()}
                          className="btn-primary min-h-11 justify-center px-4 py-2.5 text-sm"
                        >
                          Retry search
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={inactiveHelper.action === 'change-dates-hotels' ? handleHotelChangeDates : () => handleEditSearch()}
                        className={`${inactiveHelper.action === 'retry-edit' ? 'btn-pill' : 'btn-primary'} min-h-11 justify-center px-4 py-2.5 text-sm`}
                      >
                        {inactiveHelper.action === 'change-dates-hotels' ? 'Change dates' : inactiveHelper.action === 'retry-edit' ? 'Edit search' : 'Edit search'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'flights' && (
              <section
                id="flights-results-panel"
                role="tabpanel"
                aria-labelledby="flights-results-tab"
              >
                <FlightResults
                  flights={flights}
                  displayFlights={displayFlights}
                  isSearching={isSearching}
                  sortBy={sortBy}
                  setSortBy={setSortByAndUrl}
                  filterStops={filterStops}
                  setFilterStops={setFilterStopsAndUrl}
                  scores={scores}
                  scoreLoading={scoreLoading}
                  rankingUpdating={rankingUpdating}
                  suggestion={suggestion}
                  providerNotices={providerNotices}
                  origin={origin}
                  dest={dest}
                  depart={depart}
                  returnDate={returnDate}
                  tripType={tripType}
                  flexDates={flexDates}
                  searchContext={resultContext}
                  alertEmail={alertEmail}
                  setAlertEmail={setAlertEmail}
                  alertSent={alertSent}
                  alertLoading={alertLoading}
                  alertError={alertError}
                  handleAlertSubmit={handleAlertSubmit}
                  onEditSearch={() => handleEditSearch()}
                  onRetrySearch={() => void runSearch()}
                  onTryFlexibleDates={handleTryFlexibleDates}
                  onSearchAnywhere={handleSearchAnywhere}
                  onTryNearbyOrigin={handleTryNearbyOrigin}
                />
              </section>
            )}

            {activeTab === 'hotels' && (
              <section
                id="hotels-results-panel"
                role="tabpanel"
                aria-labelledby="hotels-results-tab"
              >
                {isSearching ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {hotels.map((hotel, index) => (
                      <div key={hotel.id} className={`animate-fade-up ${delays[Math.min(index, delays.length - 1)]}`}>
                        <HotelCard
                          hotel={hotel}
                          score={hotelScores[hotel.id] ?? null}
                          loading={hotelScoreLoading.has(hotel.id)}
                        />
                      </div>
                    ))}
                    {Array.from({ length: hotels.length > 0 ? 2 : 6 }).map((_, index) => (
                      <HotelSkeleton key={`hotel-skeleton-${index}`} />
                    ))}
                  </div>
                ) : hotels.length === 0 ? (
                  <ResultsStatePanel
                    eyebrow="Hotel results"
                    title={hotelEmptyTitle}
                    tone={hotelStatus === 'unavailable' ? 'warning' : 'default'}
                    action={(
                      <button
                        type="button"
                        onClick={
                          hotelStatus === 'unavailable'
                            ? () => void runSearch()
                            : hotelStatus === 'empty'
                              ? handleHotelChangeDates
                              : () => handleEditSearch()
                        }
                        className="btn-primary min-h-11 px-4 py-2.5 text-sm"
                      >
                        {hotelStatus === 'unavailable'
                          ? 'Retry search'
                          : hotelStatus === 'empty'
                            ? 'Change dates'
                            : 'Edit search'}
                      </button>
                    )}
                    secondaryAction={hotelStatus === 'empty' ? (
                      <>
                        <button
                          type="button"
                          onClick={handleSearchHotelsNearby}
                          className="btn-pill min-h-11 w-full justify-center px-4 py-2.5 text-sm"
                        >
                          Search hotels nearby
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditSearch()}
                          className="btn-pill min-h-11 w-full justify-center px-4 py-2.5 text-sm"
                        >
                          Edit search
                        </button>
                      </>
                    ) : hotelStatus === 'unavailable' ? (
                      <button
                        type="button"
                        onClick={() => handleEditSearch()}
                        className="btn-pill min-h-11 w-full justify-center px-4 py-2.5 text-sm"
                      >
                        Edit search
                      </button>
                    ) : null}
                  >
                    <p>{hotelUnavailableCopy}</p>
                    <p className="mt-2 text-xs font-medium leading-5 text-[var(--text-3)]">
                      {resultContext}
                    </p>
                    {hotelStatus === 'empty' && (
                      <p className="mt-3 text-xs font-medium leading-5 text-[var(--text-3)]">
                        Search hotels nearby keeps your destination and dates ready to broaden the stay area from the form.
                      </p>
                    )}
                    {hotelStatus === 'unavailable' && hotelAvailabilityMessage && (
                      <p className="mt-3 text-xs font-medium leading-5 text-[var(--text-3)]">
                        {hotelAvailabilityMessage}
                      </p>
                    )}
                  </ResultsStatePanel>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {hotels.map((hotel, index) => (
                      <div key={hotel.id} className={`animate-fade-up ${delays[Math.min(index, delays.length - 1)]}`}>
                        <HotelCard
                          hotel={hotel}
                          score={hotelScores[hotel.id] ?? null}
                          loading={hotelScoreLoading.has(hotel.id)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
        <SiteFooter variant="dark" showResultsLink showRoutesLink={false} />
      </div>
    </main>
  )
}
