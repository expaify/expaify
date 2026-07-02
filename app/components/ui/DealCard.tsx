import type { Money } from "@/lib/types";
import { CompareRow } from "./CompareRow";
import { DealChip } from "./DealChip";
import { PriceBlock } from "./PriceBlock";
import { StarRow } from "./StarRow";
import { TrustLine } from "./TrustLine";

type DealLinks = {
  expedia?: string;
  booking?: string;
  kiwi?: string;
  trip?: string;
};

type DealCardDeal = {
  id: string;
  hotelName: string;
  city: string;
  stars: number;
  photoUrl?: string;
  dealPrice: Money;
  medianPrice: Money;
  discountPct: number;
  checkInWindow: string;
  snapshotCount: number;
  links: DealLinks;
  headline?: string;
  isMock?: boolean;
};

type DealCardProps = {
  deal: DealCardDeal;
  href?: string;
};

export function DealCard({ deal, href }: DealCardProps) {
  const content = (
    <article className="transition-card overflow-hidden rounded-[var(--radius-card)] bg-[color:var(--surface)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]">
      <div className="relative aspect-[3/2] bg-[color:var(--line-ivory)]">
        {deal.photoUrl ? (
          <img
            src={deal.photoUrl}
            alt=""
            className="h-full w-full rounded-t-[16px] object-cover"
            loading="lazy"
          />
        ) : null}
        <div className="absolute left-4 top-4">
          <DealChip discountPct={deal.discountPct} />
        </div>
        <span className="absolute right-4 top-4 rounded-[var(--radius-pill)] bg-[rgba(20,18,16,0.75)] px-[10px] py-1 text-[11.5px] font-medium leading-none text-white">
          Found
        </span>
      </div>
      <div className="space-y-4 p-4">
        <div className="space-y-2">
          {deal.headline ? (
            <p className="text-[13px] font-medium leading-snug text-[color:var(--primary)]">{deal.headline}</p>
          ) : null}
          <h3 className="line-clamp-2 font-display text-[20px] font-bold leading-tight text-[color:var(--ink)]">
            {deal.hotelName}
          </h3>
          <StarRow stars={deal.stars} />
          <p className="text-[13px] leading-snug text-[color:var(--ink-faint)]">
            {deal.city} · {deal.checkInWindow}
          </p>
        </div>
        <PriceBlock dealPrice={deal.dealPrice} medianPrice={deal.medianPrice} />
        <CompareRow links={deal.links} />
        <TrustLine snapshotCount={deal.snapshotCount} />
        {deal.isMock ? (
          <p className="text-[11.5px] leading-snug text-[color:var(--ink-faint)]">Preview deal</p>
        ) : null}
      </div>
    </article>
  );

  if (!href) return content;

  return (
    <a href={href} className="block text-inherit no-underline" aria-label={`View ${deal.hotelName}`}>
      {content}
    </a>
  );
}
