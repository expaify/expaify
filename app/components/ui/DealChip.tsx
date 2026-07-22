type DealChipProps = {
  discountPct: number;
};

export function DealChip({ discountPct }: DealChipProps) {
  if (discountPct <= 0) return null;

  return (
    <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[color:var(--gold)] px-[12px] py-[5px] font-display text-[15px] font-bold leading-none text-[color:var(--gold-text)]">
      −{discountPct}% vs usual
    </span>
  );
}
