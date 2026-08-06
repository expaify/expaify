'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { SearchPanel, type SearchPanelSubmitPayload } from '@/components/search/SearchPanel'
import FlightResults from '@/components/flights/FlightResults'
import { sortFlights } from '@/lib/search/sortFlights'
import { comparablePriceCents } from '@/lib/search/comparablePrice'
import {
  applySearchStreamEvent,
  initialSearchStreamState,
  type SearchStreamState,
} from '@/lib/search/searchStreamReducer'
import { extractNdjsonLines } from '@/lib/search/parseNdjsonBuffer'
import type { DealScore, Money, NormalizedFare } from '@/lib/types'

type SortBy = 'price' | 'deal' | 'estimatedTotal' | 'duration'

type AlertResponse =
  | { ok: true; data: { id: string; message: string; active: boolean } }
  | { ok: false; reason: string }

function buildSearchParams(search: SearchPanelSubmitPayload): URLSearchParams {
  const params = new URLSearchParams({
    origin: search.originIata,
    trip: search.tripType,
    depart: search.departDate,
  })
  if (search.destinationIata) params.set('dest', search.destinationIata)
  if (search.tripType === 'roundtrip' && search.returnDate) params.set('return', search.returnDate)
  if (search.flexible) params.set('flex', '1')
  return params
}

function buildSearchContext(search: SearchPanelSubmitPayload | null): string {
  if (!search) return ''
  const route = search.destinationIata
    ? `${search.originIata} → ${search.destinationIata}`
    : `${search.originIata} → Anywhere`
  const dates = search.tripType === 'roundtrip' && search.returnDate
    ? `${search.departDate} - ${search.returnDate}`
    : search.departDate
      ? `${search.departDate} (one way)`
      : 'Dates not set'
  return `Flight search · ${route} · ${dates} · 1 traveler`
}

function cheapestFarePrice(fares: NormalizedFare[]): Money | null {
  if (fares.length === 0) return null
  const cheapest = fares.reduce((best, fare) =>
    comparablePriceCents(fare) < comparablePriceCents(best) ? fare : best
  , fares[0])
  return { priceCents: comparablePriceCents(cheapest), currency: cheapest.price.currency }
}

function isFlightsEvent(event: unknown): event is { type: 'flights'; data: NormalizedFare[] } {
  return (
    typeof event === 'object' &&
    event !== null &&
    (event as { type?: unknown }).type === 'flights' &&
    Array.isArray((event as { data?: unknown }).data)
  )
}

