const ERROR_COPY: Record<string, string> = {
  Configuration: "There's a temporary problem with our sign-in service. Please try again in a moment.",
  AccessDenied: "Access was denied. If this is unexpected, try a different sign-in method.",
  Verification: "Your sign-in link has expired or already been used. Request a new one below.",
  Default: "Something went wrong during sign-in. Please try again.",
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const message = ERROR_COPY[error ?? ''] ?? ERROR_COPY.Default

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--bg)] px-5">
      <div className="w-full max-w-[400px]">
        <a
          href="/"
          className="mb-10 flex items-center gap-0.5 font-display text-[20px] font-bold text-[color:var(--ink)] no-underline"
        >
          expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" />
        </a>

        <div className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="#EF4444" strokeWidth="2" />
              <path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          <h1 className="text-center font-display text-[22px] font-bold text-[color:var(--ink)]">
            Sign-in failed
          </h1>
          <p className="mt-3 text-center text-[15px] leading-relaxed text-[color:var(--ink-soft)]">
            {message}
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <a href="/login" className="btn btn-primary w-full justify-center">
              Try again
            </a>
            <a href="/deals" className="btn btn-outline w-full justify-center">
              Browse deals
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
