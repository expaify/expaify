'use client'

import { HotelOffer } from '@/lib/types'

type Props = { hotel: HotelOffer }

function StarRow({ stars }: { stars: number }) {
  const filled = Math.min(Math.round(stars), 5)
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M6 1l1.39 2.82L10.5 4.27l-2.25 2.19.53 3.09L6 8l-2.78 1.55.53-3.09L1.5 4.27l3.11-.45L6 1z"
            fill={i < filled ? '#f59e0b' : 'rgba(255,255,255,0.1)'}
          />
        </svg>
      ))}
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const label =
    score >= 9.0 ? 'Exceptional' :
    score >= 8.5 ? 'Excellent' :
    score >= 8.0 ? 'Very good' :
    score >= 7.0 ? 'Good' :
    score >= 6.0 ? 'Okay' : 'Fair'

  const bg =
    score >= 8.0 ? 'bg-emerald-600' :
    score >= 6.5 ? 'bg-blue-600' : 'bg-gray-600'

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <div>
        <p className="text-[11px] font-semibold text-gray-300 text-right leading-tight">{label}</p>
      </div>
      <div className={`${bg} rounded-lg w-9 h-9 flex items-center justify-center flex-shrink-0`}>
        <span className="text-sm font-extrabold text-white font-display tabular-nums">
          {score.toFixed(1)}
        </span>
      </div>
    </div>
  )
}

export default function HotelCard({ hotel }: Props) {
  const priceWhole = Math.floor(hotel.pricePerNight.priceCents / 100).toLocaleString('en-US')
  const priceCents = String(hotel.pricePerNight.priceCents % 100).padStart(2, '0')

  return (
    <div className="card rounded-2xl overflow-hidden flex flex-col">
      {/* Photo */}
      {hotel.photoUrl ? (
        <div className="relative h-40 w-full flex-shrink-0 bg-gray-800 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hotel.photoUrl}
            alt={hotel.name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0C1122] via-[#0C1122]/30 to-transparent" />
          <div className="absolute bottom-3 left-4">
            <StarRow stars={hotel.stars} />
          </div>
        </div>
      ) : (
        /* No-photo placeholder with gradient */
        <div className="h-24 w-full flex-shrink-0 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.08) 100%)' }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl opacity-20">🏨</span>
          </div>
          <div className="absolute bottom-3 left-4">
            <StarRow stars={hotel.stars} />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-5 flex flex-col">
        {/* Name + score */}
        <div className="flex items-start gap-3 justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-gray-100 line-clamp-2 leading-snug font-display">
              {hotel.name}
            </h3>
            {hotel.area && (
              <div className="flex items-center gap-1 mt-1.5">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M6 1C4.07 1 2.5 2.57 2.5 4.5c0 2.63 3.5 6.5 3.5 6.5s3.5-3.87 3.5-6.5C9.5 2.57 7.93 1 6 1zm0 4.75a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z"
                    fill="rgba(100,116,139,0.8)"/>
                </svg>
                <p className="text-xs text-gray-500 truncate">{hotel.area}</p>
              </div>
            )}
          </div>
          {hotel.rating !== undefined && hotel.rating > 0 && (
            <ScoreBadge score={hotel.rating} />
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Price + CTA */}
        <div className="flex items-end justify-between mt-4 pt-4 border-t border-white/5">
          <div>
            <div className="flex items-baseline gap-px">
              <span className="text-xs font-medium text-gray-500">$</span>
              <span className="text-2xl font-extrabold text-white tabular-nums tracking-tight font-display leading-tight">
                {priceWhole}
              </span>
              <span className="text-xs font-medium text-gray-500">.{priceCents}</span>
            </div>
            <p className="text-[10px] text-gray-600 font-medium">per night</p>
          </div>

          <a
            href={hotel.deeplink}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #5b21b6 100%)',
              boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
            }}
          >
            See availability
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7h8M8 4l3 3-3 3" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}
