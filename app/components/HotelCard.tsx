'use client'

import { HotelOffer } from '@/lib/types'

type Props = {
  hotel: HotelOffer
}

function renderStars(rating: number): string {
  const clamped = Math.min(Math.max(rating, 0), 5)
  const filled = Math.round(clamped)
  const empty = 5 - filled
  return '★'.repeat(filled) + '☆'.repeat(Math.max(0, empty))
}

export default function HotelCard({ hotel }: Props) {
  const priceDisplay = `$${Math.round(hotel.pricePerNight.priceCents / 100)}`

  return (
    <div className="rounded-2xl border border-white/8 bg-gray-900 p-5 space-y-3 hover:border-indigo-500/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-100 truncate">{hotel.name}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{hotel.area}</p>
          {hotel.rating !== undefined && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-amber-400 text-sm tracking-tighter leading-none">
                {renderStars(hotel.rating)}
              </span>
              <span className="text-xs text-gray-500">{hotel.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <span className="text-2xl font-semibold text-white tabular-nums">
            {priceDisplay}
          </span>
          <p className="text-xs text-gray-500 mt-0.5">/night</p>
        </div>
      </div>

      <div className="flex justify-end border-t border-white/5 pt-3">
        <a
          href={hotel.deeplink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-full transition-colors"
        >
          View <span aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  )
}
