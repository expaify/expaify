'use client'

import { useState } from 'react'
import { DealScore, NormalizedFare, NormalizedItinerary } from '@/lib/types'
import { formatMoney, isValidMoney } from '@/lib/money'
import { flightFreshnessLabel, flightPriceCheckCopy, hasProviderName, validFreshnessDate } from '@/lib/providerFreshness'
import { appendBookingReturnTo } from '@/lib/booking/config'
import { AIRPORTS } from '@/lib/airports/data'
import DealScorePanel from './DealScorePanel'

type Props = {
  fare?: NormalizedFare
  score: DealScore | null
  loading: boolean
  baggageEstimate?: BaggageEstimatePresentation
}

export type BaggageEstimatePresentation = {
  status: 'loading' | 'available' | 'unavailable'
  carryOnCount: number
  checkedCount: number
  estimatedTotal?: NormalizedFare['price']
  confidence?: 'high' | 'medium' | 'low'
  available: boolean
}

function formatDate(value?: string) {
  if (!value) return ''
  const date = value.includes('T')
    ? new Date(value)
    : new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function nearbyDateLabel(fare: NormalizedFare): string {
  const relation = fare.dateRelation
  if (!relation || relation.relation !== 'nearby') return ''

  const fareDate = new Date(`${relation.fareDepart}T00:00:00.000Z`)
  const selectedDate = new Date(`${relation.selectedDepart}T00:00:00.000Z`)
  if (Number.isNaN(fareDate.getTime()) || Number.isNaN(selectedDate.getTime())) return ''

  const days = Math.round((fareDate.getTime() - selectedDate.getTime()) / 86_400_000)
  if (days === 0) return ''
  const distance = Math.abs(days)
  const direction = days > 0 ? 'after' : 'before'
  return `${fareDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} · ${distance} day${distance === 1 ? '' : 's'} ${direction} your search`
}

function formatTime(value: string) {
  if (!value.includes('T')) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDuration(minutes?: number): string {
  if (!Number.isFinite(minutes) || minutes === undefined || minutes < 0) return ''
  const rounded = Math.round(minutes)
  if (rounded < 60) return `${rounded}m`
  const hours = Math.floor(rounded / 60)
  const remainder = rounded % 60
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`
}

function durationAria(minutes?: number): string {
  if (!Number.isFinite(minutes) || minutes === undefined || minutes < 0) return ''
  const rounded = Math.round(minutes)
  const hours = Math.floor(rounded / 60)
  const remainder = rounded % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)
  if (remainder > 0 || parts.length === 0) parts.push(`${remainder} minute${remainder === 1 ? '' : 's'}`)
  return parts.join(' ')
}

function arrivalDaySuffix(depart: string, arrive?: string): string {
  if (!arrive || !depart.includes('T') || !arrive.includes('T')) return ''
  const departDate = new Date(depart)
  const arriveDate = new Date(arrive)
  if (Number.isNaN(departDate.getTime()) || Number.isNaN(arriveDate.getTime())) return ''
  const departDay = new Date(departDate.getFullYear(), departDate.getMonth(), departDate.getDate()).getTime()
  const arriveDay = new Date(arriveDate.getFullYear(), arriveDate.getMonth(), arriveDate.getDate()).getTime()
  const diffDays = Math.round((arriveDay - departDay) / 86_400_000)
  return diffDays > 0 ? ` +${diffDays} day${diffDays === 1 ? '' : 's'}` : ''
}

function formatAirportCity(iata: string): string {
  const code = iata.trim().toUpperCase()
  if (!code) return ''
  const airport = AIRPORTS.find(entry => entry.iata === code)
  return airport?.city || code
}

// Counts full calendar days between two timestamps (or date-only values),
// used only for the "X nights in {destination}" divider on round-trip
// cards. Both `fromValue` and `toValue` are always real fields already on
// the fare (`fare.depart` and `fare.return`) — never fabricated — but the
// resulting night count is an honest approximation: `fare.return` is the
// return flight's arrival time back at the origin (confirmed by every
// provider that sets it), not its departure time from the destination, so
// an overnight return flight can shift this by up to a day. Returns null
// when either value is missing/invalid or the trip isn't at least one full
// day, rather than showing a misleading "0 nights".
function nightsBetween(fromValue: string, toValue: string): number | null {
  if (!fromValue || !toValue) return null
  const fromDate = fromValue.includes('T') ? new Date(fromValue) : new Date(`${fromValue}T00:00:00`)
  const toDate = toValue.includes('T') ? new Date(toValue) : new Date(`${toValue}T00:00:00`)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return null
  const fromDay = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()).getTime()
  const toDay = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()).getTime()
  const diffDays = Math.round((toDay - fromDay) / 86_400_000)
  return diffDays > 0 ? diffDays : null
}

// Builds a Kiwi-style "1 stop · Houston" summary strictly from a
// certainty:'confirmed' itinerary's own segments/layovers. By construction
// (see lib/providers/itinerary.ts buildConfirmedItinerary), a confirmed
// itinerary's layovers array is always complete — one entry per gap
// between segments, each with a real airport code — so this never needs to
// fall back to fare.stops (which, for round trips, is the sum of stops
// across BOTH legs and would overcount a single leg).
function confirmedStopsSummary(itinerary: NormalizedItinerary): string {
  const segments = itinerary.segments ?? []
  const stopCount = Math.max(segments.length - 1, 0)
  if (stopCount === 0) return 'Nonstop'
  const label = stopCount === 1 ? '1 stop' : `${stopCount} stops`
  const cities = (itinerary.layovers ?? [])
    .map(layover => formatAirportCity(layover.airport))
    .filter(Boolean)
  return cities.length > 0 ? `${label} · ${cities.join(', ')}` : label
}

// The honest counterpart for a certainty:'partial' leg (e.g. Google
// Flights, which gives a real duration and arrival time but never real
// per-segment layover data). Uses the fare's own top-level `stops` count
// -- always real, set by every provider regardless of itinerary certainty
// -- but never invents a layover city name the way confirmedStopsSummary
// can, since that data genuinely isn't there for a partial itinerary.
function partialStopsSummary(stops: number): string {
  if (stops <= 0) return 'Nonstop'
  return stops === 1 ? '1 stop' : `${stops} stops`
}

function getScheduleContext(label: 'Depart' | 'Return', value: string) {
  const date = formatDate(value) || value
  const time = formatTime(value)
  const hasTimestamp = value.includes('T') && Boolean(time)
  const action = label === 'Depart' ? 'departing' : 'returning'

  return {
    date,
    time,
    primary: hasTimestamp ? time : date,
    secondary: hasTimestamp ? date : '',
    ariaLabel: hasTimestamp
      ? `${label} ${date} at ${time}`
      : `${label} ${date}. ${label === 'Depart' ? 'Departure' : 'Return'} date only.`,
    ctaPhrase: hasTimestamp ? `${action} ${date} at ${time}` : `${action} ${date}`,
  }
}

function ItineraryTiming({ fare, score }: { fare: NormalizedFare; score: DealScore | null }) {
  const itinerary = fare.itinerary
  const certainty = itinerary?.certainty ?? 'unavailable'
  const duration = formatDuration(itinerary?.durationMinutes)
  const arrivalTime = itinerary?.arrive ? formatTime(itinerary.arrive) : ''
  const arrivalCopy = arrivalTime ? ` Arrives ${arrivalTime}${arrivalDaySuffix(fare.depart, itinerary?.arrive)}.` : ''
  const hasCompleteLayovers =
    certainty === 'confirmed' &&
    fare.stops > 0 &&
    itinerary?.layovers?.length === fare.stops &&
    itinerary.layovers.every(layover => layover.airport.trim() && Number.isFinite(layover.durationMinutes))

  let timingCopy = ''
  let layoverCopy = ''

  if (certainty === 'confirmed' && duration) {
    timingCopy = `Total duration: ${duration}.${arrivalCopy}`
    if (hasCompleteLayovers && itinerary?.layovers) {
      const layovers = itinerary.layovers.map(layover => {
        const suffixes = [
          layover.overnight ? 'overnight' : '',
          layover.airportChange ? 'airport change' : '',
        ].filter(Boolean)
        return `${layover.airport.trim().toUpperCase()} ${formatDuration(layover.durationMinutes)}${suffixes.length > 0 ? `, ${suffixes.join(', ')}` : ''}`
      })
      layoverCopy = layovers.length === 1
        ? `Layover: ${layovers[0].replace(' ', ', ')}`
        : `Layovers: ${layovers.join(', ')}`
    } else if (fare.stops > 0) {
      layoverCopy = 'Layover details unavailable from provider.'
    }
  } else if (certainty === 'partial') {
    if (duration) {
      timingCopy = `Total duration: ${duration}. Layover details unavailable from provider.`
    } else if (arrivalTime) {
      timingCopy = 'Arrival time confirmed by provider. Total duration and layover details unavailable.'
    } else {
      timingCopy = 'Layover details unavailable from provider.'
    }
  } else {
    timingCopy = 'Duration unavailable from provider.'
    if (fare.stops > 0) layoverCopy = 'Layover details unavailable from provider.'
  }

  const showTimingWarning = certainty !== 'confirmed'
  const showScoreCaution = Boolean(score) && certainty !== 'confirmed'

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-raised)] px-3.5 py-3 text-xs font-medium leading-5 text-[var(--text-2)]">
      <p className="font-medium text-[var(--text-1)]">Itinerary timing</p>
      <p className="mt-1 text-[var(--text-2)]">{timingCopy}</p>
      {layoverCopy ? (
        <p className="mt-1 text-[var(--text-2)]">{layoverCopy}</p>
      ) : null}
      {showTimingWarning ? (
        <p className="mt-2 rounded-[var(--radius-control)] border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-3 py-2 text-xs font-medium leading-5 text-[var(--warning)]">
          {certainty === 'partial' ? 'Some itinerary timing is provider-confirmed, but layover details are incomplete.' : 'Duration unavailable from provider.'}
        </p>
      ) : null}
      {showScoreCaution ? (
        <p className="mt-2 rounded-[var(--radius-control)] border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-3 py-2 text-xs font-medium leading-5 text-[var(--warning)]">
          Deal Score is based on price history; itinerary duration was not confirmed by the provider.
        </p>
      ) : null}
    </div>
  )
}

function ScheduleItem({ label, value }: { label: 'Depart' | 'Return'; value: string }) {
  const schedule = getScheduleContext(label, value)

  return (
    <div
      className="min-w-[7.25rem] flex-1 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 sm:max-w-[9.5rem]"
      role="group"
      aria-label={schedule.ariaLabel}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-2)]">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium leading-5 text-[var(--text-1)] tabular-nums">
        {schedule.primary}
      </p>
      {schedule.secondary ? (
        <p className="text-xs font-medium leading-4 text-[var(--text-3)]">
          {schedule.secondary}
        </p>
      ) : null}
    </div>
  )
}

function StopsChip({ stops }: { stops: number }) {
  if (stops === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--success)]/25 bg-[var(--success-soft)] px-2 py-1 text-xs font-medium text-[var(--success)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
        Nonstop
      </span>
    )
  }

  if (stops === 1) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-2 py-1 text-xs font-medium text-[var(--warning)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />
        1 stop
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-2 py-1 text-xs font-medium text-[var(--warning)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />
      {stops} stops
    </span>
  )
}

function CabinBadge({ cabin }: { cabin?: NormalizedFare['cabin'] }) {
  const labels = {
    economy: 'Eco',
    premium_economy: 'Prem',
    business: 'Biz',
    first: 'First',
  }
  const colors = {
    economy: 'text-[var(--text-2)] border-[var(--border-strong)] bg-[var(--bg-raised)]',
    premium_economy: 'text-[var(--brand)] border-[var(--border-hover)] bg-[var(--brand-soft)]',
    business: 'text-[var(--brand)] border-[var(--border-hover)] bg-[var(--brand-soft)]',
    first: 'text-[var(--warning)] border-[var(--warning)]/25 bg-[var(--warning-soft)]',
  }
  const normalizedCabin = cabin ?? 'economy'

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${colors[normalizedCabin]}`}>
      {labels[normalizedCabin]}
    </span>
  )
}

