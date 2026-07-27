'use client'

import { useEffect, useRef, useState } from 'react'

export default function DealDetailError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [retrying, setRetrying] = useState(false)
  useEffect(() => { headingRef.current?.focus() }, [])

  if (retrying) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-[560px] items-center px-4 py-8 sm:px-6">
        <p role="status" aria-live="polite" aria-atomic="true" className="font-medium text-[color:var(--text-2)]">Loading hotel details</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-[560px] items-center px-4 py-8 sm:px-6">
      <section role="alert" className="w-full rounded-[var(--radius-card)] border border-[color:var(--border-strong)] bg-[color:var(--error-soft)] p-6 sm:p-8">
        <h1 ref={headingRef} tabIndex={-1} className="rounded-[var(--radius-control)] font-display text-2xl font-bold text-[color:var(--text-1)]">Hotel details could not be loaded</h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">We could not load this hotel right now. Try again, or return to your previous hotel list.</p>
        <div className="mt-6 flex flex-col gap-3"><button type="button" onClick={() => { setRetrying(true); unstable_retry() }} className="btn btn-primary min-h-11">Try again</button><a href="/deals" className="inline-flex min-h-11 items-center justify-center font-medium text-[color:var(--text-1)]">Back to saved deals</a></div>
      </section>
    </main>
  )
}
