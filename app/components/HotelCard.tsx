'use client'

import { DealScore, HotelOffer } from '@/lib/types'
import { formatMoney, isValidMoney } from '@/lib/money'
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
            className={index < filled ? 'fill-amber-400' : 'fill-[color:var(--border-strong)]'}
          />
        </svg>
      ))}
    </div>
  )
}

function RatingBadge({ rating }: { rating: number }) {
  const label = rating >= 8.5 ? 'Excellent' : rating >= 8 ? 'Very good' : 'Good'
  const color = rating >= 8.5
    ? 'bg-[color:var(--success-soft)] text-[color:var(--success)] ring-[color:var(--border-strong)]'
    : rating >= 8
      ? 'bg-[color:var(--brand-soft)] text-[color:var(--brand)] ring-[color:var(--border-strong)]'
      : 'bg-[color:var(--bg-muted)] text-[color:var(--text-2)] ring-[color:var(--border-strong)]'

  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${color}`}>
        <span className="font-display text-sm font-extrabold tabular-nums">
          {rating.toFixed(1)}
        </span>
      </div>
      <p className="text-xs font-semibold text-[color:var(--text-2)]">{label}</p>
    </div>
  )
}

function Price({ price }: { price: HotelOffer['pricePerNight'] }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
        Nightly rate
      </p>
      <p className="mt-1 font-display text-3xl font-extrabold leading-none text-[color:var(--text-1)] tabular-nums">
        {formatMoney(price)}
      </p>
      <p className="mt-1 text-xs font-medium text-[color:var(--text-3)]">per night before taxes and fees</p>
    </div>
  )
}

function PriceUnavailable({ reason }: { reason: string }) {
  return (
    <div className="min-w-0" role="status" aria-label={`Hotel price unavailable. ${reason}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
        Nightly rate
      </p>
      <p className="mt-1 font-display text-lg font-extrabold leading-none text-[color:var(--text-1)]">
        Price unavailable
      </p>
      <p className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-3)]">
        {reason}
      </p>
    </div>
  )
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
    ? 'border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]'
    : score.verdict === 'Great'
      ? 'border-[color:var(--border-strong)] bg-[color:var(--success-soft)]'
      : score.verdict === 'Good'
        ? 'border-[color:var(--border-strong)] bg-[color:var(--brand-soft)]'
        : 'border-[color:var(--border)] bg-[color:var(--bg-raised)]'
  const percentileLabel = isLowConfidence
    ? 'Not enough hotel history for a confirmed deal rating'
    : `${formatOrdinal(score.percentile)} percentile`
  const usualMoney = { priceCents: score.medianCents, currency: score.currency }
  const usualPrice = isValidMoney(usualMoney)
    ? formatMoney(usualMoney)
    : 'Unavailable'

  return (
    <div className={`mt-4 flex flex-col gap-2 rounded-[1rem] border px-4 py-3 ${panelClasses}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
            Deal Score
          </p>
          <p className="mt-0.5 text-xs font-medium leading-5 text-[color:var(--text-2)]">
            {percentileLabel}
          </p>
        </div>
        <DealBadge verdict={score.verdict} confidence={score.confidence} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
            Usual
          </p>
          <p className="font-semibold text-[color:var(--text-1)]">{usualPrice}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
            Vs median
          </p>
          <p className="font-semibold text-[color:var(--text-1)]">{formatPctVsMedian(score.pctVsMedian)}</p>
        </div>
      </div>
      {isLowConfidence && (
        <p className="text-xs leading-5 text-[color:var(--warning)]">
          Limited hotel history. Treat this as a rough comparison, not a confirmed deal.
        </p>
      )}
      <p className="text-xs leading-5 text-[color:var(--text-2)]">{score.explanation}</p>
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
  const hasValidPrice = isValidMoney(hotel.pricePerNight)
  const canBook = hasBookingUrl && hasValidPrice
  const unavailableReason = getUnavailableReason(hasBookingUrl, hasValidPrice)
  const hasRating = hotel.rating !== undefined && hotel.rating > 0

  return (
    <div className="card flex flex-col overflow-hidden rounded-[1.25rem]">
      {hotel.photoUrl ? (
        <div className="relative h-48 w-full shrink-0 overflow-hidden bg-[color:var(--bg-muted)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hotel.photoUrl}
            alt={hotel.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex h-24 w-full shrink-0 items-end border-b border-[color:var(--border)] bg-[color:var(--bg-muted)] px-5 pb-4">
          <p className="text-xs font-semibold text-[color:var(--text-3)]">Hotel photo unavailable</p>
        </div>
      )}

      <div className="flex flex-1 flex-col p-6">
        <div className="space-y-3">
          <div>
            <h3 className="font-display line-clamp-2 text-base font-bold leading-snug text-[color:var(--text-1)]">
              {hotel.name}
            </h3>

            {hotel.area && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className="shrink-0 text-[color:var(--text-3)]">
                  <path d="M6 1C4.07 1 2.5 2.57 2.5 4.5c0 2.63 3.5 6.5 3.5 6.5s3.5-3.87 3.5-6.5C9.5 2.57 7.93 1 6 1zm0 4.75a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" fill="currentColor" />
                </svg>
                <p className="truncate text-xs font-medium text-[color:var(--text-2)]">{hotel.area}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[1rem] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
                Hotel class
              </p>
              <StarRow stars={hotel.stars} />
            </div>
            {hasRating && (
              <div className="border-l border-[color:var(--border)] pl-4">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
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

        <div className="mt-4 flex flex-col gap-4 border-t border-[color:var(--border)] pt-4 sm:flex-row sm:items-end sm:justify-between">
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
                  aria-label={`View stay details for ${hotel.name}`}
                  className="btn-primary btn-primary-responsive h-12 min-w-[11rem]"
                >
                  View stay details
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
                <p className="text-center text-[11px] font-medium text-[color:var(--text-3)] sm:text-right">
                  Opens the booking handoff. Final price and availability can change.
                </p>
              </>
            ) : (
              <>
                <span
                  className="flex h-12 w-full items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-muted)] px-4 text-sm font-bold text-[color:var(--text-3)] sm:w-auto"
                  role="status"
                  aria-label={`Booking unavailable for ${hotel.name}. ${unavailableReason}`}
                >
                  Booking unavailable
                </span>
                <p className="text-center text-xs font-medium leading-5 text-[color:var(--text-3)] sm:max-w-48 sm:text-right">
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
