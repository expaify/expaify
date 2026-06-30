'use client'

import { HotelOffer } from '@/lib/types'

type Props = {
  hotel: HotelOffer
}

function ScoreBadge({ score }: { score: number }) {
  const label =
    score >= 9 ? 'Exceptional' :
    score >= 8 ? 'Excellent' :
    score >= 7 ? 'Very good' :
    score >= 6 ? 'Good' : 'Okay'
  const color =
    score >= 8 ? 'bg-emerald-600' :
    score >= 6 ? 'bg-blue-600' : 'bg-gray-600'

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <div className={`${color} rounded-lg px-2 py-1 text-center`}>
        <span className="text-sm font-bold text-white tabular-nums">{score.toFixed(1)}</span>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-200 leading-tight">{label}</p>
      </div>
    </div>
  )
}

function StarRow({ stars }: { stars: number }) {
  const filled = Math.round(Math.min(Math.max(stars, 0), 5))
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`text-sm ${i < filled ? 'text-amber-400' : 'text-white/15'}`}>★</span>
      ))}
    </div>
  )
}

export default function HotelCard({ hotel }: Props) {
  const priceWhole = Math.floor(hotel.pricePerNight.priceCents / 100)
  const priceFrac = String(hotel.pricePerNight.priceCents % 100).padStart(2, '0')

  return (
    <div className="rounded-2xl border border-white/8 bg-[#111827] hover:border-indigo-500/40 hover:bg-[#141b2d] transition-all duration-200 overflow-hidden">
      {/* Photo strip (if available) */}
      {hotel.photoUrl && (
        <div className="h-36 w-full overflow-hidden relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hotel.photoUrl}
            alt={hotel.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111827]/80 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-4">
            <StarRow stars={hotel.stars} />
          </div>
        </div>
      )}

      <div className="p-5">
        {/* No-photo star row */}
        {!hotel.photoUrl && (
          <div className="mb-2">
            <StarRow stars={hotel.stars} />
          </div>
        )}

        {/* Name + score + price */}
        <div className="flex items-start gap-3 justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-100 line-clamp-2 leading-snug">{hotel.name}</h3>
            {hotel.area && (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-gray-600 text-xs">📍</span>
                <p className="text-xs text-gray-500">{hotel.area}</p>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            {hotel.rating !== undefined && hotel.rating > 0 && (
              <ScoreBadge score={hotel.rating} />
            )}
          </div>
        </div>

        {/* Price + CTA */}
        <div className="flex items-end justify-between mt-4 pt-4 border-t border-white/5">
          <div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-xs text-gray-500">$</span>
              <span className="text-2xl font-bold text-white tabular-nums">{priceWhole}</span>
              <span className="text-xs text-gray-500">.{priceFrac}</span>
            </div>
            <p className="text-[11px] text-gray-600">per night</p>
          </div>

          <a
            href={hotel.deeplink}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            See availability
            <span className="text-indigo-300 text-xs" aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </div>
  )
}
