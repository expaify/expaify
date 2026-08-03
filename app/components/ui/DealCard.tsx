'use client'

import { formatMoney } from '@/lib/money'
import type { HotelClimateEvidence, Money } from '@/lib/types'
import type { HotelDisruptionEvidence } from '@/lib/types'
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
  HotelDisruptionResultCue,
} from './HotelDisruptionNotice'
import { getHotelClimateResultCue } from '@/lib/hotels/climateEvidence'

type DealLinks = {
  expedia?: string
  booking?: string
  kiwi?: string
  trip?: string
}

type DealCardDeal = {
  id: string
  hotelName: string
  city: string
  stars: number
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
}

type DealCardProps = {
  deal: DealCardDeal
  href?: string
  onOpen?: () => void
  quietStayEvidence?: QuietStayEvidence
  disruptionEvidence?: HotelDisruptionEvidence
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

export function DealCard({ deal, href, onOpen, quietStayEvidence, disruptionEvidence, climateEvidence }: DealCardProps) {
  const savings = deal.medianPrice.priceCents - deal.dealPrice.priceCents
  const showSavings = savings >= 2000
  const checked = deal.isMock ? null : timeAgo(deal.updatedAt)
  const quietEvidenceCue = getQuietEvidenceResultCue(quietStayEvidence)
  const disruptionCue = getHotelDisruptionResultCue(disruptionEvidence)
  const climateCue = getHotelClimateResultCue(climateEvidence)

  const content = (
    <article className={`group overflow-hidden rounded-[var(--radius-card)] border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--surface)] ${deal.expired ? 'grayscale' : deal.isMock ? '' : 'transition-[transform,box-shadow] duration-150 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]'}`}>
      <div className="space-y-3 px-4 pb-4 pt-3">
        <div>
          {deal.isMock ? (
            <span className="mb-2 inline-flex rounded-[var(--radius-pill)] bg-[color:var(--bg-muted)] px-2 py-1 font-display text-caption font-bold leading-none text-[color:var(--ink-soft)]">
              Example
            </span>
          ) : null}
          <h3 className="text-body line-clamp-2 font-display font-bold leading-snug text-[color:var(--ink)]">
            {deal.hotelName}
          </h3>
          <p className="text-caption mt-0.5 leading-snug text-[color:var(--ink-faint)]">
            <span aria-label={`${Math.round(deal.stars)} stars`} aria-hidden>{starChars(deal.stars)}</span>
            {' · '}{deal.city}{' · '}{deal.checkInWindow}
          </p>
          <HotelDisruptionResultCue evidence={disruptionEvidence} analyticsKey={deal.id} />
          {quietEvidenceCue ? (
            <p className="mt-2 break-words text-caption font-medium leading-5 text-[color:var(--text-2)]">
              {quietEvidenceCue}
            </p>
          ) : null}
          {climateCue ? (
            <p className="mt-2 break-words text-caption font-medium leading-5 text-[color:var(--text-2)]">
              {climateCue}
            </p>
          ) : null}
        </div>

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
              <DealChip discountPct={deal.discountPct} />
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

        <PropertyPhoto src={deal.photoUrl} size="card" />

        {deal.expired ? null : deal.isMock ? (
          <p className="text-caption font-medium leading-snug text-[color:var(--ink-faint)]">Sample hotel — not bookable</p>
        ) : href ? (
          <p className="flex min-h-11 items-center justify-center rounded-[var(--radius-input)] border border-[color:var(--primary)] text-small font-medium text-[color:var(--primary)]">View deal</p>
        ) : (
          <CompareRow links={deal.links} />
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
      aria-label={`View deal: ${deal.hotelName}.${disruptionCue ? ` Supplier notice: ${disruptionCue}.` : ''}${quietEvidenceCue ? ` ${quietEvidenceCue.replace(' · ', ': ')}.` : ''}${climateCue ? ` Room climate: ${climateCue}.` : ''}`}
    >
      {content}
    </a>
  )
}
