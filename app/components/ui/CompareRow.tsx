'use client'

import { track } from '@/lib/analytics'
import { isHotelOccupancyParamKey, normalizeHotelSearchParamKey } from '@/lib/hotels/occupancyParams'

export type CompareLinks = {
  expedia?: string;
  booking?: string;
  kiwi?: string;
  trip?: string;
};

export type HotelHandoffAnalyticsContext = {
  dealId: string
  contextStatus: 'matched' | 'mismatch' | 'missing' | 'invalid'
  criteriaVersion?: string
  destinationPresent?: boolean
  dateState?: 'checkin_window' | 'missing'
}

type CompareRowProps = {
  links: CompareLinks;
  /** compact: inside cards (default). primary: full-width action zone on the deal detail page. */
  size?: "compact" | "primary";
  handoffContext?: HotelHandoffAnalyticsContext
};

const PROVIDERS: Array<{ key: keyof CompareLinks; label: string }> = [
  { key: "expedia", label: "Expedia" },
  { key: "booking", label: "Booking" },
  { key: "kiwi", label: "Kiwi" },
  { key: "trip", label: "Trip.com" },
];

const NESTED_URL_PARAM_KEYS = new Set([
  'u',
  'url',
  'redirect',
  'redirecturl',
  'target',
  'targeturl',
  'deeplink',
  'landingurl',
])

function normalizedSearchParamValues(url: URL, normalizedKey: string): string[] {
  return [...url.searchParams.entries()]
    .filter(([key]) => normalizeHotelSearchParamKey(key) === normalizedKey)
    .map(([, value]) => value)
}

function containsOccupancyParam(candidate: URL, depth = 0): boolean {
  if ([...candidate.searchParams.keys()].some(isHotelOccupancyParamKey)) return true
  if (depth >= 4) return true

  for (const [key, value] of candidate.searchParams.entries()) {
    if (!NESTED_URL_PARAM_KEYS.has(normalizeHotelSearchParamKey(key))) continue
    try {
      if (containsOccupancyParam(new URL(value), depth + 1)) return true
    } catch {
      return true
    }
  }
  return false
}

export function isAttributedHotelProviderUrl(provider: keyof CompareLinks, href: string): boolean {
  try {
    const url = new URL(href)
    if (url.protocol !== 'https:') return false
    const attributionParam: Record<keyof CompareLinks, string> = {
      expedia: 'affcid',
      booking: 'aid',
      kiwi: 'affilid',
      trip: 'marker',
    }
    const providerHost: Record<keyof CompareLinks, string> = {
      expedia: 'expedia.com',
      booking: 'booking.com',
      kiwi: 'kiwi.com',
      trip: 'tp.media',
    }
    const expectedHost = providerHost[provider]
    if (url.hostname !== expectedHost && !url.hostname.endsWith(`.${expectedHost}`)) return false
    if (!url.searchParams.get(attributionParam[provider])) return false

    if (containsOccupancyParam(url)) return false
    if (provider === 'trip') {
      const nestedValues = normalizedSearchParamValues(url, 'u')
      if (nestedValues.length !== 1) return false
      try {
        const nestedUrl = new URL(nestedValues[0])
        if (nestedUrl.protocol !== 'https:' || (nestedUrl.hostname !== 'trip.com' && !nestedUrl.hostname.endsWith('.trip.com'))) return false
      } catch {
        return false
      }
    }
    return true
  } catch {
    return false
  }
}

export function eligibleHotelProviderLinks(links: CompareLinks): CompareLinks {
  return Object.fromEntries(
    Object.entries(links).filter(([provider, href]) => (
      typeof href === 'string' && isAttributedHotelProviderUrl(provider as keyof CompareLinks, href)
    )),
  ) as CompareLinks
}

export function CompareRow({ links, size = "compact", handoffContext }: CompareRowProps) {
  const primary = size === "primary";

  const base = primary
    ? "flex min-h-[52px] items-center justify-center rounded-[var(--radius-input)] border-[1.5px] border-[color:var(--line-white)] bg-[color:var(--surface)] px-3 text-center text-[14px] font-semibold leading-none text-[color:var(--ink)] no-underline transition-colors duration-100"
    : "block rounded-[var(--radius-input)] border-[0.5px] border-[color:var(--line-white)] py-2 text-center text-[11px] font-medium leading-none text-[color:var(--ink)] no-underline transition-colors duration-100";

  return (
    <div className={primary ? "w-full space-y-2" : "space-y-2"}>
      <p className="text-[11px] leading-none text-[color:var(--ink-faint)]">Compare and book on:</p>
      <div className={primary ? "grid grid-cols-2 gap-2 min-[480px]:grid-cols-4" : "grid grid-cols-2 gap-2 min-[420px]:grid-cols-4"}>
        {PROVIDERS.map(({ key, label }) => {
          const href = links[key];
          if (href && isAttributedHotelProviderUrl(key, href) && handoffContext?.contextStatus !== 'mismatch') {
            return (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noopener noreferrer sponsored"
                aria-label={`Check this deal on ${label}`}
                onClick={() => {
                  if (!handoffContext) return
                  track('hotel_provider_handoff_clicked', {
                    provider: key,
                    deal_id: handoffContext.dealId,
                    context_status: handoffContext.contextStatus,
                    ...(handoffContext.criteriaVersion ? { criteria_version: handoffContext.criteriaVersion } : {}),
                    destination_present: handoffContext.destinationPresent ?? false,
                    date_state: handoffContext.dateState ?? 'missing',
                    occupancy_state: 'not_captured',
                    room_state: 'not_captured',
                  })
                }}
                className={`${base} hover:border-[color:var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_4%,transparent)]`}
              >
                {label}
              </a>
            );
          }
          return (
            <span
              key={key}
              className={`${base} cursor-default opacity-40`}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
