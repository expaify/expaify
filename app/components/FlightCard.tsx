'use client'

import { useState } from 'react'
import { NormalizedFare, DealScore } from '@/lib/types'

type Props = {
  fare?: NormalizedFare
  score: DealScore | null
  loading: boolean
}

function parseDateTime(s: string): { date: string; time: string } {
  if (s.includes('T')) {
    const d = new Date(s)
    const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    return { date, time }
  }
  const [y, m, day] = s.split('-').map(Number)
  const d = new Date(y, (m ?? 1) - 1, day ?? 1)
  return {
    date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    time: '',
  }
}

function StopsChip({ stops }: { stops: number }) {
  if (stops === 0)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Nonstop
      </span>
    )
  if (stops === 1)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> 1 stop
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-400 tracking-wide">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> {stops} stops
    </span>
  )
}

function AirlineLogo({ carrier }: { carrier: string }) {
  const [imgFailed, setImgFailed] = useState(false)
  const code = carrier.trim().toUpperCase().slice(0, 3)
  const iataCode = carrier.length <= 3 ? carrier.toUpperCase() : null

  if (iataCode && !imgFailed) {
    return (
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://images.kiwi.com/airlines/64/${iataCode}.png`}
          alt={iataCode}
          width={28}
          height={28}
          className="w-7 h-7 object-contain"
          onError={() => setImgFailed(true)}
        />
      </div>
    )
  }

  return (
    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-extrabold text-indigo-400 tracking-tighter font-display">
        {code.slice(0, 2)}
      </span>
    </div>
  )
}

function DealBanner({ score }: { score: DealScore }) {
  const isGreat = score.verdict === 'Great'
  const isGood  = score.verdict === 'Good'
  if (!isGreat && !isGood) return null

  const savings = Math.abs(Math.round(score.pctVsMedian))
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${
        isGreat
          ? 'bg-emerald-500/10 border border-emerald-500/20'
          : 'bg-blue-500/10 border border-blue-500/20'
      }`}
    >
      <span className="text-lg leading-none">{isGreat ? '🔥' : '✈️'}</span>
      <div className="min-w-0">
        <p className={`text-xs font-bold ${isGreat ? 'text-emerald-400' : 'text-blue-400'}`}>
          {isGreat ? 'Great deal' : 'Good price'}
          {savings > 0 && ` — ${savings}% below average`}
        </p>
        {score.explanation && (
          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{score.explanation}</p>
        )}
      </div>
      {score.confidence === 'low' && (
        <span className="ml-auto text-[10px] text-gray-600 italic flex-shrink-0">est.</span>
      )}
    </div>
  )
}

export default function FlightCard({ fare, score, loading }: Props) {
  /* ── Skeleton ─────────────────────────────────────────────────────── */
  if (!fare) {
    return (
      <div className="card rounded-2xl overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl shimmer" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-28 rounded-lg shimmer" />
              <div className="h-3 w-16 rounded shimmer" />
            </div>
            <div className="space-y-1.5 flex-shrink-0 text-right">
              <div className="h-8 w-20 rounded-lg shimmer" />
              <div className="h-2.5 w-14 rounded shimmer ml-auto" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-5 w-12 rounded shimmer" />
            <div className="flex-1 h-px shimmer" />
            <div className="h-3 w-16 rounded shimmer" />
            <div className="flex-1 h-px shimmer" />
            <div className="h-5 w-12 rounded shimmer" />
          </div>
          <div className="h-9 w-full rounded-xl shimmer" />
          <div className="h-10 w-full rounded-xl shimmer" />
        </div>
      </div>
    )
  }

  /* ── Live card ────────────────────────────────────────────────────── */
  const dep = parseDateTime(fare.depart)
  const ret = fare.return ? parseDateTime(fare.return) : null
  const priceWhole = Math.floor(fare.price.priceCents / 100).toLocaleString('en-US')
  const priceCents = String(fare.price.priceCents % 100).padStart(2, '0')

  return (
    <div className="card rounded-2xl overflow-hidden">
      {/* Header: airline + price */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-0">
        <AirlineLogo carrier={fare.carrier} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-100 truncate leading-tight">{fare.carrier}</p>
          <div className="mt-0.5">
            <StopsChip stops={fare.stops} />
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="flex items-baseline justify-end gap-px">
            <span className="text-sm font-medium text-gray-500">$</span>
            <span className="text-3xl font-extrabold text-white tabular-nums tracking-tight font-display leading-none">
              {priceWhole}
            </span>
            <span className="text-sm font-medium text-gray-500">.{priceCents}</span>
          </div>
          <p className="text-[10px] text-gray-600 font-medium mt-0.5">per person</p>
        </div>
      </div>

      {/* Route timeline */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          {/* Origin */}
          <div className="min-w-0 text-center" style={{ minWidth: '52px' }}>
            {dep.time && (
              <p className="text-base font-bold text-white tabular-nums font-display leading-tight">
                {dep.time}
              </p>
            )}
            <p className={`font-bold text-gray-100 ${dep.time ? 'text-xs' : 'text-base font-display'}`}>
              {fare.origin}
            </p>
            <p className="text-[10px] text-gray-600 leading-tight">{dep.date}</p>
          </div>

          {/* Line */}
          <div className="flex-1 flex flex-col items-center gap-0.5">
            <div className="relative w-full flex items-center justify-center">
              <div className="w-full h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
              <span className="absolute text-indigo-400 text-sm leading-none">✈</span>
            </div>
          </div>

          {/* Destination */}
          <div className="min-w-0 text-center" style={{ minWidth: '52px' }}>
            {ret?.time && (
              <p className="text-base font-bold text-white tabular-nums font-display leading-tight">
                {ret.time}
              </p>
            )}
            <p className={`font-bold text-gray-100 ${ret?.time ? 'text-xs' : 'text-base font-display'}`}>
              {fare.destination}
            </p>
            {ret && (
              <p className="text-[10px] text-gray-600 leading-tight">{ret.date}</p>
            )}
          </div>
        </div>
      </div>

      {/* Deal banner */}
      <div className="px-5 pb-3 min-h-[3rem]">
        {loading ? (
          <div className="rounded-xl shimmer h-10 w-full" />
        ) : score ? (
          <DealBanner score={score} />
        ) : null}
      </div>

      {/* CTA */}
      <div className="px-5 pb-5">
        <a
          href={fare.deeplink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-bold text-white transition-all"
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #5b21b6 100%)',
            boxShadow: '0 4px 16px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          Book flight
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 7h8M8 4l3 3-3 3" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
      </div>
    </div>
  )
}
