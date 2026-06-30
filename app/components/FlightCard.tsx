'use client'

import { useState } from 'react'
import { DealScore, NormalizedFare } from '@/lib/types'

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
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Nonstop
      </span>
    )
  }

  if (stops === 1) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        1 stop
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400">
      <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
      {stops} stops
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
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/8 bg-white/5">
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

function Price({ cents }: { cents: number }) {
  const whole = Math.floor(cents / 100).toLocaleString('en-US')
  const fractional = String(Math.abs(cents % 100)).padStart(2, '0')

  return (
    <div className="shrink-0 text-right">
      <div className="flex items-baseline justify-end gap-px">
        <span className="text-sm font-medium text-gray-500">$</span>
        <span className="font-display text-3xl font-extrabold leading-none text-white tabular-nums">
          {whole}
        </span>
        <span className="text-sm font-medium text-gray-500">.{fractional}</span>
      </div>
      <p className="mt-0.5 text-[10px] font-medium text-gray-600">per person</p>
    </div>
  )
}

function DealBanner({ score }: { score: DealScore }) {
  if (score.verdict === 'Typical') return null

  const isGreat = score.verdict === 'Great'
  const belowAverage = Math.max(0, Math.abs(Math.round(score.pctVsMedian)))

  return (
    <div
      className={`flex h-10 items-center gap-2.5 rounded-xl px-3 ${
        isGreat
          ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
          : 'border border-blue-500/20 bg-blue-500/10 text-blue-400'
      }`}
    >
      <span className="text-base leading-none">{isGreat ? '🔥' : '✈️'}</span>
      <p className="truncate text-xs font-bold">
        {isGreat ? 'Great deal' : 'Good price'} — {belowAverage}% below average
      </p>
    </div>
  )
}

export default function FlightCard({ fare, score, loading }: Props) {
  if (fare === undefined) {
    return (
      <div className="card rounded-2xl overflow-hidden">
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl shimmer" />
            <div className="h-7 w-28 rounded-lg shimmer" />
            <div className="ml-auto h-8 w-20 rounded-lg shimmer" />
          </div>
          <div className="h-5 w-full rounded-lg shimmer" />
          <div className="h-10 w-full rounded-xl shimmer" />
          <div className="h-12 w-full rounded-xl shimmer" />
        </div>
      </div>
    )
  }

  const departTime = formatTime(fare.depart)
  const returnTime = fare.return ? formatTime(fare.return) : ''

  return (
    <div className="card rounded-2xl overflow-hidden">
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <AirlineLogo carrier={fare.carrier} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-100">
              {fare.carrier}
            </p>
            <StopsChip stops={fare.stops} />
          </div>
          <Price cents={fare.price.priceCents} />
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-white/[0.025] px-3 py-3">
          <div className="w-16 shrink-0 text-left">
            {departTime && (
              <p className="font-display text-base font-bold leading-tight text-white tabular-nums">
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

          <div className="relative flex h-8 min-w-0 flex-1 items-center justify-center">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />
            <span className="absolute rounded-full bg-[#0C1122] px-1.5 text-sm leading-none text-indigo-300">
              ✈
            </span>
          </div>

          <div className="w-16 shrink-0 text-right">
            {returnTime && (
              <p className="font-display text-base font-bold leading-tight text-white tabular-nums">
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

        {loading ? (
          <div className="h-10 w-full rounded-xl shimmer" />
        ) : score ? (
          <DealBanner score={score} />
        ) : null}

        <a
          href={fare.deeplink}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#6366f1,#5b21b6)] text-sm font-bold text-white shadow-[0_4px_16px_rgba(99,102,241,0.35)] transition-opacity hover:opacity-90"
        >
          Book flight
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </div>
  )
}
