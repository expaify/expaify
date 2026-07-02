type LockedDealCardProps = {
  placeholderName: string;
  placeholderCity: string;
  stars: number;
  photoUrl?: string;
  joinHref?: string;
};

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
}: LockedDealCardProps) {
  return (
    <article className="overflow-hidden rounded-[24px] border-[0.5px] border-[#e8e2d8] bg-white transition-[transform,box-shadow] duration-150 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(20,18,16,0.12)]">
      {/* ── Image area ─────────────────────────────── */}
      <div className="relative h-[160px] overflow-hidden">
        {photoUrl ? (
          <>
            <img src={photoUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(14,90,84,0.35)] to-transparent" aria-hidden />
          </>
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "linear-gradient(150deg,#0E5A54 0%,#0A4440 100%)" }}
            aria-hidden
          >
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

        {/* Members chip — top left */}
        <span className="absolute left-3 top-3 rounded-[999px] bg-[color:var(--gold)] px-[12px] py-[5px] font-display text-[15px] font-bold leading-none text-[color:var(--gold-text)]">
          Members
        </span>

        {/* Found pill — top right */}
        <span className="absolute right-3 top-3 rounded-[999px] bg-[rgba(20,18,16,0.78)] px-[10px] py-[4px] text-[11px] font-medium leading-none text-[#FAF7F2]">
          found today
        </span>
      </div>

      {/* ── Body ───────────────────────────────────── */}
      <div className="relative space-y-3 px-[18px] pb-[18px] pt-[14px]">
        {/* Blurred content */}
        <div className="pointer-events-none select-none blur-[5px]" aria-hidden>
          <h3 className="font-display text-[16px] font-[600] leading-snug text-[#141210]">
            {placeholderName}
          </h3>
          <p className="mt-[2px] text-[12px] leading-snug text-[#8a857d]">
            {starChars(stars)} · {placeholderCity}
          </p>
        </div>
        <div className="pointer-events-none select-none space-y-[2px] blur-[5px]" aria-hidden>
          <div className="flex items-baseline gap-2">
            <div className="h-7 w-16 rounded-full bg-[#0E5A54]" />
            <div className="h-4 w-10 rounded-full bg-[#e8e2d8]" />
            <div className="h-4 w-20 rounded-full bg-[#e8e2d8]" />
          </div>
        </div>
        <div className="pointer-events-none select-none blur-[5px]" aria-hidden>
          <div className="grid grid-cols-4 gap-[6px]">
            {["Expedia", "Booking", "Kiwi", "Trip.com"].map((name) => (
              <div key={name} className="rounded-[10px] border-[0.5px] border-[#d8d2c6] py-2 text-center text-[11px] font-medium text-[#141210]">
                {name}
              </div>
            ))}
          </div>
        </div>

        {/* Unlock overlay */}
        <div className="absolute inset-x-4 top-1/2 flex -translate-y-1/2 flex-col items-center gap-3 rounded-[16px] bg-[rgba(255,255,255,0.90)] px-4 py-5 text-center shadow-[0_4px_20px_rgba(20,18,16,0.10)] backdrop-blur-[2px]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#141210" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <p className="text-[12px] font-medium text-[#5C5852]">Members-only deal</p>
          <a href={joinHref} className="btn btn-conversion min-h-[36px] px-5 text-[13px]">
            Unlock with Premium
          </a>
        </div>
      </div>
    </article>
  );
}
