export function AdminForbidden() {
  return (
    <div className="mx-auto max-w-[860px] px-5 py-10 sm:px-5">
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-muted)] px-5 py-6 text-center">
        <h1 className="text-h3 text-[var(--text-1)]">You don&apos;t have access to this page</h1>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          Admin tools are limited to expaify support and engineering staff. If you think you should
          have access, contact your engineering lead.
        </p>
        <a
          href="/account"
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-[var(--brand)] px-4 text-sm font-bold text-[var(--text-inverse)] no-underline focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          Back to your account
        </a>
      </div>
    </div>
  )
}

export function AdminRoleCheckError() {
  return (
    <div className="mx-auto max-w-[860px] px-5 py-10 sm:px-5">
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-muted)] px-5 py-6 text-center">
        <h1 className="text-h3 text-[var(--text-1)]">Couldn&apos;t verify admin access</h1>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          Something went wrong checking your permissions. No account data was loaded.
        </p>
        <a
          href="."
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 text-sm font-bold text-[var(--text-1)] no-underline focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          Try again
        </a>
      </div>
    </div>
  )
}
