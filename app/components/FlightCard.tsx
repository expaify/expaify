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
    return `${month} ${parseInt(parts[2] ?? '0', 10)}, ${parts[0]}`
  }
  return dateStr
}

export default function FlightCard({ fare, score, loading }: Props) {
  // Full skeleton — no fare data yet (search in flight)
  if (!fare) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-3 w-44 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="h-8 w-16 bg-gray-200 rounded animate-pulse flex-shrink-0" />
        </div>
        <div className="flex gap-4 pt-1">
          <div className="h-3 w-10 bg-gray-100 rounded animate-pulse" />
          <div className="h-3 w-14 bg-gray-100 rounded animate-pulse" />
          <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="flex justify-end">
          <div className="h-3 w-8 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    )
  }

  const priceDisplay = `$${Math.round(fare.price.priceCents / 100)}`

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
      {/* Badge + price row */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0 flex-1">
          {loading || score === null ? (
            <>
              <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
              <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
            </>
          ) : (
            <>
              <DealBadge verdict={score.verdict} confidence={score.confidence} />
              <p className="text-xs text-gray-500 leading-relaxed">{score.explanation}</p>
            </>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <span className="text-2xl font-bold text-gray-900">{priceDisplay}</span>
        </div>
      </div>

      {/* Flight details */}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-gray-600 pt-1 border-t border-gray-100">
        <span className="font-medium text-gray-800">{fare.carrier}</span>
        <span>{formatStops(fare.stops)}</span>
        <span>{formatDate(fare.depart)}</span>
      </div>

      {/* Book link */}
      <div className="flex justify-end">
        <a
          href={fare.deeplink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-0.5 transition-colors"
        >
          Book <span aria-hidden="true">&#8594;</span>
        </a>
      </div>
    </div>
  )
}
