'use client'

import { track } from '@/lib/analytics'
import { eligibleHotelProviderLinks, type CompareLinks } from './ui/CompareRow'

const PROVIDERS: Array<{ key: keyof CompareLinks; label: string }> = [
  { key: 'booking', label: 'Booking.com' },
  { key: 'expedia', label: 'Expedia' },
  { key: 'trip', label: 'Trip.com' },
  { key: 'kiwi', label: 'Kiwi' },
]

export function DealDetailProviderHandoff({ dealId, city, links, backHref, expired }: {
  dealId: string
  city: string
  links: Record<string, string>
  backHref: string
  expired: boolean
}) {
  const eligible = eligibleHotelProviderLinks(links)
  const provider = expired ? undefined : PROVIDERS.find(item => eligible[item.key])
  const freeAlertsHref = `/login?intent=free&city=${encodeURIComponent(city)}&utm_source=deal_detail&utm_medium=secondary&utm_campaign=free_alerts`

  if (!provider) {
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
  return (
    <div>
      <a href={href} target="_blank" rel="noopener noreferrer sponsored" onClick={() => track('deal_detail_cta_provider', { deal_id: dealId, provider: provider.key })} className="btn btn-primary inline-flex min-h-12 w-full items-center justify-center text-center sm:w-auto sm:min-w-64">
        View deal on {provider.label}
      </a>
      <p className="mt-2 text-xs text-[color:var(--text-3)]">Opens {provider.label} in a new tab. You pay the provider, not expaify.</p>
      <a href={freeAlertsHref} onClick={() => track('deal_detail_cta_free_alerts', { deal_id: dealId, city })} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-[color:var(--brand)] underline underline-offset-2">Get free alerts for {city}</a>
    </div>
  )
}