function AirlineLogo({ carrier }: { carrier: string }) {
  const [failed, setFailed] = useState(false)
  const cleanCarrier = carrier.trim()
  const code = cleanCarrier.toUpperCase().slice(0, 3)
  const iataCode = cleanCarrier.length <= 3 ? code : ''
  const initials = code.slice(0, 2) || 'EX'

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-raised)]">
      {iataCode && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://images.kiwi.com/airlines/64/${iataCode}.png`}
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-display text-xs font-bold text-[var(--brand)]">
          {initials}
        </span>
      )}
    </div>
  )
}

function Price({ price, heading, label, freshnessLabel }: { price: NormalizedFare['price']; heading: string; label: string; freshnessLabel: string }) {
  return (
    <div className="min-w-[6.75rem] max-w-[9.5rem] text-right sm:min-w-[7.5rem] sm:shrink-0">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-2)]">
        {heading}
      </p>
      <p className="mt-1 font-display text-xl font-bold leading-none text-[var(--text-1)] tabular-nums sm:text-4xl">
        {formatMoney(price)}
      </p>
      <div className="mt-1 space-y-0.5 text-xs font-medium leading-4 text-[var(--text-3)]">
        <p>{label}</p>
        <p className="text-[var(--text-2)]">{freshnessLabel}</p>
      </div>
    </div>
  )
}

