export default function LoadingDealDetail() {
  return (
    <main className="mx-auto w-full max-w-[1080px] px-4 py-5 sm:px-6 sm:py-8">
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">Loading hotel details</p>
      <div aria-hidden="true">
        <div className="skeleton h-11 w-36 rounded-[var(--radius-control)]" />
        <div className="mt-4 space-y-4">
          <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6">
            <div className="skeleton h-4 w-32 rounded-full" /><div className="skeleton mt-3 h-8 w-3/4 rounded-[var(--radius-control)]" />
            <div className="skeleton mt-4 h-20 w-full rounded-[var(--radius-control)]" />
            <div className="mt-3 grid gap-3 min-[480px]:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-[var(--radius-control)]" />)}</div>
          </section>
          <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6"><div className="skeleton h-6 w-48 rounded-full" /><div className="mt-4 grid gap-4 lg:grid-cols-2"><div className="skeleton h-36 rounded-[var(--radius-control)]" /><div className="skeleton h-36 rounded-[var(--radius-control)]" /></div></section>
          <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6"><div className="skeleton h-6 w-28 rounded-full" /><div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="skeleton h-20 rounded-[var(--radius-control)]" /><div className="skeleton h-20 rounded-[var(--radius-control)]" /></div></section>
          <section className="rounded-[var(--radius-card)] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] p-4 sm:p-6"><div className="skeleton h-6 w-56 rounded-full" /><div className="skeleton mt-4 h-12 w-full rounded-[var(--radius-control)]" /></section>
          <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6"><div className="skeleton h-6 w-44 rounded-full" /><div className="skeleton mt-4 h-44 w-full rounded-[var(--radius-card)]" /></section>
        </div>
      </div>
    </main>
  )
}
