'use client'

import { formatMoney } from '@/lib/money'
import type { HotelClimateEvidence, HotelDisruptionEvidence, HotelReviewEvidence, Money } from '@/lib/types'
import { timeAgo } from '@/lib/timeAgo'
import { CompareRow } from './CompareRow'
import { DealChip } from './DealChip'
import { PropertyPhoto } from './PropertyPhoto'
import {
  getQuietEvidenceResultCue,
  type QuietStayEvidence,
} from './QuietStayEvidenceLedger'
import {
  getHotelDisruptionResultCue,
  NO_HOTEL_DISRUPTION_EVIDENCE,
  useHotelDisruptionResultImpression,
} from './HotelDisruptionNotice'
import type { HotelPoolEvidence } from '@/app/components/research/hotelPoolFixtures'
import { getHotelPoolCardSummary } from './HotelPoolEvidenceLedger'
import {
  accessibilityCardAccessibleText,
  type AccessibilityPresentation,
} from './HotelAccessibilityFit'
import { getGuestReviewScanLine } from '../GuestReviewEvidence'
import {
  getHotelFundsCardSignal,
  type ApiDealFundsPolicy,
} from '../HotelFundsPolicyComparison'
import { getHotelClimateResultCue, validateHotelClimateEvidence } from '@/lib/hotels/climateEvidence'
import { CITY_DISPLAY_TO_SLUG } from '@/lib/cities'
import {
  getHotelEvChargingResultCopy,
  PRODUCTION_EV_CHARGING_UNKNOWN,
  type HotelEvChargingEvidence,
} from '../HotelEvCharging'

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
  evChargingEvidence?: HotelEvChargingEvidence
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

export function DealCardCity({ city }: { city: string }) {
  const citySlug = CITY_DISPLAY_TO_SLUG[city]

  if (!citySlug) return <>{city}</>

  return (
    <a
      href={`/destinations/${citySlug}`}
      className="relative z-[2] underline-offset-2 hover:underline focus-visible:rounded-sm"
    >
      {city}
    </a>
  )
}

