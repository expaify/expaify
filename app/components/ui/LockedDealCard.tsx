import { StarRow } from "./StarRow";

type LockedDealCardProps = {
  placeholderName: string;
  placeholderCity: string;
  stars: number;
  photoUrl?: string;
};

export function LockedDealCard({ placeholderName, placeholderCity, stars, photoUrl }: LockedDealCardProps) {
  return (
    <article className="transition-card overflow-hidden rounded-[var(--radius-card)] bg-[color:var(--surface)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]">
      <div className="relative aspect-[3/2] bg-[color:var(--line-ivory)]">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            className="h-full w-full rounded-t-[16px] object-cover"
            loading="lazy"
          />
        ) : null}
        <span className="absolute left-4 top-4 rounded-[var(--radius-pill)] bg-[color:var(--gold)] px-[10px] py-1 font-display text-[13px] font-bold leading-none text-[color:var(--gold-text)]">
          Members
        </span>
        <span className="absolute right-4 top-4 rounded-[var(--radius-pill)] bg-[rgba(20,18,16,0.75)] px-[10px] py-1 text-[11.5px] font-medium leading-none text-white">
          Found
        </span>
      </div>
      <div className="relative space-y-4 p-4">
        <div className="space-y-2">
          <h3 className="pointer-events-none select-none font-display text-[20px] font-bold leading-tight text-[color:var(--ink)] blur-[6px]">
            {placeholderName}
          </h3>
          <StarRow stars={stars} />
          <p className="text-[13px] leading-snug text-[color:var(--ink-faint)]">{placeholderCity}</p>
        </div>
        <div className="pointer-events-none select-none space-y-2 blur-[6px]">
          <div className="h-8 w-32 rounded-[var(--radius-pill)] bg-[color:var(--primary)]" />
          <div className="h-4 w-24 rounded-[var(--radius-pill)] bg-[color:var(--line-ivory)]" />
        </div>
        <div className="absolute inset-x-4 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 rounded-[var(--radius-card)] bg-[rgba(255,255,255,0.82)] p-4 text-center">
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="stroke-[color:var(--ink)]">
            <path d="M7 10V8a5 5 0 0 1 10 0v2" fill="none" strokeWidth="2" strokeLinecap="round" />
            <rect x="5" y="10" width="14" height="10" rx="2" fill="none" strokeWidth="2" />
          </svg>
          <button type="button" className="btn btn-conversion min-h-9 px-4 text-[13px]">
            Unlock with Premium
          </button>
        </div>
      </div>
    </article>
  );
}
