import { formatMoney } from "@/lib/money";
import type { Money } from "@/lib/types";

type PriceBlockProps = {
  dealPrice: Money;
  medianPrice: Money;
  perNight?: boolean;
};

export function PriceBlock({ dealPrice, medianPrice, perNight = true }: PriceBlockProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="font-display text-[28px] font-bold leading-none text-[color:var(--primary)]">
        {formatMoney(dealPrice)}
      </span>
      {perNight ? (
        <span className="text-[13px] leading-none text-[color:var(--ink-faint)]">/ night</span>
      ) : null}
      <span className="text-[15px] leading-none text-[color:var(--ink-faint)] line-through">
        {formatMoney(medianPrice)}
      </span>
    </div>
  );
}
