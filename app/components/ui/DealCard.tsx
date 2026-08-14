'use client'

import { formatMoney } from '@/lib/money'
import type { HotelClimateEvidence, HotelDisruptionEvidence, HotelReviewEvidence, Money } from '@/lib/types'
import { timeAgo } from '@/lib/timeAgo'
import { CompareRow } from './CompareRow'
import { DealChip } from './DealChip'
import { Icon } from './icons/Icon'
import { PropertyPhoto } from './PropertyPhoto'
import {
  getQuietEvidenceResultCue,
  type QuietStayEvidence,
} from './QuietStayEvidenceLedger'
import {
  getHotelDisruptionResultCue,
  HotelDisruptionResultCue,
} from './HotelDisruptionNotice'
import type { HotelPoolEvidence } from '@/app/components/research/hotelPoolFixtures'
import { getHotelPoolCardSummary } from './HotelPoolEvidenceLedger'
import {
  AccessibilityCardCue,
  accessibilityCardAccessibleText,
  type AccessibilityPresentation,
} from './HotelAccessibilityFit'
import { getGuestReviewScanLine } from '../GuestReviewEvidence'
import {
  DepositHoldCardSignal,
  getHotelFundsCardSignal,
  type ApiDealFundsPolicy,
} from '../HotelFundsPolicyComparison'
import { getHotelClimateResultCue } from '@/lib/hotels/climateEvidence'

type DealLinks = {
  expedia?: string
  booking?: string
  kiwi?: string
  trip?: string
  bookingSearchUrl?: string
}

type DealCardDeal = {
  id: string
  hotelName: string
  city: string
  stars: number | null
  photoUrl?: string
  dealPrice: Money
  medianPrice: Money
  discountPct: number
  checkInWindow: string
  snapshotCount: number
  links: DealLinks
  headline?: string
  isMock?: boolean
  firstSeen?: string
  updatedAt?: string | null
  expired?: boolean
  reviewEvidence?: HotelReviewEvidence
  fundsPolicy?: ApiDealFundsPolicy
}

type DealCardProps = {
  deal: DealCardDeal
  href?: string
  onOpen?: () => void
  quietStayEvidence?: QuietStayEvidence
  disruptionEvidence?: HotelDisruptionEvidence
  poolEvidence?: HotelPoolEvidence
  /** 'eager' for above-the-fold instances (e.g. the homepage hero/teaser) so the LCP image isn't deferred. */
  photoLoading?: 'eager' | 'lazy'
  accessibility?: AccessibilityPresentation
  climateEvidence?: HotelClimateEvidence
}

