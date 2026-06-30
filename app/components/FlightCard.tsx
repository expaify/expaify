'use client'

import { useState } from 'react'
import { DealScore, NormalizedFare } from '@/lib/types'
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
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[11px] font-semibold text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Nonstop
      </span>
    )
  }

  if (stops === 1) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[11px] font-semibold text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        1 stop
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/20 bg-orange-400/10 px-2 py-1 text-[11px] font-semibold text-orange-300">
      <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
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
    economy: 'text-gray-500 border-gray-700',
    premium_economy: 'text-blue-400 border-blue-800',
    business: 'text-violet-400 border-violet-800',
    first: 'text-amber-400 border-amber-800',
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
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
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
        <span className="font-display text-xs font-extrabold text-indigo-400">
          {initials}
        </span>
      )}
    </div>
  )
}

function Price({ cents, currency, label }: { cents: number; currency: string; label: string }) {
  const whole = Math.floor(cents / 100).toLocaleString('en-US')
  const fractional = String(Math.abs(cents % 100)).padStart(2, '0')
  const currencyLabel = currency === 'USD' ? '$' : currency

  return (
    <div className="min-w-[6.75rem] shrink-0 text-right">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
        Current fare
      </p>
      <div className="mt-1 flex items-baseline justify-end gap-px">
        <span className="text-sm font-semibold text-gray-400">{currencyLabel}</span>
        <span className="font-display text-[2rem] font-extrabold leading-none text-white tabular-nums">
          {whole}
        </span>
        <span className="text-sm font-semibold text-gray-500">.{fractional}</span>
      </div>
      <p className="mt-1 text-[11px] font-medium leading-4 text-gray-500">{label}</p>
    </div>
  )
}

function DealBanner({ score }: { score: DealScore }) {
  const isLowConfidence = score.confidence === 'low'
  const panelClasses = isLowConfidence
    ? 'border-amber-500/20 bg-amber-500/10'
    : score.verdict === 'Great'
      ? 'border-emerald-500/20 bg-emerald-500/10'
      : score.verdict === 'Good'
        ? 'border-blue-500/20 bg-blue-500/10'
        : 'border-white/10 bg-white/[0.035]'
  const percentileLabel = isLowConfidence
    ? 'Not enough route history for a confirmed deal rating'
    : `${Math.round(score.percentile)}th percentile`

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border px-3.5 py-3 ${panelClasses}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
            Deal Score
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-5 text-gray-100">
            {percentileLabel}
          </p>
        </div>
        <DealBadge verdict={score.verdict} confidence={score.confidence} />
      </div>
      <p className="text-xs leading-5 text-gray-300">{score.explanation}</p>
    </div>
  )
}

export default function FlightCard({ fare, score, loading }: Props) {
  if (fare === undefined) {
    return (
      <div className="card rounded-2xl overflow-hidden">
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl shimmer" />
            <div className="space-y-2">
              <div className="h-4 w-28 rounded-lg shimmer" />
              <div className="h-4 w-36 rounded-lg shimmer" />
            </div>
            <div className="ml-auto h-10 w-24 rounded-lg shimmer" />
          </div>
          <div className="h-24 w-full rounded-xl shimmer" />
          <div className="h-20 w-full rounded-xl shimmer" />
          <div className="h-12 w-full rounded-xl shimmer" />
        </div>
      </div>
    )
  }

  const departTime = formatTime(fare.depart)
  const returnTime = fare.return ? formatTime(fare.return) : ''
  const isInternalBooking = fare.source === 'duffel' || fare.deeplink.startsWith('/book')
  const hasDeeplink = fare.deeplink.trim().length > 0 && fare.deeplink !== '#'
  const ctaLabel = !hasDeeplink
    ? 'Provider link unavailable'
    : isInternalBooking
      ? 'Review paused booking'
      : `Check with ${fare.source}`
  const ctaNote = !hasDeeplink
    ? 'Availability cannot be verified from this result.'
    : isInternalBooking
      ? 'In-app booking is paused. Review only.'
      : 'Opens provider search. Price and availability can change.'
  const priceLabel = fare.priceScope === 'party_total'
    ? `total for ${fare.passengerCount ?? 1} adult${(fare.passengerCount ?? 1) === 1 ? '' : 's'}`
    : 'per person'
  const tripLabel = fare.return ? 'Round trip' : 'One way'
  const carrierLabel = fare.carrier.trim() || 'Unknown carrier'
  const sourceLabel = fare.source.trim() || 'provider'

  return (
    <article className="card overflow-hidden rounded-2xl">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <AirlineLogo carrier={carrierLabel} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
              {tripLabel}
            </p>
            <h3 className="mt-0.5 truncate text-base font-bold leading-6 text-gray-100">
              {fare.origin} to {fare.destination}
            </h3>
            <p className="truncate text-xs leading-5 text-gray-400">
              {carrierLabel} via {sourceLabel}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StopsChip stops={fare.stops} />
              <CabinBadge cabin={fare.cabin} />
            </div>
          </div>
          <Price cents={fare.price.priceCents} currency={fare.price.currency} label={priceLabel} />
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-3.5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-[4.75rem] shrink-0 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Depart
              </p>
              {departTime && (
                <p className="mt-1 font-display text-base font-bold leading-tight text-white tabular-nums">
                  {departTime}
                </p>
              )}
              <p className="font-display text-lg font-bold leading-tight text-gray-100">
                {fare.origin}
              </p>
              <p className="text-[10px] leading-tight text-gray-600">
                {formatDate(fare.depart)}
              </p>
            </div>

            <div className="relative flex h-10 min-w-0 flex-1 items-center justify-center" aria-hidden="true">
              <div className="h-px w-full bg-white/10" />
              <span className="absolute rounded-full border border-white/10 bg-[#0C1122] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                {fare.return ? 'Return' : 'Route'}
              </span>
            </div>

            <div className="w-[4.75rem] shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {fare.return ? 'Return' : 'To'}
              </p>
              {returnTime && (
                <p className="mt-1 font-display text-base font-bold leading-tight text-white tabular-nums">
                  {returnTime}
                </p>
              )}
              <p className="font-display text-lg font-bold leading-tight text-gray-100">
                {fare.destination}
              </p>
              <p className="text-[10px] leading-tight text-gray-600">
                {formatDate(fare.return ?? fare.depart)}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="h-20 w-full rounded-xl shimmer" aria-label="Loading deal score" />
        ) : score ? (
          <DealBanner score={score} />
        ) : null}

        <div className="space-y-2">
          {hasDeeplink ? (
            <a
              href={fare.deeplink}
              target={isInternalBooking ? undefined : '_blank'}
              rel={isInternalBooking ? undefined : 'noopener noreferrer sponsored'}
              aria-label={`${ctaLabel} for ${fare.origin} to ${fare.destination}, ${priceLabel}`}
              className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-center text-sm font-bold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 ${
                isInternalBooking
                  ? 'border border-white/10 bg-white/[0.04] text-gray-100'
                  : 'bg-white text-gray-950 shadow-[0_4px_16px_rgba(255,255,255,0.08)]'
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
              className="flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-bold text-gray-500"
            >
              {ctaLabel}
            </button>
          )}
          <p className="text-center text-[11px] leading-4 text-gray-500">{ctaNote}</p>
        </div>
      </div>
    </article>
  )
}
