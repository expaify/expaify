'use client'

import { DealScore, HotelOffer } from '@/lib/types'
import DealBadge from './DealBadge'

type Props = {
  hotel: HotelOffer
  score?: DealScore | null
  loading?: boolean
}

function StarRow({ stars }: { stars: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(stars)))

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, index) => (
        <svg key={index} width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M6 1l1.39 2.82 3.11.45-2.25 2.19.53 3.09L6 8 3.22 9.55l.53-3.09L1.5 4.27l3.11-.45L6 1z"
            className={index < filled ? 'fill-amber-400' : 'fill-white/20'}
          />
        </svg>
      ))}
    </div>
  )
}

function RatingBadge({ rating }: { rating: number }) {
  const label = rating >= 8.5 ? 'Excellent' : rating >= 8 ? 'Very good' : 'Good'
  const color = rating >= 8.5
    ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25'
    : rating >= 8
      ? 'bg-blue-500/15 text-blue-300 ring-blue-500/25'
      : 'bg-gray-500/15 text-gray-300 ring-gray-500/25'

  return (
    <div className="mt-4 flex items-center gap-2">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${color}`}>
        <span className="font-display text-sm font-extrabold tabular-nums">
          {rating.toFixed(1)}
        </span>
      </div>
      <p className="text-xs font-semibold text-gray-300">{label}</p>
    </div>
  )
}

function Price({ cents }: { cents: number }) {
  const whole = Math.floor(cents / 100).toLocaleString('en-US')
  const fractional = String(Math.abs(cents % 100)).padStart(2, '0')

  return (
    <div>
      <div className="flex items-baseline gap-px">
        <span className="text-xs font-medium text-gray-500">$</span>
        <span className="font-display text-2xl font-extrabold leading-none text-white tabular-nums">
          {whole}
        </span>
        <span className="text-xs font-medium text-gray-500">.{fractional}</span>
      </div>
      <p className="mt-0.5 text-[10px] font-medium text-gray-600">per night</p>
    </div>
  )
}

function PriceUnavailable() {
  return (
    <div>
      <p className="font-display text-lg font-extrabold leading-none text-gray-400">
        Price unavailable
      </p>
      <p className="mt-1 text-[10px] font-medium text-gray-600">
        per-night rate not confirmed
      </p>
    </div>
  )
}

function formatMoney(cents: number, currency: string) {
  const roundedCents = Math.round(cents)
  const amount = roundedCents / 100

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: roundedCents % 100 === 0 ? 0 : 2,
  }).format(amount)
}

function formatPctVsMedian(pctVsMedian: number) {
  const rounded = Math.round(pctVsMedian)
  if (rounded === 0) return 'At usual price'

  return `${Math.abs(rounded)}% ${rounded < 0 ? 'below' : 'above'} usual`
}

function HotelDealPanel({ score }: { score: DealScore }) {
  const isLowConfidence = score.confidence === 'low'
  const panelClasses = isLowConfidence
    ? 'border-amber-500/20 bg-amber-500/10'
    : score.verdict === 'Great'
      ? 'border-emerald-500/20 bg-emerald-500/10'
      : score.verdict === 'Good'
        ? 'border-blue-500/20 bg-blue-500/10'
        : 'border-white/10 bg-white/[0.035]'
  const percentileLabel = isLowConfidence
    ? 'Not enough hotel history for a confirmed deal rating'
    : `${Math.round(score.percentile)}th percentile`
  const usualPrice = score.medianCents > 0
    ? formatMoney(score.medianCents, score.currency)
    : 'Unavailable'

  return (
    <div className={`mt-3 flex flex-col gap-2 rounded-xl border px-3 py-3 ${panelClasses}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Deal Score
          </p>
          <p className="mt-0.5 text-xs font-medium leading-5 text-gray-300">
            {percentileLabel}
          </p>
        </div>
        <DealBadge verdict={score.verdict} confidence={score.confidence} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
            Usual
          </p>
          <p className="font-semibold text-gray-300">{usualPrice}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
            Vs median
          </p>
          <p className="font-semibold text-gray-300">{formatPctVsMedian(score.pctVsMedian)}</p>
        </div>
      </div>
      {isLowConfidence && (
        <p className="text-xs leading-5 text-amber-200/80">
          Limited hotel history. Treat this as a rough comparison, not a confirmed deal.
        </p>
      )}
      <p className="text-xs leading-5 text-gray-300">{score.explanation}</p>
    </div>
  )
}

function isValidBookingUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export default function HotelCard({ hotel, score = null, loading = false }: Props) {
  const hasBookingUrl = isValidBookingUrl(hotel.deeplink)
  const hasValidPrice = Number.isInteger(hotel.pricePerNight.priceCents) && hotel.pricePerNight.priceCents > 0
  const canBook = hasBookingUrl && hasValidPrice

  return (
    <div className="card rounded-2xl overflow-hidden flex flex-col">
      {hotel.photoUrl ? (
        <div className="relative h-40 w-full shrink-0 overflow-hidden bg-gray-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hotel.photoUrl}
            alt={hotel.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0C1122] via-[#0C1122]/35 to-transparent" />
          <div className="absolute bottom-3 left-4">
            <StarRow stars={hotel.stars} />
          </div>
        </div>
      ) : (
        <div className="relative h-24 w-full shrink-0 overflow-hidden bg-gradient-to-br from-indigo-500/15 to-violet-500/10">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl opacity-20">🏨</span>
          </div>
          <div className="absolute bottom-3 left-4">
            <StarRow stars={hotel.stars} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display line-clamp-2 text-sm font-bold leading-snug text-gray-100">
          {hotel.name}
        </h3>

        {loading ? (
          <div className="mt-3 h-6 w-24 rounded-full shimmer" />
        ) : score ? (
          <HotelDealPanel score={score} />
        ) : null}

        {hotel.area && (
          <div className="mt-1.5 flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0 text-gray-500">
              <path d="M6 1C4.07 1 2.5 2.57 2.5 4.5c0 2.63 3.5 6.5 3.5 6.5s3.5-3.87 3.5-6.5C9.5 2.57 7.93 1 6 1zm0 4.75a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" fill="currentColor" />
            </svg>
            <p className="truncate text-xs text-gray-500">{hotel.area}</p>
          </div>
        )}

        {hotel.rating !== undefined && hotel.rating > 0 && (
          <RatingBadge rating={hotel.rating} />
        )}

        <div className="flex-1" />

        <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/5 pt-4">
          {hasValidPrice ? (
            <Price cents={hotel.pricePerNight.priceCents} />
          ) : (
            <PriceUnavailable />
          )}
          <div className="flex shrink-0 flex-col items-end gap-1">
            {canBook ? (
              <>
                <a
                  href={hotel.deeplink}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="inline-flex items-center justify-center rounded-xl bg-[linear-gradient(135deg,#6366f1,#5b21b6)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_4px_16px_rgba(99,102,241,0.35)] transition-opacity hover:opacity-90"
                >
                  Book hotel →
                </a>
                <p className="text-[10px] font-medium text-gray-600">via HotelLook</p>
              </>
            ) : (
              <>
                <span className="inline-flex items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] px-4 py-2.5 text-sm font-bold text-gray-500">
                  Booking unavailable
                </span>
                <p className="max-w-28 text-right text-[10px] font-medium text-gray-600">
                  {hasBookingUrl ? 'No confirmed price' : 'No valid booking link'}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