function PriceUnavailable({ reason, freshnessLabel }: { reason: string; freshnessLabel?: string }) {
  return (
    <div className="min-w-[6.75rem] max-w-[9.5rem] text-right sm:min-w-[7.5rem] sm:shrink-0" role="status" aria-label={`Flight price unavailable. ${reason}${freshnessLabel ? ` ${freshnessLabel}.` : ''}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-2)]">
        Current fare
      </p>
      <p className="mt-1 font-display text-lg font-bold leading-tight text-[var(--text-1)]">
        Price unavailable
      </p>
      <div className="mt-1 space-y-0.5 text-xs font-medium leading-4 text-[var(--text-3)]">
        <p>{reason}</p>
        {freshnessLabel ? <p className="text-[var(--text-2)]">{freshnessLabel}</p> : null}
      </div>
    </div>
  )
}

function BaggageEstimateRow({
  estimate,
}: {
  estimate: BaggageEstimatePresentation
}) {
  const isLowConfidence = estimate.status === 'available' && estimate.confidence === 'low'
  const isUnavailable = estimate.status === 'unavailable'
  const rowTone = isLowConfidence || isUnavailable
    ? 'border-[var(--warning)]/25 bg-[var(--warning-soft)]'
    : 'border-[var(--border)] bg-[var(--bg-raised)]'
  const labelTone = isLowConfidence || isUnavailable
    ? 'text-[var(--warning)]'
    : 'text-[var(--text-2)]'

  let label = 'Estimating bags'
  let detail = ''

  if (estimate.status === 'available' && estimate.estimatedTotal) {
    label = isLowConfidence
      ? `Rough bag estimate: ${formatMoney(estimate.estimatedTotal)}`
      : `Est. with bags: ${formatMoney(estimate.estimatedTotal)}`
    detail = isLowConfidence
      ? 'Low-confidence airline rule; verify before booking.'
      : `${estimate.carryOnCount} carry-on, ${estimate.checkedCount} checked included in estimate.`
  } else if (estimate.status === 'unavailable') {
    label = 'Bag estimate unavailable'
    detail = 'Check baggage terms with the provider before booking.'
  }

  return (
    <div className={`mt-3 min-h-[3.75rem] rounded-[var(--radius-control)] border px-3 py-2 text-xs leading-5 sm:col-span-2 ${rowTone}`}>
      <p className={`font-medium ${labelTone}`}>{label}</p>
      {detail ? (
        <p className="text-[var(--text-2)]">{detail}</p>
      ) : null}
    </div>
  )
}

function isSafeInternalBookingLink(source: string, deeplink: string): boolean {
  if (source !== 'duffel') return false

  try {
    const url = new URL(deeplink, 'https://expaify.local')
    return url.origin === 'https://expaify.local' && url.pathname === '/book'
  } catch {
    return false
  }
}

function isSafeExternalProviderLink(deeplink: string): boolean {
  try {
    const url = new URL(deeplink.trim())
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function ScoreChip({ score, loading }: { score: DealScore | null; loading: boolean }) {
  if (loading) {
    return (
      <span
        className="inline-flex min-h-7 items-center rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1 text-xs font-medium text-[var(--text-2)]"
        aria-live="polite"
      >
        Score pending
      </span>
    )
  }

  if (!score) {
    return (
      <span className="inline-flex min-h-7 items-center rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1 text-xs font-medium text-[var(--text-2)]">
        Score unavailable
      </span>
    )
  }

  const label = score.confidence === 'low' ? 'Limited history' : score.verdict
  const classes = score.confidence === 'low'
    ? 'border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]'
    : score.verdict === 'Great'
      ? 'border-[color:var(--border-strong)] bg-[color:var(--success-soft)] text-[color:var(--success)]'
      : score.verdict === 'Good'
        ? 'border-[color:var(--border-strong)] bg-[color:var(--brand-soft)] text-[color:var(--brand)]'
        : 'border-[color:var(--border)] bg-[color:var(--bg-muted)] text-[color:var(--text-2)]'

  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-xs font-medium ${classes}`}>
      {label}
    </span>
  )
}

