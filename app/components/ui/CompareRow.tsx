'use client'

import { track } from '@/lib/analytics'

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
  hotelName?: string
  onProviderOpen?: (provider: keyof CompareLinks) => void
};

const PROVIDERS: Array<{ key: keyof CompareLinks; label: string }> = [
  { key: "expedia", label: "Expedia" },
  { key: "booking", label: "Booking" },
  { key: "kiwi", label: "Kiwi" },
  { key: "trip", label: "Trip.com" },
];

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

    const occupancyKeys = new Set(['adults', 'adult', 'rooms', 'room_qty', 'children', 'childages', 'child_ages'])
    const containsOccupancy = (candidate: URL): boolean => {
      if ([...candidate.searchParams.keys()].some(key => occupancyKeys.has(key.toLocaleLowerCase('en-US')))) return true
      const nested = candidate.searchParams.get('u')
      if (!nested) return false
      try {
        return containsOccupancy(new URL(nested))
      } catch {
        return true
      }
    }
    if (containsOccupancy(url)) return false
    if (provider === 'trip') {
      const nested = url.searchParams.get('u')
      if (!nested) return false
      try {
        const nestedUrl = new URL(nested)
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

export function CompareRow({ links, size = "compact", handoffContext, hotelName, onProviderOpen }: CompareRowProps) {
  const primary = size === "primary";

  // Layout only — colour is applied per-state so the unavailable variant can opt
  // out of the link tone without relying on Tailwind class-order to win.
  const layout = primary
    ? "flex min-h-13 items-center justify-center rounded-[var(--radius-input)] border-[1.5px] bg-[color:var(--surface)] px-3 text-center text-small font-medium leading-none no-underline transition-colors duration-100"
    : "block rounded-[var(--radius-input)] border-[0.5px] py-2 text-center text-caption font-medium leading-none no-underline transition-colors duration-100";

  const base = `${layout} border-[color:var(--line-white)] text-[color:var(--ink)]`;
  // --ink-faint is the lightest tone that still clears AA (4.85:1 on --surface);
  // the previous opacity-40 rendered this label at ~2.9:1.
  const unavailable = `${layout} border-dashed border-[color:var(--line-white)] bg-[color:var(--surface)] text-[color:var(--ink-faint)]`;

  return (
    <div className={primary ? "w-full space-y-2" : "space-y-2"}>
      <p className="text-caption font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">{primary ? 'Provider options' : 'Compare and book on:'}</p>
      <div className={primary ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "grid grid-cols-2 gap-2 min-[420px]:grid-cols-4"}>
        {PROVIDERS.map(({ key, label }) => {
          const href = links[key];
          if (href && isAttributedHotelProviderUrl(key, href) && handoffContext?.contextStatus !== 'mismatch') {
            return (
              <div key={key} className="min-w-0">
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  data-hotel-provider={key}
                  aria-label={primary && hotelName
                    ? `Check rooms at ${label} for ${hotelName}. Opens in a new tab. The provider confirms room details, live availability, final total, taxes and fees, cancellation policy, and terms.`
                    : `Check this deal on ${label}`}
                  onClick={() => {
                    onProviderOpen?.(key)
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
                  {primary ? `Check rooms at ${label}` : label}
                </a>
                {primary ? <p className="text-caption mt-1 text-center text-[color:var(--text-3)]">Opens {label} in a new tab. Your expaify page stays open.</p> : null}
              </div>
            );
          }
          if (primary) return null
          return (
            <span
              key={key}
              className={`${unavailable} cursor-default`}
              title={`${label} has no attributed link for this stay`}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
