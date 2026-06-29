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

  // ─── Search form ────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <h1 className="text-4xl font-bold text-gray-900 mb-1">expaify</h1>
          <p className="text-gray-500 mb-8 text-base">
            Find flight deals that are actually good.
          </p>

          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label
                htmlFor="origin"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Origin <span className="text-red-500">*</span>
              </label>
              <input
                id="origin"
                type="text"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="NYC, JFK, 10001"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="dest"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Destination
              </label>
              <input
                id="dest"
                type="text"
                value={dest}
                onChange={(e) => setDest(e.target.value)}
                placeholder="LAX, London, leave blank to browse deals"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="depart"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Depart
                </label>
                <input
                  id="depart"
                  type="date"
                  value={depart}
                  onChange={(e) => setDepart(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
              <div>
                <label
                  htmlFor="return"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Return
                </label>
                <input
                  id="return"
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-colors"
            >
              Search
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ─── Results view ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Top bar */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleBack}
            className="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1 transition-colors"
          >
            <span aria-hidden="true">&#8592;</span> Back
          </button>
          <span className="font-bold text-gray-900">expaify</span>
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 mb-6 flex items-center justify-between gap-4">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={handleBack}
              className="text-sm font-medium text-red-700 hover:text-red-900 underline flex-shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Notice banner */}
        {notice && !error && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 mb-6">
            <p className="text-sm text-blue-700">{notice}</p>
          </div>
        )}

        {!error && (
          <>
            {/* Flights section */}
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Flights
              </h2>

              {isSearching ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <FlightCard key={i} loading score={null} />
                  ))}
                </div>
              ) : flights.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center">
                  <p className="text-gray-600 text-sm font-medium">
                    No flights found for this route.
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
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
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Hotels
              </h2>

              {isSearching ? (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center">
                  <div className="h-3 w-32 bg-gray-200 rounded animate-pulse mx-auto" />
                </div>
              ) : hotels.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center">
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
          </>
        )}
      </div>
    </div>
  )
}
