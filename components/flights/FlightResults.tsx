'use client'

import type { Dispatch, FormEvent, SetStateAction } from 'react'
import FlightCard from '@/app/components/FlightCard'
import { AIRPORTS } from '@/lib/airports/data'
import type { DealScore, NormalizedFare } from '@/lib/types'
import { BaggageFeeEstimator } from '@/components/baggage/BaggageFeeEstimator'
import type { BaggageCabinClass } from '@/lib/baggage/types'

type SortBy = 'price' | 'deal'
type TripType = 'roundtrip' | 'oneway'

type FlightResultsProps = {
  flights: NormalizedFare[]
  displayFlights: NormalizedFare[]
  isSearching: boolean
  sortBy: SortBy
  setSortBy: Dispatch<SetStateAction<SortBy>>
  filterStops: number | null
  setFilterStops: Dispatch<SetStateAction<number | null>>
  scores: Record<string, DealScore | null>
  scoreLoading: Set<string>
  rankingUpdating?: boolean
  suggestion: string | null
  providerNotices: string[]
  dest: string
  depart: string
  returnDate: string
  tripType: TripType
  alertEmail: string
  setAlertEmail: Dispatch<SetStateAction<string>>
  alertSent: boolean
  alertLoading: boolean
  alertError: string | null
  handleAlertSubmit: (event: FormEvent<HTMLFormElement>) => void
}

const delays = ['', 'delay-75', 'delay-150', 'delay-225', 'delay-300']

function countryForAirport(iata: string): string {
  return AIRPORTS.find(airport => airport.iata === iata.toUpperCase())?.country ?? 'US'
}

function cabinForBaggage(cabin: NormalizedFare['cabin']): BaggageCabinClass {
  if (cabin === 'premium_economy') return 'PREMIUM_ECONOMY'
  if (cabin === 'business') return 'BUSINESS'
  if (cabin === 'first') return 'FIRST'
  return 'ECONOMY'
}

function cheapestVisibleFare(fares: NormalizedFare[]): NormalizedFare | null {
  if (fares.length === 0) return null
  return fares.reduce((best, fare) =>
    fare.price.priceCents < best.price.priceCents ? fare : best
  )
}

function isHotelNotice(notice: string): boolean {
  return notice.toLowerCase().startsWith('hotels unavailable')
}

