type TrustLineProps = {
  snapshotCount: number;
};

export function TrustLine({ snapshotCount }: TrustLineProps) {
  const copy = snapshotCount <= 2
    ? `Early deal — tracked ${snapshotCount} times so far. Confidence grows as we check daily.`
    : `Based on ${snapshotCount} price checks over 60 days · expaify never adds fees.`

  return (
    <p className="flex items-center gap-2 text-[11.5px] leading-snug text-[color:var(--ink-faint)]">
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
        <rect x="1" y="5" width="2" height="4" rx="1" className="fill-[color:var(--ink-faint)]" />
        <rect x="4" y="2" width="2" height="7" rx="1" className="fill-[color:var(--ink-faint)]" />
        <rect x="7" y="4" width="2" height="5" rx="1" className="fill-[color:var(--ink-faint)]" />
      </svg>
      <span>{copy}</span>
    </p>
  );
}
