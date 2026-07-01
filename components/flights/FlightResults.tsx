'use client'

import type { Dispatch, FormEvent, ReactNode, SetStateAction } from 'react'
import FlightCard from '@/app/components/FlightCard'
import { AIRPORTS } from '@/lib/airports/data'
import type { DealScore, NormalizedFare, ProviderNotice } from '@/lib/types'
import { BaggageFeeEstimator } from '@/components/baggage/BaggageFeeEstimator'
import type { BaggageCabinClass } from '@/lib/baggage/types'
import { formatMoney } from '@/lib/money'

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
  providerNotices: ProviderNotice[]
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
  onEditSearch?: () => void
  onRetrySearch?: () => void
}

const delays = ['', 'delay-75', 'delay-150', 'delay-225', 'delay-300']

const sortLabels: Record<SortBy, string> = {
  deal: 'Best deal',
  price: 'Lowest price',
}

function stopFilterLabel(value: number | null): string {
  if (value === 0) return 'Nonstop'
  if (value === 1) return '1 stop'
  return 'All stops'
}

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

function isHotelNotice(notice: ProviderNotice): boolean {
  return notice.provider.toLowerCase().includes('hotel')
}

function FlightStatePanel({
  eyebrow,
  title,
  children,
  action,
  tone = 'default',
}: {
  eyebrow: string
  title: string
  children: ReactNode
  action?: ReactNode
  tone?: 'default' | 'warning'
}) {
  const toneClasses = tone === 'warning'
    ? 'border-[var(--warning)]/25 bg-[var(--warning-soft)]'
    : 'border-[var(--border)] bg-[var(--bg-surface)]'
  const eyebrowClasses = tone === 'warning'
    ? 'text-[var(--warning)]'
    : 'text-[var(--text-2)]'

  return (
    <section
      className={`rounded-[1.25rem] border px-5 py-5 shadow-[var(--shadow-card)] animate-fade-in sm:px-6 sm:py-6 ${toneClasses}`}
      role="status"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-wide ${eyebrowClasses}`}>
            {eyebrow}
          </p>
          <h2 className="mt-1 font-display text-xl font-bold leading-7 text-[var(--text-1)]">
            {title}
          </h2>
          <div className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-2)]">
            {children}
          </div>
        </div>
        {action && (
          <div className="flex w-full shrink-0 sm:w-auto">
            {action}
          </div>
        )}
      </div>
    </section>
  )
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
  onEditSearch,
  onRetrySearch,
}: FlightResultsProps) {
  const baggageFare = cheapestVisibleFare(displayFlights)
  const flightProviderNotices = providerNotices.filter(notice => !isHotelNotice(notice))
  const bestDealCount = displayFlights.reduce((count, fare) => count + (scores[fare.id]?.verdict === 'Great' ? 1 : 0), 0)
  const nonstopCount = displayFlights.filter(fare => fare.stops === 0).length
  const cheapestFare = baggageFare
  const missingDepart = !depart
  const missingRoundtripReturn = tripType === 'roundtrip' && !returnDate
  const filtersHideResults = flights.length > 0 && displayFlights.length === 0
  const hasProviderUnavailable = flightProviderNotices.length > 0 && flights.length === 0 && !missingDepart && !missingRoundtripReturn
  const incompleteDates = missingDepart || missingRoundtripReturn
  const controlsDisabled = flights.length === 0
  const controlsSummary = controlsDisabled
    ? 'Sort and stop filters will be available after fares load.'
    : `Showing ${displayFlights.length} of ${flights.length} fare${flights.length === 1 ? '' : 's'}, sorted by ${sortLabels[sortBy].toLowerCase()} with ${stopFilterLabel(filterStops).toLowerCase()} selected.`
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
          ? 'No flight provider returned usable inventory. Try again shortly or adjust the trip details.'
          : 'No current fares matched this route and date combination. Edit the search to try nearby dates, another destination, or anywhere.'
  const emptyAction = filtersHideResults ? (
    <button
      type="button"
      onClick={() => setFilterStops(null)}
      className="btn-primary min-h-11 w-full px-4 py-2.5 text-sm sm:w-auto"
    >
      Show all stops
    </button>
  ) : hasProviderUnavailable && onRetrySearch ? (
    <button
      type="button"
      onClick={onRetrySearch}
      className="btn-primary min-h-11 w-full px-4 py-2.5 text-sm sm:w-auto"
    >
      Retry search
    </button>
  ) : onEditSearch ? (
    <button
      type="button"
      onClick={onEditSearch}
      className="btn-primary min-h-11 w-full px-4 py-2.5 text-sm sm:w-auto"
    >
      Edit search
    </button>
  ) : null

  return (
    <>
      {(flightProviderNotices.length > 0 || missingDepart || missingRoundtripReturn) && (
        <div className="mb-4">
          <FlightStatePanel
            eyebrow="Search notice"
            title="Provider coverage may be incomplete"
            tone="warning"
          >
            {missingDepart && (
              <p className="mt-1">Departure date is missing, so live fare coverage may be incomplete.</p>
            )}
            {missingRoundtripReturn && (
              <p className="mt-1">Return date is missing for this round trip. Results may not reflect round-trip inventory.</p>
            )}
            {flightProviderNotices.length > 0 && (
              <div className="mt-1 space-y-1">
                {flightProviderNotices.map(notice => (
                  <p key={`${notice.provider}-${notice.status}-${notice.message}`}>{notice.message}</p>
                ))}
              </div>
            )}
          </FlightStatePanel>
        </div>
      )}

      {(flights.length > 0 || isSearching) && (
        <div className="mb-5 rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-raised)] p-4 shadow-[var(--shadow-card)] sm:p-5">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)]">
                Lowest live fare
              </p>
              <p className="mt-1 font-display text-xl font-extrabold text-[var(--text-1)]">
                {cheapestFare ? formatMoney(cheapestFare.price) : 'Waiting'}
              </p>
              <p className="mt-1 text-xs font-medium text-[var(--text-2)]">
                {cheapestFare ? `${cheapestFare.origin} to ${cheapestFare.destination}` : 'Results will populate here as fares arrive.'}
              </p>
            </div>
            <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)]">
                Great deals
              </p>
              <p className="mt-1 font-display text-xl font-extrabold text-[var(--text-1)]">
                {bestDealCount}
              </p>
              <p className="mt-1 text-xs font-medium text-[var(--text-2)]">
                Ranked well against recent route history.
              </p>
            </div>
            <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)]">
                Nonstop options
              </p>
              <p className="mt-1 font-display text-xl font-extrabold text-[var(--text-1)]">
                {nonstopCount}
              </p>
              <p className="mt-1 text-xs font-medium text-[var(--text-2)]">
                Direct itineraries in the current result set.
              </p>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <fieldset className="min-w-0">
                <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-2)]">
                  Sort
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {(['deal', 'price'] as const).map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSortBy(option)}
                      aria-pressed={sortBy === option}
                      aria-describedby="flight-results-controls-summary"
                      disabled={controlsDisabled}
                      className={`btn-pill min-h-11 w-full px-3 ${sortBy === option ? 'active' : ''}`}
                    >
                      <span className="truncate">{sortLabels[option]}</span>
                      {sortBy === option && <span className="btn-pill-status">On</span>}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="min-w-0">
                <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-2)]">
                  Stops
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {([null, 0, 1] as const).map(value => (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() => setFilterStops(value)}
                      aria-pressed={filterStops === value}
                      aria-describedby="flight-results-controls-summary"
                      disabled={controlsDisabled}
                      className={`btn-pill min-h-11 w-full px-3 ${filterStops === value ? 'active' : ''}`}
                    >
                      <span className="truncate">{stopFilterLabel(value)}</span>
                      {filterStops === value && <span className="btn-pill-status">On</span>}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
            <span className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-bold text-[var(--text-2)] lg:justify-self-end">
              {displayFlights.length} result{displayFlights.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div id="flight-results-controls-summary" className="mt-2 min-h-5 text-xs font-semibold leading-5 text-[var(--text-2)]" aria-live="polite" aria-atomic="true">
            <span>{controlsSummary}</span>
            {rankingUpdating && (
              <span className="ml-0 mt-1 flex items-center gap-2 text-[var(--brand)] sm:ml-2 sm:mt-0 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)] dot-pulse" aria-hidden="true" />
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
        <div className="space-y-4">
          <FlightStatePanel
            eyebrow="Flights"
            title="Checking live flight inventory"
          >
            <div className="flex items-start gap-3">
              <span className="mt-2 flex shrink-0 gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)] dot-pulse" />
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)] dot-pulse-2" />
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)] dot-pulse-3" />
              </span>
              <p>Fare cards will appear here as providers return usable prices for this search.</p>
            </div>
          </FlightStatePanel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <FlightCard key={index} score={null} loading />
            ))}
          </div>
        </div>
      ) : displayFlights.length === 0 ? (
        <FlightStatePanel
          eyebrow="Flight results"
          title={emptyTitle}
          tone={hasProviderUnavailable ? 'warning' : 'default'}
          action={emptyAction}
        >
          <p>
            {emptyCopy}
          </p>
          {suggestion && <p className="mt-3 text-xs font-medium leading-5 text-[var(--text-3)]">{suggestion}</p>}
        </FlightStatePanel>
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
            <div className="mt-5 rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-raised)] p-5 shadow-[var(--shadow-card)] animate-fade-up sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1 text-left">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)]">Route tracking</p>
                  <p className="mt-1 font-display text-xl font-bold text-[var(--text-1)]">Track this route</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-2)]">
                    Get an email when prices drop below the current live range for this search.
                  </p>
                </div>
                {alertSent ? (
                  <p className="rounded-[var(--radius-control)] border border-[var(--success)]/25 bg-[var(--success-soft)] px-4 py-2.5 text-sm font-bold text-[var(--success)]" role="status">
                    You&apos;re on the list
                  </p>
                ) : (
                  <div className="w-full lg:w-auto">
                    <form className="flex w-full flex-col gap-2 sm:flex-row" onSubmit={handleAlertSubmit}>
                      <label className="sr-only" htmlFor="flight-alert-email">
                        Email for route price alerts
                      </label>
                      <input
                        id="flight-alert-email"
                        type="email"
                        required
                        value={alertEmail}
                        onChange={event => setAlertEmail(event.target.value)}
                        placeholder="your@email.com"
                        aria-describedby={alertError ? 'flight-alert-error' : undefined}
                        className="field-input min-h-11 !py-2.5 !pl-4 text-sm sm:w-64"
                      />
                      <button
                        type="submit"
                        disabled={alertLoading}
                        className="btn-primary min-h-11 !w-full whitespace-nowrap px-5 !py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60 sm:!w-auto"
                      >
                        {alertLoading ? 'Setting...' : 'Notify me'}
                      </button>
                    </form>
                    {alertError && (
                      <p id="flight-alert-error" className="mt-2 text-xs font-semibold leading-5 text-[var(--error)] sm:text-right" role="alert">{alertError}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
