'use client'

import { HotelOffer } from '@/lib/types'

type Props = {
  hotel: HotelOffer
}

export default function HotelCard({ hotel }: Props) {
  const priceDisplay = `$${Math.round(hotel.pricePerNight.priceCents / 100)}/night`

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 truncate">{hotel.name}</h3>
          <p className="text-sm text-gray-500">{hotel.area}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <span className="text-xl font-bold text-gray-900">{priceDisplay}</span>
          {hotel.rating !== undefined && (
            <p className="text-xs text-gray-500 mt-0.5">
              &#9733; {hotel.rating}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end border-t border-gray-100 pt-2">
        <a
          href={hotel.deeplink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-0.5 transition-colors"
        >
          View <span aria-hidden="true">&#8594;</span>
        </a>
      </div>
    </div>
  )
}
