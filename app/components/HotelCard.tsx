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
    <div className="flex items-center gap-0.5" role="img" aria-label={`${filled} out of 5 stars`}>
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
    <div className="flex items-center gap-2">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${color}`}>
        <span className="font-display text-sm font-extrabold tabular-nums">
          {rating.toFixed(1)}
        </span>
      </div>
      <p className="text-xs font-semibold text-gray-300">{label}</p>
    </div>
  )
}

function Price({ price }: { price: HotelOffer['pricePerNight'] }) {
  const roundedCents = Math.round(price.priceCents)
  const amount = roundedCents / 100
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currency,
    maximumFractionDigits: roundedCents % 100 === 0 ? 0 : 2,
  }).format(amount)

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
        Nightly rate
      </p>
      <p className="mt-1 font-display text-3xl font-extrabold leading-none text-white tabular-nums">
        {formatted}
      </p>
      <p className="mt-1 text-xs font-medium text-gray-500">per night before taxes and fees</p>
    </div>
  )
}

function PriceUnavailable({ reason }: { reason: string }) {
  return (
    <div className="min-w-0" role="status" aria-label={`Hotel price unavailable. ${reason}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
        Nightly rate
      </p>
      <p className="mt-1 font-display text-lg font-extrabold leading-none text-gray-300">
        Price unavailable
      </p>
      <p className="mt-1 text-xs font-medium leading-5 text-gray-500">
        {reason}
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

function formatOrdinal(value: number) {
  const rounded = Math.round(value)
  const mod100 = rounded % 100

  if (mod100 >= 11 && mod100 <= 13) return `${rounded}th`

  switch (rounded % 10) {
    case 1:
      return `${rounded}st`
    case 2:
      return `${rounded}nd`
    case 3:
      return `${rounded}rd`
    default:
      return `${rounded}th`
  }
}

function getUnavailableReason(hasBookingUrl: boolean, hasValidPrice: boolean) {
  if (!hasValidPrice && !hasBookingUrl) {
    return 'No confirmed nightly price or valid booking link was returned.'
  }

  if (!hasValidPrice) {
    return 'No confirmed nightly price was returned.'
  }

  return 'No valid booking link was returned.'
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
    : `${formatOrdinal(score.percentile)} percentile`
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
  const unavailableReason = getUnavailableReason(hasBookingUrl, hasValidPrice)
  const hasRating = hotel.rating !== undefined && hotel.rating > 0

  return (
    <div className="card flex flex-col overflow-hidden rounded-2xl">
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
        </div>
      ) : (
        <div className="flex h-24 w-full shrink-0 items-end border-b border-white/5 bg-white/[0.025] px-5 pb-4">
          <p className="text-xs font-semibold text-gray-500">Hotel photo unavailable</p>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <div className="space-y-3">
          <div>
            <h3 className="font-display line-clamp-2 text-base font-bold leading-snug text-gray-100">
              {hotel.name}
            </h3>

            {hotel.area && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0 text-gray-500">
                  <path d="M6 1C4.07 1 2.5 2.57 2.5 4.5c0 2.63 3.5 6.5 3.5 6.5s3.5-3.87 3.5-6.5C9.5 2.57 7.93 1 6 1zm0 4.75a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" fill="currentColor" />
                </svg>
                <p className="truncate text-xs font-medium text-gray-400">{hotel.area}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-white/[0.025] px-3 py-3">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                Hotel class
              </p>
              <StarRow stars={hotel.stars} />
            </div>
            {hasRating && (
              <div className="border-l border-white/10 pl-4">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                  Guest rating
                </p>
                <RatingBadge rating={hotel.rating as number} />
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="mt-4 h-24 w-full rounded-xl shimmer" />
        ) : score ? (
          <HotelDealPanel score={score} />
        ) : null}

        <div className="flex-1" />

        <div className="mt-4 flex flex-col gap-4 border-t border-white/5 pt-4 sm:flex-row sm:items-end sm:justify-between">
          {hasValidPrice ? (
            <Price price={hotel.pricePerNight} />
          ) : (
            <PriceUnavailable reason={unavailableReason} />
          )}
          <div className="flex w-full shrink-0 flex-col gap-1 sm:w-auto sm:items-end">
            {canBook ? (
              <>
                <a
                  href={hotel.deeplink}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  aria-label={`Book ${hotel.name} on HotelLook`}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#6366f1,#5b21b6)] px-4 text-sm font-bold text-white shadow-[0_4px_16px_rgba(99,102,241,0.35)] transition-opacity hover:opacity-90 sm:w-auto"
                >
                  Book hotel
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                <p className="text-center text-[11px] font-medium text-gray-500 sm:text-right">
                  via HotelLook
                </p>
              </>
            ) : (
              <>
                <span
                  className="flex h-12 w-full items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] px-4 text-sm font-bold text-gray-400 sm:w-auto"
                  role="status"
                  aria-label={`Booking unavailable for ${hotel.name}. ${unavailableReason}`}
                >
                  Booking unavailable
                </span>
                <p className="text-center text-xs font-medium leading-5 text-gray-500 sm:max-w-48 sm:text-right">
                  {unavailableReason}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
