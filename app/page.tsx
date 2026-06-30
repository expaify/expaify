'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { DealScore, HotelOffer, NormalizedFare } from '@/lib/types'
import AlertSignup from './components/AlertSignup'
import AirportInput from './components/AirportInput'
import FlightCard from './components/FlightCard'
import HotelCard from './components/HotelCard'

type View = 'form' | 'results'
type TripType = 'roundtrip' | 'oneway'
type SortBy = 'price' | 'deal' | 'stops'
type ActiveTab = 'flights' | 'hotels'

const popularRoutes = [
  { label: 'New York → London', origin: 'JFK', dest: 'LHR' },
  { label: 'LA → Tokyo', origin: 'LAX', dest: 'NRT' },
  { label: 'NYC → Miami', origin: 'JFK', dest: 'MIA' },
  { label: 'Chicago → Paris', origin: 'ORD', dest: 'CDG' },
  { label: 'SF → Tokyo', origin: 'SFO', dest: 'NRT' },
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

function IconLocation({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C8.69 2 6 4.69 6 8c0 5.25 6 14 6 14s6-8.75 6-14c0-3.31-2.69-6-6-6zm0 8.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" fill="currentColor" />
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

export default function Home() {
  const [view, setView] = useState<View>('form')
  const [tripType, setTripType] = useState<TripType>('roundtrip')
  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('')
  const [originDisplay, setOriginDisplay] = useState('')
  const [destDisplay, setDestDisplay] = useState('')
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
  const [sortBy, setSortBy] = useState<SortBy>('price')
  const [nonstopOnly, setNonstopOnly] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('flights')
  const [hoveredRoute, setHoveredRoute] = useState<string | null>(null)
  const progressKey = useRef<number>(0)

  useEffect(() => {
    if (tripType === 'oneway') setReturnDate('')
  }, [tripType])

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

  async function runSearch() {
    if (!origin.trim()) return

    setIsSearching(true)
    setError(null)
    setFlights([])
    setHotels([])
    setScores({})
    setHotelScores({})
    setScoreLoading(new Set())
    setHotelScoreLoading(new Set())
    setView('results')
    setActiveTab('flights')
    progressKey.current += 1

    try {
      const params = new URLSearchParams({ origin: origin.trim() })
      if (dest.trim()) params.set('dest', dest.trim())
      if (depart) params.set('depart', depart)
      if (returnDate && tripType === 'roundtrip') params.set('return', returnDate)
      params.set('passengers', String(passengers))
      if (flexDates && depart) params.set('flex', '1')

      const response = await fetch(`/api/search?${params.toString()}`)
      if (!response.ok || !response.body) throw new Error('Search failed')

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
            const message = JSON.parse(line) as { type: string; data?: unknown; message?: string }
            if (message.type === 'flights' && Array.isArray(message.data)) {
              const newFares = message.data as NormalizedFare[]
              accumulated.push(...newFares)
              setFlights(dedup(accumulated))
              newFares.forEach(fireScore)
            } else if (message.type === 'hotels' && Array.isArray(message.data)) {
              const newHotels = message.data as HotelOffer[]
              setHotels(newHotels)
              newHotels.forEach(fireHotelScore)
            } else if (message.type === 'done') {
              setIsSearching(false)
            }
          } catch {
            // Skip malformed NDJSON lines without failing the whole search.
          }
        }
      }

      setIsSearching(false)
    } catch {
      setError('Something went wrong. Please try again.')
      setIsSearching(false)
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await runSearch()
  }

  function handleSwap() {
    const tmpIata = origin
    const tmpDisplay = originDisplay
    setOrigin(dest)
    setOriginDisplay(destDisplay)
    setDest(tmpIata)
    setDestDisplay(tmpDisplay)
  }

  const displayedFlights = flights
    .filter(fare => !nonstopOnly || fare.stops === 0)
    .slice()
    .sort((a, b) => {
      if (sortBy === 'price') return a.price.priceCents - b.price.priceCents
      if (sortBy === 'stops') return a.stops - b.stops || a.price.priceCents - b.price.priceCents
      return (scores[a.id]?.percentile ?? 101) - (scores[b.id]?.percentile ?? 101)
    })

  const routeLabel = [originDisplay || origin, destDisplay || dest].filter(Boolean).join(' → ')
  const greatCount = Object.values(scores).filter(score => score?.verdict === 'Great').length

  if (view === 'form') {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07091A] px-4 py-16">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_50%_0%,rgba(99,102,241,1),transparent_70%)] opacity-25 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-[400px] w-[500px] bg-[radial-gradient(ellipse_at_0%_100%,rgba(139,92,246,1),transparent_70%)] opacity-10 blur-3xl" />
          <div className="absolute right-0 top-1/3 h-[300px] w-[400px] bg-[radial-gradient(ellipse_at_100%_50%,rgba(59,130,246,1),transparent_70%)] opacity-[0.08] blur-3xl" />
          <svg className="absolute inset-0 h-full w-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative w-full max-w-xl">
          <div className="mb-10 text-center animate-fade-up">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 dot-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                Live deal intelligence
              </span>
            </div>
            <h1 className="font-display bg-[linear-gradient(135deg,#fff_0%,#c7d2fe_44%,#818cf8_100%)] bg-clip-text text-7xl font-extrabold leading-none tracking-tighter text-transparent sm:text-9xl">
              expaify
            </h1>
            <p className="mt-5 text-base font-semibold text-gray-300 sm:text-lg">
              Flights + Hotels ranked by real deal quality.
            </p>
          </div>

          <section className="rounded-3xl border border-white/8 bg-[#0C1122]/85 p-6 shadow-[0_24px_64px_rgba(0,0,0,0.6)] backdrop-blur-xl animate-fade-up delay-75">
            <div className="mb-5 flex rounded-xl bg-white/[0.04] p-1">
              {(['roundtrip', 'oneway'] as TripType[]).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTripType(type)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-bold transition-colors ${
                    tripType === type
                      ? 'border-indigo-500/30 bg-indigo-500/25 text-indigo-300'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {type === 'roundtrip' ? 'Round trip' : 'One way'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearch} className="space-y-3">
              <div className="grid grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)] items-end gap-2">
                <div>
                  <label className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600">
                    From
                  </label>
                  <AirportInput
                    id="origin"
                    value={origin}
                    displayValue={originDisplay}
                    onChange={(iata, display) => { setOrigin(iata); setOriginDisplay(display) }}
                    placeholder="City or airport code"
                    required
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSwap}
                  aria-label="Swap origin and destination"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] text-gray-600 transition-colors hover:border-indigo-500/30 hover:text-indigo-300"
                >
                  <IconSwap />
                </button>

                <div>
                  <label className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600">
                    To
                  </label>
                  <AirportInput
                    id="dest"
                    value={dest}
                    displayValue={destDisplay}
                    onChange={(iata, display) => { setDest(iata); setDestDisplay(display) }}
                    placeholder="Anywhere"
                  />
                </div>
              </div>

              <div className={`grid gap-3 ${tripType === 'roundtrip' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600">
                    Depart
                  </label>
                  <div className="relative">
                    <IconCalendar className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="date"
                      value={depart}
                      onChange={event => setDepart(event.target.value)}
                      className="field-input"
                    />
                  </div>
                </div>

                {tripType === 'roundtrip' && (
                  <div>
                    <label className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600">
                      Return
                    </label>
                    <div className="relative">
                      <IconCalendar className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                      <input
                        type="date"
                        value={returnDate}
                        onChange={event => setReturnDate(event.target.value)}
                        className="field-input"
                      />
                    </div>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={flexDates}
                  onChange={e => setFlexDates(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 accent-indigo-500"
                />
                <span className="text-xs text-gray-400 font-medium">
                  I'm flexible <span className="text-gray-600">(±3 days)</span>
                </span>
              </label>

              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">Passengers</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPassengers(p => Math.max(1, p - 1))}
                    className="w-7 h-7 rounded-full bg-white/5 border border-white/10 text-gray-300 text-sm font-bold hover:bg-white/10 transition-colors flex items-center justify-center disabled:opacity-30"
                    disabled={passengers <= 1}
                  >
                    −
                  </button>
                  <span className="text-sm font-bold text-gray-100 w-4 text-center tabular-nums">{passengers}</span>
                  <button
                    type="button"
                    onClick={() => setPassengers(p => Math.min(9, p + 1))}
                    className="w-7 h-7 rounded-full bg-white/5 border border-white/10 text-gray-300 text-sm font-bold hover:bg-white/10 transition-colors flex items-center justify-center disabled:opacity-30"
                    disabled={passengers >= 9}
                  >
                    +
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={isSearching}>
                {isSearching ? (
                  <>
                    <span className="spinner" />
                    Scanning deals…
                  </>
                ) : (
                  <>
                    <IconPlane className="text-indigo-200" />
                    Search flights + hotels
                  </>
                )}
              </button>
            </form>
          </section>

          <div className="mt-5 flex flex-wrap items-center gap-2 animate-fade-up delay-150">
            <span className="text-xs font-semibold text-gray-700">Popular:</span>
            {popularRoutes.map(route => {
              const active = hoveredRoute === route.label
              return (
                <button
                  key={route.label}
                  type="button"
                  onClick={() => {
                    setOrigin(route.origin)
                    setDest(route.dest)
                  }}
                  onMouseEnter={() => setHoveredRoute(route.label)}
                  onMouseLeave={() => setHoveredRoute(null)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    active
                      ? 'border-indigo-500/30 bg-indigo-500/[0.06] text-indigo-300'
                      : 'border-white/8 bg-white/[0.03] text-gray-500'
                  }`}
                >
                  {route.label}
                </button>
              )
            })}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#07091A]">
      {isSearching && <div key={progressKey.current} className="search-progress-bar" />}

      <header className="sticky top-0 z-20 border-b border-white/8 bg-[#07091A]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <button
            type="button"
            onClick={() => setView('form')}
            className="font-display shrink-0 text-xl font-extrabold tracking-tighter text-white transition-opacity hover:opacity-70"
          >
            expaify
          </button>

          <button
            type="button"
            onClick={() => setView('form')}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/8 bg-white/[0.04] px-4 py-2.5 text-left transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/[0.05]"
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
              Edit ✎
            </span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 flex items-start justify-between gap-4 animate-fade-in">
          {isSearching ? (
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 dot-pulse" />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 dot-pulse-2" />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 dot-pulse-3" />
              </div>
              <p className="text-sm text-gray-400">Scanning deals across providers…</p>
            </div>
          ) : error ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-red-400">{error}</p>
              <button
                type="button"
                onClick={runSearch}
                className="rounded-lg border border-indigo-500/30 px-3 py-1.5 text-xs font-bold text-indigo-400 transition-colors hover:bg-indigo-500/10"
              >
                Retry
              </button>
            </div>
          ) : (
            <div>
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
        </div>

        {!error && (
          <>
            <div className="mb-6 flex border-b border-white/8">
              {(['flights', 'hotels'] as ActiveTab[]).map(tab => {
                const count = tab === 'flights' ? flights.length : hotels.length
                const active = activeTab === tab
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`relative px-5 py-3 text-sm font-bold capitalize transition-colors ${
                      active ? 'text-gray-100' : 'text-gray-600 hover:text-gray-300'
                    }`}
                  >
                    {tab}
                    <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                      active ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-gray-600'
                    }`}>
                      {count}
                    </span>
                    {active && (
                      <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-t-full bg-[linear-gradient(90deg,#6366f1,#a78bfa)]" />
                    )}
                  </button>
                )
              })}
            </div>

            {activeTab === 'flights' && (
              <>
                {(flights.length > 0 || isSearching) && (
                  <div className="mb-5 flex flex-wrap items-center gap-2">
                    <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                      Sort by
                    </span>
                    {(['price', 'deal', 'stops'] as SortBy[]).map(option => {
                      const labels: Record<SortBy, string> = {
                        price: 'Best price',
                        deal: 'Best deal',
                        stops: 'Fewest stops',
                      }
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setSortBy(option)}
                          className={`btn-pill ${sortBy === option ? 'active' : ''}`}
                        >
                          {labels[option]}
                        </button>
                      )
                    })}
                    <div className="mx-1 h-4 w-px bg-white/8" />
                    <button
                      type="button"
                      onClick={() => setNonstopOnly(value => !value)}
                      className={`btn-pill ${nonstopOnly ? 'active' : ''}`}
                    >
                      ✈ Nonstop only
                    </button>
                  </div>
                )}

                {isSearching && displayedFlights.length === 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <FlightCard key={index} score={null} loading />
                    ))}
                  </div>
                ) : displayedFlights.length === 0 ? (
                  <div className="py-24 text-center animate-fade-in">
                    <div className="mb-4 text-5xl">✈️</div>
                    <p className="font-display text-lg font-bold text-gray-300">No flights found</p>
                    <p className="mx-auto mt-2 max-w-xs text-sm text-gray-600">
                      {nonstopOnly
                        ? 'Try removing the nonstop filter to see connecting fares.'
                        : 'Try different dates, another destination, or leave destination blank to explore.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {displayedFlights.map((fare, index) => (
                        <div key={fare.id} className={`animate-fade-up ${delays[Math.min(index, delays.length - 1)]}`}>
                          <FlightCard
                            fare={fare}
                            score={scores[fare.id] ?? null}
                            loading={scoreLoading.has(fare.id)}
                          />
                        </div>
                      ))}
                      {isSearching && <FlightCard score={null} loading />}
                    </div>

                    {!isSearching && dest.trim() && flights.length > 0 && (
                      <div className="mt-8 animate-fade-up">
                        <AlertSignup origin={origin.trim()} destination={dest.trim()} />
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {activeTab === 'hotels' && (
              <>
                {isSearching && hotels.length === 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <HotelSkeleton key={index} />
                    ))}
                  </div>
                ) : hotels.length === 0 ? (
                  <div className="py-24 text-center animate-fade-in">
                    <div className="mb-4 text-5xl">🏨</div>
                    <p className="font-display text-lg font-bold text-gray-300">No hotels found</p>
                    <p className="mx-auto mt-2 max-w-xs text-sm text-gray-600">
                      {!dest.trim()
                        ? 'Enter a destination to compare hotel availability.'
                        : tripType === 'oneway' || !returnDate
                          ? 'Add a return date to search hotels for the trip.'
                          : 'No hotels are available for these dates yet.'}
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