export default function FlightResults({
  flights,
  displayFlights,
  isSearching,
  sortBy,
  setSortBy,
  filterStops,
  setFilterStops,
  scores,
  scoreLoading,
  rankingUpdating = false,
  suggestion,
  providerNotices,
  dest,
  depart,
  returnDate,
  tripType,
  alertEmail,
  setAlertEmail,
  alertSent,
  alertLoading,
  alertError,
  handleAlertSubmit,
}: FlightResultsProps) {
  const baggageFare = cheapestVisibleFare(displayFlights)
  const flightProviderNotices = providerNotices.filter(notice => !isHotelNotice(notice))
  const missingDepart = !depart
  const missingRoundtripReturn = tripType === 'roundtrip' && !returnDate
  const filtersHideResults = flights.length > 0 && displayFlights.length === 0
  const hasProviderUnavailable = flightProviderNotices.length > 0 && flights.length === 0 && !missingDepart && !missingRoundtripReturn
  const incompleteDates = missingDepart || missingRoundtripReturn
  const emptyTitle = incompleteDates
    ? 'Dates needed for a complete search'
    : filtersHideResults
      ? 'Filters are hiding the available fares'
      : hasProviderUnavailable
        ? 'Flight providers unavailable'
        : 'No flight inventory found'
  const emptyCopy = missingDepart
    ? 'Add a departure date so providers can return current fares and Deal Scores can be compared honestly.'
    : missingRoundtripReturn
      ? 'Add a return date for round-trip pricing, or switch to one way before searching again.'
      : filtersHideResults
        ? 'Clear the stops filter or choose All to review the fares returned for this search.'
        : hasProviderUnavailable
          ? 'The flight providers we could reach did not return usable inventory. Try again shortly or adjust the trip details.'
          : 'No current fares matched this route and date combination. Try nearby dates, another destination, or search anywhere.'

  return (
    <>
      {(flightProviderNotices.length > 0 || missingDepart || missingRoundtripReturn) && (
        <div className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.045] px-4 py-3 text-sm leading-6 text-amber-100/85">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-200/70">
            Search notice
          </p>
          {missingDepart && (
            <p className="mt-1">Departure date is missing, so live fare coverage may be incomplete.</p>
          )}
          {missingRoundtripReturn && (
            <p className="mt-1">Return date is missing for this round trip. Results may not reflect round-trip inventory.</p>
          )}
          {flightProviderNotices.length > 0 && (
            <div className="mt-1 space-y-1">
              {flightProviderNotices.map(notice => (
                <p key={notice}>{notice}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {flights.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-bold text-gray-600">Sort</span>
            {(['deal', 'price'] as const).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setSortBy(option)}
                className={`btn-pill ${sortBy === option ? 'active' : ''}`}
              >
                {option === 'deal' ? 'Best deal' : 'Lowest price'}
              </button>
            ))}
            <span className="ml-2 mr-1 text-xs font-bold text-gray-600">Stops</span>
            {([null, 0, 1] as const).map(value => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setFilterStops(value)}
                className={`btn-pill ${filterStops === value ? 'active' : ''}`}
              >
                {value === null ? 'All' : value === 0 ? 'Nonstop' : '1 stop'}
              </button>
            ))}
            <span className="ml-auto text-xs text-gray-600">
              {displayFlights.length} result{displayFlights.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="mt-2 min-h-5" aria-live="polite">
            {rankingUpdating && (
              <span
                className="block text-xs font-semibold leading-5 text-indigo-300"
              >
                Updating deal ranking as scores finish.
              </span>
            )}
          </div>
        </div>
      )}

      {baggageFare && (
        <BaggageFeeEstimator
          carrierCode={baggageFare.carrier}
          originCountry={countryForAirport(baggageFare.origin)}
          destinationCountry={countryForAirport(baggageFare.destination)}
          cabinClass={cabinForBaggage(baggageFare.cabin)}
        />
      )}

      {isSearching && displayFlights.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <FlightCard key={index} score={null} loading />
          ))}
        </div>
      ) : displayFlights.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-8 text-center animate-fade-in sm:px-6 sm:py-10">
          <p className="font-display text-base font-bold text-gray-200 sm:text-lg">{emptyTitle}</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
            {emptyCopy}
          </p>
          {suggestion && <p className="mt-2 text-xs text-gray-500">{suggestion}</p>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayFlights.map((fare, index) => (
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

          {!isSearching && dest.trim() && flights.length >= 3 && (
            <div className="card mt-4 flex flex-col items-center gap-4 p-5 animate-fade-up sm:flex-row">
              <div className="flex-1 text-center sm:text-left">
                <p className="font-display font-bold text-gray-200">🔔 Track this route</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Get an email when prices drop below today&apos;s level
                </p>
              </div>
              {alertSent ? (
                <p className="text-sm font-bold text-emerald-400">✓ You&apos;re on the list</p>
              ) : (
                <div className="w-full sm:w-auto">
                  <form className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row" onSubmit={handleAlertSubmit}>
                    <input
                      type="email"
                      required
                      value={alertEmail}
                      onChange={event => setAlertEmail(event.target.value)}
                      placeholder="your@email.com"
                      className="field-input !py-2.5 !pl-4 text-sm sm:w-48"
                    />
                    <button
                      type="submit"
                      disabled={alertLoading}
                      className="btn-primary !w-auto whitespace-nowrap px-4 !py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {alertLoading ? 'Setting...' : 'Notify me'}
                    </button>
                  </form>
                  {alertError && (
                    <p className="mt-2 text-xs text-red-300 sm:text-right">{alertError}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}
