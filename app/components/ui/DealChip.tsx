type DealChipProps = {
  discountPct: number;
};

export function DealChip({ discountPct }: DealChipProps) {
  if (discountPct <= 0) return null;

  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-pill)] bg-[color:var(--gold)] px-[10px] py-1 font-display text-[13px] font-bold leading-none text-[color:var(--gold-text)]"
    >
      -{discountPct}%
    </span>
  );
}
