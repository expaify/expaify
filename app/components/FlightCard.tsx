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
              <p className="text-xs text-gray-500 leading-relaxed mt-1">
                {score.explanation}
              </p>
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
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm border-t border-white/5 pt-3">
        <span className="font-medium text-gray-300">{fare.carrier}</span>
        <span className="text-gray-500">{formatStops(fare.stops)}</span>
        <span className="text-gray-500">{formatDate(fare.depart)}</span>
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
