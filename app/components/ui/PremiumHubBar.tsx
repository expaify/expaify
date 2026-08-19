'use client'

import { useEffect, useState, type RefObject } from 'react'
import { track } from '@/lib/analytics'
import { TrackedLink } from '@/app/components/TrackedLink'
import { Icon } from './icons/Icon'

type PremiumHubBarProps = {
  lockedDealsCount: number
  firstLockedDealRef: RefObject<HTMLElement | null>
  joinHref?: string
  city?: string
}

function trackingHref(joinHref: string, lockedDealsCount: number): string {
  const separator = joinHref.includes('?') ? '&' : '?'
  return `${joinHref}${separator}utm_source=deal_page&utm_medium=sticky_hub&deals_count=${lockedDealsCount}`
}

export function PremiumHubBar({ lockedDealsCount, firstLockedDealRef, joinHref = '/join', city }: PremiumHubBarProps) {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    setRevealed(false)
    const target = firstLockedDealRef.current
    if (lockedDealsCount <= 0 || !target) return
    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true)
      return
    }

    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      setRevealed(true)
      observer.disconnect()
    }, {
      // The effective root is the bottom 30% of the viewport.
      rootMargin: '-70% 0px 0px 0px',
      threshold: 0,
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [firstLockedDealRef, lockedDealsCount])

  if (lockedDealsCount <= 0) return null

  let summaryText = `Unlock ${lockedDealsCount} premium deals found today.`
  let buttonLabel = `Unlock All ${lockedDealsCount} Deals`
  let ariaLabel = `Unlock all ${lockedDealsCount} exclusive premium deals found today`
  if (lockedDealsCount === 1) {
    summaryText = '1 exclusive, high-discount deal is locked below.'
    buttonLabel = 'Unlock 1 Deal'
    ariaLabel = 'Unlock the remaining 1 exclusive premium deal found today'
  } else if (lockedDealsCount <= 5) {
    summaryText = `Only ${lockedDealsCount} exclusive, high-discount deals are locked below.`
    buttonLabel = `Unlock These ${lockedDealsCount} Deals`
    ariaLabel = `Unlock these ${lockedDealsCount} exclusive premium deals found today`
  }

  return (
    <div inert={!revealed} className={`fixed bottom-0 left-0 right-0 z-50 w-full px-0 pb-[env(safe-area-inset-bottom)] transition-[transform,opacity] duration-300 md:bottom-4 md:px-4 ${revealed ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'}`} aria-hidden={!revealed}>
      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--bg-overlay)] px-6 py-4 shadow-2xl backdrop-blur-md md:rounded-[var(--radius-card)] md:flex-row md:py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--gold-deep)] text-[color:var(--ink)] shadow-inner">
            <Icon name="premium_unlocked" size={20} />
          </div>
          <div>
            <p className="text-body font-display font-bold leading-tight text-[color:var(--ink)]">{summaryText}</p>
            <p className="text-caption mt-0.5 hidden text-[color:var(--ink-soft)] md:block">Unlock every members-only deal on this page, verified daily.</p>
            <p className="text-caption mt-1 text-[color:var(--ink-soft)]">
              {city ? `Just want email when ${city} drops? ` : 'Just want email when a deal drops? '}
              <TrackedLink
                href="/login?intent=free&utm_source=deal_page&utm_medium=sticky_hub_free_strip&utm_campaign=free_alerts"
                analyticsEvent="free_alert_cta_click"
                analyticsProps={{ placement: 'deals_sticky_strip' }}
                className="font-semibold text-[color:var(--primary)] underline underline-offset-2"
              >
                Get free alerts
              </TrackedLink>
            </p>
          </div>
        </div>
        <a
          href={trackingHref(joinHref, lockedDealsCount)}
          onClick={() => track('click_sticky_hub_unlock', { deals_visible: lockedDealsCount })}
          className="btn btn-conversion w-full text-center font-display text-body font-bold tracking-wide md:w-auto md:px-8 md:py-3"
          aria-label={ariaLabel}
        >
          {buttonLabel}
        </a>
      </div>
    </div>
  )
}
