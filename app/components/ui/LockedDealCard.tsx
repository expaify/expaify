'use client'

import { track } from '@/lib/analytics'
import { PropertyPhoto } from './PropertyPhoto'
import { Icon } from './icons/Icon'

type LockedDealCardProps = {
  placeholderName: string
  placeholderCity: string
  stars: number | null
  discountPct: number
  photoUrl?: string
  joinHref?: string
  accessibilityNeedsSelected?: boolean
}

function starChars(stars: number): string {
  const n = Math.max(0, Math.min(5, Math.round(stars)))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

function trackingHref(joinHref: string, discountPct: number): string {
  const separator = joinHref.includes('?') ? '&' : '?'
  return `${joinHref}${separator}utm_source=deal_page&utm_medium=card_teaser&discount=${discountPct}`
}

export function LockedDealCard({
  placeholderCity,
  stars,
  discountPct,
  photoUrl,
  joinHref = '/join',
  accessibilityNeedsSelected = false,
}: LockedDealCardProps) {
  return (
    <a
      href={trackingHref(joinHref, discountPct)}
      onClick={() => track('click_card_teaser_unlock', { discount_percent: discountPct })}
      aria-label={`Locked premium deal. Save ${discountPct}% at a hotel in ${placeholderCity}. Unlock deal with Premium.`}
      className="group relative block overflow-hidden rounded-[var(--radius-card)] border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--surface)] shadow-[var(--shadow-card-rest)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-[color:var(--gold-deep)] hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gold-deep)]"
    >
      <div className="absolute right-3 top-3 z-30 flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[color:var(--gold-deep)] px-2.5 py-1 font-display text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink)] shadow-md transition-transform duration-200 group-hover:scale-105">
        <Icon name="premium_unlocked" size={16} className="text-[color:var(--ink)]" />
        <span>Save {discountPct}%</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <span className="rounded-[var(--radius-pill)] bg-[color:var(--primary)] px-3 py-1 font-display text-body font-bold leading-none text-[color:var(--text-inverse)]">
          Members
        </span>
        <span className="rounded-[var(--radius-pill)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-2 py-1 text-caption font-medium leading-none text-[color:var(--text-2)]">
          Deal found today
        </span>
      </div>

      <div className="px-4 pt-3" aria-hidden="true">
        <div className="relative">
          <div className={photoUrl ? 'blur-sm' : ''}>
            <PropertyPhoto
              src={photoUrl}
              size="card"
              brandedFallback={{ cityLabel: placeholderCity }}
            />
          </div>
          {photoUrl ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--line-ivory)] bg-[color:var(--surface)]/90 shadow-sm">
                <Icon name="premium_unlocked" size={20} className="text-[color:var(--gold-deep)]" />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative space-y-3 px-4 pb-4 pt-3">
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[color:var(--bg-overlay)]/10 px-4 py-4 text-center" aria-hidden="true">
          <div className="flex items-center gap-2 rounded-[var(--radius-input)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] px-4 py-2 shadow-sm transition-all duration-200 group-hover:border-[color:var(--gold-deep)] group-hover:shadow-md">
            <Icon name="premium_unlocked" size={16} className="text-[color:var(--gold-deep)]" />
            <span className="font-display text-caption font-bold uppercase tracking-wide text-[color:var(--ink)]">Premium Only</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="h-5 w-3/5 rounded-[6px] bg-[color:var(--line-ivory)]" aria-hidden="true" />
          <p className="text-caption mt-0.5 leading-snug text-[color:var(--ink-faint)]">
            {stars === null ? 'Not yet rated' : starChars(stars)} · {placeholderCity}
          </p>
        </div>
        <div className="h-8 w-28 rounded-[var(--radius-pill)] bg-[color:var(--line-ivory)]" aria-hidden="true" />
        {accessibilityNeedsSelected ? (
          <p className="relative z-20 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3 py-2.5 text-caption font-medium leading-5 text-[color:var(--text-2)]">
            Accessibility fit available after this deal is unlocked.
          </p>
        ) : null}
        <div>
          <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
            {['Expedia', 'Booking', 'Kiwi', 'Trip.com'].map(name => (
              <div key={name} className="rounded-[var(--radius-input)] border-[0.5px] border-[color:var(--line-white)] py-2 text-center text-caption font-medium text-[color:var(--ink)]">
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </a>
  )
}
