import { timeAgo } from '@/lib/timeAgo'

type LockedDealCardProps = {
  placeholderName: string;
  placeholderCity: string;
  stars: number;
  photoUrl?: string;
  joinHref?: string;
  updatedAt?: string | null;
};

function fmtAbsolute(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function starChars(stars: number): string {
  const n = Math.max(0, Math.min(5, Math.round(stars)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

export function LockedDealCard({
  placeholderName,
  placeholderCity,
  stars,
  photoUrl,
  joinHref = "/join",
  updatedAt,
}: LockedDealCardProps) {
  const checked = timeAgo(updatedAt)
  return (
    <article className="overflow-hidden rounded-[var(--radius-card)] border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--surface)] transition-[transform,box-shadow] duration-150 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]">
      {/* ── Image area ─────────────────────────────── */}
      <div className="relative h-[160px] overflow-hidden">
        {photoUrl ? (
          <>
            <img src={photoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_srgb,var(--primary)_35%,transparent)] to-transparent" aria-hidden />
          </>
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "linear-gradient(150deg,var(--primary) 0%,var(--primary-deep) 100%)" }}
            aria-hidden
          >
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

        {/* Members chip — top left */}
        <span className="absolute left-3 top-3 rounded-[var(--radius-pill)] bg-[color:var(--gold)] px-3 py-1 font-display text-[15px] font-bold leading-none text-[color:var(--gold-text)]">
          Members
        </span>

        {checked !== null && (
          <span
            className="absolute right-3 top-3 rounded-[var(--radius-pill)] bg-[color:color-mix(in_srgb,var(--ink)_78%,transparent)] px-2 py-1 text-[11px] font-medium leading-none text-[color:var(--bg)]"
            title={updatedAt ? fmtAbsolute(updatedAt) : undefined}
          >
            checked {checked}
          </span>
        )}
      </div>

      {/* ── Body ───────────────────────────────────── */}
      <div className="relative space-y-3 px-4 pb-4 pt-3">
        {/* Blurred content */}
        <div className="pointer-events-none select-none blur-[5px]" aria-hidden>
          <h3 className="font-display text-[16px] font-bold leading-snug text-[color:var(--ink)]">
            {placeholderName}
          </h3>
          <p className="mt-[2px] text-[12px] leading-snug text-[color:var(--ink-faint)]">
            {starChars(stars)} · {placeholderCity}
          </p>
        </div>
        <div className="pointer-events-none select-none space-y-[2px] blur-[5px]" aria-hidden>
          <div className="flex items-baseline gap-2">
            <div className="h-7 w-16 rounded-full bg-[color:var(--primary)]" />
            <div className="h-4 w-10 rounded-full bg-[color:var(--line-ivory)]" />
            <div className="h-4 w-20 rounded-full bg-[color:var(--line-ivory)]" />
          </div>
        </div>
        <div className="pointer-events-none select-none blur-[5px]" aria-hidden>
          <div className="grid grid-cols-4 gap-2">
            {["Expedia", "Booking", "Kiwi", "Trip.com"].map((name) => (
              <div key={name} className="rounded-[var(--radius-input)] border-[0.5px] border-[color:var(--line-white)] py-2 text-center text-[11px] font-medium text-[color:var(--ink)]">
                {name}
              </div>
            ))}
          </div>
        </div>

        {/* Unlock overlay */}
        <div className="absolute inset-x-4 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 rounded-[var(--radius-input)] bg-[color:var(--bg-overlay)] px-4 py-4 text-center shadow-[var(--shadow-card-hover)] backdrop-blur-[2px]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <p className="text-[12px] font-medium text-[color:var(--ink-soft)]">Members-only deal</p>
          <a href={joinHref} className="btn btn-conversion min-h-[36px] px-5 text-[13px]">
            Unlock with Premium
          </a>
        </div>
      </div>
    </article>
  );
}
