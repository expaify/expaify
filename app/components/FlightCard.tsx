'use client'

import { useState } from 'react'
import { DealScore, NormalizedFare } from '@/lib/types'
import { formatMoney, isValidMoney } from '@/lib/money'
import DealBadge from './DealBadge'

type Props = {
  fare?: NormalizedFare
  score: DealScore | null
  loading: boolean
}

function formatDate(value?: string) {
  if (!value) return ''
  const date = value.includes('T')
    ? new Date(value)
    : new Date(`${value}T00:00:00`)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(value: string) {
  if (!value.includes('T')) return ''
  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function StopsChip({ stops }: { stops: number }) {
  if (stops === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--success)]/25 bg-[var(--success-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--success)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
        Nonstop
      </span>
    )
  }

  if (stops === 1) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--warning)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />
        1 stop
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--warning)]">
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
    <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold ${colors[normalizedCabin]}`}>
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
        <span className="font-display text-xs font-extrabold text-[var(--brand)]">
          {initials}
        </span>
      )}
    </div>
  )
}

function Price({ price, heading, label }: { price: NormalizedFare['price']; heading: string; label: string }) {
  return (
    <div className="min-w-0 text-left sm:min-w-[6.75rem] sm:shrink-0 sm:text-right">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-2)]">
        {heading}
      </p>
      <p className="mt-1 font-display text-3xl font-extrabold leading-none text-[var(--text-1)] tabular-nums">
        {formatMoney(price)}
      </p>
      <p className="mt-1 text-[11px] font-semibold leading-4 text-[var(--text-3)]">
        {label}
      </p>
    </div>
  )
}

function PriceUnavailable({ reason }: { reason: string }) {
  return (
    <div className="min-w-0 text-left sm:min-w-[6.75rem] sm:shrink-0 sm:text-right" role="status" aria-label={`Flight price unavailable. ${reason}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-2)]">
        Current fare
      </p>
      <p className="mt-1 font-display text-lg font-extrabold leading-tight text-[var(--text-1)]">
        Price unavailable
      </p>
      <p className="mt-1 text-[11px] font-semibold leading-4 text-[var(--text-3)]">
        {reason}
      </p>
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

function externalCtaLabel(source: string): string {
  return source === 'duffel' ? 'Continue to booking' : 'View fare details';
}

