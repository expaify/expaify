'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { DealScore, HotelOffer, NormalizedFare, ProviderIssueStatus, ProviderNotice } from '@/lib/types'
import { resolveToIATA } from '@/lib/airports/resolve'
import AirportInput from './components/AirportInput'
import HotelCard from './components/HotelCard'
import FlightResults from '@/components/flights/FlightResults'
import { sortFlights } from '@/lib/search/sortFlights'

type View = 'form' | 'results'
type TripType = 'roundtrip' | 'oneway'
type SortBy = 'price' | 'deal'
type ActiveTab = 'flights' | 'hotels'
type HotelAvailability = 'idle' | 'loading' | 'available' | 'empty' | 'unavailable' | 'skipped'
type RecentSearch = { origin: string; dest: string; originDisplay: string; destDisplay: string }
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

const destinations = [
  { label: 'New York to London', origin: 'JFK', dest: 'LHR', originDisplay: 'New York (JFK)', destDisplay: 'London (LHR)', tag: 'Transatlantic', meta: 'Deal history ready' },
  { label: 'Los Angeles to Tokyo', origin: 'LAX', dest: 'NRT', originDisplay: 'Los Angeles (LAX)', destDisplay: 'Tokyo (NRT)', tag: 'Long haul', meta: 'Flexible date friendly' },
  { label: 'New York to Paris', origin: 'JFK', dest: 'CDG', originDisplay: 'New York (JFK)', destDisplay: 'Paris (CDG)', tag: 'Europe', meta: 'Popular route' },
  { label: 'New York to Dubai', origin: 'JFK', dest: 'DXB', originDisplay: 'New York (JFK)', destDisplay: 'Dubai (DXB)', tag: 'Premium cabins', meta: 'Price swings often' },
  { label: 'New York to Miami', origin: 'JFK', dest: 'MIA', originDisplay: 'New York (JFK)', destDisplay: 'Miami (MIA)', tag: 'Domestic', meta: 'Frequent fare drops' },
]

const delays = ['', 'delay-75', 'delay-150', 'delay-225', 'delay-300']

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
    const key = `${fare.carrier}:${fare.origin}:${fare.destination}:${fare.depart.slice(0, 16)}`
    const existing = best.get(key)
    if (!existing || fare.price.priceCents < existing.price.priceCents) {
      best.set(key, fare)
    }
  }

  return Array.from(best.values()).sort((a, b) => a.price.priceCents - b.price.priceCents)
}