export function FlightsClient() {
  const [lastSearch, setLastSearch] = useState<SearchPanelSubmitPayload | null>(null)
  const [searchState, setSearchState] = useState<SearchStreamState>(initialSearchStreamState)
  const [isSearching, setIsSearching] = useState(false)
  const [scores, setScores] = useState<Record<string, DealScore | null>>({})
  const [scoreLoading, setScoreLoading] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<SortBy>('deal')
  const [filterStops, setFilterStops] = useState<number | null>(null)
  const [alertEmail, setAlertEmail] = useState('')
  const [alertSent, setAlertSent] = useState(false)
  const [alertLoading, setAlertLoading] = useState(false)
  const [alertError, setAlertError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const requestedScoreIds = useRef<Set<string>>(new Set())
  const searchPanelRef = useRef<HTMLDivElement | null>(null)

  const scoreFare = useCallback((fare: NormalizedFare, signal: AbortSignal) => {
    setScoreLoading(prev => new Set(prev).add(fare.id))
    fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fare }),
      signal,
    })
      .then(response => {
        if (!response.ok) throw new Error(`Deal score request failed (${response.status}).`)
        return response.json() as Promise<DealScore>
      })
      .then(score => {
        setScores(prev => ({ ...prev, [fare.id]: score }))
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        // A missing score is shown honestly as "no score" by FlightCard —
        // never fabricate a DealScore when the request failed.
        setScores(prev => ({ ...prev, [fare.id]: null }))
      })
      .finally(() => {
        setScoreLoading(prev => {
          const next = new Set(prev)
          next.delete(fare.id)
          return next
        })
      })
  }, [])

  const scoreNewFares = useCallback((fares: NormalizedFare[], signal: AbortSignal) => {
    const newFares = fares.filter(fare => !requestedScoreIds.current.has(fare.id))
    newFares.forEach(fare => {
      requestedScoreIds.current.add(fare.id)
      scoreFare(fare, signal)
    })
  }, [scoreFare])

  const runSearch = useCallback((search: SearchPanelSubmitPayload) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    requestedScoreIds.current = new Set()

    setLastSearch(search)
    setSearchState(initialSearchStreamState)
    setScores({})
    setScoreLoading(new Set())
    setAlertSent(false)
    setAlertError(null)
    setIsSearching(true)

    const dispatch = (event: unknown) => {
      // A reader.read() already in flight when a newer search supersedes
      // this one can still resolve after abort() — abort only rejects the
      // *next* read, not one already pending. Without this guard, that
      // straggling chunk would merge into the new search's freshly-reset
      // state. abortRef.current is checked fresh on every call rather than
      // captured once, since it can change between events in the same loop.
      if (abortRef.current !== controller) return
      setSearchState(prev => applySearchStreamEvent(prev, event))
      // Kick off scoring from the raw event's fares rather than from the
      // merged state — reading side effects off a setState updater risks
      // running them twice under React's Strict Mode double-invoke.
      if (isFlightsEvent(event)) {
        scoreNewFares(event.data, controller.signal)
      }
    }

    const params = buildSearchParams(search)

    void (async () => {
      try {
        const response = await fetch(`/api/search?${params.toString()}`, { signal: controller.signal })

        if (!response.ok || !response.body) {
          let message = `Search request failed (${response.status}).`
          try {
            const errorBody = (await response.json()) as { error?: unknown }
            if (typeof errorBody.error === 'string' && errorBody.error) message = errorBody.error
          } catch {
            // Non-JSON error body — fall back to the generic message above.
          }
          dispatch({ type: 'notice', provider: 'Search request', status: 'unavailable', message })
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
          events.forEach(dispatch)
        }

        buffer += decoder.decode()
        if (buffer.trim()) {
          const { events } = extractNdjsonLines(`${buffer}\n`)
          events.forEach(dispatch)
        }
      } catch (error) {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : 'The search stream failed unexpectedly.'
        dispatch({ type: 'notice', provider: 'Search request', status: 'unavailable', message })
      } finally {
        if (!controller.signal.aborted) setIsSearching(false)
      }
    })()
  }, [scoreNewFares])

  const handleSubmit = useCallback((search: SearchPanelSubmitPayload) => {
    runSearch(search)
  }, [runSearch])

  const handleAlertSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!lastSearch || alertLoading) return

    if (!lastSearch.destinationIata) {
      setAlertError('Add a destination to this search before setting a price alert.')
      return
    }

    const cheapest = cheapestFarePrice(searchState.flights)
    if (!cheapest) {
      setAlertError('We need at least one live fare before setting a price alert.')
      return
    }

    setAlertLoading(true)
    setAlertError(null)

    void (async () => {
      try {
        const response = await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: alertEmail,
            origin: lastSearch.originIata,
            destination: lastSearch.destinationIata,
            thresholdCents: cheapest.priceCents,
          }),
        })
        const result = (await response.json()) as AlertResponse
        if (!response.ok || !result.ok) {
          setAlertError(!result.ok ? result.reason : `Price alert signup failed (${response.status}).`)
          return
        }
        setAlertSent(true)
      } catch {
        setAlertError('Price alert signup is unavailable right now. Please try again.')
      } finally {
        setAlertLoading(false)
      }
    })()
  }, [lastSearch, alertLoading, alertEmail, searchState.flights])

  const filteredFlights = useMemo(() => (
    filterStops === null
      ? searchState.flights
      : searchState.flights.filter(fare => fare.stops === filterStops)
  ), [searchState.flights, filterStops])

  const displayFlights = useMemo(
    () => sortFlights(filteredFlights, sortBy, scores),
    [filteredFlights, sortBy, scores]
  )

  const rankingUpdating = scoreLoading.size > 0

  const onEditSearch = useCallback(() => {
    searchPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const onRetrySearch = useCallback(() => {
    if (lastSearch) runSearch(lastSearch)
  }, [lastSearch, runSearch])

  const onTryFlexibleDates = useCallback(() => {
    if (lastSearch) runSearch({ ...lastSearch, flexible: true })
  }, [lastSearch, runSearch])

  const onSearchAnywhere = useCallback(() => {
    if (lastSearch) runSearch({ ...lastSearch, destinationIata: '' })
  }, [lastSearch, runSearch])

  const onTryNearbyOrigin = useCallback((iata: string) => {
    if (lastSearch) runSearch({ ...lastSearch, originIata: iata })
  }, [lastSearch, runSearch])

  return (
    <div className="space-y-8">
      <div ref={searchPanelRef}>
        <SearchPanel onSubmit={handleSubmit} />
      </div>
      <FlightResults
        flights={searchState.flights}
        displayFlights={displayFlights}
        isSearching={isSearching}
        hasSearched={lastSearch !== null}
        sortBy={sortBy}
        setSortBy={setSortBy}
        filterStops={filterStops}
        setFilterStops={setFilterStops}
        scores={scores}
        scoreLoading={scoreLoading}
        rankingUpdating={rankingUpdating}
        suggestion={searchState.suggestion}
        providerNotices={searchState.providerNotices}
        origin={lastSearch?.originIata ?? ''}
        dest={lastSearch?.destinationIata ?? ''}
        depart={lastSearch?.departDate ?? ''}
        returnDate={lastSearch?.returnDate ?? ''}
        tripType={lastSearch?.tripType ?? 'roundtrip'}
        flexDates={lastSearch?.flexible ?? false}
        searchContext={buildSearchContext(lastSearch)}
        alertEmail={alertEmail}
        setAlertEmail={setAlertEmail}
        alertSent={alertSent}
        alertLoading={alertLoading}
        alertError={alertError}
        handleAlertSubmit={handleAlertSubmit}
        onEditSearch={onEditSearch}
        onRetrySearch={onRetrySearch}
        onTryFlexibleDates={onTryFlexibleDates}
        onSearchAnywhere={onSearchAnywhere}
        onTryNearbyOrigin={onTryNearbyOrigin}
      />
    </div>
  )
}
