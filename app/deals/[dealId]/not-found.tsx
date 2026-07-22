export default function DealNotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-[560px] items-center px-4 py-8 sm:px-6">
      <section className="w-full rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-6 text-center sm:p-8">
        <h1 className="font-display text-2xl font-bold text-[color:var(--text-1)]">Hotel details unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">We could not find this hotel deal. It may have been removed or the link may be incomplete.</p>
        <a href="/deals" className="btn btn-primary mt-6 inline-flex min-h-11 w-full items-center justify-center">Back to saved deals</a>
      </section>
    </main>
  )
}
