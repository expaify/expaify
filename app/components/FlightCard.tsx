'use client'

import { NormalizedFare, DealScore } from '@/lib/types'
import DealBadge from './DealBadge'

type Props = {
  fare?: NormalizedFare
  score: DealScore | null
  loading: boolean
}

function formatStops(stops: number): string {
  if (stops === 0) return 'Nonstop'
  if (stops === 1) return '1 stop'
  return `${stops} stops`
}

function formatDate(dateStr: string): string {
  const datePart = dateStr.split('T')[0]
  const parts = datePart.split('-')
  if (parts.length === 3) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ]
    const monthIndex = parseInt(parts[1] ?? '0', 10) - 1
    const month = months[monthIndex] ?? parts[1]
    return `${month} ${parseInt(parts[2] ?? '0', 10)}`
  }
  return dateStr
}

const SOURCE_BADGE: Record<string, { label: string; classes: string }> = {
  duffel:         { label: 'Live',  classes: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' },
  travelpayouts:  { label: 'TP',    classes: 'bg-white/5 text-gray-500 border border-white/10' },
  amadeus:        { label: 'GDS',   classes: 'bg-violet-500/10 text-violet-400 border border-violet-500/20' },
  kiwi:           { label: 'Kiwi',  classes: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
}

function SourceBadge({ source }: { source: string }) {
  const badge = SOURCE_BADGE[source]
  if (!badge) return null
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded tracking-wide ${badge.classes}`}>
      {badge.label}
    </span>
  )
}

export default function FlightCard({ fare, score, loading }: Props) {
  // Full skeleton — no fare data yet (search in flight)
  if (!fare) {
    return (
      <div className="rounded-2xl border border-white/8 bg-gray-900 p-5 space-y-4 animate-pulse">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2.5 flex-1">
            <div className="h-4 w-32 bg-white/10 rounded-full" />
            <div className="h-5 w-20 bg-white/10 rounded-full" />
            <div className="h-3 w-48 bg-white/5 rounded" />
          </div>
          <div className="h-9 w-20 bg-white/10 rounded flex-shrink-0" />
        </div>
        <div className="flex gap-4 pt-3 border-t border-white/5">
          <div className="h-3 w-16 bg-white/5 rounded" />
          <div className="h-3 w-12 bg-white/5 rounded" />
          <div className="h-3 w-16 bg-white/5 rounded" />
        </div>
        <div className="flex justify-end">
          <div className="h-6 w-16 bg-white/10 rounded-full" />
        </div>
      </div>
    )
  }

  const priceDisplay = `$${Math.round(fare.price.priceCents / 100)}`

  return (
    <div className="rounded-2xl border border-white/8 bg-gray-900 p-5 space-y-3 hover:border-indigo-500/50 transition-colors">
      {/* Route + price row */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-gray-100 truncate">
            {fare.origin} → {fare.destination}
          </p>
          {loading || score === null ? (
            <div className="mt-2 space-y-1.5">
              <div className="h-5 w-20 bg-white/10 rounded-full animate-pulse" />
              <div className="h-3 w-48 bg-white/5 rounded animate-pulse" />
            </div>
          ) : (
            <div className="mt-1.5">
              <DealBadge verdict={score.verdict} confidence={score.confidence} />
              <p className="text-xs text-gray-500 leading-relaxed mt-1 line-clamp-2">
                {score.explanation}
              </p>
              <div className="mt-2">
                <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      score.verdict === 'Great' ? 'bg-green-500' :
                      score.verdict === 'Good'  ? 'bg-blue-500'  : 'bg-gray-600'
                    }`}
                    style={{ width: `${score.percentile}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  {score.percentile}th percentile · {score.pctVsMedian > 0 ? '+' : ''}{score.pctVsMedian}% vs median
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <span className="text-3xl font-semibold text-white tabular-nums">
            {priceDisplay}
          </span>
        </div>
      </div>

      {/* Flight details */}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm border-t border-white/5 pt-3 items-center">
        <span className="font-medium text-gray-300">{fare.carrier}</span>
        <span className="text-gray-500">{formatStops(fare.stops)}</span>
        <span className="text-gray-500">{formatDate(fare.depart)}</span>
        {fare.return && <span className="text-gray-500">↩ {formatDate(fare.return)}</span>}
        <SourceBadge source={fare.source} />
      </div>

      {/* Book button */}
      <div className="flex justify-end">
        <a
          href={fare.deeplink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-full transition-colors"
        >
          Book <span aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  )
}
