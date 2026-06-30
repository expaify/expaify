'use client'

import { NormalizedFare, DealScore } from '@/lib/types'

type Props = {
  fare?: NormalizedFare
  score: DealScore | null
  loading: boolean
}

function formatTime(dateStr: string): string {
  // dateStr might be "2024-06-15" or "2024-06-15T10:00:00"
  if (dateStr.includes('T')) {
    const t = new Date(dateStr)
    return t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  }
  return ''
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr.split('T')[0] + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function airlineInitials(carrier: string): string {
  return carrier.replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase()
}

function AirlineLogo({ carrier }: { carrier: string }) {
  // Try IATA code for known carriers — fallback to styled initials
  const code = carrier.length <= 3 ? carrier.toUpperCase() : null
  if (code) {
    return (
      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0 overflow-hidden">
        <span className="text-[10px] font-bold text-gray-300 tracking-tight">{code}</span>
      </div>
    )
  }
  return (
    <div className="w-9 h-9 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] font-bold text-indigo-400">{airlineInitials(carrier)}</span>
    </div>
  )
}

function StopsBadge({ stops }: { stops: number }) {
  if (stops === 0) return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
      Nonstop
    </span>
  )
  if (stops === 1) return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
      1 stop
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
      {stops} stops
    </span>
  )
}

function DealBanner({ score }: { score: DealScore }) {
  const isGreat = score.verdict === 'Great'
  const isGood = score.verdict === 'Good'
  if (!isGreat && !isGood) return null

  const savings = Math.abs(Math.round(score.pctVsMedian))

  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
      isGreat
        ? 'bg-emerald-500/10 border border-emerald-500/20'
        : 'bg-blue-500/10 border border-blue-500/20'
    }`}>
      <span className="text-base">{isGreat ? '🔥' : '✈️'}</span>
      <div className="min-w-0">
        <p className={`text-xs font-semibold ${isGreat ? 'text-emerald-400' : 'text-blue-400'}`}>
          {isGreat ? 'Great deal' : 'Good price'} — {savings > 0 ? `${savings}% below avg` : 'near average'}
        </p>
        <p className="text-[11px] text-gray-500 truncate">{score.explanation}</p>
      </div>
    </div>
  )
}

export default function FlightCard({ fare, score, loading }: Props) {
  if (!fare) {
    return (
      <div className="rounded-2xl border border-white/8 bg-[#111827] p-5 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-28 bg-white/10 rounded" />
            <div className="h-3 w-16 bg-white/5 rounded" />
          </div>
          <div className="h-8 w-16 bg-white/10 rounded-xl" />
        </div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-14 bg-white/10 rounded" />
          <div className="flex-1 h-px bg-white/5" />
          <div className="h-3 w-12 bg-white/5 rounded" />
          <div className="flex-1 h-px bg-white/5" />
          <div className="h-5 w-14 bg-white/10 rounded" />
        </div>
        <div className="h-9 w-full bg-white/5 rounded-xl" />
      </div>
    )
  }

  const departTime = formatTime(fare.depart)
  const returnTime = fare.return ? formatTime(fare.return) : null
  const departDate = formatDate(fare.depart)
  const returnDate = fare.return ? formatDate(fare.return) : null
  const priceWhole = Math.floor(fare.price.priceCents / 100)
  const priceFrac = String(fare.price.priceCents % 100).padStart(2, '0')

  return (
    <div className="rounded-2xl border border-white/8 bg-[#111827] hover:border-indigo-500/40 hover:bg-[#141b2d] transition-all duration-200 overflow-hidden">
      {/* Top row: airline + price */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <AirlineLogo carrier={fare.carrier} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-100 truncate">{fare.carrier}</p>
          <StopsBadge stops={fare.stops} />
        </div>
        <div className="text-right flex-shrink-0">
          <div className="flex items-baseline gap-0.5 justify-end">
            <span className="text-sm text-gray-400">$</span>
            <span className="text-3xl font-bold text-white tabular-nums tracking-tight">{priceWhole}</span>
            <span className="text-sm text-gray-400">.{priceFrac}</span>
          </div>
          <p className="text-[11px] text-gray-600 text-right">per person</p>
        </div>
      </div>

      {/* Route timeline */}
      <div className="px-5 pb-3">
        <div className="flex items-center gap-2">
          {/* Outbound */}
          <div className="text-center min-w-[52px]">
            {departTime && <p className="text-base font-bold text-white tabular-nums">{departTime}</p>}
            <p className={`font-semibold text-gray-200 ${departTime ? 'text-xs' : 'text-sm'}`}>{fare.origin}</p>
            <p className="text-[10px] text-gray-600">{departDate}</p>
          </div>

          {/* Flight line */}
          <div className="flex-1 flex flex-col items-center gap-1">
            <div className="relative w-full flex items-center">
              <div className="flex-1 h-px bg-gradient-to-r from-white/10 via-indigo-500/40 to-white/10" />
              <span className="absolute left-1/2 -translate-x-1/2 text-indigo-400 text-xs">✈</span>
            </div>
          </div>

          {/* Destination */}
          <div className="text-center min-w-[52px]">
            {returnTime && <p className="text-base font-bold text-white tabular-nums">{returnTime}</p>}
            <p className={`font-semibold text-gray-200 ${returnTime ? 'text-xs' : 'text-sm'}`}>{fare.destination}</p>
            {returnDate && returnDate !== departDate && (
              <p className="text-[10px] text-gray-600">{returnDate}</p>
            )}
          </div>
        </div>
      </div>

      {/* Deal banner (only shows for Great/Good) */}
      {loading && (
        <div className="mx-5 mb-3 rounded-xl bg-white/5 border border-white/8 h-11 animate-pulse" />
      )}
      {!loading && score && (
        <div className="px-5 pb-3">
          <DealBanner score={score} />
        </div>
      )}

      {/* Book CTA */}
      <div className="px-5 pb-5">
        <a
          href={fare.deeplink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-4 py-3 text-sm font-semibold text-white transition-colors"
        >
          Book flight
          <span className="text-indigo-300" aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  )
}
