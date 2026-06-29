'use client'

import { useState, FormEvent } from 'react'
import { NormalizedFare, DealScore, HotelOffer } from '@/lib/types'
import FlightCard from './components/FlightCard'
import HotelCard from './components/HotelCard'

interface SearchResult {
  flights: NormalizedFare[]
  hotels: HotelOffer[]
  notice?: string
}

type View = 'form' | 'results'

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
      if (!res.ok) throw new Error('Search request failed')

      const data = (await res.json()) as SearchResult
      setFlights(data.flights)
      setHotels(data.hotels)
      setNotice(data.notice)
      setIsSearching(false)

      if (data.flights.length > 0) {
        // Mark all flights as score-loading
        const initialScores: Record<string, DealScore | null> = {}
        const loadingIds = new Set<string>()
        for (const fare of data.flights) {
          initialScores[fare.id] = null
          loadingIds.add(fare.id)
        }
        setScores(initialScores)
        setScoreLoading(loadingIds)

        // Fire all /api/score requests in parallel; update each card as it resolves
        data.flights.forEach((fare) => {
          fetch('/api/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fare }),
          })
            .then((r) => {
              if (!r.ok) throw new Error('Score request failed')
              return r.json() as Promise<DealScore>
            })
            .then((score) => {
              setScores((prev) => ({ ...prev, [fare.id]: score }))
            })
            .catch(() => {
              // Score unavailable — card renders with null score, no longer loading
            })
            .finally(() => {
              setScoreLoading((prev) => {
                const next = new Set(prev)
                next.delete(fare.id)
                return next
              })
            })
        })
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

  // ─── Search form (hero) ──────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          {/* Hero text */}
          <div className="mb-10 text-center">
            <p className="text-xs font-medium text-indigo-400 uppercase tracking-widest mb-5">
              Deal intelligence
            </p>
            <h1 className="text-7xl font-bold text-white tracking-tight leading-none mb-4">
              expaify
            </h1>
            <p className="text-gray-300 text-lg font-medium mb-2">
              Find deals worth booking.
            </p>
            <p className="text-gray-500 text-sm">
              Flight prices scored against 90 days of history.
            </p>
          </div>

          {/* Search card */}
          <div className="bg-gray-900 border border-white/8 rounded-2xl p-6 shadow-2xl shadow-black/50">
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
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

              <div>
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
                  placeholder="LAX, London, or leave blank to browse"
                  className="w-full rounded-xl bg-[#0a0f1e] border border-white/10 px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
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
                Search flights
              </button>
            </form>
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
            ← New search
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Flights section */}
            <section>
              <h2 className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-4">
                Flights
              </h2>

              {isSearching ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <FlightCard key={i} loading score={null} />
                  ))}
                </div>
              ) : flights.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-gray-900 px-4 py-10 text-center">
                  <p className="text-gray-400 text-sm font-medium">
                    No flights found for this route.
                  </p>
                  <p className="text-gray-600 text-xs mt-1">
                    Try different dates or a different destination.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {flights.map((fare) => (
                    <FlightCard
                      key={fare.id}
                      fare={fare}
                      score={scores[fare.id] ?? null}
                      loading={scoreLoading.has(fare.id)}
                    />
                  ))}
                </div>
              )}
            </section>

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
                  {hotels.map((hotel) => (
                    <HotelCard key={hotel.id} hotel={hotel} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
