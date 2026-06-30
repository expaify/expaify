'use client'

import { useState, useEffect, FormEvent, useRef } from 'react'
import { NormalizedFare, DealScore, HotelOffer } from '@/lib/types'
import FlightCard from './components/FlightCard'
import HotelCard from './components/HotelCard'
import AlertSignup from './components/AlertSignup'

type View      = 'form' | 'results'
type SortBy    = 'price' | 'deal' | 'stops'
type TripType  = 'roundtrip' | 'oneway'
type ActiveTab = 'flights' | 'hotels'

const popularRoutes = [
  { label: 'New York → London',  origin: 'JFK', dest: 'LHR' },
  { label: 'LA → Tokyo',         origin: 'LAX', dest: 'NRT' },
  { label: 'NYC → Miami',        origin: 'JFK', dest: 'MIA' },
  { label: 'Chicago → Paris',    origin: 'ORD', dest: 'CDG' },
  { label: 'SF → Tokyo',         origin: 'SFO', dest: 'NRT' },
]

const staggerDelays = ['', 'delay-75', 'delay-150', 'delay-225', 'delay-300', 'delay-375']

/* ── Icons (inline SVG to avoid icon lib dependency) ────────────────────── */
function IconPlane({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12l-7-7v4l-12 3v2l12 3v4l7-7z" fill="currentColor"/>
    </svg>
  )
}
function IconSwap({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3 9h18M8 2v4m8-4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
function IconLocation({ className }: { className?: string }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C8.69 2 6 4.69 6 8c0 5.25 6 14 6 14s6-8.75 6-14c0-3.31-2.69-6-6-6zm0 8.5A2.5 2.5 0 1112 5.5a2.5 2.5 0 010 5z" fill="currentColor"/>
    </svg>
  )
}

/* ── SearchProgress bar ─────────────────────────────────────────────────── */
function SearchProgress({ active }: { active: boolean }) {
  if (!active) return null
  return <div className="search-progress-bar" key={Date.now()} style={{ width: '0%' }} />
}

export default function Home() {
  const [view, setView]           = useState<View>('form')
  const [tripType, setTripType]   = useState<TripType>('roundtrip')
  const [origin, setOrigin]       = useState('')
  const [dest, setDest]           = useState('')
  const [depart, setDepart]       = useState('')
  const [returnDate, setReturnDate] = useState('')

  const [flights, setFlights]     = useState<NormalizedFare[]>([])
  const [hotels, setHotels]       = useState<HotelOffer[]>([])
  const [notice, setNotice]       = useState<string | undefined>()
  const [scores, setScores]       = useState<Record<string, DealScore | null>>({})
  const [scoreLoading, setScoreLoading] = useState<Set<string>>(new Set())
  const [isSearching, setIsSearching]   = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [sortBy, setSortBy]       = useState<SortBy>('price')
  const [nonstopOnly, setNonstopOnly]   = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('flights')

  const progressKey = useRef(0)

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
      .then(s => setScores(prev => ({ ...prev, [fare.id]: s })))
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
    progressKey.current += 1

    try {
      const params = new URLSearchParams({ origin: origin.trim() })
      if (dest.trim()) params.set('dest', dest.trim())
      if (depart) params.set('depart', depart)
      if (returnDate && tripType === 'roundtrip') params.set('return', returnDate)

      const res = await fetch(`/api/search?${params.toString()}`)
      if (!res.ok || !res.body) throw new Error('Search failed')

      const reader  = res.body.getReader()
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
              if ((msg.data as HotelOffer[]).length > 0) setActiveTab('flights')
            } else if (msg.type === 'notice' && msg.message) {
              setNotice(prev => prev ? `${prev} — ${msg.message}` : msg.message)
            } else if (msg.type === 'done') {
              setIsSearching(false)
            }
          } catch { /* skip */ }
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
    setOrigin(dest)
    setDest(origin)
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

  const greatCount = Object.values(scores).filter(s => s?.verdict === 'Great').length
  const routeLabel = [origin.trim(), dest.trim()].filter(Boolean).join(' → ')

  /* ── Hero ──────────────────────────────────────────────────────────────── */
  if (view === 'form') {
    return (
      <div className="relative min-h-screen bg-[#07091A] flex flex-col items-center justify-center px-4 py-20 overflow-hidden">
        {/* Mesh gradient background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] opacity-25"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, #6366f1 0%, transparent 70%)' }} />
          <div className="absolute bottom-0 left-0 w-[500px] h-[400px] opacity-10"
            style={{ background: 'radial-gradient(ellipse at 0% 100%, #8b5cf6 0%, transparent 70%)' }} />
          <div className="absolute top-1/3 right-0 w-[400px] h-[300px] opacity-8"
            style={{ background: 'radial-gradient(ellipse at 100% 50%, #3b82f6 0%, transparent 70%)' }} />
          {/* Grid pattern */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative w-full max-w-lg">
          {/* Wordmark */}
          <div className="text-center mb-10 animate-fade-up">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/8 rounded-full px-4 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-pulse" />
              <span className="text-[11px] font-semibold text-gray-400 tracking-widest uppercase">
                Live deal intelligence
              </span>
            </div>
            <h1 className="font-display text-7xl sm:text-9xl font-extrabold tracking-tighter leading-none mb-4"
              style={{
                background: 'linear-gradient(135deg, #fff 0%, #c7d2fe 40%, #818cf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              expaify
            </h1>
            <p className="text-gray-300 text-base sm:text-lg font-semibold mb-1">
              Flights + Hotels ranked by real deal quality.
            </p>
            <p className="text-gray-500 text-sm">
              Prices scored against 90 days of history — not just the lowest number.
            </p>
          </div>

          {/* Search card */}
          <div className="animate-fade-up delay-100 rounded-3xl p-6"
            style={{
              background: 'rgba(12,17,34,0.85)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Trip type */}
            <div className="flex items-center gap-1 p-1 rounded-xl mb-5"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              {(['roundtrip', 'oneway'] as TripType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTripType(t)}
                  className="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
                  style={{
                    background: tripType === t ? 'rgba(99,102,241,0.25)' : 'transparent',
                    color: tripType === t ? '#a5b4fc' : '#64748b',
                    border: tripType === t ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                  }}
                >
                  {t === 'roundtrip' ? 'Round trip' : 'One way'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearch} className="space-y-3">
              {/* Origin + Swap + Dest */}
              <div className="grid grid-cols-[1fr_40px_1fr] items-end gap-2">
                {/* From */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-[0.12em] mb-1.5 pl-1">
                    From
                  </label>
                  <div className="relative">
                    <IconLocation className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="text"
                      value={origin}
                      onChange={e => setOrigin(e.target.value)}
                      placeholder="City or airport"
                      required
                      className="field-input"
                    />
                  </div>
                </div>

                {/* Swap */}
                <button
                  type="button"
                  onClick={handleSwap}
                  className="mb-0 self-end h-[50px] w-10 rounded-xl flex items-center justify-center transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#64748b',
                  }}
                  aria-label="Swap origin and destination"
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.color = '#a5b4fc'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.3)'
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.color = '#64748b'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'
                  }}
                >
                  <IconSwap />
                </button>

                {/* To */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-[0.12em] mb-1.5 pl-1">
                    To
                  </label>
                  <div className="relative">
                    <IconLocation className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="text"
                      value={dest}
                      onChange={e => setDest(e.target.value)}
                      placeholder="Anywhere"
                      className="field-input"
                    />
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className={`grid gap-3 ${tripType === 'roundtrip' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-[0.12em] mb-1.5 pl-1">
                    Depart
                  </label>
                  <div className="relative">
                    <IconCalendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                    <input
                      type="date"
                      value={depart}
                      onChange={e => setDepart(e.target.value)}
                      className="field-input"
                    />
                  </div>
                </div>
                {tripType === 'roundtrip' && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-[0.12em] mb-1.5 pl-1">
                      Return
                    </label>
                    <div className="relative">
                      <IconCalendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                      <input
                        type="date"
                        value={returnDate}
                        onChange={e => setReturnDate(e.target.value)}
                        className="field-input"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit */}
              <button type="submit" className="btn-primary" disabled={isSearching}>
                {isSearching ? (
                  <>
                    <span className="spinner" />
                    Scanning deals…
                  </>
                ) : (
                  <>
                    <IconPlane className="text-indigo-300" />
                    Search flights + hotels
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Popular routes */}
          <div className="mt-5 flex flex-wrap items-center gap-2 animate-fade-up delay-200">
            <span className="text-xs text-gray-700 font-semibold">Popular:</span>
            {popularRoutes.map(r => (
              <button
                key={r.label}
                type="button"
                onClick={() => { setOrigin(r.origin); setDest(r.dest) }}
                className="text-xs px-3 py-1.5 rounded-full transition-all"
                style={{
                  border: '1px solid rgba(255,255,255,0.07)',
                  background: 'rgba(255,255,255,0.03)',
                  color: '#64748b',
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#a5b4fc'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.3)'
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.06)'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#64748b'
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.07)'
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)'
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ── Results ──────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#07091A]">
      {/* Progress bar */}
      {isSearching && (
        <div key={progressKey.current} className="search-progress-bar" />
      )}

      {/* Sticky header */}
      <header
        className="sticky top-0 z-20 border-b"
        style={{
          background: 'rgba(7,9,26,0.88)',
          borderColor: 'rgba(255,255,255,0.07)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          {/* Logo */}
          <button
            onClick={() => setView('form')}
            className="font-display font-extrabold text-xl tracking-tighter text-white flex-shrink-0 transition-opacity hover:opacity-70"
          >
            expaify
          </button>

          {/* Search recap pill */}
          <button
            onClick={() => setView('form')}
            className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all group"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.3)'
              ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.05)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)'
              ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'
            }}
          >
            <IconPlane className="text-indigo-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-200 truncate">
              {routeLabel || 'Anywhere'}
            </span>
            {depart && (
              <>
                <span className="text-gray-700 flex-shrink-0">·</span>
                <span className="text-sm text-gray-500 flex-shrink-0 truncate">
                  {depart}{returnDate && tripType === 'roundtrip' ? ` – ${returnDate}` : ''}
                </span>
              </>
            )}
            <span className="ml-auto text-xs text-gray-600 group-hover:text-indigo-400 transition-colors flex-shrink-0 font-medium">
              Edit ✎
            </span>
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Status row */}
        <div className="flex items-center justify-between mb-5 animate-fade-in">
          {isSearching ? (
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 dot-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 dot-pulse-2" />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 dot-pulse-3" />
              </div>
              <p className="text-sm text-gray-400">Scanning deals across providers…</p>
            </div>
          ) : error ? (
            <div className="flex items-center gap-3">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={runSearch}
                className="text-xs font-bold text-indigo-400 border border-indigo-500/30 rounded-lg px-3 py-1.5 hover:bg-indigo-500/10 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-gray-200">
                {flights.length > 0
                  ? `${flights.length} flight${flights.length !== 1 ? 's' : ''} found${routeLabel ? ` · ${routeLabel}` : ''}`
                  : 'No flights found'}
              </p>
              {greatCount > 0 && (
                <p className="text-xs text-emerald-400 font-semibold mt-0.5 animate-fade-in">
                  🔥 {greatCount} great deal{greatCount !== 1 ? 's' : ''} below historical average
                </p>
              )}
            </div>
          )}
        </div>

        {!error && (
          <>
            {/* Tabs */}
            <div
              className="flex items-center gap-0 mb-6 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.07)' }}
            >
              {(['flights', 'hotels'] as ActiveTab[]).map(tab => {
                const count = tab === 'flights' ? flights.length : hotels.length
                const active = activeTab === tab
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className="relative px-5 py-3 text-sm font-bold capitalize transition-colors"
                    style={{ color: active ? '#f1f5f9' : '#64748b' }}
                  >
                    {tab}
                    {count > 0 && (
                      <span
                        className="ml-2 text-[11px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{
                          background: active ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                          color: active ? '#a5b4fc' : '#64748b',
                        }}
                      >
                        {count}
                      </span>
                    )}
                    {active && (
                      <span
                        className="absolute bottom-0 left-3 right-3 h-0.5 rounded-t-full"
                        style={{ background: 'linear-gradient(90deg, #6366f1, #a78bfa)' }}
                      />
                    )}
                  </button>
                )
              })}
            </div>

            {/* ── Flights ──────────────────────────────────────────────── */}
            {activeTab === 'flights' && (
              <>
                {(flights.length > 0 || isSearching) && (
                  <div className="flex flex-wrap items-center gap-2 mb-5">
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mr-1">Sort by</span>
                    {(['price', 'deal', 'stops'] as SortBy[]).map(opt => {
                      const labels: Record<SortBy, string> = {
                        price: 'Best price',
                        deal: 'Best deal',
                        stops: 'Fewest stops',
                      }
                      return (
                        <button
                          key={opt}
                          onClick={() => setSortBy(opt)}
                          className={`btn-pill ${sortBy === opt ? 'active' : ''}`}
                        >
                          {labels[opt]}
                        </button>
                      )
                    })}
                    <div className="w-px h-4 self-center mx-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
                    <button
                      onClick={() => setNonstopOnly(p => !p)}
                      className={`btn-pill ${nonstopOnly ? 'active' : ''}`}
                    >
                      <span className="text-emerald-400">✈</span>
                      Nonstop only
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
                  <div className="text-center py-24 animate-fade-in">
                    <div className="text-5xl mb-4">✈️</div>
                    <p className="font-display font-bold text-lg text-gray-300">No flights found</p>
                    <p className="text-gray-600 text-sm mt-2 max-w-xs mx-auto">
                      {nonstopOnly
                        ? 'Try removing the Nonstop only filter to see more options.'
                        : 'Try different dates, a different destination, or leave destination blank to explore.'}
                    </p>
                    {nonstopOnly && (
                      <button
                        onClick={() => setNonstopOnly(false)}
                        className="mt-4 text-sm font-bold text-indigo-400 border border-indigo-500/30 rounded-xl px-4 py-2 hover:bg-indigo-500/10 transition-colors"
                      >
                        Show all flights
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayedFlights.map((fare, i) => (
                      <div key={fare.id} className={`animate-fade-up ${staggerDelays[Math.min(i, 5)]}`}>
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

                {/* Alert signup */}
                {dest.trim() && !isSearching && flights.length > 0 && (
                  <div className="mt-8 animate-fade-up">
                    <AlertSignup origin={origin.trim()} destination={dest.trim()} />
                  </div>
                )}
              </>
            )}

            {/* ── Hotels ───────────────────────────────────────────────── */}
            {activeTab === 'hotels' && (
              <>
                {isSearching && hotels.length === 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="card rounded-2xl overflow-hidden">
                        <div className="h-40 shimmer" />
                        <div className="p-5 space-y-3">
                          <div className="h-4 w-3/4 rounded shimmer" />
                          <div className="h-3 w-1/2 rounded shimmer" />
                          <div className="pt-3 border-t border-white/5 flex justify-between items-end">
                            <div className="space-y-1.5">
                              <div className="h-6 w-16 rounded shimmer" />
                              <div className="h-2.5 w-12 rounded shimmer" />
                            </div>
                            <div className="h-10 w-32 rounded-xl shimmer" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : hotels.length === 0 ? (
                  <div className="text-center py-24 animate-fade-in">
                    <div className="text-5xl mb-4">🏨</div>
                    <p className="font-display font-bold text-lg text-gray-300">No hotels found</p>
                    <p className="text-gray-600 text-sm mt-2 max-w-xs mx-auto">
                      {!dest.trim()
                        ? 'Enter a destination city to see hotels.'
                        : tripType === 'oneway' || !returnDate
                        ? 'Add a return date to see hotel availability.'
                        : 'No hotels available for these dates. Try different dates.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {hotels.map((hotel, i) => (
                      <div key={hotel.id} className={`animate-fade-up ${staggerDelays[Math.min(i, 5)]}`}>
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
