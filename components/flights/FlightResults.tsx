'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ComponentProps, Dispatch, FormEvent, ReactNode, SetStateAction } from 'react'
import FlightCard from '@/app/components/FlightCard'
import { AIRPORTS } from '@/lib/airports/data'
import type { DealScore, Money, NormalizedFare, ProviderNotice } from '@/lib/types'
import type { BaggageCabinClass, BaggageFeeEstimate } from '@/lib/baggage/types'
import { formatMoney } from '@/lib/money'
import { fareFreshnessSummary } from '@/lib/providerFreshness'

type SortBy = 'price' | 'deal' | 'estimatedTotal' | 'duration'
type TripType = 'roundtrip' | 'oneway'
type BagRequestStatus = 'loading' | 'available' | 'unavailable'
type BagRequest = {
  queryKey: string
  status: BagRequestStatus
  fee?: Money
  confidence?: BaggageFeeEstimate['confidence']
  includedCarryOnBags?: number
  includedCheckedBags?: number
}

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
  origin: string
  dest: string
  depart: string
  returnDate: string
  tripType: TripType
  flexDates: boolean
  searchContext: string
  alertEmail: string
  setAlertEmail: Dispatch<SetStateAction<string>>
  alertSent: boolean
  alertLoading: boolean
  alertError: string | null
  handleAlertSubmit: (event: FormEvent<HTMLFormElement>) => void
  onEditSearch?: () => void
  onRetrySearch?: () => void
  onTryFlexibleDates?: () => void
  onSearchAnywhere?: () => void
  onTryNearbyOrigin?: (iata: string) => void
}

const delays = ['', 'delay-75', 'delay-150', 'delay-225', 'delay-300']

const sortLabels: Record<SortBy, string> = {
  deal: 'Best deal',
  price: 'Lowest price',
  estimatedTotal: 'Lowest est. total',
  duration: 'Shortest duration',
}

const segmentedButtonBase =
  'min-h-11 rounded-[calc(var(--radius-control)-0.125rem)] border px-2 text-center text-sm font-bold leading-5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-60'

function segmentedButtonClass(isSelected: boolean, isDisabled: boolean): string {
  if (isSelected) {
    return `${segmentedButtonBase} border-[var(--border-strong)] bg-[var(--brand)] text-[var(--text-inverse)] ring-1 ring-inset ring-[var(--border-strong)]`
  }

  if (isDisabled) {
    return `${segmentedButtonBase} border-transparent bg-[var(--bg-muted)] text-[var(--text-3)]`
  }

  return `${segmentedButtonBase} border-transparent bg-[var(--bg-raised)] text-[var(--text-2)] hover:border-[var(--border-hover)] hover:text-[var(--text-1)]`
}

function stopFilterLabel(value: number | null): string {
  if (value === 0) return 'Nonstop'
  if (value === 1) return '1 stop'
  return 'All stops'
}

