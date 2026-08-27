'use client'

import { useEffect, useState } from 'react'
import { track } from '@/lib/analytics'
import { formatMoney } from '@/lib/money'
import type { Money } from '@/lib/types'
import { eligibleHotelProviderLinks, type CompareLinks } from './ui/CompareRow'

const PROVIDERS: Array<{ key: keyof CompareLinks; label: string }> = [
  { key: 'booking', label: 'Booking.com' },
  { key: 'expedia', label: 'Expedia' },
  { key: 'trip', label: 'Trip.com' },
  { key: 'kiwi', label: 'Kiwi' },
]

function MobileStickyCta({ href, label, event, price, heroId, expired, rel }: { href: string; label: string; event: () => void; price: Money; heroId: string; expired: boolean; rel: string }) {
  const [showSticky, setShowSticky] = useState(false)

  useEffect(() => {
    if (expired) return
    const update = () => {
      const hero = document.getElementById(heroId)
      setShowSticky(Boolean(hero && hero.getBoundingClientRect().bottom <= 0))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [expired, heroId])

  return (
    <div className={`fixed inset-x-0 bottom-0 z-50 border-t border-[color:var(--border)] bg-[color:var(--surface)]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(20,18,16,0.08)] backdrop-blur-md motion-safe:transition-transform motion-safe:duration-300 min-[1024px]:hidden ${showSticky ? 'translate-y-0' : 'pointer-events-none translate-y-full'}`} aria-hidden={!showSticky}>
      <div className="mx-auto flex max-w-[680px] items-center gap-3">
        <div className="min-w-0 shrink-0">
          <p className="text-h3 font-bold text-[color:var(--ink)] text-tabular">{formatMoney(price)}</p>
          <p className="text-caption text-[color:var(--ink-faint)]">per night</p>
        </div>
        <a href={href} target="_blank" rel={rel} onClick={event} tabIndex={showSticky ? undefined : -1} className="btn btn-primary min-w-0 flex-1 text-center">{label}</a>
      </div>
    </div>
  )
}

export function DealDetailProviderHandoff({ dealId, city, links, backHref, expired, stickyPrice, heroId }: {
  dealId: string
  city: string
  links: Record<string, string>
  backHref: string
  expired: boolean
  stickyPrice?: Money
  heroId?: string
}) {
  const eligible = eligibleHotelProviderLinks(links)
  const provider = expired ? undefined : PROVIDERS.find(item => eligible[item.key])
  const bookingSearchUrl = links.bookingSearchUrl
  const freeAlertsHref = `/login?intent=free&city=${encodeURIComponent(city)}&utm_source=deal_detail&utm_medium=secondary&utm_campaign=free_alerts`

  if (!provider) {
    if (bookingSearchUrl) {
      return (
        <div>
          <a href={bookingSearchUrl} target="_blank" rel="noopener noreferrer" onClick={() => track('deal_cta_fallback_booking_search', { deal_id: dealId })} className="btn btn-primary inline-flex min-h-12 w-full items-center justify-center text-center sm:w-auto sm:min-w-64">
            Search on Booking.com
          </a>
          <p className="mt-2 text-xs text-[color:var(--text-3)]">Opens Booking.com in a new tab. You pay Booking.com, not expaify.</p>
          <a href={freeAlertsHref} onClick={() => track('deal_detail_cta_free_alerts', { deal_id: dealId, city })} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[color:var(--brand)] underline underline-offset-2">Get free alerts for {city}</a>
          {stickyPrice && heroId ? <MobileStickyCta href={bookingSearchUrl} label="Search on Booking.com" event={() => track('deal_cta_fallback_booking_search', { deal_id: dealId })} price={stickyPrice} heroId={heroId} expired={expired} rel="noopener noreferrer" /> : null}
        </div>
      )
    }
    return (
      <div className="rounded-[var(--radius-control)] border border-[color:var(--error)] bg-[color:var(--error-soft)] p-4" role="status">
        <p className="font-medium text-[color:var(--text-1)]">Booking link unavailable for this snapshot</p>
        <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">Compare current rates on your usual OTA, or go back to results.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <a href={backHref} className="btn btn-outline min-h-11 justify-center">Back to matching hotels</a>
          <a href={freeAlertsHref} onClick={() => track('deal_detail_cta_free_alerts', { deal_id: dealId, city })} className="btn btn-primary min-h-11 justify-center">Get free alerts for {city}</a>
        </div>
      </div>
    )
  }

  const href = eligible[provider.key]!
  const ctaLabel = `View deal on ${provider.label}`
  return (
    <div>
      <a href={href} target="_blank" rel="noopener noreferrer sponsored" onClick={() => track('deal_detail_cta_provider', { deal_id: dealId, provider: provider.key })} className="btn btn-primary inline-flex min-h-12 w-full items-center justify-center text-center sm:w-auto sm:min-w-64">
        {ctaLabel}
      </a>
      <p className="mt-2 text-xs text-[color:var(--text-3)]">Opens {provider.label} in a new tab. You pay the provider, not expaify.</p>
      <a href={freeAlertsHref} onClick={() => track('deal_detail_cta_free_alerts', { deal_id: dealId, city })} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[color:var(--brand)] underline underline-offset-2">Get free alerts for {city}</a>
      {stickyPrice && heroId ? <MobileStickyCta href={href} label={ctaLabel} event={() => track('deal_detail_cta_provider', { deal_id: dealId, provider: provider.key })} price={stickyPrice} heroId={heroId} expired={expired} rel="noopener noreferrer sponsored" /> : null}
    </div>
  )
}