function RouteArrow({ tone = 'strong' }: { tone?: 'strong' | 'muted' }) {
  const lineClass = tone === 'strong' ? 'bg-[var(--border-strong)]' : 'bg-[var(--border)]'
  return (
    <div className="my-1 flex w-full min-w-[2rem] items-center gap-1" aria-hidden="true">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${lineClass}`} />
      <span className={`h-px min-w-[0.5rem] flex-1 ${lineClass}`} />
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0 text-[var(--text-3)]">
        <path d="M1 7h11M7.5 3.5L11 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`h-px min-w-[0.5rem] flex-1 ${lineClass}`} />
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${lineClass}`} />
    </div>
  )
}

// The rich, Kiwi-style leg row: bold depart time + origin code on the
// left, duration/stops in the middle, bold arrival time + destination code
// on the right. Used for both a certainty:'confirmed' leg (every value
// provider-confirmed) and certainty:'partial' (real duration + arrival
// time, but stopsSummary must be the honest partialStopsSummary, never
// confirmedStopsSummary's invented-city version) — `estimated` distinguishes
// the two visually so a partial leg is never presented with confirmed's
// full precision.
function LegTimeline({
  originCode,
  destinationCode,
  departValue,
  arriveValue,
  durationMinutes,
  stopsSummary,
  estimated = false,
}: {
  originCode: string
  destinationCode: string
  departValue: string
  arriveValue: string
  durationMinutes?: number
  stopsSummary: string
  estimated?: boolean
}) {
  const departTime = formatTime(departValue)
  const arriveTime = formatTime(arriveValue)
  const daySuffix = arrivalDaySuffix(departValue, arriveValue)
  const durationLabel = formatDuration(durationMinutes)

  return (
    <div className="grid grid-cols-[auto_minmax(3.5rem,1fr)_auto] items-center gap-2 sm:gap-3">
      <div className="min-w-0 text-left">
        <p className="font-display text-lg font-bold leading-6 text-[var(--text-1)] tabular-nums sm:text-2xl">
          {departTime}
        </p>
        <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-2)]">
          {originCode}
        </p>
      </div>
      <div className="flex min-w-0 flex-col items-center px-1">
        {durationLabel ? (
          <p className="text-xs font-medium leading-4 text-[var(--text-2)] tabular-nums">{durationLabel}</p>
        ) : null}
        <RouteArrow tone="strong" />
        <p className="truncate text-xs font-medium leading-4 text-[var(--text-2)]">{stopsSummary}</p>
        {estimated ? (
          <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide text-[var(--text-3)]">Estimated</p>
        ) : null}
      </div>
      <div className="min-w-0 text-right">
        <p className="font-display text-lg font-bold leading-6 text-[var(--text-1)] tabular-nums sm:text-2xl">
          {arriveTime}{daySuffix}
        </p>
        <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-2)]">
          {destinationCode}
        </p>
      </div>
    </div>
  )
}

