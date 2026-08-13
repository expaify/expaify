import type { ReactNode } from 'react'

export type IconName =
  | 'deal_alert'
  | 'watchlist'
  | 'price_history'
  | 'verified_savings'
  | 'email_alert'
  | 'destination_tracking'
  | 'direct_booking'
  | 'no_hidden_fees'
  | 'marketplace_comparison'
  | 'premium_unlocked'
  | 'privacy'
  | 'hotel_deals'

export type IconSize = 16 | 20 | 24

type IconProps = {
  name: IconName
  size?: IconSize        // default 20 (md)
  active?: boolean        // default false — only affects the 3 stateful names (§6); ignored for the other 9
  className?: string      // caller supplies exactly one of the 4 D3 color-token classes here
}

type IconEntry = {
  base: ReactNode
  active?: ReactNode
}

const ICONS: Record<IconName, IconEntry> = {
  deal_alert: {
    base: (
      <>
        <path d="M8 2.5c-2 0-3.25 1.6-3.25 3.75v2.1c0 .55-.22 1.08-.6 1.47L3 11h10l-1.15-1.18a2.1 2.1 0 0 1-.6-1.47v-2.1C11.25 4.1 10 2.5 8 2.5z" />
        <path d="M6.6 12.5a1.5 1.5 0 0 0 2.8 0" />
      </>
    ),
  },
  watchlist: {
    base: <path d="M8 3v10M3 8h10" strokeLinecap="round" />,
    active: <path d="M3 8.5l3.2 3.2L13 5" strokeLinecap="round" strokeLinejoin="round" />,
  },
  price_history: {
    base: (
      <>
        <path d="M2.5 11l3-3.5 2.5 2L13.5 4" />
        <circle cx="13.5" cy="4" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  },
  verified_savings: {
    base: (
      <>
        <path d="M8 2l4.5 1.6v3.4c0 3.3-2.05 5.6-4.5 6.6-2.45-1-4.5-3.3-4.5-6.6V3.6L8 2z" />
        <path d="M5.8 8.2l1.6 1.6 3-3.4" />
      </>
    ),
  },
  email_alert: {
    base: (
      <>
        <rect x="2.5" y="4" width="11" height="8" rx="1.5" />
        <path d="M3 5l5 3.5L13 5" />
      </>
    ),
    active: (
      <>
        <rect x="2.5" y="4" width="11" height="8" rx="1.5" />
        <path d="M3 5l5 3.5L13 5" />
        <circle cx="12.5" cy="4" r="1.75" fill="currentColor" stroke="none" />
      </>
    ),
  },
  destination_tracking: {
    base: (
      <>
        <path d="M8 2c-2.35 0-4.25 1.85-4.25 4.15 0 3.1 4.25 7.85 4.25 7.85s4.25-4.75 4.25-7.85C12.25 3.85 10.35 2 8 2z" />
        <circle cx="8" cy="6.3" r="1.4" />
      </>
    ),
    active: (
      <path
        d="M8 2c-2.35 0-4.25 1.85-4.25 4.15 0 3.1 4.25 7.85 4.25 7.85s4.25-4.75 4.25-7.85C12.25 3.85 10.35 2 8 2z"
        fill="currentColor"
        stroke="none"
      />
    ),
  },
  direct_booking: {
    base: (
      <>
        <path d="M6 3H3v10h10v-3" />
        <path d="M9 3h4v4" />
        <path d="M13 3L7 9" />
      </>
    ),
  },
  no_hidden_fees: {
    base: (
      <>
        <path d="M2.5 8.5L8 3h4.5a1 1 0 0 1 1 1V8.5L8.5 14a1 1 0 0 1-1.4 0L2.5 9.9a1 1 0 0 1 0-1.4z" />
        <circle cx="10.5" cy="5.5" r="0.9" />
      </>
    ),
  },
  marketplace_comparison: {
    base: (
      <>
        <path d="M2.5 13h11" />
        <path d="M5 13V6" />
        <path d="M11 13V9" />
      </>
    ),
  },
  premium_unlocked: {
    base: (
      <>
        <rect x="4" y="7.5" width="8" height="6" rx="1.25" />
        <path d="M6 7.5V5.75a2 2 0 0 1 4 0V7.5" />
      </>
    ),
  },
  privacy: {
    base: (
      <>
        <path d="M2.5 8c1.4-2.6 3.4-4 5.5-4s4.1 1.4 5.5 4c-1.4 2.6-3.4 4-5.5 4S3.9 10.6 2.5 8z" />
        <circle cx="8" cy="8" r="1.5" />
        <path d="M3 3l10 10" />
      </>
    ),
  },
  hotel_deals: {
    base: (
      <>
        <path d="M2.5 12.5V6.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V9" />
        <path d="M2.5 9h11a1 1 0 0 1 1 1v2.5" />
        <path d="M2.5 12.5h11" />
        <circle cx="4.5" cy="7" r="0.6" fill="currentColor" stroke="none" />
      </>
    ),
  },
}

export function Icon({ name, size = 20, active = false, className }: IconProps) {
  const entry = ICONS[name]
  const body = (active && entry.active) ? entry.active : entry.base
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {body}
    </svg>
  )
}
