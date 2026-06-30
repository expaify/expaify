'use client'

import { useState, FormEvent } from 'react'
import { NormalizedFare, DealScore, HotelOffer } from '@/lib/types'
import FlightCard from './components/FlightCard'
import HotelCard from './components/HotelCard'
import AlertSignup from './components/AlertSignup'

type View = 'form' | 'results'
type SortBy = 'price' | 'deal' | 'stops'
type TripType = 'roundtrip' | 'oneway'
type ActiveTab = 'flights' | 'hotels'

const popularRoutes = [
  { label: 'NYC → London', origin: 'JFK', dest: 'LHR' },
  { label: 'LA → Tokyo', origin: 'LAX', dest: 'NRT' },
  { label: 'NYC → Miami', origin: 'JFK', dest: 'MIA' },
  { label: 'Chicago → Paris', origin: 'ORD', dest: 'CDG' },
  { label: 'SF → Tokyo', origin: 'SFO', dest: 'NRT' },
]

const staggerDelays = ['', 'delay-75', 'delay-150', 'delay-225']

export default function Home() {
  const [view, setView] = useState<View>('form')
  const [tripType, setTripType] = useState<TripType>('roundtrip')
  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('')
  const [depart, setDepart] = useState('')
  const [returnDate, setReturnDate] = useState('')

  const [flights, setFlights] = useState<NormalizedFare[]>([])
  const [hotels, setHotels] = useState<HotelOffer[]>([])
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [scores, setScores] = useState<Record<string, DealScore | null>>({})
  const [scoreLoading, setScoreLoading] = useState<Set<string>>(new Set())
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>('price')
  const [nonstopOnly, setNonstopOnly] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('flights')

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
    fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fare }),
    })
      .then(r => r.ok ? r.json() as Promise<DealScore> : Promise.reject())
      .then(score => setScores(prev => ({ ...prev, [fare.id]: score })))
      .catch(() => {})
      .finally(() => setScoreLoading(prev => { const n = new Set(prev); n.delete(fare.id); return n }))
  }

  async function runSearch() {
    setIsSearching(true)
    setError(null)
    setFlights([])
    setHotels([])
    setScores({})
    setScoreLoading(new Set())
    setNotice(undefined)
    setView('results')
    setActiveTab('flights')

    try {
      const params = new URLSearchParams({ origin: origin.trim() })
      if (dest.trim()) params.set('dest', dest.trim())
      if (depart) params.set('depart', depart)
      if (returnDate && tripType === 'roundtrip') params.set('return', returnDate)

      const res = await fetch(`/api/search?${params.toString()}`)
      if (!res.ok || !res.body) throw new Error('Search failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      const accumulated: NormalizedFare[] = []

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
          } catch { /* skip malformed line */ }
        }
      }
    } catch {
      setError('Something went wrong. Please try again.')
      setIsSearching(false)
    }
  }

  async function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!origin.trim()) return
    await runSearch()
  }

  function handleSwap() {
    const tmp = origin
    setOrigin(dest)
    setDest(tmp)
  }

  const displayedFlights = flights
    .filter(f => !nonstopOnly || f.stops === 0)
    .slice()
    .sort((a, b) => {
      if (sortBy === 'price') return a.price.priceCents - b.price.priceCents
      if (sortBy === 'stops') return a.stops - b.stops
      const aP = scores[a.id]?.percentile ?? 101
      const bP = scores[b.id]?.percentile ?? 101
      return aP - bP
    })

  // ─── Hero / Search form ──────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="relative min-h-screen bg-[#080d1a] flex flex-col items-center justify-center px-4 py-16 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_60%_0%,rgba(99,102,241,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_100%,rgba(139,92,246,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.03]" />

        <div className="relative w-full max-w-xl">
          {/* Wordmark */}
          <div className="text-center mb-10">
            <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-[0.2em] mb-4">
              Deal intelligence · Flights + Hotels
            </p>
            <h1 className="text-6xl sm:text-8xl font-black tracking-tighter leading-none mb-4 bg-gradient-to-br from-white via-indigo-200 to-indigo-500 bg-clip-text text-transparent">
              expaify
            </h1>
            <p className="text-gray-400 text-base sm:text-lg font-medium">
              Flight + hotel prices ranked against 90 days of history.
            </p>
          </div>

          {/* Search card */}
          <div className="bg-[#0e1424]/80 border border-white/10 rounded-3xl p-6 shadow-2xl shadow-black/60 backdrop-blur-md">
            {/* Trip type */}
            <div className="flex items-center gap-1 mb-5 bg-white/5 rounded-xl p-1">
              {(['roundtrip', 'oneway'] as TripType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTripType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    tripType === t
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {t === 'roundtrip' ? 'Round trip' : 'One way'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearch} className="space-y-3">
              {/* Origin + Swap + Destination */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                    From
                  </label>
                  <input
                    type="text"
                    value={origin}
                    onChange={e => setOrigin(e.target.value)}
                    placeholder="City, airport or code"
                    required
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSwap}
                  aria-label="Swap"
                  className="mb-0.5 h-[46px] w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 text-lg"
                >
                  ⇄
                </button>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                    To
                  </label>
                  <input
                    type="text"
                    value={dest}
                    onChange={e => setDest(e.target.value)}
                    placeholder="Anywhere"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className={`grid gap-3 ${tripType === 'roundtrip' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                    Depart
                  </label>
                  <input
                    type="date"
                    value={depart}
                    onChange={e => setDepart(e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
                {tripType === 'roundtrip' && (
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                      Return
                    </label>
                    <input
                      type="date"
                      value={returnDate}
                      onChange={e => setReturnDate(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-600 py-4 text-sm font-bold text-white hover:opacity-90 active:opacity-80 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#0e1424] transition-all shadow-lg shadow-indigo-500/20"
              >
                Search flights + hotels →
              </button>
            </form>
          </div>

          {/* Popular routes */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-600 font-medium">Popular:</span>
            {popularRoutes.map(r => (
              <button
                key={r.label}
                type="button"
                onClick={() => { setOrigin(r.origin); setDest(r.dest) }}
                className="text-xs px-3 py-1.5 rounded-full border border-white/8 bg-white/4 text-gray-400 hover:border-indigo-500/50 hover:text-indigo-300 hover:bg-indigo-500/5 transition-colors"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── Results view ────────────────────────────────────────────────────────────
  const routeSummary = [origin.trim(), dest.trim()].filter(Boolean).join(' → ')
  const greatDeals = Object.values(scores).filter(s => s?.verdict === 'Great').length

  return (
    <div className="min-h-screen bg-[#080d1a]">
      {/* Sticky header with inline search */}
      <header className="sticky top-0 z-20 border-b border-white/8 bg-[#080d1a]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setView('form')}
              className="font-black text-xl text-white tracking-tighter flex-shrink-0 hover:text-indigo-400 transition-colors"
            >
              expaify
            </button>

            {/* Compact search recap — click to go back */}
            <button
              onClick={() => setView('form')}
              className="flex-1 flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-left hover:border-indigo-500/40 hover:bg-white/8 transition-all group"
            >
              <span className="text-sm font-semibold text-gray-200 truncate">{routeSummary || 'Anywhere'}</span>
              {depart && (
                <>
                  <span className="text-white/20 flex-shrink-0">·</span>
                  <span className="text-sm text-gray-400 flex-shrink-0">{depart}{returnDate && tripType === 'roundtrip' ? ` – ${returnDate}` : ''}</span>
                </>
              )}
              <span className="ml-auto text-xs text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0">Edit ✎</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Status bar */}
        <div className="flex items-center justify-between mb-5">
          <div>
            {isSearching ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <p className="text-sm text-gray-400">Scanning deals across providers…</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-gray-200">
                  {flights.length > 0 ? `${flights.length} flights found` : 'No flights found'}
                  {dest.trim() ? ` · ${routeSummary}` : ''}
                </p>
                {greatDeals > 0 && (
                  <p className="text-xs text-emerald-400 mt-0.5">🔥 {greatDeals} great deal{greatDeals !== 1 ? 's' : ''} below average</p>
                )}
              </div>
            )}
          </div>
          {error && (
            <button
              onClick={runSearch}
              className="text-xs font-medium text-indigo-400 border border-indigo-500/30 rounded-lg px-3 py-1.5 hover:bg-indigo-500/10 transition-colors"
            >
              Retry
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 mb-6">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {!error && (
          <>
            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-white/8 mb-6">
              {(['flights', 'hotels'] as ActiveTab[]).map(tab => {
                const count = tab === 'flights' ? flights.length : hotels.length
                const active = activeTab === tab
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative px-5 py-3 text-sm font-semibold capitalize transition-colors ${
                      active ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {tab}
                    {count > 0 && (
                      <span className={`ml-2 text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                        active ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-gray-500'
                      }`}>
                        {count}
                      </span>
                    )}
                    {active && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* ─── Flights tab ─────────────────────────────────────────────────── */}
            {activeTab === 'flights' && (
              <>
                {/* Sort + filter bar */}
                {(flights.length > 0 || isSearching) && (
                  <div className="flex flex-wrap items-center gap-2 mb-5">
                    <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider mr-1">Sort</span>
                    {(['price', 'deal', 'stops'] as SortBy[]).map(opt => {
                      const labels: Record<SortBy, string> = { price: 'Best price', deal: 'Best deal', stops: 'Fewest stops' }
                      const active = sortBy === opt
                      return (
                        <button
                          key={opt}
                          onClick={() => setSortBy(opt)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${
                            active
                              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                              : 'bg-white/5 text-gray-400 hover:text-white border border-white/8 hover:border-white/20'
                          }`}
                        >
                          {labels[opt]}
                        </button>
                      )
                    })}
                    <div className="w-px h-4 bg-white/10 self-center mx-1" />
                    <button
                      onClick={() => setNonstopOnly(p => !p)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                        nonstopOnly
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-white/5 text-gray-400 hover:text-white border-white/8 hover:border-white/20'
                      }`}
                    >
                      ✈ Nonstop only
                    </button>
                  </div>
                )}

                {isSearching && displayedFlights.length === 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <FlightCard key={i} loading score={null} />
                    ))}
                  </div>
                ) : displayedFlights.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-4xl mb-4">✈️</p>
                    <p className="text-gray-300 font-semibold">No flights found</p>
                    <p className="text-gray-600 text-sm mt-1">
                      {nonstopOnly ? 'Try removing the nonstop filter.' : 'Try different dates or destination.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayedFlights.map((fare, i) => (
                      <div key={fare.id} className={`animate-fade-up ${staggerDelays[Math.min(i, 3)]}`}>
                        <FlightCard
                          fare={fare}
                          score={scores[fare.id] ?? null}
                          loading={scoreLoading.has(fare.id)}
                        />
                      </div>
                    ))}
                    {isSearching && (
                      <FlightCard loading score={null} />
                    )}
                  </div>
                )}

                {/* Price alert */}
                {dest.trim() && !isSearching && flights.length > 0 && (
                  <div className="mt-8">
                    <AlertSignup origin={origin.trim()} destination={dest.trim()} />
                  </div>
                )}
              </>
            )}

            {/* ─── Hotels tab ──────────────────────────────────────────────────── */}
            {activeTab === 'hotels' && (
              <>
                {isSearching && hotels.length === 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="rounded-2xl border border-white/8 bg-[#111827] p-5 animate-pulse">
                        <div className="h-36 bg-white/5 rounded-xl mb-4" />
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-white/10 rounded w-3/4" />
                            <div className="h-3 bg-white/5 rounded w-1/2" />
                          </div>
                          <div className="h-9 w-12 bg-white/10 rounded-lg" />
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-end">
                          <div className="space-y-1">
                            <div className="h-6 w-16 bg-white/10 rounded" />
                            <div className="h-3 w-14 bg-white/5 rounded" />
                          </div>
                          <div className="h-9 w-28 bg-white/10 rounded-xl" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : hotels.length === 0 ? (
                  <div className="text-center py-20">
                    <p className="text-4xl mb-4">🏨</p>
                    <p className="text-gray-300 font-semibold">No hotels found</p>
                    <p className="text-gray-600 text-sm mt-1">
                      {!dest.trim()
                        ? 'Enter a destination to see hotels.'
                        : !returnDate
                        ? 'Add a return date to see hotels.'
                        : 'No hotels available for these dates.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {hotels.map((hotel, i) => (
                      <div key={hotel.id} className={`animate-fade-up ${staggerDelays[Math.min(i, 3)]}`}>
                        <HotelCard hotel={hotel} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
