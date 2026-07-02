import { formatMoney } from "@/lib/money";
import type { Money } from "@/lib/types";
import { CompareRow } from "./CompareRow";
import { DealChip } from "./DealChip";

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
  firstSeen?: string;
};

type DealCardProps = {
  deal: DealCardDeal;
  href?: string;
};

function timeAgo(iso?: string): string {
  if (!iso) return "today";
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return minutes <= 1 ? "just now" : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function starChars(stars: number): string {
  const n = Math.max(0, Math.min(5, Math.round(stars)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function savingsCents(deal: DealCardDeal): number {
  return deal.medianPrice.priceCents - deal.dealPrice.priceCents;
}

export function DealCard({ deal, href }: DealCardProps) {
  const savings = savingsCents(deal);
  const showSavings = savings >= 2000; // ≥ $20/night

  const content = (
    <article className="group overflow-hidden rounded-[24px] border-[0.5px] border-[#e8e2d8] bg-white transition-[transform,box-shadow] duration-150 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(20,18,16,0.12)]">
      {/* ── Image area ─────────────────────────────── */}
      <div className="relative h-[160px] overflow-hidden">
        {deal.photoUrl ? (
          <>
            <img
              src={deal.photoUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
            {/* depth overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(14,90,84,0.35)] to-transparent" aria-hidden />
          </>
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "linear-gradient(150deg,#0E5A54 0%,#0A4440 100%)" }}
            aria-hidden
          >
            {/* Building icon */}
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9FE1CB"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 22V12h6v10M3 9h18M9 3v6M15 3v6" />
            </svg>
          </div>
        )}

        {/* Discount chip — top left */}
        <div className="absolute left-3 top-3">
          <DealChip discountPct={deal.discountPct} />
        </div>

        {/* Found pill — top right */}
        <span className="absolute right-3 top-3 rounded-[999px] bg-[rgba(20,18,16,0.78)] px-[10px] py-[4px] text-[11px] font-medium leading-none text-[#FAF7F2]">
          found {timeAgo(deal.firstSeen)}
        </span>
      </div>

      {/* ── Body ───────────────────────────────────── */}
      <div className="space-y-3 px-[18px] pb-[18px] pt-[14px]">
        {/* Headline */}
        {deal.headline ? (
          <p className="text-[12px] font-medium leading-snug text-[color:var(--primary)]">
            {deal.headline}
          </p>
        ) : null}

        {/* Hotel name */}
        <div>
          <h3 className="line-clamp-2 font-display text-[16px] font-[600] leading-snug text-[#141210]">
            {deal.hotelName}
          </h3>
          <p className="mt-[2px] text-[12px] leading-snug text-[#8a857d]">
            <span aria-label={`${Math.round(deal.stars)} stars`} aria-hidden>
              {starChars(deal.stars)}
            </span>
            {" · "}
            {deal.city}
            {" · "}
            {deal.checkInWindow}
          </p>
        </div>

        {/* Price */}
        <div className="space-y-[2px]">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[26px] font-bold leading-none text-[#0E5A54]">
              {formatMoney(deal.dealPrice)}
            </span>
            <span className="self-end pb-[2px] text-[11px] leading-none text-[#8a857d]">/ night</span>
            <span className="text-[14px] leading-none text-[#8a857d] line-through">
              usually {formatMoney(deal.medianPrice)}
            </span>
          </div>
          {showSavings && (
            <p className="text-[12px] font-medium text-[#0E5A54]">
              Save {formatMoney({ priceCents: savings, currency: deal.dealPrice.currency })}/night
            </p>
          )}
        </div>

        {/* OTA compare */}
        <CompareRow links={deal.links} />

        {/* Trust line */}
        <p className="text-[10.5px] leading-snug text-[#8a857d]">
          Based on {deal.snapshotCount} price checks over 60 days · expaify never adds fees
        </p>

        {deal.isMock ? (
          <p className="text-[10.5px] leading-snug text-[color:var(--ink-faint)]">Preview deal</p>
        ) : null}
      </div>
    </article>
  );

  if (!href) return content;

  return (
    <a href={href} className="block text-inherit no-underline" aria-label={`View deal: ${deal.hotelName}`}>
      {content}
    </a>
  );
}