function isValidDateParam(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function parsePositivePassengerCount(value: string | null): number | null {
  const parsed = Number(value ?? '1')
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 9 ? parsed : null
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
  const sortBy: SortBy = sortParam === 'price' ? 'price' : 'deal'
  const filterStops = stopsParam === '0' || stopsParam === '1' ? Number(stopsParam) : null

  if (!hasSearchState) {
    return { criteria: null, error: null, activeTab, sortBy, filterStops }
  }

  if (activeTabParam && activeTabParam !== 'flights' && activeTabParam !== 'hotels') {
    return { criteria: null, error: 'The results tab in this link is not valid. Choose flights or hotels.', activeTab, sortBy, filterStops }
  }
  if (sortParam && sortParam !== 'deal' && sortParam !== 'price') {
    return { criteria: null, error: 'The sort option in this link is not valid. Choose best deal or lowest price.', activeTab, sortBy, filterStops }
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
    <div className="card rounded-2xl overflow-hidden">
      <div className="h-40 shimmer" />
      <div className="space-y-3 p-5">
        <div className="h-4 w-3/4 rounded-lg shimmer" />
        <div className="h-3 w-1/2 rounded-lg shimmer" />
        <div className="flex items-end justify-between border-t border-white/5 pt-4">
          <div className="space-y-1.5">
            <div className="h-7 w-16 rounded-lg shimmer" />
            <div className="h-2.5 w-12 rounded-lg shimmer" />
          </div>
          <div className="h-10 w-32 rounded-xl shimmer" />
        </div>
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
    <div className="mt-3 rounded-xl border border-white/8 bg-white/2 p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-600">
        Cheapest days - {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
      </p>
      <div className="grid grid-cols-7 gap-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div key={day} className="py-0.5 text-center text-[9px] font-bold text-gray-700">
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
              className={`rounded-lg py-1.5 text-center transition-all ${bg} ${
                isSelected ? 'ring-1 ring-indigo-400' : 'hover:ring-1 hover:ring-white/20'
              }`}
            >
              <div className="text-[11px] font-medium text-gray-300">
                {new Date(`${date}T12:00`).getDate()}
              </div>
              {price && <div className="text-[9px] text-gray-500">${Math.round(price / 100)}</div>}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-end gap-3">
        <span className="flex items-center gap-1 text-[9px] text-gray-600">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/40" />
          Cheap
        </span>
        <span className="flex items-center gap-1 text-[9px] text-gray-600">
          <span className="inline-block h-2 w-2 rounded-sm bg-red-500/30" />
          Expensive
        </span>
      </div>
    </div>
  )
}

export default function Home() {
  const [view, setView] = useState<View>('form')
  const [tripType, setTripType] = useState<TripType>('roundtrip')
  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('')
  const [originDisplay, setOriginDisplay] = useState('')
  const [destDisplay, setDestDisplay] = useState('')
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([])
  const [depart, setDepart] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [passengers, setPassengers] = useState(1)
  const [flexDates, setFlexDates] = useState(false)
  const [flights, setFlights] = useState<NormalizedFare[]>([])
  const [hotels, setHotels] = useState<HotelOffer[]>([])
  const [scores, setScores] = useState<Record<string, DealScore | null>>({})
  const [hotelScores, setHotelScores] = useState<Record<string, DealScore | null>>({})
  const [scoreLoading, setScoreLoading] = useState<Set<string>>(new Set())
  const [hotelScoreLoading, setHotelScoreLoading] = useState<Set<string>>(new Set())
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const parsed = parseCriteriaFromUrl(params)
    setActiveTab(parsed.activeTab)
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
      if (!rawDepart || isValidDateParam(rawDepart)) setDepart(rawDepart)
      if (!rawReturn || isValidDateParam(rawReturn)) setReturnDate(rawReturn)
      if (rawPassengers !== null) setPassengers(rawPassengers)
      if (rawTrip === 'oneway' || rawTrip === 'roundtrip') setTripType(rawTrip)
      setFlexDates(params.get('flex') === '1')
      setFormError(parsed.error)
      setView('form')
      return
    }

    if (parsed.criteria) {
      setOrigin(parsed.criteria.origin)
      setOriginDisplay(parsed.criteria.originDisplay)
      setDest(parsed.criteria.dest)
      setDestDisplay(parsed.criteria.destDisplay)
      setDepart(parsed.criteria.depart)
      setReturnDate(parsed.criteria.returnDate)
      setPassengers(parsed.criteria.passengers)
      setTripType(parsed.criteria.tripType)
      setFlexDates(parsed.criteria.flexDates)
      void runSearch(parsed.criteria, { activeTab: parsed.activeTab })
    }
  }, [])

  useEffect(() => {
    if (tripType === 'oneway') setReturnDate('')
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
      setFormError('Add an origin to search.')
      setView('form')
      return
    }
    if (normalized.depart && !isValidDateParam(normalized.depart)) {
      setFormError('Use a valid departure date before searching.')
      setView('form')
      return
    }
    if (normalized.returnDate && !isValidDateParam(normalized.returnDate)) {
      setFormError('Use a valid return date before searching.')
      setView('form')
      return
    }
    if (normalized.depart && normalized.returnDate && normalized.returnDate < normalized.depart) {
      setFormError('Return date must be after departure date.')
      setView('form')
      return
    }

    setIsSearching(true)
    setFormError(null)
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
    setHotelAvailability(normalized.dest && normalized.depart && normalized.returnDate && normalized.tripType === 'roundtrip' ? 'loading' : 'skipped')
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
    setActiveTab(options.activeTab ?? 'flights')
    progressKey.current += 1
    if (options.updateUrl) syncUrl(normalized, { activeTab: options.activeTab ?? 'flights' })

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
        setAlertError(data.ok ? 'Price alert signup is unavailable right now.' : data.reason)
      }
    } catch {
      setAlertError('Network error. Please try again.')
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
    setOrigin(dest)
    setOriginDisplay(destDisplay)
    setDest(tmpIata)
    setDestDisplay(tmpDisplay)
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
  const greatCount = Object.values(scores).filter(score => score?.verdict === 'Great').length
  const hotelsTabDisabled = hotels.length === 0 && ['idle', 'skipped', 'unavailable'].includes(hotelAvailability)
  const hotelUnavailableCopy =
    hotelAvailability === 'unavailable'
      ? hotelAvailabilityMessage ?? 'The hotel provider is unavailable right now.'
      : hotelAvailability === 'skipped'
        ? !dest.trim()
          ? 'Add a destination to check hotel availability.'
          : !depart || !returnDate || tripType !== 'roundtrip'
            ? 'Add departure and return dates to check hotel availability.'
            : hotelAvailabilityMessage ?? 'Hotel availability was not checked for this search.'
        : hotelAvailability === 'empty'
          ? hotelAvailabilityMessage ?? 'No hotels were returned for these dates.'
          : 'Hotel availability is still loading.'
  const hotelEmptyTitle =
    hotelAvailability === 'empty'
      ? 'No hotel inventory found'
      : hotelAvailability === 'unavailable'
        ? 'Hotels unavailable'
        : 'Hotel dates needed'

  if (view === 'form') {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[#f5f7fb] text-slate-950">
        <ThemeToggle />

        <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
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

          <div className="grid flex-1 items-start gap-8 py-8 lg:grid-cols-[minmax(0,0.86fr)_minmax(620px,1.14fr)] lg:items-center lg:py-10">
            <section className="max-w-xl animate-fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live fare scoring
              </div>
              <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Know when a flight price is actually worth booking.
              </h1>
              <p className="mt-5 max-w-lg text-base font-medium leading-7 text-slate-600 sm:text-lg">
                Search current fares and compare each option against recent route history, median price, and deal percentile.
              </p>

              <div className="mt-7 grid grid-cols-3 gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="min-w-0 px-1">
                  <p className="text-[11px] font-bold uppercase text-slate-400">Verdict</p>
                  <p className="mt-1 text-sm font-bold text-slate-950">Great, Good, Typical</p>
                </div>
                <div className="min-w-0 border-l border-slate-200 px-3">
                  <p className="text-[11px] font-bold uppercase text-slate-400">Baseline</p>
                  <p className="mt-1 text-sm font-bold text-slate-950">90-day route history</p>
                </div>
                <div className="min-w-0 border-l border-slate-200 px-3">
                  <p className="text-[11px] font-bold uppercase text-slate-400">Hotels</p>
                  <p className="mt-1 text-sm font-bold text-slate-950">Checked when dates fit</p>
                </div>
              </div>
            </section>

            <section className="animate-fade-up delay-75 rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-[0_24px_70px_rgba(15,23,42,0.13)] sm:p-4">
              <div className="mb-4 flex items-start justify-between gap-4 px-1 pt-1 sm:px-2">
                <div>
                  <h2 className="font-display text-lg font-extrabold tracking-tight text-slate-950 sm:text-xl">Search flights</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">Add a route to rank live prices by deal quality.</p>
                </div>
                <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 sm:block">
                  Cash fares first
                </div>
              </div>

              <div className="mb-4 flex rounded-2xl bg-slate-100 p-1">
                {(['roundtrip', 'oneway'] as TripType[]).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => { setTripType(type); setFormError(null) }}
                    className={`min-h-11 flex-1 rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                    tripType === type
                      ? 'border-white bg-white text-slate-950 shadow-sm'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                  >
                    {type === 'roundtrip' ? 'Round trip' : 'One way'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSearch} className="space-y-4">
                <div className="grid grid-cols-1 items-end gap-3 lg:grid-cols-[minmax(0,1fr)_44px_minmax(0,1fr)]">
                <div>
                  <label className="mb-1.5 block pl-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    From
                  </label>
                  <AirportInput
                    id="origin"
                    value={origin}
                    displayValue={originDisplay}
                    onChange={(iata, display) => { setOrigin(iata); setOriginDisplay(display); setFormError(null) }}
                    placeholder="City or airport code"
                    required
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSwap}
                  aria-label="Swap origin and destination"
                    className="mx-auto flex h-11 w-11 rotate-90 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 lg:rotate-0"
                >
                  <IconSwap />
                </button>

                <div>
                  <label className="mb-1.5 block pl-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    To
                  </label>
                  <AirportInput
                    id="dest"
                    value={dest}
                    displayValue={destDisplay}
                    onChange={(iata, display) => { setDest(iata); setDestDisplay(display); setFormError(null) }}
                    placeholder="Anywhere"
                  />
                </div>
              </div>

                <div className={`grid gap-3 ${tripType === 'roundtrip' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="mb-1.5 block pl-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    Depart
                  </label>
                  <div className="relative">
                      <IconCalendar className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      value={depart}
                      onChange={event => { setDepart(event.target.value); setFormError(null) }}
                      className="min-h-[3.25rem] w-full rounded-[0.875rem] border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-[0.9375rem] font-semibold text-slate-950 transition-[border-color,box-shadow,background] [color-scheme:light] focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                    />
                  </div>
                </div>

                {tripType === 'roundtrip' && (
                  <div>
                    <label className="mb-1.5 block pl-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      Return
                    </label>
                    <div className="relative">
                        <IconCalendar className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="date"
                        value={returnDate}
                        onChange={event => { setReturnDate(event.target.value); setFormError(null) }}
                        className="min-h-[3.25rem] w-full rounded-[0.875rem] border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-[0.9375rem] font-semibold text-slate-950 transition-[border-color,box-shadow,background] [color-scheme:light] focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                      />
                    </div>
                  </div>
                )}
              </div>

              {Object.keys(calendarPrices).length > 0 && (
                <PriceCalendar prices={calendarPrices} selected={depart} onSelect={setDepart} />
              )}

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)]">
                  <label className="flex min-h-14 cursor-pointer select-none items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4">
                    <span>
                      <span className="block text-sm font-bold text-slate-900">Flexible dates</span>
                      <span className="block text-xs font-medium text-slate-500">Search nearby dates when possible</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={flexDates}
                      onChange={e => setFlexDates(e.target.checked)}
                      className="h-5 w-5 rounded border-slate-300 bg-white accent-indigo-600"
                    />
                  </label>

                  <div className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4">
                    <span>
                      <span className="block text-sm font-bold text-slate-900">Passengers</span>
                      <span className="block text-xs font-medium text-slate-500">{passengers === 1 ? '1 traveler' : `${passengers} travelers`}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setPassengers(p => Math.max(1, p - 1)); setFormError(null) }}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-bold text-slate-700 transition-colors hover:border-slate-300 disabled:opacity-35"
                        disabled={passengers <= 1}
                        aria-label="Remove passenger"
                      >
                        -
                      </button>
                      <span className="w-5 text-center text-sm font-extrabold tabular-nums text-slate-950">{passengers}</span>
                      <button
                        type="button"
                        onClick={() => { setPassengers(p => Math.min(9, p + 1)); setFormError(null) }}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-bold text-slate-700 transition-colors hover:border-slate-300 disabled:opacity-35"
                        disabled={passengers >= 9}
                        aria-label="Add passenger"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {formError && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium leading-6 text-amber-800" role="alert">
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
                      Scanning deals...
                  </>
                ) : (
                  <>
                    <IconPlane className="text-indigo-200" />
                    Search flights
                  </>
                )}
              </button>
            </form>
          </section>
          </div>

          <section className="pb-7 animate-fade-up delay-150">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Route suggestions</h2>
              {recentSearches.length > 0 && (
                <span className="text-xs font-semibold text-slate-400">Recent searches saved locally</span>
              )}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {destinations.map(destination => (
              <button
                key={destination.label}
                type="button"
                onClick={() => {
                  setOrigin(destination.origin)
                  setOriginDisplay(destination.originDisplay)
                  setDest(destination.dest)
                  setDestDisplay(destination.destDisplay)
                  setFormError(null)
                }}
                  className="group flex min-h-[5.5rem] w-[15.5rem] flex-shrink-0 flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/50"
              >
                  <span className="text-sm font-extrabold text-slate-950 transition-colors group-hover:text-indigo-800">{destination.label}</span>
                  <span className="text-xs font-medium text-slate-500">{destination.meta}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">{destination.tag}</span>
              </button>
            ))}
            </div>

          {recentSearches.length > 0 && (
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Recent</span>
              {recentSearches.map(r => (
                <button
                  key={r.origin + r.dest}
                  type="button"
                  onClick={() => {
                    setOrigin(r.origin)
                    setDest(r.dest)
                    setOriginDisplay(r.originDisplay)
                    setDestDisplay(r.destDisplay)
                    setFormError(null)
                  }}
                    className="inline-flex min-h-9 max-w-full items-center rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-900"
                >
                  {r.originDisplay || r.origin} → {r.destDisplay || r.dest}
                </button>
              ))}
            </div>
          )}
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#07091A]">
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
                {depart}{returnDate ? ` - ${returnDate}` : ''}
              </span>
            )}
            <span className="ml-auto shrink-0 text-xs font-medium text-gray-600">
              Edit
            </span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 flex flex-col gap-3 animate-fade-in sm:flex-row sm:items-start">
          {isSearching ? (
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 dot-pulse" />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 dot-pulse-2" />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 dot-pulse-3" />
              </div>
              <p className="text-sm text-gray-400">Scanning deals across providers…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <p className="text-sm text-red-400">{error}</p>
              <button
                type="button"
                onClick={() => void runSearch()}
                className="rounded-lg border border-indigo-500/30 px-3 py-1.5 text-xs font-bold text-indigo-400 transition-colors hover:bg-indigo-500/10"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-200">
                {flights.length} flight{flights.length === 1 ? '' : 's'} found{routeLabel ? ` · ${routeLabel}` : ''}
                {passengers > 1 && <span className="text-gray-600"> × {passengers} passengers</span>}
              </p>
              {greatCount > 0 && (
                <p className="mt-0.5 text-xs font-semibold text-emerald-400">
                  🔥 {greatCount} great deal{greatCount === 1 ? '' : 's'}
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

        {!error && (
          <>
            <div className="mb-6 flex overflow-x-auto border-b border-white/8 scrollbar-hide">
              {(['flights', 'hotels'] as ActiveTab[]).map(tab => {
                const count = tab === 'flights' ? flights.length : hotels.length
                const active = activeTab === tab
                const disabled = tab === 'hotels' && hotelsTabDisabled
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      if (!disabled) handleActiveTabChange(tab)
                    }}
                    disabled={disabled}
                    aria-disabled={disabled}
                    className={`relative min-h-11 flex-shrink-0 px-4 py-3 text-sm font-bold capitalize transition-colors sm:px-5 ${
                      disabled
                        ? 'cursor-not-allowed text-gray-700'
                        : active ? 'text-gray-100' : 'text-gray-600 hover:text-gray-300'
                    }`}
                  >
                    {tab}
                    <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                      disabled
                        ? 'bg-white/[0.03] text-gray-700'
                        : active ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-gray-600'
                    }`}>
                      {disabled ? 'Unavailable' : count}
                    </span>
                    {active && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-t-full bg-[linear-gradient(90deg,#6366f1,#a78bfa)]" />
                    )}
                  </button>
                )
              })}
            </div>

            {hotelsTabDisabled && !isSearching && (
              <div className="mb-6 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-gray-500">
                <p className="font-semibold text-gray-300">Hotels were not included.</p>
                <p className="mt-0.5">{hotelUnavailableCopy}</p>
              </div>
            )}

            {activeTab === 'flights' && (
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
                dest={dest}
                depart={depart}
                returnDate={returnDate}
                tripType={tripType}
                alertEmail={alertEmail}
                setAlertEmail={setAlertEmail}
                alertSent={alertSent}
                alertLoading={alertLoading}
                alertError={alertError}
                handleAlertSubmit={handleAlertSubmit}
              />
            )}

            {activeTab === 'hotels' && (
              <>
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
                  <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-8 text-center animate-fade-in sm:px-6 sm:py-10">
                    <p className="font-display text-base font-bold text-gray-200 sm:text-lg">
                      {hotelEmptyTitle}
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                      {hotelUnavailableCopy}
                    </p>
                  </div>
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
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}
