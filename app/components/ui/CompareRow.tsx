type CompareLinks = {
  expedia?: string;
  booking?: string;
  kiwi?: string;
  trip?: string;
};

type CompareRowProps = {
  links: CompareLinks;
};

const providers: Array<{ key: keyof CompareLinks; label: string }> = [
  { key: "expedia", label: "Expedia" },
  { key: "booking", label: "Booking.com" },
  { key: "kiwi", label: "Kiwi" },
  { key: "trip", label: "Trip.com" },
];

export function CompareRow({ links }: CompareRowProps) {
  const visibleLinks = providers
    .map((provider) => ({ ...provider, href: links[provider.key] }))
    .filter((provider): provider is { key: keyof CompareLinks; label: string; href: string } => {
      return typeof provider.href === "string" && provider.href.trim().length > 0;
    });

  if (visibleLinks.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11.5px] leading-none text-[color:var(--ink-faint)]">Compare and book on:</p>
      <div className="flex flex-wrap gap-2">
        {visibleLinks.map((provider) => (
          <a
            key={provider.key}
            href={provider.href}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="flex h-11 min-w-[calc(50%-4px)] flex-1 items-center justify-center rounded-[var(--radius-pill)] border-[1.5px] border-[color:var(--line-white)] bg-[color:var(--surface)] px-3 text-center text-[13px] font-medium leading-none text-[color:var(--ink)] no-underline min-[420px]:min-w-0 min-[420px]:max-w-[160px]"
          >
            {provider.label}
          </a>
        ))}
      </div>
    </div>
  );
}
