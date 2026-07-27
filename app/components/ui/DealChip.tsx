type DealChipProps = {
  discountPct: number;
};

export function DealChip({ discountPct }: DealChipProps) {
  if (discountPct <= 0) return null;

  return (
    <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[color:var(--gold)] px-3 py-1.5 font-display text-body font-bold leading-none text-[color:var(--gold-text)]">
      −{discountPct}% vs usual
    </span>
  );
}