function starChars(stars: number): string {
  const n = Math.max(0, Math.min(5, Math.round(stars)))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

function absoluteCheckedAt(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return undefined
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DealCard({ deal, href, onOpen, quietStayEvidence, disruptionEvidence, poolEvidence, photoLoading = 'lazy', accessibility, climateEvidence }: DealCardProps) {
  const savings = deal.medianPrice.priceCents - deal.dealPrice.priceCents
  const showSavings = savings >= 2000
  const checked = deal.isMock ? null : timeAgo(deal.updatedAt)
  // Trust Resolution Gate: Verify sufficient snapshot volume, fresh updates, and high discount magnitude
  const isFresh = deal.updatedAt
    ? (Date.now() - new Date(deal.updatedAt).getTime()) < 36 * 60 * 60 * 1000 // 36 hours in milliseconds
    : false

  const showVerifiedBadge =
    !deal.isMock &&
    !deal.expired &&
    deal.snapshotCount >= 12 &&
    deal.discountPct >= 15 &&
    isFresh
  const quietEvidenceCue = getQuietEvidenceResultCue(quietStayEvidence)
  const disruptionCue = getHotelDisruptionResultCue(disruptionEvidence)
  const poolCue = getHotelPoolCardSummary(poolEvidence)
  const accessibilityAccessibleText = accessibilityCardAccessibleText(accessibility, deal.expired)
  const reviewScanLine = getGuestReviewScanLine(deal.reviewEvidence)
  const fundsPolicySignal = getHotelFundsCardSignal(deal.fundsPolicy)
  const climateCue = getHotelClimateResultCue(climateEvidence)

  const content = (
    <article className={`group overflow-hidden rounded-[var(--radius-card)] border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--surface)] ${deal.expired ? 'grayscale' : deal.isMock ? '' : 'transition-[transform,box-shadow] duration-150 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]'}`}>
      <div className="px-4 pt-3">
        {deal.isMock ? (
          <span className="mb-2 inline-flex rounded-[var(--radius-pill)] bg-[color:var(--bg-muted)] px-2 py-1 font-display text-caption font-bold leading-none text-[color:var(--ink-soft)]">
            Example
          </span>
        ) : null}
        <PropertyPhoto src={deal.photoUrl} size="card" loading={photoLoading} />
      </div>

      <div className="space-y-3 px-4 pb-4 pt-3">
        <div>
          <h3 className="text-body line-clamp-2 font-display font-bold leading-snug text-[color:var(--ink)]">
            {deal.hotelName}
          </h3>
          <p className="text-caption mt-0.5 leading-snug text-[color:var(--ink-faint)]">
            {deal.stars === null ? (
              <span>Not yet rated</span>
            ) : (
              <span aria-label={`${Math.round(deal.stars)}-star hotel class`} role="img">{starChars(deal.stars)}</span>
            )}
            {' · '}{deal.city}{' · '}{deal.checkInWindow}
          </p>
          {reviewScanLine ? (
            <p aria-label={reviewScanLine.accessible} className="mt-1 break-words text-caption font-medium leading-5 text-[color:var(--text-2)]">
              {reviewScanLine.visible}
            </p>
          ) : null}
          <HotelDisruptionResultCue evidence={disruptionEvidence} analyticsKey={deal.id} />
          {quietEvidenceCue ? (
            <p className="mt-2 break-words text-caption font-medium leading-5 text-[color:var(--text-2)]">
              {quietEvidenceCue}
            </p>
          ) : null}
          {poolCue ? (
            <p className={`mt-2 break-words text-caption font-medium leading-5 ${poolCue.warning ? 'text-[color:var(--warning)]' : 'text-[color:var(--text-2)]'}`}>
              {poolCue.copy}
            </p>
          ) : null}
          {climateCue ? (
            <p className="mt-2 break-words text-caption font-medium leading-5 text-[color:var(--text-2)]">
              {climateCue}
            </p>
          ) : null}
        </div>

        <AccessibilityCardCue presentation={accessibility} expired={deal.expired} />

        <div className="space-y-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-2">
            <span className="text-h2 leading-none text-[color:var(--primary)]">
              {formatMoney(deal.dealPrice)}
            </span>
            <span className="text-caption self-end pb-0.5 leading-none text-[color:var(--ink-faint)]">/ night</span>
            <span className="text-small leading-none text-[color:var(--ink-faint)] line-through">
              usually {formatMoney(deal.medianPrice)}
            </span>
            {deal.expired ? (
              <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[color:var(--bg-muted)] px-3 py-1.5 font-display text-small font-bold leading-none text-[color:var(--ink-soft)]">
                Expired
              </span>
            ) : (
              <>
                <DealChip discountPct={deal.discountPct} />
                {showVerifiedBadge && (
                  <div
                    className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[color:var(--bg-muted)] px-2 py-1 text-caption font-bold text-[color:var(--primary)] self-center"
                    role="status"
                    title={`Verified savings based on ${deal.snapshotCount} independent price checks.`}
                    aria-label={`Price verified by expaify. Based on ${deal.snapshotCount} independent price checks over the past 60 days.`}
                  >
                    <Icon name="verified_savings" size={16} className="text-[color:var(--primary)]" />
                    <span>Price Verified</span>
                  </div>
                )}
              </>
            )}
          </div>
          {deal.headline ? (
            <p className="text-caption font-medium leading-snug text-[color:var(--primary)]">{deal.headline}</p>
          ) : null}
          {showSavings ? (
            <p className="text-caption font-medium text-[color:var(--primary)]">
              Save {formatMoney({ priceCents: savings, currency: deal.dealPrice.currency })}/night
            </p>
          ) : null}
          {checked ? (
            <p
              title={absoluteCheckedAt(deal.updatedAt)}
              className="text-caption font-medium leading-snug text-[color:var(--ink-soft)]"
            >
              Price checked {checked}
            </p>
          ) : null}
        </div>

        <DepositHoldCardSignal policy={deal.fundsPolicy} />
        {deal.expired ? null : deal.isMock ? (
          <p className="text-caption font-medium leading-snug text-[color:var(--ink-faint)]">Sample hotel — not bookable</p>
        ) : href ? (
          <p className="flex min-h-11 items-center justify-center rounded-[var(--radius-input)] border border-[color:var(--primary)] text-small font-medium text-[color:var(--primary)]">View deal</p>
        ) : (
          <div className="space-y-2">
            <CompareRow links={deal.links} />
            {deal.links.bookingSearchUrl ? (
              <a
                href={deal.links.bookingSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-caption font-medium text-[color:var(--ink-faint)] underline-offset-2 hover:underline"
              >
                Or search this stay on Booking.com
              </a>
            ) : null}
          </div>
        )}

        {!deal.isMock && !deal.expired ? (
          <p className="text-caption leading-snug text-[color:var(--ink-faint)]">
            Based on {deal.snapshotCount} price checks over 60 days · expaify never adds fees
          </p>
        ) : null}
      </div>
    </article>
  )

  if (!href) return content

  return (
    <a
      href={href}
      onClick={(event) => {
        if ((event.target as Element).closest('a') === event.currentTarget) onOpen?.()
      }}
      className="block text-inherit no-underline"
      aria-label={`View deal: ${deal.hotelName}.${deal.stars === null ? '' : ` ${Math.round(deal.stars)}-star hotel class.`}${reviewScanLine ? ` ${reviewScanLine.accessible}.` : ''}${disruptionCue ? ` Supplier notice: ${disruptionCue}.` : ''}${accessibilityAccessibleText ? ` ${accessibilityAccessibleText}` : ''}${quietEvidenceCue ? ` ${quietEvidenceCue.replace(' · ', ': ')}.` : ''}${poolCue ? ` Pool detail: ${poolCue.copy}.` : ''}${climateCue ? ` Room climate: ${climateCue}.` : ''}${fundsPolicySignal ? ` ${fundsPolicySignal.copy}` : ''}`}
    >
      {content}
    </a>
  )
}
