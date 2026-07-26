'use client'

import { formatMoney } from '@/lib/money'
import type { Money } from '@/lib/types'
import { timeAgo } from '@/lib/timeAgo'
import { CompareRow } from './CompareRow'
import { DealChip } from './DealChip'
import { PropertyPhoto } from './PropertyPhoto'

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
}

type DealCardProps = {
  deal: DealCardDeal
  href?: string
  onOpen?: () => void
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

export function DealCard({ deal, href, onOpen }: DealCardProps) {
  const savings = deal.medianPrice.priceCents - deal.dealPrice.priceCents
  const showSavings = savings >= 2000
  const checked = deal.isMock ? null : timeAgo(deal.updatedAt)

  const content = (
    <article className={`group relative overflow-hidden rounded-[var(--radius-card)] border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--surface)] ${deal.isMock ? '' : 'transition-[transform,box-shadow] duration-150 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]'}`}>
      {deal.isMock ? (
        <span className="absolute right-3 top-3 rounded-[var(--radius-pill)] border border-[color:var(--line-white)] bg-[color:var(--surface)] px-2.5 py-1 text-[12px] font-semibold leading-none text-[color:var(--ink)]">
          Example
        </span>
      ) : checked ? (
        <span
          className="absolute right-3 top-3 rounded-[var(--radius-pill)] bg-[color:color-mix(in_srgb,var(--ink)_78%,transparent)] px-2 py-1 text-[11px] font-medium leading-none text-[color:var(--bg)]"
          title={absoluteCheckedAt(deal.updatedAt)}
        >
          checked {checked}
        </span>
      ) : null}
      <div className="space-y-3 px-4 pb-4 pt-3">
        <div className={deal.isMock || checked ? 'pr-28' : undefined}>
          <h3 className="line-clamp-2 font-display text-[16px] font-bold leading-snug text-[color:var(--ink)]">
            {deal.hotelName}
          </h3>
          <p className="mt-[2px] text-[12px] leading-snug text-[color:var(--ink-faint)]">
            <span aria-label={`${Math.round(deal.stars)} stars`} aria-hidden>{starChars(deal.stars)}</span>
            {' · '}{deal.city}{' · '}{deal.checkInWindow}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-2">
            <span className="font-display text-[26px] font-bold leading-none text-[color:var(--primary)]">
              {formatMoney(deal.dealPrice)}
            </span>
            <span className="self-end pb-[2px] text-[11px] leading-none text-[color:var(--ink-faint)]">/ night</span>
            <span className="text-[14px] leading-none text-[color:var(--ink-faint)] line-through">
              usually {formatMoney(deal.medianPrice)}
            </span>
            <DealChip discountPct={deal.discountPct} />
          </div>
          {deal.headline ? (
            <p className="text-[12px] font-medium leading-snug text-[color:var(--primary)]">{deal.headline}</p>
          ) : null}
          {showSavings ? (
            <p className="text-[12px] font-medium text-[color:var(--primary)]">
              Save {formatMoney({ priceCents: savings, currency: deal.dealPrice.currency })}/night
            </p>
          ) : null}
        </div>

        <PropertyPhoto src={deal.photoUrl} size="card" />

        {deal.isMock ? (
          <p className="text-caption font-medium leading-snug text-[color:var(--ink-faint)]">Sample hotel — not bookable</p>
        ) : (
          <CompareRow links={deal.links} />
        )}

        {!deal.isMock ? (
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
      aria-label={`View deal: ${deal.hotelName}`}
    >
      {content}
    </a>
  )
}