// The honest counterpart to LegTimeline for a round trip's return leg.
// No provider in this codebase ever supplies the return flight's
// departure time, duration, or stop count — only its arrival back at the
// origin (`fare.return`, confirmed by every provider that sets it — see
// duffel.ts/kiwi.ts, each assigning it from the final return
// segment's real arrival timestamp). Inventing a fake departure time or
// duration to mirror LegTimeline's layout would violate this card's
// no-fabrication rule, so this row deliberately shows less: a muted
// "Return" label in place of a depart time, and a real bold arrival time.
function ReturnArrivalRow({
  fromCode,
  toCode,
  arriveValue,
}: {
  fromCode: string
  toCode: string
  arriveValue: string
}) {
  const arriveTime = formatTime(arriveValue)
  const arriveDate = formatDate(arriveValue)

  return (
    <div className="grid grid-cols-[auto_minmax(3.5rem,1fr)_auto] items-center gap-2 sm:gap-3">
      <div className="min-w-0 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-2)]">Return</p>
        <p className="mt-0.5 text-xs font-medium leading-4 text-[var(--text-3)]">{fromCode}</p>
      </div>
      <div className="flex min-w-0 flex-col items-center px-1">
        <p className="text-xs font-medium leading-4 text-[var(--text-3)]">Departure time unavailable</p>
        <RouteArrow tone="muted" />
      </div>
      <div className="min-w-0 text-right">
        <p className="font-display text-lg font-bold leading-6 text-[var(--text-1)] tabular-nums sm:text-2xl">
          {arriveTime}
        </p>
        <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-2)]">
          {toCode}
        </p>
        <p className="text-[10px] font-medium leading-4 text-[var(--text-3)]">Lands {arriveDate}</p>
      </div>
    </div>
  )
}

function NightsDivider({ nights, destinationCity }: { nights: number; destinationCity: string }) {
  return (
    <div className="my-3 flex items-center gap-2" role="separator">
      <span className="h-px flex-1 bg-[var(--border)]" />
      <span className="whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-2)]">
        {nights} night{nights === 1 ? '' : 's'} in {destinationCity}
      </span>
      <span className="h-px flex-1 bg-[var(--border)]" />
    </div>
  )
}

