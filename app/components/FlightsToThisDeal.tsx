'use client'

import { useEffect, useReducer, useRef, useState } from 'react'
import AirportInput from '@/app/components/AirportInput'
import FlightCard from '@/app/components/FlightCard'
import { extractNdjsonLines } from '@/lib/search/parseNdjsonBuffer'
import {
  applySearchStreamEvent,
  initialSearchStreamState,
  type SearchStreamState,
} from '@/lib/search/searchStreamReducer'
import type { NormalizedFare } from '@/lib/types'

/** Adds calendar days to a YYYY-MM-DD string in UTC, avoiding the
 * local-timezone day-boundary shift a plain `new Date(str).setDate(...)`
 * can introduce (same discipline as the rest of this codebase's date math). */
function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day) + days * 86_400_000)
  return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`
}

type ActiveSearch = {
  origin: string
  dest: string
  depart: string
  returnDate: string
}

function FlightsToThisDealResults({ search }: { search: ActiveSearch }) {
  const [streamState, dispatch] = useReducer(applySearchStreamEvent, initialSearchStreamState)
  const [streamError, setStreamError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current = controller
    setStreamError(null)

    void (async () => {
      try {
        const params = new URLSearchParams({
          origin: search.origin,
          dest: search.dest,
          depart: search.depart,
          return: search.returnDate,
          trip: 'roundtrip',
        })
        const response = await fetch(`/api/search?${params.toString()}`, { signal: controller.signal })

        if (!response.ok || !response.body) {
          setStreamError(`Flight search failed (${response.status}).`)
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const { events, remainder } = extractNdjsonLines(buffer)
          buffer = remainder
          events.forEach(event => dispatch(event as Parameters<typeof applySearchStreamEvent>[1]))
        }

        buffer += decoder.decode()
        if (buffer.trim()) {
          const { events } = extractNdjsonLines(`${buffer}\n`)
          events.forEach(event => dispatch(event as Parameters<typeof applySearchStreamEvent>[1]))
        }
      } catch (error) {
        if (controller.signal.aborted) return
        setStreamError(error instanceof Error ? error.message : 'The flight search failed unexpectedly.')
      }
    })()

    return () => controller.abort()
  }, [search.origin, search.dest, search.depart, search.returnDate])

  const isSearching = !streamState.done && !streamError
  const cheapestFares: NormalizedFare[] = [...streamState.flights]
    .sort((a, b) => a.price.priceCents - b.price.priceCents)
    .slice(0, 3)

  return (
    <div className="mt-4 space-y-3">
      {streamError ? (
        <p className="rounded-[var(--radius-control)] border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-3 py-2 text-xs font-medium text-[var(--warning)]" role="alert">
          {streamError}
        </p>
      ) : null}

      {streamState.providerNotices.map((notice, index) => (
        <p
          key={`${notice.provider}-${notice.status}-${index}`}
          className="rounded-[var(--radius-control)] border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-3 py-2 text-xs font-medium text-[var(--warning)]"
        >
          {notice.provider}: {notice.message}
        </p>
      ))}

      {isSearching ? (
        <p className="text-sm text-[var(--text-2)]">Searching for flights…</p>
      ) : null}

      {!isSearching && !streamError && cheapestFares.length === 0 ? (
        <p className="text-sm text-[var(--text-2)]">No flights found for these dates.</p>
      ) : null}

      {cheapestFares.map(fare => (
        <FlightCard key={fare.id} fare={fare} score={null} loading={false} />
      ))}
    </div>
  )
}

type FlightsToThisDealProps = {
  destinationIata: string
  checkInDate: string
  nights: number
}

export function FlightsToThisDeal({ destinationIata, checkInDate, nights }: FlightsToThisDealProps) {
  const [originIata, setOriginIata] = useState('')
  const [originDisplay, setOriginDisplay] = useState('')
  const [activeSearch, setActiveSearch] = useState<ActiveSearch | null>(null)

  const handleSearch = () => {
    if (!originIata) return
    setActiveSearch({
      origin: originIata,
      dest: destinationIata,
      depart: checkInDate,
      returnDate: addDaysToDateString(checkInDate, nights),
    })
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-[color:var(--border-strong)] bg-[var(--bg-surface)] p-4 sm:p-6">
      <h2 className="text-xl font-medium text-[color:var(--text-1)] sm:text-2xl">Find flights to {destinationIata}</h2>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <AirportInput
            id="flights-to-deal-origin"
            value={originIata}
            displayValue={originDisplay}
            onChange={(iata, display) => {
              setOriginIata(iata)
              setOriginDisplay(display)
            }}
            placeholder="Flying from"
            required
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={!originIata}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--brand)] bg-[var(--brand)] px-4 text-sm font-medium text-[var(--text-inverse)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Search flights
        </button>
      </div>

      {activeSearch ? <FlightsToThisDealResults key={`${activeSearch.origin}-${activeSearch.dest}-${activeSearch.depart}`} search={activeSearch} /> : null}
    </section>
  )
}