function formatDuration(minutes?: number): string {
  if (!Number.isFinite(minutes) || minutes === undefined || minutes < 0) return ''
  const rounded = Math.round(minutes)
  if (rounded < 60) return `${rounded}m`
  const hours = Math.floor(rounded / 60)
  const remainder = rounded % 60
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`
}

function hasConfirmedDuration(fare: NormalizedFare): boolean {
  return fare.itinerary?.certainty === 'confirmed' && Number.isFinite(fare.itinerary.durationMinutes)
}

function stopSummaryLabel(stops: number): string {
  if (stops === 0) return 'Nonstop'
  if (stops === 1) return '1 stop'
  return `${stops} stops`
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

function usdAmountToMoney(value: number): Money | null {
  if (!Number.isFinite(value) || value < 0) return null

  const priceCents = Math.round(value * 100)
  if (!Number.isSafeInteger(priceCents) || priceCents < 0) return null

  return { priceCents, currency: 'USD' }
}

function isBaggageEstimatePayload(value: unknown): value is BaggageFeeEstimate {
  if (!value || typeof value !== 'object') return false

  const estimate = value as Partial<BaggageFeeEstimate>
  return (
    typeof estimate.estimatedTotalUsd === 'number' &&
    Number.isFinite(estimate.estimatedTotalUsd) &&
    estimate.estimatedTotalUsd >= 0 &&
    (estimate.confidence === 'high' || estimate.confidence === 'medium' || estimate.confidence === 'low') &&
    typeof estimate.includedCarryOnBags === 'number' &&
    typeof estimate.includedCheckedBags === 'number'
  )
}

function bagQueryKey(fare: NormalizedFare, carryOnBags: number, checkedBags: number): string {
  return [
    fare.carrier.trim().toUpperCase(),
    countryForAirport(fare.origin),
    countryForAirport(fare.destination),
    cabinForBaggage(fare.cabin),
    carryOnBags,
    checkedBags,
  ].join('|')
}

function estimatedTotalCents(fare: NormalizedFare, request: BagRequest | undefined, queryKey: string): number | null {
  if (fare.price.currency !== 'USD') return null
  if (!request || request.queryKey !== queryKey || request.status !== 'available' || !request.fee) return null
  return fare.price.priceCents + request.fee.priceCents
}

function baggageEstimateForCard(
  fare: NormalizedFare,
  request: BagRequest | undefined,
  queryKey: string,
  carryOnBags: number,
  checkedBags: number
): ComponentProps<typeof FlightCard>['baggageEstimate'] {
  const hasCurrentEstimate = request?.queryKey === queryKey

  if (fare.price.currency !== 'USD') {
    return {
      status: 'unavailable',
      carryOnCount: carryOnBags,
      checkedCount: checkedBags,
      available: false,
    }
  }

  if (!hasCurrentEstimate || request.status === 'loading') {
    return {
      status: 'loading',
      carryOnCount: carryOnBags,
      checkedCount: checkedBags,
      available: false,
    }
  }

  if (request.status !== 'available' || !request.fee) {
    return {
      status: 'unavailable',
      carryOnCount: carryOnBags,
      checkedCount: checkedBags,
      available: false,
    }
  }

  return {
    status: 'available',
    carryOnCount: carryOnBags,
    checkedCount: checkedBags,
    estimatedTotal: {
      priceCents: fare.price.priceCents + request.fee.priceCents,
      currency: 'USD',
    },
    confidence: request.confidence ?? 'low',
    available: true,
  }
}

function BagCountControl({
  label,
  value,
  onChange,
  decreaseLabel,
  increaseLabel,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  decreaseLabel: string
  increaseLabel: string
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-2)]">
        {label}
      </p>
      <div className="flex h-10 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-raised)] px-1.5">
        <button
          type="button"
          aria-label={decreaseLabel}
          disabled={value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-raised)] text-sm font-black text-[var(--text-1)] transition hover:border-[var(--border-hover)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        >
          -
        </button>
        <span className="min-w-6 flex-1 text-center text-sm font-extrabold tabular-nums text-[var(--text-1)]">
          {value}
        </span>
        <button
          type="button"
          aria-label={increaseLabel}
          disabled={value >= 4}
          onClick={() => onChange(Math.min(4, value + 1))}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-raised)] text-sm font-black text-[var(--text-1)] transition hover:border-[var(--border-hover)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        >
          +
        </button>
      </div>
    </div>
  )
}

function EstimatedBagsFieldset({
  carryOnBags,
  checkedBags,
  setCarryOnBags,
  setCheckedBags,
}: {
  carryOnBags: number
  checkedBags: number
  setCarryOnBags: Dispatch<SetStateAction<number>>
  setCheckedBags: Dispatch<SetStateAction<number>>
}) {
  const selectedBagsLabel = `${carryOnBags} carry-on, ${checkedBags} checked`

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-xs font-bold text-[var(--text-1)]">Estimated bags</legend>
      <p className="mb-2 text-xs font-semibold leading-5 text-[var(--text-2)]">
        {selectedBagsLabel}
      </p>
      <div className="grid gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] p-2 sm:grid-cols-2">
        <BagCountControl
          label="Carry-on"
          value={carryOnBags}
          onChange={setCarryOnBags}
          decreaseLabel="Decrease carry-on bags"
          increaseLabel="Increase carry-on bags"
        />
        <BagCountControl
          label="Checked"
          value={checkedBags}
          onChange={setCheckedBags}
          decreaseLabel="Decrease checked bags"
          increaseLabel="Increase checked bags"
        />
      </div>
    </fieldset>
  )
}

function cheapestVisibleFare(fares: NormalizedFare[]): NormalizedFare | null {
  if (fares.length === 0) return null
  return fares.reduce((best, fare) =>
    fare.price.priceCents < best.price.priceCents ? fare : best
  )
}

function cheapestFareThreshold(fares: NormalizedFare[]): NormalizedFare['price'] | null {
  if (fares.length === 0) return null
  return fares.reduce((best, fare) =>
    fare.price.priceCents < best.priceCents ? fare.price : best
  , fares[0].price)
}

function isHotelNotice(notice: ProviderNotice): boolean {
  return notice.provider.toLowerCase().includes('hotel')
}

function parseSuggestionIatas(suggestion: string | null): string[] {
  if (!suggestion) return []

  const seen = new Set<string>()
  const matches = suggestion.match(/\b[A-Z]{3}\b/g) ?? []
  for (const match of matches) {
    if (AIRPORTS.some(airport => airport.iata === match)) {
      seen.add(match)
    }
  }

  return Array.from(seen)
}

function RouteAlertBlockedPrompt({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-raised)] p-4">
      <p className="font-display text-base font-bold leading-6 text-[var(--text-1)]">
        {title}
      </p>
      <p className="mt-1 text-sm leading-6 text-[var(--text-2)]">
        {body}
      </p>
      <button
        type="button"
        disabled
        className="mt-3 btn-primary min-h-11 w-full px-4 py-2.5 text-sm disabled:opacity-60 sm:w-auto"
      >
        Alert unavailable
      </button>
    </div>
  )
}

function RouteAlertLoadingRow() {
  return (
    <section className="mb-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <p className="font-display text-base font-bold leading-6 text-[var(--text-1)]">
        Route tracking will be available after fares finish loading
      </p>
      <p className="mt-1 text-sm leading-6 text-[var(--text-2)]">
        We will use the cheapest returned fare to set the drop threshold.
      </p>
    </section>
  )
}

function RouteAlertModule({
  origin,
  dest,
  threshold,
  fareCount,
  alertEmail,
  setAlertEmail,
  alertSent,
  alertLoading,
  alertError,
  handleAlertSubmit,
}: {
  origin: string
  dest: string
  threshold: string
  fareCount: number
  alertEmail: string
  setAlertEmail: Dispatch<SetStateAction<string>>
  alertSent: boolean
  alertLoading: boolean
  alertError: string | null
  handleAlertSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const plural = fareCount === 1 ? '' : 's'
  const body = fareCount >= 3
    ? `Get an email when this search drops below ${threshold}. Threshold is based on the cheapest live fare returned right now.`
    : `Get an email when this search drops below ${threshold}. Only ${fareCount} live fare${plural} returned, so this alert uses the cheapest fare we can verify right now.`

  return (
    <section className="mb-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,auto)] lg:items-start">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)]">
            Route tracking
          </p>
          <h3 className="mt-1 font-display text-lg font-bold leading-7 text-[var(--text-1)]">
            Track this route
          </h3>
          <p className="mt-1 text-sm leading-6 text-[var(--text-2)]">
            {body}
          </p>
        </div>
        <div className="min-w-0 lg:justify-self-end">
          {alertSent ? (
            <p
              className="rounded-[var(--radius-control)] border border-[var(--success)]/25 bg-[var(--success-soft)] px-4 py-3 text-sm font-bold leading-6 text-[var(--success)]"
              role="status"
              aria-live="polite"
            >
              Alert set for {origin.trim()} to {dest.trim()} below {threshold}. Fares can change before booking.
            </p>
          ) : (
            <>
              <form className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:w-auto" onSubmit={handleAlertSubmit}>
                <label className="sr-only" htmlFor="flight-alert-email">
                  Email for route price alerts
                </label>
                <input
                  id="flight-alert-email"
                  type="email"
                  required
                  value={alertEmail}
                  onChange={event => setAlertEmail(event.target.value)}
                  placeholder="you@example.com"
                  aria-describedby={alertError ? 'flight-alert-error' : undefined}
                  className="field-input min-h-11 !py-2.5 !pl-4 text-sm sm:min-w-0 lg:w-72"
                />
                <button
                  type="submit"
                  disabled={alertLoading}
                  className="btn-primary min-h-11 !w-full whitespace-nowrap px-5 !py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60 sm:!w-auto"
                >
                  {alertLoading ? 'Setting alert' : 'Notify me'}
                </button>
              </form>
              {alertLoading && (
                <p className="mt-2 text-xs font-semibold leading-5 text-[var(--brand)]" role="status" aria-live="polite">
                  Setting your route alert...
                </p>
              )}
              {alertError && (
                <p id="flight-alert-error" className="mt-2 text-xs font-semibold leading-5 text-[var(--error)]" role="alert">
                  {alertError || 'Price alert signup is unavailable right now. Please try again.'}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
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

function MobileFlightControls({
  summaryLine1,
  summaryLine2,
  sortBy,
  setSortBy,
  filterStops,
  setFilterStops,
  controlsDisabled,
  showBaggageControls,
  carryOnBags,
  checkedBags,
  setCarryOnBags,
  setCheckedBags,
  estimatedSortDisabled,
  durationSortDisabled,
}: {
  summaryLine1: string
  summaryLine2: string
  sortBy: SortBy
  setSortBy: Dispatch<SetStateAction<SortBy>>
  filterStops: number | null
  setFilterStops: Dispatch<SetStateAction<number | null>>
  controlsDisabled: boolean
  showBaggageControls: boolean
  carryOnBags: number
  checkedBags: number
  setCarryOnBags: Dispatch<SetStateAction<number>>
  setCheckedBags: Dispatch<SetStateAction<number>>
  estimatedSortDisabled: boolean
  durationSortDisabled: boolean
}) {
  return (
    <details className="sm:hidden">
      <summary className="flex min-h-11 list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <p className="min-w-0 text-xs font-semibold leading-5 text-[var(--text-2)]">
          <span className="block truncate sm:inline">{summaryLine1}</span>
          <span className="block truncate sm:inline">{summaryLine2}</span>
        </p>
        <span
          role="button"
          aria-controls="flight-mobile-controls"
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-sm font-bold text-[var(--text-1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        >
          Filter
        </span>
      </summary>
      <div id="flight-mobile-controls" className="mt-3 grid gap-3 border-t border-[var(--border)] pt-3 sm:hidden">
        <p className="text-xs font-bold text-[var(--text-1)]">Sort and stops</p>
        <fieldset className="min-w-0">
          <legend className="sr-only">Sort</legend>
          <div className="grid gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] p-1">
            {(['deal', 'price', 'duration', 'estimatedTotal'] as const).map(option => {
              const disabled =
                controlsDisabled ||
                (option === 'estimatedTotal' && estimatedSortDisabled) ||
                (option === 'duration' && durationSortDisabled)
              return (
              <button
                key={option}
                type="button"
                onClick={() => setSortBy(option)}
                aria-pressed={sortBy === option}
                aria-describedby="flight-results-controls-summary"
                disabled={disabled}
                className={segmentedButtonClass(sortBy === option, disabled)}
              >
                {sortLabels[option]}
              </button>
              )
            })}
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="sr-only">Stops</legend>
          <div className="grid grid-cols-3 gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] p-1">
            {([null, 0, 1] as const).map(value => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setFilterStops(value)}
                aria-pressed={filterStops === value}
                aria-describedby="flight-results-controls-summary"
                disabled={controlsDisabled}
                className={`${segmentedButtonClass(filterStops === value, controlsDisabled)} text-xs`}
              >
                {stopFilterLabel(value)}
              </button>
            ))}
          </div>
        </fieldset>
        {showBaggageControls && (
          <EstimatedBagsFieldset
            carryOnBags={carryOnBags}
            checkedBags={checkedBags}
            setCarryOnBags={setCarryOnBags}
            setCheckedBags={setCheckedBags}
          />
        )}
      </div>
    </details>
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
  origin,
  dest,
  depart,
  returnDate,
  tripType,
  flexDates,
  searchContext,
  alertEmail,
  setAlertEmail,
  alertSent,
  alertLoading,
  alertError,
  handleAlertSubmit,
  onEditSearch,
  onRetrySearch,
  onTryFlexibleDates,
  onSearchAnywhere,
  onTryNearbyOrigin,
}: FlightResultsProps) {
  const [carryOnBags, setCarryOnBags] = useState(1)
  const [checkedBags, setCheckedBags] = useState(0)
  const [bagRequests, setBagRequests] = useState<Record<string, BagRequest>>({})
  const flightProviderNotices = providerNotices.filter(notice => !isHotelNotice(notice))
  const flightProviderWarningNotices = flightProviderNotices.filter(notice =>
    notice.status === 'unavailable' || notice.status === 'malformed_response'
  )
  const bestDealCount = displayFlights.reduce((count, fare) => count + (scores[fare.id]?.verdict === 'Great' ? 1 : 0), 0)
  const nonstopCount = displayFlights.filter(fare => fare.stops === 0).length
  const cheapestFare = cheapestVisibleFare(displayFlights)
  const freshnessSummary = fareFreshnessSummary(displayFlights)
  const alertThreshold = cheapestFareThreshold(flights)
  const formattedAlertThreshold = alertThreshold ? formatMoney(alertThreshold) : null
  const missingDepart = !depart
  const missingRoundtripReturn = tripType === 'roundtrip' && !returnDate
  const filtersHideResults = flights.length > 0 && displayFlights.length === 0
  const hasProviderUnavailable = flightProviderWarningNotices.length > 0 && flights.length === 0 && !missingDepart && !missingRoundtripReturn
  const incompleteDates = missingDepart || missingRoundtripReturn
  const routeCompleteForAlert = Boolean(origin.trim()) && Boolean(dest.trim()) && !incompleteDates
  const showEnabledAlert = !isSearching && routeCompleteForAlert && flights.length > 0 && Boolean(formattedAlertThreshold) && !filtersHideResults
  const showLoadingAlert = isSearching && routeCompleteForAlert && flights.length > 0 && !filtersHideResults
  const showBlockedAlert = !isSearching && routeCompleteForAlert && flights.length === 0 && !filtersHideResults
  const hasSearchableOrigin = Boolean(origin.trim())
  const nearbyIatas = parseSuggestionIatas(suggestion).filter(iata => iata !== origin.trim().toUpperCase())
  const showSearchAnywhere = hasSearchableOrigin && Boolean(dest.trim()) && Boolean(onSearchAnywhere)
  const showFlexibleDates = hasSearchableOrigin && !incompleteDates && Boolean(onTryFlexibleDates)
  const controlsDisabled = flights.length === 0
  const showBaggageControls = displayFlights.length > 0
  const confirmedDurationFares = displayFlights.filter(hasConfirmedDuration)
  const durationSortDisabled = confirmedDurationFares.length < 2
  const fastestFare = confirmedDurationFares.reduce<NormalizedFare | null>((best, fare) => {
    if (!best) return fare
    return (fare.itinerary?.durationMinutes ?? Number.POSITIVE_INFINITY) < (best.itinerary?.durationMinutes ?? Number.POSITIVE_INFINITY)
      ? fare
      : best
  }, null)
  const fastestDuration = formatDuration(fastestFare?.itinerary?.durationMinutes)
  const currentBagQueryKeys = useMemo(() => {
    const entries = displayFlights.map(fare => [fare.id, bagQueryKey(fare, carryOnBags, checkedBags)] as const)
    return Object.fromEntries(entries)
  }, [displayFlights, carryOnBags, checkedBags])
  const currentBagEstimates = useMemo(() => {
    return Object.fromEntries(displayFlights.map(fare => [
      fare.id,
      baggageEstimateForCard(fare, bagRequests[fare.id], currentBagQueryKeys[fare.id], carryOnBags, checkedBags),
    ]))
  }, [displayFlights, bagRequests, currentBagQueryKeys, carryOnBags, checkedBags])
  const bagEstimateValues = useMemo(() => {
    return Object.fromEntries(displayFlights.map(fare => [
      fare.id,
      estimatedTotalCents(fare, bagRequests[fare.id], currentBagQueryKeys[fare.id]),
    ]))
  }, [displayFlights, bagRequests, currentBagQueryKeys])
  const allCurrentBagEstimatesReady = displayFlights.length > 0 && displayFlights.every(fare => currentBagEstimates[fare.id]?.status !== 'loading')
  const allCurrentBagEstimatesAvailable = displayFlights.length > 0 && displayFlights.every(fare => typeof bagEstimateValues[fare.id] === 'number')
  const anyCurrentBagEstimateUnavailable = displayFlights.length > 0 && allCurrentBagEstimatesReady && !allCurrentBagEstimatesAvailable
  const anyCurrentBagEstimateLoading = displayFlights.length > 0 && displayFlights.some(fare => currentBagEstimates[fare.id]?.status === 'loading')
  const anyLowConfidenceBagEstimate = displayFlights.some(fare => currentBagEstimates[fare.id]?.confidence === 'low')
  const estimatedSortDisabled = !allCurrentBagEstimatesAvailable || anyCurrentBagEstimateLoading
  const renderedFlights = useMemo(() => {
    if (sortBy !== 'estimatedTotal' || estimatedSortDisabled) return displayFlights

    return [...displayFlights].sort((a, b) => {
      const aTotal = bagEstimateValues[a.id] ?? Number.POSITIVE_INFINITY
      const bTotal = bagEstimateValues[b.id] ?? Number.POSITIVE_INFINITY
      return (
        aTotal - bTotal ||
        a.price.priceCents - b.price.priceCents ||
        a.stops - b.stops ||
        a.depart.localeCompare(b.depart) ||
        a.id.localeCompare(b.id)
      )
    })
  }, [displayFlights, sortBy, estimatedSortDisabled, bagEstimateValues])
  const basePriceWinner = cheapestFare
  const estimatedWinner = allCurrentBagEstimatesAvailable
    ? displayFlights.reduce((best, fare) => {
      const fareTotal = bagEstimateValues[fare.id] ?? Number.POSITIVE_INFINITY
      const bestTotal = bagEstimateValues[best.id] ?? Number.POSITIVE_INFINITY
      return fareTotal < bestTotal ? fare : best
    }, displayFlights[0])
    : null
  const baggageSummarySentences = useMemo(() => {
    if (displayFlights.length === 0) return []
    if (anyCurrentBagEstimateLoading && !allCurrentBagEstimatesReady) return ['Estimating bag totals for visible fares.']

    const sentences: string[] = []
    const lowestEstimate = basePriceWinner ? bagEstimateValues[basePriceWinner.id] : null

    if (estimatedWinner && basePriceWinner && estimatedWinner.id !== basePriceWinner.id) {
      sentences.push(`Bags may change the lowest option: ${estimatedWinner.carrier} ${estimatedWinner.origin} to ${estimatedWinner.destination} is estimated lowest with bags.`)
    } else if (lowestEstimate !== null && basePriceWinner && lowestEstimate === basePriceWinner.price.priceCents) {
      sentences.push('Selected bags add no estimated cost for the lowest visible option.')
    } else if (allCurrentBagEstimatesAvailable) {
      sentences.push('Bags do not change the lowest estimated option.')
    }

    if (anyCurrentBagEstimateUnavailable) {
      sentences.push('Some bag estimates are unavailable, so compare provider terms before booking.')
    } else if (anyLowConfidenceBagEstimate && sentences.length < 2) {
      sentences.push('Some estimates are rough, so verify provider terms before booking.')
    }

    return sentences.slice(0, 2)
  }, [
    allCurrentBagEstimatesAvailable,
    allCurrentBagEstimatesReady,
    anyCurrentBagEstimateLoading,
    anyCurrentBagEstimateUnavailable,
    anyLowConfidenceBagEstimate,
    bagEstimateValues,
    basePriceWinner,
    displayFlights.length,
    estimatedWinner,
  ])
  const baggageSummaryTone = (
    anyCurrentBagEstimateUnavailable ||
    (estimatedWinner && basePriceWinner && estimatedWinner.id !== basePriceWinner.id)
  ) ? 'warning' : 'default'
  const baggageSortHelp = anyCurrentBagEstimateLoading
    ? 'Bag-adjusted sorting is available after estimates load.'
    : anyCurrentBagEstimateUnavailable
      ? 'Bag-adjusted sorting needs estimates for every visible fare.'
      : ''

  useEffect(() => {
    if (displayFlights.length === 0) return

    const controller = new AbortController()

    for (const fare of displayFlights) {
      const queryKey = currentBagQueryKeys[fare.id]
      if (!queryKey || bagRequests[fare.id]?.queryKey === queryKey) continue

      setBagRequests(prev => ({
        ...prev,
        [fare.id]: { queryKey, status: 'loading' },
      }))

      const params = new URLSearchParams({
        carrierCode: fare.carrier,
        originCountry: countryForAirport(fare.origin),
        destinationCountry: countryForAirport(fare.destination),
        cabinClass: cabinForBaggage(fare.cabin),
        checkedBags: String(checkedBags),
        carryOnBags: String(carryOnBags),
      })

      fetch(`/api/baggage?${params.toString()}`, { signal: controller.signal })
        .then(response => response.ok ? response.json() as Promise<unknown> : Promise.reject())
        .then(data => {
          if (!isBaggageEstimatePayload(data)) throw new Error('Invalid baggage estimate payload')
          const fee = usdAmountToMoney(data.estimatedTotalUsd)
          if (!fee || fare.price.currency !== 'USD') throw new Error('Invalid baggage estimate money')

          setBagRequests(prev => ({
            ...prev,
            [fare.id]: {
              queryKey,
              status: 'available',
              fee,
              confidence: data.confidence,
              includedCarryOnBags: data.includedCarryOnBags,
              includedCheckedBags: data.includedCheckedBags,
            },
          }))
        })
        .catch(error => {
          if (error instanceof DOMException && error.name === 'AbortError') return
          setBagRequests(prev => ({
            ...prev,
            [fare.id]: { queryKey, status: 'unavailable' },
          }))
        })
    }

    return () => controller.abort()
  }, [displayFlights, currentBagQueryKeys, carryOnBags, checkedBags])

  useEffect(() => {
    if ((sortBy === 'estimatedTotal' && estimatedSortDisabled) || (sortBy === 'duration' && durationSortDisabled)) {
      setSortBy('price')
    }
  }, [durationSortDisabled, estimatedSortDisabled, setSortBy, sortBy])

  const resultScope = flights.length > 0
    ? `Showing ${displayFlights.length} of ${flights.length} fares`
    : isSearching
      ? 'Waiting for fares'
      : 'Controls available after fares load'
  const controlsSummary = controlsDisabled
    ? 'Sort and stop filters will be available after fares load.'
    : `Showing ${displayFlights.length} of ${flights.length} fares, sorted by ${sortLabels[sortBy].toLowerCase()} with ${stopFilterLabel(filterStops).toLowerCase()} selected.${freshnessSummary ? ` ${freshnessSummary.sentence}` : ''}${baggageSortHelp ? ` ${baggageSortHelp}` : ''}${durationSortDisabled ? ' Duration sort needs confirmed itinerary times.' : ''}`
  const mobileControlsSummaryLine1 = controlsDisabled
    ? 'Filters available after fares load'
    : `${displayFlights.length} of ${flights.length} fares`
  const mobileControlsSummaryLine2 = controlsDisabled
    ? 'Waiting for fares'
    : `${sortLabels[sortBy]} | ${stopFilterLabel(filterStops)}${freshnessSummary ? ` | ${freshnessSummary.mobileClause}` : ''}`
  const emptyTitle = incompleteDates
    ? 'Dates needed for a complete search'
    : filtersHideResults
      ? 'Filters are hiding the available fares'
      : hasProviderUnavailable
        ? 'Flights unavailable'
        : 'No flights returned'
  const emptyCopy = missingDepart
    ? 'Add a departure date so providers can return current fares and Deal Scores can be compared honestly.'
    : missingRoundtripReturn
      ? 'Add a return date for round-trip pricing, or switch to one way before searching again.'
      : filtersHideResults
        ? 'Clear the stops filter or choose All to review the fares returned for this search.'
        : hasProviderUnavailable
          ? 'Flight inventory was not confirmed because a provider is unavailable. Retry this search or edit trip details.'
          : 'No flights were returned for this route. Edit the route, dates, or flexibility options.'
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
  const recoveryActions = filtersHideResults || incompleteDates ? emptyAction : hasProviderUnavailable ? (
    <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:flex lg:flex-wrap">
      {onRetrySearch && (
        <button
          type="button"
          onClick={onRetrySearch}
          className="btn-primary min-h-11 w-full px-4 py-2.5 text-sm lg:w-auto"
        >
          Retry search
        </button>
      )}
      {onEditSearch && (
        <button
          type="button"
          onClick={onEditSearch}
          className="btn-pill min-h-11 w-full justify-center px-4 py-2.5 text-sm lg:w-auto"
        >
          Edit search
        </button>
      )}
    </div>
  ) : (
    <>
      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:flex lg:flex-wrap">
        {showFlexibleDates && (
          <button
            type="button"
            onClick={flexDates ? onEditSearch : onTryFlexibleDates}
            className="btn-primary min-h-11 w-full px-4 py-2.5 text-sm lg:w-auto"
          >
            {flexDates ? 'Edit dates' : 'Try flexible dates'}
          </button>
        )}
        {showSearchAnywhere && (
          <button
            type="button"
            onClick={onSearchAnywhere}
            className="btn-pill min-h-11 w-full justify-center px-4 py-2.5 text-sm lg:w-auto"
          >
            Search anywhere from {origin.trim().toUpperCase()}
          </button>
        )}
        {onEditSearch && (
          <button
            type="button"
            onClick={onEditSearch}
            className={`${showFlexibleDates ? 'btn-pill' : 'btn-primary'} min-h-11 w-full justify-center px-4 py-2.5 text-sm lg:w-auto`}
          >
            Edit search
          </button>
        )}
      </div>
      {nearbyIatas.length > 0 && onTryNearbyOrigin && (
        <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-raised)] p-3">
          <p id="nearby-airport-helper" className="text-xs font-bold text-[var(--text-2)]">
            Search from a nearby airport
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {nearbyIatas.map(iata => (
              <button
                key={iata}
                type="button"
                onClick={() => onTryNearbyOrigin(iata)}
                aria-describedby="nearby-airport-helper"
                className="btn-pill min-h-11 justify-center px-4 py-2.5 text-sm"
              >
                Try {iata}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )

  return (
    <>
      {(flightProviderWarningNotices.length > 0 || missingDepart || missingRoundtripReturn) && (
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
            {flightProviderWarningNotices.length > 0 && (
              <div className="mt-1 space-y-1">
                {flightProviderWarningNotices.map(notice => (
                  <p key={`${notice.provider}-${notice.status}-${notice.message}`}>{notice.message}</p>
                ))}
              </div>
            )}
          </FlightStatePanel>
        </div>
      )}

      {(flights.length > 0 || isSearching) && (
        <div className="mb-5 rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--bg-raised)] p-4 shadow-[var(--shadow-card)] sm:p-5">
          <div className="flex flex-col gap-4">
            <MobileFlightControls
              summaryLine1={mobileControlsSummaryLine1}
              summaryLine2={mobileControlsSummaryLine2}
              sortBy={sortBy}
              setSortBy={setSortBy}
              filterStops={filterStops}
              setFilterStops={setFilterStops}
              controlsDisabled={controlsDisabled}
              showBaggageControls={showBaggageControls}
              carryOnBags={carryOnBags}
              checkedBags={checkedBags}
              setCarryOnBags={setCarryOnBags}
              setCheckedBags={setCheckedBags}
              estimatedSortDisabled={estimatedSortDisabled}
              durationSortDisabled={durationSortDisabled}
            />
            <div className="hidden flex-col gap-2 sm:flex lg:flex-row lg:items-center lg:justify-between">
              <h2 className="font-display text-lg font-bold leading-6 text-[var(--text-1)]">
                Refine flight results
              </h2>
              <p className="text-sm font-semibold leading-5 text-[var(--text-2)]">
                {resultScope}
              </p>
            </div>
            <div className="hidden gap-3 border-t border-[var(--border)] pt-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
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
              <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)]">
                  Freshness
                </p>
                <p className="mt-1 font-display text-xl font-extrabold text-[var(--text-1)]">
                  {freshnessSummary ? freshnessSummary.metric : isSearching ? 'Waiting' : 'Unavailable'}
                </p>
                <p className="mt-1 text-xs font-medium leading-5 text-[var(--text-2)]">
                  {freshnessSummary ? freshnessSummary.detail : isSearching ? 'Provider timestamps appear as fares arrive.' : 'Provider freshness is missing.'}
                </p>
              </div>
              <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
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
              <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)]">
                  {fastestFare ? 'Fastest itinerary' : 'Nonstop options'}
                </p>
                <p className="mt-1 font-display text-xl font-extrabold text-[var(--text-1)]">
                  {fastestFare && fastestDuration ? fastestDuration : nonstopCount}
                </p>
                <p className="mt-1 text-xs font-medium text-[var(--text-2)]">
                  {fastestFare
                    ? `${fastestFare.carrier} · ${stopSummaryLabel(fastestFare.stops)}`
                    : 'Duration details will appear when providers return confirmed itinerary times.'}
                </p>
              </div>
            </div>
            <div className="hidden gap-4 sm:grid lg:grid-cols-[minmax(16rem,1fr)_minmax(16rem,1fr)_minmax(16rem,1fr)] lg:items-end">
              <fieldset className="min-w-0">
                <legend className="mb-2 text-xs font-bold text-[var(--text-1)]">
                  Sort by
                </legend>
                <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] p-1 lg:grid-cols-4">
                  {(['deal', 'price', 'duration', 'estimatedTotal'] as const).map(option => {
                    const disabled =
                      controlsDisabled ||
                      (option === 'estimatedTotal' && estimatedSortDisabled) ||
                      (option === 'duration' && durationSortDisabled)
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setSortBy(option)}
                        aria-pressed={sortBy === option}
                        aria-describedby="flight-results-controls-summary"
                        disabled={disabled}
                        className={`${segmentedButtonClass(sortBy === option, disabled)} text-xs sm:text-sm`}
                      >
                        {sortLabels[option]}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
              <fieldset className="min-w-0">
                <legend className="mb-2 text-xs font-bold text-[var(--text-1)]">
                  Stops
                </legend>
                <div className="grid grid-cols-3 gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] p-1">
                  {([null, 0, 1] as const).map(value => (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() => setFilterStops(value)}
                      aria-pressed={filterStops === value}
                      aria-describedby="flight-results-controls-summary"
                      disabled={controlsDisabled}
                      className={`${segmentedButtonClass(filterStops === value, controlsDisabled)} text-xs sm:text-sm`}
                    >
                      {stopFilterLabel(value)}
                    </button>
                  ))}
                </div>
              </fieldset>
              {showBaggageControls && (
                <EstimatedBagsFieldset
                  carryOnBags={carryOnBags}
                  checkedBags={checkedBags}
                  setCarryOnBags={setCarryOnBags}
                  setCheckedBags={setCheckedBags}
                />
              )}
            </div>
            <div id="flight-results-controls-summary" className="min-h-5 text-xs font-semibold leading-5 text-[var(--text-2)]" aria-live="polite" aria-atomic="true">
              <span>{controlsSummary}</span>
              {rankingUpdating && (
                <span className="ml-0 mt-1 flex items-center gap-2 text-[var(--brand)] sm:ml-2 sm:mt-0 sm:inline-flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)] dot-pulse" aria-hidden="true" />
                  Updating deal ranking as scores finish.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {showBaggageControls && baggageSummarySentences.length > 0 && (
        <section
          className={`mb-4 rounded-[var(--radius-control)] border px-4 py-3 ${
            baggageSummaryTone === 'warning'
              ? 'border-[var(--warning)]/25 bg-[var(--warning-soft)]'
              : 'border-[var(--border)] bg-[var(--bg-surface)]'
          }`}
          aria-live="polite"
          aria-atomic="true"
        >
          <p className="text-sm font-bold leading-6 text-[var(--text-1)]">
            {baggageSummarySentences.join(' ')}
          </p>
        </section>
      )}

      {showEnabledAlert && formattedAlertThreshold && (
        <RouteAlertModule
          origin={origin}
          dest={dest}
          threshold={formattedAlertThreshold}
          fareCount={flights.length}
          alertEmail={alertEmail}
          setAlertEmail={setAlertEmail}
          alertSent={alertSent}
          alertLoading={alertLoading}
          alertError={alertError}
          handleAlertSubmit={handleAlertSubmit}
        />
      )}
      {showLoadingAlert && (
        <RouteAlertLoadingRow />
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
        >
          <p>
            {emptyCopy}
          </p>
          {searchContext && (
            <p className="mt-2 text-xs font-medium leading-5 text-[var(--text-3)]">
              {searchContext}
            </p>
          )}
          {recoveryActions}
          {showBlockedAlert && (
            <RouteAlertBlockedPrompt
              title={hasProviderUnavailable ? 'Track this route after live fares return' : 'Track this route after a fare appears'}
              body={hasProviderUnavailable
                ? 'We need at least one live fare before setting a drop alert. Retry this search or edit the trip details.'
                : 'We need at least one live fare before setting a drop alert. Try nearby dates, another destination, or anywhere.'}
            />
          )}
          {suggestion && <p className="mt-3 text-xs font-medium leading-5 text-[var(--text-3)]">{suggestion}</p>}
        </FlightStatePanel>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {renderedFlights.map((fare, index) => (
              <div key={fare.id} className={`animate-fade-up ${delays[Math.min(index, delays.length - 1)]}`}>
                <FlightCard
                  fare={fare}
                  score={scores[fare.id] ?? null}
                  loading={scoreLoading.has(fare.id)}
                  baggageEstimate={currentBagEstimates[fare.id]}
                />
              </div>
            ))}
            {isSearching && <FlightCard score={null} loading />}
          </div>
        </>
      )}
    </>
  )
}
