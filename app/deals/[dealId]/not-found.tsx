export default function DealNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--bg)] px-5">
      <div className="w-full max-w-[400px] text-center">
        <a
          href="/"
          className="mb-10 inline-flex items-center gap-0.5 font-display text-[20px] font-bold text-[color:var(--ink)] no-underline"
        >
          expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" />
        </a>

        <div className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--primary-soft)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="var(--primary)" strokeWidth="1.8" />
              <path d="M12 7v5M12 16h.01" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          <h1 className="font-display text-[22px] font-bold text-[color:var(--ink)]">
            This deal has expired.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--ink-soft)]">
            We update our feed daily — there are usually hundreds of active deals.
          </p>

          <a href="/deals" className="btn btn-primary mt-6 w-full justify-center">
            Browse current deals
          </a>
        </div>
      </div>
    </div>
  )
}
