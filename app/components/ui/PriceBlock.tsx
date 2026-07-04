import { formatMoney } from "@/lib/money";
import type { Money } from "@/lib/types";

type PriceBlockProps = {
  dealPrice: Money;
  medianPrice: Money;
  perNight?: boolean;
  /** md: inside cards and panels (default). display: hero price on the deal detail page. */
  size?: "md" | "display";
};

export function PriceBlock({ dealPrice, medianPrice, perNight = true, size = "md" }: PriceBlockProps) {
  const display = size === "display";

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span
        className={
          display
            ? "text-display text-[color:var(--primary)]"
            : "font-display text-[28px] font-bold leading-none text-[color:var(--primary)]"
        }
      >
        {formatMoney(dealPrice)}
      </span>
      {perNight ? (
        <span className="text-[13px] leading-none text-[color:var(--ink-faint)]">/ night</span>
      ) : null}
      <span className={`${display ? "text-[16px]" : "text-[15px]"} leading-none text-[color:var(--ink-faint)] line-through`}>
        usually {formatMoney(medianPrice)}
      </span>
    </div>
  );
}
