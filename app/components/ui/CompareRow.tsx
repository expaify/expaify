'use client'

import { track } from '@/lib/analytics'

type CompareLinks = {
  expedia?: string;
  booking?: string;
  kiwi?: string;
  trip?: string;
};

type CompareRowProps = {
  links: CompareLinks;
  /** compact: inside cards (default). primary: full-width action zone on the deal detail page. */
  size?: "compact" | "primary";
  handoffContext?: { dealId: string; contextStatus: 'missing' | 'invalid' };
};

const PROVIDERS: Array<{ key: keyof CompareLinks; label: string }> = [
  { key: "expedia", label: "Expedia" },
  { key: "booking", label: "Booking" },
  { key: "kiwi", label: "Kiwi" },
  { key: "trip", label: "Trip.com" },
];

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
          if (href) {
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
                    destination_present: false,
                    date_state: 'missing',
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
