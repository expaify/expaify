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
  hotelName?: string;
};

const PROVIDERS: Array<{ key: keyof CompareLinks; label: string }> = [
  { key: "expedia", label: "Expedia" },
  { key: "booking", label: "Booking" },
  { key: "kiwi", label: "Kiwi" },
  { key: "trip", label: "Trip.com" },
];

export function CompareRow({ links, size = "compact", hotelName }: CompareRowProps) {
  const primary = size === "primary";

  const base = primary
    ? "flex min-h-[52px] items-center justify-center rounded-[var(--radius-input)] border-[1.5px] border-[color:var(--line-white)] bg-[color:var(--surface)] px-3 text-center text-[14px] font-semibold leading-snug text-[color:var(--ink)] no-underline transition-colors duration-100"
    : "block rounded-[var(--radius-input)] border-[0.5px] border-[color:var(--line-white)] py-2 text-center text-[11px] font-medium leading-none text-[color:var(--ink)] no-underline transition-colors duration-100";

  return (
    <div className={primary ? "w-full space-y-2" : "space-y-2"}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--ink-faint)]">
        {primary ? "Provider options" : "Compare on"}
      </p>
      <div className={primary ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "grid grid-cols-2 gap-2 min-[420px]:grid-cols-4"}>
        {PROVIDERS.map(({ key, label }) => {
          const href = links[key];
          if (href) {
            const link = (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer sponsored"
                aria-label={primary && hotelName ? `Check rooms at ${label} for ${hotelName}. Opens in a new tab. The provider confirms room details, live availability, final total, taxes and fees, cancellation policy, and terms.` : undefined}
                className={`${base} hover:border-[color:var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_4%,transparent)]`}
              >
                {primary ? `Check rooms at ${label}` : label}
              </a>
            );

            if (!primary) return <span key={key}>{link}</span>;

            return (
              <div key={key} className="min-w-0">
                {link}
                <p className="mt-1.5 text-center text-xs leading-5 text-[color:var(--text-3)]">
                  Opens {label} in a new tab. Your expaify page stays open.
                </p>
              </div>
            );
          }
          return primary ? null : (
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