export function DealCard({ deal, href, onOpen, quietStayEvidence, disruptionEvidence, poolEvidence, photoLoading = 'lazy', accessibility, climateEvidence, evChargingEvidence = PRODUCTION_EV_CHARGING_UNKNOWN }: DealCardProps) {
  const savings = deal.medianPrice.priceCents - deal.dealPrice.priceCents
  const showSavings = savings >= 2000
  const checked = deal.isMock ? null : timeAgo(deal.updatedAt)
  const quietEvidenceCue = getQuietEvidenceResultCue(quietStayEvidence)
  const disruptionCue = getHotelDisruptionResultCue(disruptionEvidence)
  const poolCue = getHotelPoolCardSummary(poolEvidence)
  const accessibilityAccessibleText = accessibilityCardAccessibleText(accessibility, deal.expired)
  const reviewScanLine = getGuestReviewScanLine(deal.reviewEvidence)
  const fundsPolicySignal = getHotelFundsCardSignal(deal.fundsPolicy)
  const validatedClimateEvidence = validateHotelClimateEvidence(climateEvidence)
  const climateCue = validatedClimateEvidence?.capability === 'unsupported'
    || validatedClimateEvidence?.rows.every(row => row.value === 'not_provided')
    ? null
    : getHotelClimateResultCue(validatedClimateEvidence)
  const evChargingCue = getHotelEvChargingResultCopy(evChargingEvidence)
  const accessibilityCue = !deal.expired && accessibility?.needs.length
    ? accessibility.rollup === 'all_documented'
      ? 'All selected needs documented'
      : accessibility.rollup === 'has_mismatch'
        ? 'Does not match a selected need'
        : accessibility.rollup === 'loading'
          ? 'Checking accessibility details…'
          : 'Some needs require confirmation'
    : null
  const winningCue = disruptionCue
    ? { kind: 'disruption' as const, copy: disruptionCue, warning: true, accessible: disruptionCue }
    : poolCue
      ? { kind: 'pool' as const, ...poolCue, accessible: poolCue.copy }
      : climateCue
        ? { kind: 'climate' as const, copy: climateCue, warning: false, accessible: climateCue }
        : accessibilityCue
          ? { kind: 'accessibility' as const, copy: accessibilityCue, warning: accessibility?.rollup !== 'all_documented', accessible: accessibilityAccessibleText ?? accessibilityCue }
          : quietEvidenceCue
            ? { kind: 'quiet' as const, copy: quietEvidenceCue, warning: false, accessible: quietEvidenceCue }
            : reviewScanLine
              ? { kind: 'review' as const, copy: reviewScanLine.visible, warning: false, accessible: reviewScanLine.accessible }
              : evChargingEvidence.presentationState !== 'unknown'
                ? { kind: 'ev-charging' as const, copy: evChargingCue.visible, warning: evChargingEvidence.presentationState !== 'confirmed', accessible: evChargingCue.accessible }
                : fundsPolicySignal
                  ? { kind: 'funds-policy' as const, copy: fundsPolicySignal.copy, warning: fundsPolicySignal.state === 'partial' || fundsPolicySignal.state === 'conflicting', accessible: fundsPolicySignal.copy }
                  : null
  const disruptionImpressionRef = useHotelDisruptionResultImpression({
    evidence: disruptionEvidence ?? NO_HOTEL_DISRUPTION_EVIDENCE,
    analyticsKey: deal.id,
    enabled: winningCue?.kind === 'disruption',
  })
  const showTrackingIndicator = !deal.isMock && !deal.expired && deal.medianPrice.priceCents > 0
  const trackingFillPct = showTrackingIndicator
    ? Math.max(0, Math.min(100, (deal.dealPrice.priceCents / deal.medianPrice.priceCents) * 100))
    : 0

  const content = (
    <article className={`overflow-hidden rounded-[var(--radius-card)] border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--surface)] shadow-[var(--shadow-card-rest)] ${deal.expired ? 'grayscale' : deal.isMock ? '' : 'transition-[transform,box-shadow] duration-150 group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-card-hover)]'}`}>
      <div className="relative">
        <PropertyPhoto src={deal.photoUrl} size="card" loading={photoLoading} />
        {deal.isMock ? (
          <span className="absolute left-3 top-3 z-[2] inline-flex items-center rounded-[var(--radius-pill)] border border-[color:var(--line-white)] bg-[color:var(--surface)] px-2 py-1 font-display text-caption font-bold leading-none text-[color:var(--ink-soft)] shadow-[var(--shadow-card-rest)]">
            Example
          </span>
        ) : null}
      </div>

      <div className="flex h-full flex-col px-4 pb-4 pt-3">
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
            {' · '}<DealCardCity city={deal.city} />{' · '}{deal.checkInWindow}
          </p>
          {winningCue ? (
            <p
              ref={winningCue.kind === 'disruption' ? disruptionImpressionRef as React.RefObject<HTMLParagraphElement | null> : undefined}
              data-ev-charging-signal={winningCue.kind === 'ev-charging' ? 'true' : undefined}
              data-ev-charging-offer={winningCue.kind === 'ev-charging' ? deal.id : undefined}
              data-ev-charging-revision={winningCue.kind === 'ev-charging' ? evChargingEvidence.evidenceRevision : undefined}
              data-ev-charging-state={winningCue.kind === 'ev-charging' ? evChargingEvidence.presentationState : undefined}
              className={`mt-2 line-clamp-2 break-words text-caption font-medium leading-5 ${winningCue.warning ? 'text-[color:var(--warning)]' : 'text-[color:var(--text-2)]'}`}
            >
              {winningCue.copy}
            </p>
          ) : null}
        </div>

        <div className="mt-auto space-y-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-2">
            <span className="text-h2 leading-none text-[color:var(--ink)] text-tabular">
              {formatMoney(deal.dealPrice)}
            </span>
            <span className="text-caption self-end pb-0.5 leading-none text-[color:var(--ink-faint)]">/ night</span>
            <span className="text-small leading-none text-[color:var(--ink-faint)] line-through text-tabular">
              usually {formatMoney(deal.medianPrice)}
            </span>
            {deal.expired ? (
              <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[color:var(--bg-muted)] px-3 py-1.5 font-display text-small font-bold leading-none text-[color:var(--ink-soft)]">
                Expired
              </span>
            ) : (
              <DealChip discountPct={deal.discountPct} />
            )}
          </div>
          {showSavings ? (
            <p className="text-caption font-medium text-[color:var(--ink-soft)] text-tabular">
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

        {showTrackingIndicator ? (
          <div className="space-y-1" style={{ opacity: deal.snapshotCount >= 12 ? 1 : 0.6 }}>
            <div
              role="img"
              aria-label={`${formatMoney(deal.dealPrice)} is ${deal.discountPct}% below the 60-day median of ${formatMoney(deal.medianPrice)}, based on ${deal.snapshotCount} price checks.`}
              className="h-1.5 w-full overflow-hidden rounded-[var(--radius-pill)] bg-[color:var(--line-ivory)]"
            >
              <div
                className="h-full rounded-[var(--radius-pill)] bg-[color:var(--primary)]"
                style={{ width: `${trackingFillPct}%` }}
              />
            </div>
            <p className="text-caption leading-snug text-[color:var(--ink-faint)] text-tabular">
              Tracked 60 days · {deal.snapshotCount} checks
            </p>
          </div>
        ) : null}
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
      </div>
    </article>
  )

  if (!href) return content

  return (
    <div className="group relative">
      {content}
      <a
        href={href}
        onClick={onOpen}
        className="absolute inset-0 z-[1] block text-inherit no-underline"
        aria-label={`View deal: ${deal.hotelName}.${deal.stars === null ? '' : ` ${Math.round(deal.stars)}-star hotel class.`}${winningCue?.accessible ? ` ${winningCue.accessible}.` : ''}`}
      />
    </div>
  )
}