function DealBanner({ score }: { score: DealScore }) {
  const isLowConfidence = score.confidence === 'low'
  const panelClasses = isLowConfidence
    ? 'border-[var(--warning)]/25 bg-[var(--warning-soft)]'
    : score.verdict === 'Great'
      ? 'border-[var(--success)]/25 bg-[var(--success-soft)]'
      : score.verdict === 'Good'
        ? 'border-[var(--brand)]/25 bg-[var(--brand-soft)]'
        : 'border-[var(--border)] bg-[var(--bg-raised)]'
  const percentileLabel = isLowConfidence
    ? 'Not enough route history for a confirmed deal rating'
    : `${Math.round(score.percentile)}th percentile`

  return (
    <div
      className={`flex flex-col gap-2 rounded-[var(--radius-card)] border px-3.5 py-3 ${panelClasses}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-2)]">
            Deal Score
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-5 text-[var(--text-1)]">
            {percentileLabel}
          </p>
        </div>
        <DealBadge verdict={score.verdict} confidence={score.confidence} />
      </div>
      <p className="text-xs font-medium leading-5 text-[var(--text-2)]">{score.explanation}</p>
    </div>
  )
}

function DealUnavailable() {
  return (
    <div
      className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-raised)] px-3.5 py-3"
      role="status"
      aria-label="Deal Score unavailable for this fare right now."
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-2)]">
        Deal Score
      </p>
      <p className="mt-0.5 text-sm font-semibold leading-5 text-[var(--text-1)]">
        Unavailable right now
      </p>
      <p className="mt-1 text-xs font-medium leading-5 text-[var(--text-2)]">
        We could not compare this fare against route history yet. The live price is still shown above.
      </p>
    </div>
  )
}

export default function FlightCard({ fare, score, loading }: Props) {
  if (fare === undefined) {
    return (
      <div className="card overflow-hidden">
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-[var(--radius-control)] shimmer" />
            <div className="space-y-2">
              <div className="h-4 w-28 rounded-[var(--radius-control)] shimmer" />
              <div className="h-4 w-36 rounded-[var(--radius-control)] shimmer" />
            </div>
            <div className="ml-auto h-10 w-24 rounded-[var(--radius-control)] shimmer" />
          </div>
          <div className="h-28 w-full rounded-[1rem] shimmer" />
          <div className="h-24 w-full rounded-[1rem] shimmer" />
          <div className="h-12 w-full rounded-[var(--radius-control)] shimmer" />
        </div>
      </div>
    )
  }

  const departTime = formatTime(fare.depart)
  const returnTime = fare.return ? formatTime(fare.return) : ''
  const hasValidPrice = isValidMoney(fare.price)
  const isInternalBooking = isSafeInternalBookingLink(fare.source, fare.deeplink)
  const hasDeeplink = isInternalBooking || isSafeExternalProviderLink(fare.deeplink)
  const canOpenProvider = hasDeeplink && hasValidPrice
  const ctaLabel = !hasValidPrice
    ? 'Price unavailable'
    : !hasDeeplink
    ? 'Provider link unavailable'
    : isInternalBooking
      ? 'Review fare details'
      : externalCtaLabel(fare.source)
  const ctaNote = !hasValidPrice
    ? 'No confirmed fare price was returned for this result.'
    : !hasDeeplink
    ? 'Availability cannot be verified from this result.'
    : isInternalBooking
      ? 'In-app booking is paused. This page is review-only.'
      : 'Opens the booking handoff. Final price and availability can change.'
  const passengerCount = Number.isInteger(fare.passengerCount) && (fare.passengerCount ?? 0) > 0
    ? fare.passengerCount as number
    : 1
  const priceHeading = fare.priceScope === 'party_total' ? 'Passenger total' : 'Traveler fare'
  const priceLabel = fare.priceScope === 'party_total'
    ? `total trip price for ${passengerCount} adult${passengerCount === 1 ? '' : 's'}`
    : 'per person fare for this trip'
  const unavailableReason = 'No confirmed fare price was returned.'
  const tripLabel = fare.return ? 'Round trip' : 'One way'
  const carrierLabel = fare.carrier.trim() || 'Unknown carrier'
  const sourceLabel = isInternalBooking ? 'review path' : 'verified fare'

  return (
    <article className="card overflow-hidden rounded-[1.25rem]">
      <div className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="flex min-w-0 items-start gap-3">
            <AirlineLogo carrier={carrierLabel} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-2)]">
                {tripLabel}
              </p>
              <h3 className="mt-0.5 truncate text-base font-bold leading-6 text-[var(--text-1)]">
                {fare.origin} to {fare.destination}
              </h3>
              <p className="truncate text-xs font-medium leading-5 text-[var(--text-2)]">
                {carrierLabel} • {sourceLabel}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StopsChip stops={fare.stops} />
                <CabinBadge cabin={fare.cabin} />
              </div>
            </div>
          </div>
          {hasValidPrice ? (
            <Price price={fare.price} heading={priceHeading} label={priceLabel} />
          ) : (
            <PriceUnavailable reason={unavailableReason} />
          )}
        </div>

        <div className="rounded-[1rem] border border-[var(--border)] bg-[var(--bg-raised)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <div className="flex items-center gap-3">
            <div className="w-[4.75rem] shrink-0 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-2)]">
                Depart
              </p>
              {departTime && (
                <p className="mt-1 font-display text-base font-bold leading-tight text-[var(--text-1)] tabular-nums">
                  {departTime}
                </p>
              )}
              <p className="font-display text-lg font-bold leading-tight text-[var(--text-1)]">
                {fare.origin}
              </p>
              <p className="text-[10px] font-medium leading-tight text-[var(--text-3)]">
                {formatDate(fare.depart)}
              </p>
            </div>

            <div className="relative flex h-10 min-w-0 flex-1 items-center justify-center" aria-hidden="true">
              <div className="h-px w-full bg-[var(--border-strong)]" />
              <span className="absolute rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-2)]">
                {fare.return ? 'Return' : 'Route'}
              </span>
            </div>

            <div className="w-[4.75rem] shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-2)]">
                {fare.return ? 'Return' : 'To'}
              </p>
              {returnTime && (
                <p className="mt-1 font-display text-base font-bold leading-tight text-[var(--text-1)] tabular-nums">
                  {returnTime}
                </p>
              )}
              <p className="font-display text-lg font-bold leading-tight text-[var(--text-1)]">
                {fare.destination}
              </p>
              <p className="text-[10px] font-medium leading-tight text-[var(--text-3)]">
                {formatDate(fare.return ?? fare.depart)}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="h-20 w-full rounded-[var(--radius-card)] shimmer" aria-label="Loading deal score" />
        ) : score ? (
          <DealBanner score={score} />
        ) : (
          <DealUnavailable />
        )}

        <div className="space-y-2">
          {canOpenProvider ? (
            <a
              href={fare.deeplink}
              target={isInternalBooking ? undefined : '_blank'}
              rel={isInternalBooking ? undefined : 'noopener noreferrer sponsored'}
              aria-label={`${ctaLabel} for ${fare.origin} to ${fare.destination}, ${priceLabel}`}
              className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-center text-sm font-bold transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] ${
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
              className="flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-muted)] px-4 text-sm font-bold text-[var(--text-3)]"
            >
              {ctaLabel}
            </button>
          )}
          <p className="text-center text-[11px] font-medium leading-4 text-[var(--text-3)]">{ctaNote}</p>
        </div>
      </div>
    </article>
  )
}
