'use client'

import { useState, FormEvent } from 'react'
import { NormalizedFare, DealScore, HotelOffer } from '@/lib/types'
import FlightCard from './components/FlightCard'
import HotelCard from './components/HotelCard'
import AlertSignup from './components/AlertSignup'

interface SearchResult {
  flights: NormalizedFare[]
  hotels: HotelOffer[]
  notice?: string
}

type View = 'form' | 'results'
type SortBy = 'price' | 'deal' | 'stops'

const popularRoutes = [
  { label: 'JFK → LAX', origin: 'JFK', dest: 'LAX' },
  { label: 'JFK → LHR', origin: 'JFK', dest: 'LHR' },
  { label: 'LAX → NRT', origin: 'LAX', dest: 'NRT' },
  { label: 'ORD → LHR', origin: 'ORD', dest: 'LHR' },
  { label: 'SFO → NRT', origin: 'SFO', dest: 'NRT' },
]

const staggerDelays = ['', 'delay-75', 'delay-150', 'delay-225']

export default function Home() {
  const [view, setView] = useState<View>('form')

  // Form state
  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('')
  const [depart, setDepart] = useState('')
  const [returnDate, setReturnDate] = useState('')

  // Results state
  const [flights, setFlights] = useState<NormalizedFare[]>([])
  const [hotels, setHotels] = useState<HotelOffer[]>([])
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [scores, setScores] = useState<Record<string, DealScore | null>>({})
  const [scoreLoading, setScoreLoading] = useState<Set<string>>(new Set())
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sort + filter state
  const [sortBy, setSortBy] = useState<SortBy>('price')
  const [nonstopOnly, setNonstopOnly] = useState(false)

  async function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!origin.trim()) return

    // Reset and switch to results view showing skeletons
    setIsSearching(true)
    setError(null)
    setFlights([])
    setHotels([])
    setScores({})
    setScoreLoading(new Set())
    setNotice(undefined)
    setView('results')

    try {
      const params = new URLSearchParams({ origin: origin.trim() })
      if (dest.trim()) params.set('dest', dest.trim())
      if (depart) params.set('depart', depart)
      if (returnDate) params.set('return', returnDate)

      const res = await fetch(`/api/search?${params.toString()}`)
      if (!res.ok || !res.body) throw new Error('Search request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      const accumulated: NormalizedFare[] = []

      function dedup(fares: NormalizedFare[]): NormalizedFare[] {
        const best = new Map<string, NormalizedFare>()
        for (const f of fares) {
          const k = `${f.carrier}:${f.origin}:${f.destination}:${f.depart.slice(0, 16)}`
          const ex = best.get(k)
          if (!ex || f.price.priceCents < ex.price.priceCents) best.set(k, f)
        }
        return Array.from(best.values()).sort((a, b) => a.price.priceCents - b.price.priceCents)
      }

      function fireScore(fare: NormalizedFare) {
        setScoreLoading(prev => new Set(prev).add(fare.id))
        fetch('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fare }) })
          .then(r => r.ok ? r.json() as Promise<DealScore> : Promise.reject())
          .then(score => setScores(prev => ({ ...prev, [fare.id]: score })))
          .catch(() => {})
          .finally(() => setScoreLoading(prev => { const n = new Set(prev); n.delete(fare.id); return n }))
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line) as { type: string; data?: unknown; message?: string }
            if (msg.type === 'flights' && Array.isArray(msg.data)) {
              const newFares = msg.data as NormalizedFare[]
              accumulated.push(...newFares)
              setFlights(dedup([...accumulated]))
              newFares.forEach(fireScore)
            } else if (msg.type === 'hotels' && Array.isArray(msg.data)) {
              setHotels(msg.data as HotelOffer[])
            } else if (msg.type === 'notice' && msg.message) {
              setNotice(prev => prev ? `${prev} ${msg.message}` : msg.message)
            } else if (msg.type === 'done') {
              setIsSearching(false)
            }
          } catch { /* ignore malformed line */ }
        }
      }
    } catch {
      setError('Something went wrong. Try again.')
      setIsSearching(false)
    }
  }

  function handleBack() {
    setView('form')
    setError(null)
  }

  function handleSwap() {
    const tmp = origin
    setOrigin(dest)
    setDest(tmp)
  }

  // ─── Compute displayed flights (filter + sort) ──────────────────────────────
  const displayedFlights = flights
    .filter((fare) => !nonstopOnly || fare.stops === 0)
    .slice()
    .sort((a, b) => {
      if (sortBy === 'price') return a.price.priceCents - b.price.priceCents
      if (sortBy === 'stops') return a.stops - b.stops
      // 'deal': lower percentile = better deal; unscored fares sort last
      const aPerc = scores[a.id]?.percentile ?? 101
      const bPerc = scores[b.id]?.percentile ?? 101
      return aPerc - bPerc
    })

  // ─── Search form (hero) ──────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="relative overflow-hidden min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center px-4 py-16">
        {/* Background glow blobs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-violet-600/15 blur-3xl pointer-events-none" />

        <div className="w-full max-w-md">
          {/* Hero text */}
          <div className="mb-10 text-center">
            <p className="text-xs font-medium text-indigo-400 uppercase tracking-widest mb-5 animate-fade-up">
              Deal intelligence
            </p>
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-none mb-4 bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent animate-fade-up delay-75">
              expaify
            </h1>
            <p className="text-gray-300 text-base sm:text-lg font-medium mb-2 animate-fade-up delay-150">
              Find deals worth booking.
            </p>
            <p className="text-gray-500 text-sm animate-fade-up delay-225">
              Flight prices scored against 90 days of history.
            </p>
          </div>

          {/* Search card */}
          <div className="bg-gray-900 border border-white/8 rounded-2xl p-6 shadow-2xl shadow-black/50">
            <form onSubmit={handleSearch} className="space-y-4">
              {/* Origin + Destination side-by-side with swap button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1">
                  <label
                    htmlFor="origin"
                    className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5"
                  >
                    Origin{' '}
                    <span className="text-red-400 normal-case tracking-normal">
                      *
                    </span>
                  </label>
                  <input
                    id="origin"
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="NYC, JFK, 10001"
                    required
                    className="w-full rounded-xl bg-[#0a0f1e] border border-white/10 px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSwap}
                  aria-label="Swap origin and destination"
                  className="rounded-xl bg-white/5 border border-white/10 px-2.5 py-3 text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 rotate-90 sm:rotate-0"
                >
                  ↔
                </button>
                <div className="flex-1">
                  <label
                    htmlFor="dest"
                    className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5"
                  >
                    Destination
                  </label>
                  <input
                    id="dest"
                    type="text"
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                    placeholder="LAX, London, or leave blank"
                    className="w-full rounded-xl bg-[#0a0f1e] border border-white/10 px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="depart"
                    className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5"
                  >
                    Depart
                  </label>
                  <input
                    id="depart"
                    type="date"
                    value={depart}
                    onChange={(e) => setDepart(e.target.value)}
                    className="w-full rounded-xl bg-[#0a0f1e] border border-white/10 px-4 py-3 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label
                    htmlFor="return"
                    className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5"
                  >
                    Return
                  </label>
                  <input
                    id="return"
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full rounded-xl bg-[#0a0f1e] border border-white/10 px-4 py-3 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:from-indigo-400 hover:to-indigo-500 hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all"
              >
                Search flights →
              </button>
            </form>
          </div>

          {/* Quick-pick route chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-600">Popular:</span>
            {popularRoutes.map((route) => (
              <button
                key={route.label}
                type="button"
                onClick={() => { setOrigin(route.origin); setDest(route.dest) }}
                className="text-xs px-3 py-1 rounded-full border border-white/10 bg-white/5 text-gray-400 hover:border-indigo-500/50 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                {route.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── Results view ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      {/* Navbar */}
      <nav className="sticky top-0 z-10 border-b border-white/8 bg-[#0a0f1e]/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-white text-lg tracking-tight">
            expaify
          </span>
          <button
            onClick={handleBack}
            className="text-sm text-gray-400 border border-white/10 rounded-lg px-3 py-1.5 hover:border-white/20 hover:text-gray-200 transition-colors"
          >
            ← New<span className="hidden sm:inline"> search</span>
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-8">
        {/* Error banner */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 mb-6 flex items-center justify-between gap-4">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={handleBack}
              className="text-sm font-medium text-red-400 hover:text-red-300 underline flex-shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Notice banner */}
        {notice && !error && (
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 mb-6">
            <p className="text-sm text-indigo-300">{notice}</p>
          </div>
        )}

        {!error && (
          <>
            {/* Results count header */}
            {isSearching ? (
              <p className="text-sm text-gray-500 animate-pulse mb-6">Scanning deals…</p>
            ) : nonstopOnly ? (
              <p className="text-sm text-gray-400 mb-6">
                Showing {displayedFlights.length} of {flights.length} flight{flights.length !== 1 ? 's' : ''}{dest.trim() ? ` to ${dest.trim()}` : ''}
              </p>
            ) : (
              <p className="text-sm text-gray-400 mb-6">
                Found {flights.length} flight{flights.length !== 1 ? 's' : ''}{dest.trim() ? ` to ${dest.trim()}` : ''}
              </p>
            )}

            {/* Sort + filter controls bar */}
            {!isSearching && flights.length > 0 && (
              <div className="bg-gray-900/60 border border-white/8 rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-2 mb-6">
                {/* Sort pills */}
                <div className="flex items-center gap-1.5">
                  {(['price', 'deal', 'stops'] as SortBy[]).map((option) => {
                    const labels: Record<SortBy, string> = { price: 'Price', deal: 'Deal', stops: 'Stops' }
                    const active = sortBy === option
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setSortBy(option)}
                        className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${
                          active
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'
                        }`}
                      >
                        {labels[option]}
                      </button>
                    )
                  })}
                </div>

                {/* Divider */}
                <div className="w-px h-4 bg-white/10 self-center" />

                {/* Nonstop toggle */}
                <button
                  type="button"
                  onClick={() => setNonstopOnly((prev) => !prev)}
                  className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
                    nonstopOnly
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'
                  }`}
                >
                  Nonstop only
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Flights section */}
              <section>
                <h2 className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-4">
                  Flights
                </h2>

                {isSearching ? (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500 animate-pulse mb-3">Scanning deals across providers…</p>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <FlightCard key={i} loading score={null} />
                    ))}
                  </div>
                ) : displayedFlights.length === 0 ? (
                  <div className="rounded-2xl border border-white/8 bg-gray-900 px-4 py-10 text-center">
                    <p className="text-gray-400 text-sm font-medium">
                      {flights.length > 0 ? 'No nonstop flights for this route.' : 'No flights found for this route.'}
                    </p>
                    <p className="text-gray-600 text-xs mt-1">
                      {flights.length > 0 ? 'Try removing the nonstop filter.' : 'Try different dates or a different destination.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayedFlights.map((fare, index) => (
                      <div
                        key={fare.id}
                        className={`animate-fade-up ${staggerDelays[Math.min(index, 3)]}`}
                      >
                        <FlightCard
                          fare={fare}
                          score={scores[fare.id] ?? null}
                          loading={scoreLoading.has(fare.id)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Price alert signup */}
              {dest.trim() && !isSearching && (
                <section className="md:col-span-2">
                  <AlertSignup origin={origin.trim()} destination={dest.trim()} />
                </section>
              )}

              {/* Hotels section */}
              <section>
                <h2 className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-4">
                  Hotels
                </h2>

                {isSearching ? (
                  <div className="space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-2xl border border-white/8 bg-gray-900 p-5 space-y-3 animate-pulse"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="h-4 w-40 bg-white/10 rounded" />
                            <div className="h-3 w-24 bg-white/5 rounded" />
                            <div className="h-3 w-20 bg-white/5 rounded" />
                          </div>
                          <div className="space-y-1.5 flex-shrink-0">
                            <div className="h-7 w-20 bg-white/10 rounded" />
                            <div className="h-3 w-12 bg-white/5 rounded" />
                          </div>
                        </div>
                        <div className="h-px w-full bg-white/5" />
                        <div className="flex justify-end">
                          <div className="h-6 w-14 bg-white/10 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : hotels.length === 0 ? (
                  <div className="rounded-2xl border border-white/8 bg-gray-900 px-4 py-10 text-center">
                    <p className="text-gray-500 text-sm">
                      No hotels found — hotels search requires a destination.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {hotels.map((hotel, index) => (
                      <div
                        key={hotel.id}
                        className={`animate-fade-up ${staggerDelays[Math.min(index, 3)]}`}
                      >
                        <HotelCard hotel={hotel} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
