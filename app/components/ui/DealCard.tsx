import { formatMoney } from "@/lib/money";
import type { Money } from "@/lib/types";
import { CompareRow } from "./CompareRow";
import { DealChip } from "./DealChip";
import { timeAgo } from "@/lib/timeAgo";

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
  updatedAt?: string | null;
};

type DealCardProps = {
  deal: DealCardDeal;
  href?: string;
};

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
  const checked = deal.isMock ? null : timeAgo(deal.updatedAt);

  const content = (
    <article className={`group overflow-hidden rounded-[var(--radius-card)] border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--surface)] ${deal.isMock ? '' : 'transition-[transform,box-shadow] duration-150 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]'}`}>
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
            <div className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_srgb,var(--primary)_35%,transparent)] to-transparent" aria-hidden />
          </>
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "linear-gradient(150deg,var(--primary) 0%,var(--primary-deep) 100%)" }}
            aria-hidden
          >
            {/* Building icon */}
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--primary-soft)"
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

        {deal.isMock ? (
          <span className="absolute right-3 top-3 rounded-[var(--radius-pill)] bg-[color:var(--gold)] px-2 py-1 font-display text-[11px] font-bold leading-none text-[color:var(--gold-text)]">
            Example
          </span>
        ) : checked ? (
          <span
            title={deal.updatedAt ?? undefined}
            className="absolute right-3 top-3 rounded-[var(--radius-pill)] bg-[color:color-mix(in_srgb,var(--ink)_78%,transparent)] px-2 py-1 text-[11px] font-medium leading-none text-[color:var(--bg)]"
          >
            checked {checked}
          </span>
        ) : null}
      </div>

      {/* ── Body ───────────────────────────────────── */}
      <div className="space-y-3 px-4 pb-4 pt-3">
        {/* Headline */}
        {deal.headline ? (
          <p className="text-[12px] font-medium leading-snug text-[color:var(--primary)]">
            {deal.headline}
          </p>
        ) : null}

        {/* Hotel name */}
        <div>
          <h3 className="line-clamp-2 font-display text-[16px] font-bold leading-snug text-[color:var(--ink)]">
            {deal.hotelName}
          </h3>
          <p className="mt-[2px] text-[12px] leading-snug text-[color:var(--ink-faint)]">
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
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-display text-[26px] font-bold leading-none text-[color:var(--primary)]">
              {formatMoney(deal.dealPrice)}
            </span>
            <span className="self-end pb-[2px] text-[11px] leading-none text-[color:var(--ink-faint)]">/ night</span>
            <span className="text-[14px] leading-none text-[color:var(--ink-faint)] line-through">
              usually {formatMoney(deal.medianPrice)}
            </span>
          </div>
          {showSavings && (
            <p className="text-[12px] font-medium text-[color:var(--primary)]">
              Save {formatMoney({ priceCents: savings, currency: deal.dealPrice.currency })}/night
            </p>
          )}
        </div>

        {/* OTA compare */}
        {deal.isMock ? (
          <p className="text-caption font-medium leading-snug text-[color:var(--ink-faint)]">Sample hotel — not bookable</p>
        ) : (
          <CompareRow links={deal.links} />
        )}

        {/* Trust line */}
        {!deal.isMock ? (
          <p className="text-caption leading-snug text-[color:var(--ink-faint)]">
            Based on {deal.snapshotCount} price checks over 60 days · expaify never adds fees
          </p>
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
