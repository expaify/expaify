type DealChipProps = {
  discountPct: number;
};

export function DealChip({ discountPct }: DealChipProps) {
  if (discountPct <= 0) return null;

  return (
    <span className="relative inline-flex items-center rounded-[var(--radius-pill)] bg-[color:var(--gold)] px-3 py-1.5 font-display text-body font-bold leading-none text-[color:var(--gold-text)] text-tabular">
      <span
        aria-hidden="true"
        className="motion-safe:absolute motion-safe:inset-0 motion-safe:rounded-[var(--radius-pill)] motion-safe:border motion-safe:border-[color:var(--gold)] motion-safe:animate-deal-chip-pulse"
      />
      −{discountPct}% vs usual
    </span>
  );
}