// The default-visible visual timeline this redesign adds: a real
// departure-time/arrival-time route row (in the spirit of Kiwi's results
// card). Renders for certainty:'confirmed' (full precision, real layover
// city names) AND certainty:'partial' (real duration + arrival time, but
// an honest stops-only summary and a visible "Estimated" cue — this is
// Google Flights' realistic case, and live traffic showed this path is
// what actually needs to render for the redesign to be visible at all;
// see REPAIR-FLIGHT-TIMELINE-PARTIAL-CERTAINTY-01). Certainty 'unavailable'
// fares keep the existing, unchanged collapsed treatment (duration pill +
// stops chip + "Departs" text) — this function returns null for those, so
// FlightCard's own honest fallback keeps doing its job.
function RouteTimeline({ fare }: { fare: NormalizedFare }) {
  const itinerary = fare.itinerary
  if (!itinerary || (itinerary.certainty !== 'confirmed' && itinerary.certainty !== 'partial')) return null
  if (!itinerary.arrive || !Number.isFinite(itinerary.durationMinutes)) return null

  const isConfirmed = itinerary.certainty === 'confirmed'
  const stopsSummary = isConfirmed ? confirmedStopsSummary(itinerary) : partialStopsSummary(fare.stops)
  const nights = fare.return ? nightsBetween(fare.depart, fare.return) : null
  const nightsClause = nights !== null ? ` ${nights} night${nights === 1 ? '' : 's'} in ${formatAirportCity(fare.destination)}.` : ''
  const precisionClause = isConfirmed ? '' : ' Timing is provider-estimated, not confirmed.'
  const ariaLabel = fare.return
    ? `Outbound: ${stopsSummary === 'Nonstop' ? 'nonstop' : stopsSummary} from ${fare.origin} to ${fare.destination}, departs ${formatTime(fare.depart)}, arrives ${formatTime(itinerary.arrive)}, total duration ${durationAria(itinerary.durationMinutes)}.${nightsClause} Return arrives ${formatTime(fare.return)} at ${fare.origin} on ${formatDate(fare.return)}.${precisionClause}`
    : `${stopsSummary === 'Nonstop' ? 'Nonstop' : stopsSummary} from ${fare.origin} to ${fare.destination}, departs ${formatTime(fare.depart)}, arrives ${formatTime(itinerary.arrive)}, total duration ${durationAria(itinerary.durationMinutes)}.${precisionClause}`

  return (
    <div
      className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-3 sm:px-4"
      role="group"
      aria-label={ariaLabel}
    >
      <LegTimeline
        originCode={fare.origin}
        destinationCode={fare.destination}
        departValue={fare.depart}
        arriveValue={itinerary.arrive}
        durationMinutes={itinerary.durationMinutes}
        stopsSummary={stopsSummary}
        estimated={!isConfirmed}
      />
      {fare.return ? (
        <>
          {nights !== null ? (
            <NightsDivider nights={nights} destinationCity={formatAirportCity(fare.destination)} />
          ) : (
            <div className="my-3 h-px bg-[var(--border)]" role="separator" />
          )}
          <ReturnArrivalRow fromCode={fare.destination} toCode={fare.origin} arriveValue={fare.return} />
        </>
      ) : null}
    </div>
  )
}

