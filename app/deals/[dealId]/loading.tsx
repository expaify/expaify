export default function LoadingDealDetails() {
  return (
    <main className="min-h-screen bg-[color:var(--bg-base)] px-4 py-5 text-[color:var(--text-1)] sm:px-6">
      <div
        className="mx-auto flex w-full max-w-5xl flex-col gap-4"
        role="status"
        aria-label="Loading deal details."
      >
        <div className="h-8 w-32 rounded-full shimmer" aria-hidden="true" />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="card flex min-w-0 flex-col gap-4 p-4 sm:p-6">
            <div className="flex flex-wrap gap-2" aria-hidden="true">
              <div className="h-8 w-24 rounded-full shimmer" />
              <div className="h-8 w-28 rounded-full shimmer" />
              <div className="h-8 w-40 rounded-full shimmer" />
            </div>

            <div className="space-y-3" aria-hidden="true">
              <div className="h-8 w-4/5 rounded-[var(--radius-control)] shimmer" />
              <div className="h-5 w-full rounded-[var(--radius-control)] shimmer" />
            </div>

            <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
                Loading deal details
              </p>
              <div className="mt-2 h-10 w-36 rounded-[var(--radius-control)] shimmer" aria-hidden="true" />
              <div className="mt-3 h-4 w-5/6 rounded-[var(--radius-control)] shimmer" aria-hidden="true" />
            </section>

            <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4">
              <div className="h-5 w-24 rounded-[var(--radius-control)] shimmer" aria-hidden="true" />
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden="true">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <div className="h-3 w-16 rounded-[var(--radius-control)] shimmer" />
                    <div className="h-5 w-full rounded-[var(--radius-control)] shimmer" />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
                Deal Score
              </p>
              <p className="mt-0.5 text-xs font-medium leading-5 text-[color:var(--text-2)]">
                Checking recent price history
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 min-[420px]:grid-cols-3" aria-hidden="true">
                <div className="h-10 rounded-[var(--radius-control)] shimmer" />
                <div className="h-10 rounded-[var(--radius-control)] shimmer" />
                <div className="h-10 rounded-[var(--radius-control)] shimmer" />
              </div>
            </section>
          </section>

          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-5 lg:self-start">
            <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4">
              <div className="h-12 w-full rounded-[var(--radius-control)] shimmer" aria-hidden="true" />
              <div className="mx-auto mt-3 h-4 w-4/5 rounded-[var(--radius-control)] shimmer" aria-hidden="true" />
            </section>
            <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4">
              <div className="h-4 w-20 rounded-[var(--radius-control)] shimmer" aria-hidden="true" />
              <div className="mt-3 h-5 w-40 rounded-[var(--radius-control)] shimmer" aria-hidden="true" />
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
