'use client'

import { useState } from 'react'
import { track } from '@/lib/analytics'
import { TrackedLink } from '@/app/components/TrackedLink'
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
  dealId?: string
  canSelfUnlock?: boolean
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
  dealId,
  canSelfUnlock = false,
}: LockedDealCardProps) {
  const [unlocking, setUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState('')

  async function activate(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!canSelfUnlock || !dealId) {
      track('click_card_teaser_unlock', { discount_percent: discountPct })
      return
    }
    event.preventDefault()
    if (unlocking) return
    setUnlocking(true)
    setUnlockError('')
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/unlock`, { method: 'POST' })
      const body = await response.json() as { ok?: boolean; error?: string }
      if (!response.ok || !body.ok) {
        setUnlockError(body.error === 'weekly_limit_reached' ? 'Your 3 weekly unlocks are already used.' : 'Could not unlock this deal. Try again.')
        setUnlocking(false)
        return
      }
      window.location.reload()
    } catch {
      setUnlockError('Could not unlock this deal. Try again.')
      setUnlocking(false)
    }
  }
  return (
    <div className="group relative block overflow-hidden rounded-[var(--radius-card)] border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--surface)] shadow-[var(--shadow-card-rest)] motion-safe:transition-all motion-safe:duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)] focus-within:ring-2 focus-within:ring-[color:var(--primary)]">
      <a
        href={canSelfUnlock ? '#' : trackingHref(joinHref, discountPct)}
        onClick={activate}
        aria-label={`Locked deal. Save ${discountPct}% at a hotel in ${placeholderCity}. ${canSelfUnlock ? 'Use one weekly unlock to reveal this deal.' : 'Unlock deal with Premium.'}`}
        className="block focus-visible:outline-none"
      >
      <div className="absolute right-3 top-3 z-30 flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[color:var(--accent)] px-2.5 py-1 font-display text-caption font-bold text-[color:var(--ink)] shadow-[var(--shadow-card-rest)] motion-safe:transition-transform motion-safe:duration-300 group-hover:scale-105">
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

      <div className="relative mt-3" aria-hidden="true">
          <div className={photoUrl ? 'blur-sm scale-105' : ''}>
            <PropertyPhoto
              src={photoUrl}
              size="card"
              brandedFallback={{ cityLabel: placeholderCity }}
            />
          </div>
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[color:var(--surface)]/60 p-4 backdrop-blur-md">
            <div className="flex max-w-[260px] flex-col items-center rounded-[var(--radius-card)] border border-white/80 bg-[color:var(--surface)]/90 px-5 py-4 text-center shadow-[var(--shadow-card-hover)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--primary-soft)]">
                <Icon name="premium_unlocked" size={20} className="text-[color:var(--primary)]" />
              </span>
              <span className="mt-2 font-display text-body font-bold text-[color:var(--ink)]">{canSelfUnlock ? (unlocking ? 'Unlocking…' : 'Use a weekly unlock') : 'Members-only deal'}</span>
              <span className="mt-1 text-caption text-[color:var(--ink-soft)]">{canSelfUnlock ? 'Reveal this hotel and its current rate.' : 'Join Premium to reveal this hotel and its current rate.'}</span>
            </div>
          </div>
      </div>

      <div className="relative space-y-3 px-4 pb-4 pt-3">
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
        {unlockError ? <p className="relative z-20 text-caption font-medium text-[color:var(--error)]" role="alert">{unlockError}</p> : null}
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
      <TrackedLink
        href={`/login?intent=free&city=${encodeURIComponent(placeholderCity)}&utm_source=deal_page&utm_medium=card_teaser_free&utm_campaign=free_alerts`}
        analyticsEvent="free_alert_cta_click"
        analyticsProps={{ placement: 'locked_card', discount_percent: discountPct }}
        className="relative z-30 mx-4 mb-4 block text-center text-caption font-semibold text-[color:var(--primary)] underline underline-offset-2"
      >
        Get free alerts for {placeholderCity} (3 unlocks/week)
      </TrackedLink>
    </div>
  )
}
