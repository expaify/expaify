type CompareLinks = {
  expedia?: string;
  booking?: string;
  kiwi?: string;
  trip?: string;
};

type CompareRowProps = {
  links: CompareLinks;
};

const PROVIDERS: Array<{ key: keyof CompareLinks; label: string }> = [
  { key: "expedia", label: "Expedia" },
  { key: "booking", label: "Booking" },
  { key: "kiwi", label: "Kiwi" },
  { key: "trip", label: "Trip.com" },
];

export function CompareRow({ links }: CompareRowProps) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-none text-[color:var(--ink-faint)]">Compare and book on:</p>
      <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
        {PROVIDERS.map(({ key, label }) => {
          const href = links[key];
          const base =
            "block rounded-[var(--radius-input)] border-[0.5px] border-[color:var(--line-white)] py-2 text-center text-[11px] font-medium leading-none text-[color:var(--ink)] no-underline transition-colors duration-100";
          if (href) {
            return (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className={`${base} hover:border-[color:var(--primary)] hover:bg-[rgba(14,90,84,0.04)]`}
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