export default function FlightCard({ fare, score, loading, baggageEstimate }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (fare === undefined) {
    return (
      <div className="card overflow-hidden rounded-[var(--radius-card)] p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <div className="flex min-w-0 gap-3">
            <div className="h-11 w-11 shrink-0 rounded-[var(--radius-control)] shimmer" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-28 rounded-[var(--radius-control)] shimmer" />
              <div className="h-4 w-36 rounded-[var(--radius-control)] shimmer" />
              <div className="h-4 w-44 rounded-[var(--radius-control)] shimmer" />
            </div>
          </div>
          <div className="h-12 w-24 rounded-[var(--radius-control)] shimmer" />
        </div>
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="h-7 w-32 rounded-full shimmer" />
          <div className="h-10 w-28 rounded-[var(--radius-control)] shimmer" />
        </div>
        <div className="mt-3 min-h-[3.75rem] rounded-[var(--radius-control)] shimmer" />
      </div>
    )
  }

  const hasValidPrice = isValidMoney(fare.price)
  const isInternalBooking = isSafeInternalBookingLink(fare.source, fare.deeplink)
  const hasDeeplink = isInternalBooking || isSafeExternalProviderLink(fare.deeplink)
  const canOpenProvider = hasDeeplink && hasValidPrice
  // `window.location` is unavailable during server render, so the very
  // first (server) paint always uses the plain internal booking link —
  // identical to pre-repair behavior. Once running in the browser, this
  // recovers the current results URL (route, dates, tab, filters) so the
  // booking review page's "Back to search" links can return to it instead
  // of the homepage. Computed directly during render (no extra hook) so
  // this stays a plain function call, matching how this component is
  // exercised by this repo's no-jsdom, direct-invocation component tests.
  const currentResultsUrl = typeof window === 'undefined' ? '' : `${window.location.pathname}${window.location.search}`
  const ctaHref = isInternalBooking && currentResultsUrl
    ? appendBookingReturnTo(fare.deeplink, currentResultsUrl)
    : fare.deeplink
  const freshnessLabel = flightFreshnessLabel(fare.source, fare.fetchedAt)
  const priceCheckCopy = flightPriceCheckCopy(fare.source, fare.fetchedAt)
  const shouldShowUnavailableFreshness = hasProviderName(fare.source) || Boolean(validFreshnessDate(fare.fetchedAt))
  const formattedPrice = hasValidPrice ? formatMoney(fare.price) : ''
  const ctaLabel = !hasValidPrice
    ? 'Price unavailable'
    : !hasDeeplink
    ? 'Provider link unavailable'
    : isInternalBooking
      ? 'Review fare'
      : 'Continue to provider'
  const destinationMetadata = isInternalBooking ? 'expaify review' : 'Provider site'
  const priceUnavailableReason = 'No confirmed price was returned for this result.'
  const providerUnavailableReason = 'Availability cannot be verified from this result.'
  const ctaNote = !hasValidPrice
    ? priceUnavailableReason
    : !hasDeeplink
    ? providerUnavailableReason
    : isInternalBooking
      ? 'expaify review opens next; booking may remain paused and provider terms can change.'
      : 'Final price, availability, baggage fees, and provider terms can change.'
  const passengerCount = Number.isInteger(fare.passengerCount) && (fare.passengerCount ?? 0) > 0
    ? fare.passengerCount as number
    : 1
  const priceHeading = fare.priceScope === 'party_total' ? 'Passenger total' : 'Traveler fare'
  const priceLabel = fare.priceScope === 'party_total'
    ? `total trip price for ${passengerCount} adult${passengerCount === 1 ? '' : 's'}`
    : 'per person fare for this trip'
  const unavailableReason = priceUnavailableReason
  const tripLabel = fare.return ? 'Round trip' : 'One way'
  const carrierLabel = fare.carrier.trim() || 'Unknown carrier'
  const departContext = getScheduleContext('Depart', fare.depart)
  const nearbyDate = nearbyDateLabel(fare)
  const itinerary = fare.itinerary
  const itineraryCertainty = itinerary?.certainty ?? 'unavailable'
  const durationLabel = formatDuration(itinerary?.durationMinutes)
  const showCollapsedDuration = Boolean(durationLabel) && (itineraryCertainty === 'confirmed' || itineraryCertainty === 'partial')
  const showRouteTimeline = (itineraryCertainty === 'confirmed' || itineraryCertainty === 'partial') && Boolean(itinerary?.arrive) && Number.isFinite(itinerary?.durationMinutes)
  const scheduleAriaLabel = itineraryCertainty === 'confirmed' && durationLabel
    ? `Flight schedule, total duration ${durationAria(itinerary?.durationMinutes)}`
    : 'Flight schedule'
  const detailsId = `flight-details-${fare.id}`
  const ctaAriaLabel = !hasValidPrice
    ? `Price unavailable for ${fare.origin} to ${fare.destination}. ${priceUnavailableReason} ${shouldShowUnavailableFreshness ? freshnessLabel : ''}`.trim()
    : !hasDeeplink
      ? `Provider link unavailable for ${fare.origin} to ${fare.destination}. ${providerUnavailableReason} ${freshnessLabel}.`
      : isInternalBooking
        ? `Review fare for ${fare.origin} to ${fare.destination}. Current fare ${formattedPrice}, ${priceLabel}. ${freshnessLabel}. Opens expaify review before any provider action.`
        : `Continue to provider for ${fare.origin} to ${fare.destination}. Current fare ${formattedPrice}, ${priceLabel}. ${freshnessLabel}. Opens provider site in a new tab. Final price, availability, baggage fees, and provider terms can change.`

  return (
    <article className="card overflow-hidden rounded-[var(--radius-card)]">
      <div className="p-3 sm:p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(6.75rem,auto)] gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="hidden sm:block">
              <AirlineLogo carrier={carrierLabel} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-medium leading-5 text-[var(--text-1)] sm:text-base">
                {fare.origin} to {fare.destination}
              </h3>
              <p className="truncate text-xs font-medium leading-5 text-[var(--text-2)]">
                {tripLabel} · {carrierLabel}
              </p>
              {nearbyDate ? (
                <p className="mt-1 text-xs font-medium leading-5 text-[var(--text-2)]">
                  {nearbyDate}
                </p>
              ) : null}
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
                {showCollapsedDuration && !showRouteTimeline ? (
                  <span className={`text-xs leading-5 tabular-nums ${
                    itineraryCertainty === 'confirmed'
                      ? 'font-medium text-[var(--text-1)]'
                      : 'font-medium text-[var(--text-2)]'
                  }`}>
                    Total {durationLabel}
                  </span>
                ) : null}
                <StopsChip stops={fare.stops} />
                {departContext.time && !showRouteTimeline ? (
                  <span className="truncate text-xs font-medium leading-5 text-[var(--text-2)]">
                    Departs {departContext.time}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          {hasValidPrice ? (
            <Price price={fare.price} heading={priceHeading} label={priceLabel} freshnessLabel={freshnessLabel} />
          ) : (
            <PriceUnavailable reason={unavailableReason} freshnessLabel={shouldShowUnavailableFreshness ? freshnessLabel : undefined} />
          )}
        </div>

        {showRouteTimeline ? (
          <div className="mt-3">
            <RouteTimeline fare={fare} />
          </div>
        ) : null}

        {baggageEstimate ? <BaggageEstimateRow estimate={baggageEstimate} /> : null}

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="min-w-0">
            <ScoreChip score={score} loading={loading} />
          </div>
          {canOpenProvider ? (
            <a
              href={ctaHref}
              target={isInternalBooking ? undefined : '_blank'}
              rel={isInternalBooking ? undefined : 'noopener noreferrer sponsored'}
              aria-label={ctaAriaLabel}
              className={`inline-flex min-h-10 max-w-[8.5rem] items-center justify-center gap-2 rounded-[var(--radius-control)] px-3 text-center text-xs font-medium transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] sm:min-h-12 sm:max-w-none sm:px-4 sm:text-sm ${
                isInternalBooking
                  ? 'border border-[var(--border-strong)] bg-[var(--bg-raised)] text-[var(--text-1)]'
                  : 'border border-[var(--brand)] bg-[var(--brand)] text-[var(--text-inverse)] shadow-[var(--shadow-btn)]'
              }`}
            >
              <span className="truncate">{ctaLabel}</span>
              <svg className="shrink-0" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ) : (
            <button
              type="button"
              disabled
              aria-label={ctaAriaLabel}
              className="inline-flex min-h-10 max-w-[8.5rem] cursor-not-allowed items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-muted)] px-3 text-xs font-medium text-[var(--text-3)] sm:min-h-12 sm:max-w-none sm:px-4 sm:text-sm"
            >
              <span className="truncate">{ctaLabel}</span>
            </button>
          )}
        </div>

        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={detailsId}
          onClick={() => setIsExpanded(value => !value)}
          className="mt-3 flex min-h-10 w-full items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        >
          {isExpanded ? 'Hide details' : 'Details'}
        </button>
      </div>

      {isExpanded && (
        <div id={detailsId} className="border-t border-[var(--border)] px-3 pb-3 pt-3 sm:px-5 sm:pb-5">
          <div className="space-y-3">
            <DealScorePanel
              score={score}
              loading={loading}
              scope="route"
              priceNoun="fare"
              unavailableCopy="We could not compare this fare against route history yet. The live price is still shown when available."
            />

            <ItineraryTiming fare={fare} score={score} />

            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-raised)] px-3.5 py-3 text-xs font-medium leading-5 text-[var(--text-2)]">
              <p className="font-medium text-[var(--text-1)]">Price scope</p>
              <p>{priceLabel}</p>
              <p className="mt-2 font-medium text-[var(--text-1)]">Baggage estimate</p>
              <p>
                {baggageEstimate?.available
                  ? 'Estimated bag totals are added to the confirmed fare only for comparison. Provider baggage rules and final checkout totals can change.'
                  : 'No bag estimate is available for this fare. Review provider baggage terms before booking.'}
              </p>
              <p className="mt-2 font-medium text-[var(--text-1)]">Price check</p>
              <p>{priceCheckCopy}</p>
              <p className="mt-2 font-medium text-[var(--text-1)]">Provider handoff</p>
              <p>{ctaNote}</p>
              {!hasValidPrice ? <p className="mt-2">No confirmed fare price was returned for this result.</p> : null}
              {hasValidPrice && !hasDeeplink ? <p className="mt-2">Availability cannot be verified from this result.</p> : null}
              <p className="mt-2">
                {tripLabel} · {destinationMetadata} · {carrierLabel} · {fare.cabin ? `${fare.cabin.replace('_', ' ')} cabin` : 'economy cabin'}
              </p>
              <div className="mt-2 flex flex-wrap items-stretch gap-2" role="group" aria-label={scheduleAriaLabel}>
                <ScheduleItem label="Depart" value={fare.depart} />
                {fare.return ? <ScheduleItem label="Return" value={fare.return} /> : null}
                <CabinBadge cabin={fare.cabin} />
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
