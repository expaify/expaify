'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminResultRow } from './AdminResultRow'
import type { AdminLookupResult } from '@/lib/admin/lookup'
import type { Result } from '@/lib/types'
import { formatMoney } from '@/lib/money'

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'result'; query: string; data: AdminLookupResult }

export function AdminUserSearch() {
  const [value, setValue] = useState('')
  const [state, setState] = useState<SearchState>({ kind: 'idle' })
  const [showAlertsInline, setShowAlertsInline] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultHeadingRef = useRef<HTMLHeadingElement>(null)
  const rowHeadingRef = useRef<HTMLSpanElement>(null)
  const router = useRouter()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (state.kind === 'result') {
      if (state.data.account && state.data.publicAlerts.length === 0) {
        // Single registered account — focus its row heading.
        window.requestAnimationFrame(() => rowHeadingRef.current?.focus())
      } else {
        window.requestAnimationFrame(() => resultHeadingRef.current?.focus())
      }
    } else if (state.kind === 'error') {
      window.requestAnimationFrame(() => resultHeadingRef.current?.focus())
    }
  }, [state])

  async function runSearch(q: string) {
    setShowAlertsInline(false)
    setState({ kind: 'loading' })
    try {
      const res = await fetch(`/api/admin/lookup?q=${encodeURIComponent(q)}`)
      const body = (await res.json()) as Result<AdminLookupResult>
      if (!body.ok) {
        setState({ kind: 'error' })
        return
      }
      setState({ kind: 'result', query: q, data: body.data })
    } catch {
      setState({ kind: 'error' })
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = value.trim()
    if (!q || state.kind === 'loading') return
    void runSearch(q)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setValue('')
    }
  }

  return (
    <div className="mx-auto max-w-[860px] px-4 py-6 sm:px-5 sm:py-10">
      <h1 className="text-h2 text-[var(--text-1)]">User lookup</h1>
      <p className="mt-1 text-sm text-[var(--text-2)]">
        Search by email, user ID, Stripe customer ID, Stripe subscription ID, or price-alert email to
        open one account.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 flex gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] p-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Email, user ID, or Stripe ID"
          aria-label="Email, user ID, or Stripe ID"
          className="min-h-11 flex-1 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-1)] focus-visible:border-[var(--border-focus)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        />
        <button
          type="submit"
          disabled={state.kind === 'loading'}
          className="min-h-11 rounded-[var(--radius-control)] bg-[var(--brand)] px-4 text-sm font-bold text-[var(--text-inverse)] disabled:opacity-60 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
        >
          {state.kind === 'loading' ? 'Searching…' : 'Search'}
        </button>
      </form>

      <div aria-live="polite" className="sr-only">
        {state.kind === 'loading' ? 'Searching…' : ''}
      </div>

      <div className="mt-6">
        {state.kind === 'loading' && (
          <div className="flex flex-col gap-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[60px] animate-pulse rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-muted)]"
              />
            ))}
          </div>
        )}

        {state.kind === 'error' && (
          <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-muted)] px-5 py-6 text-center">
            <h2 ref={resultHeadingRef} tabIndex={-1} className="text-h3 text-[var(--text-1)] focus-visible:outline-none">
              Search failed
            </h2>
            <p className="mt-2 text-sm text-[var(--text-2)]">
              Something went wrong running that search. Try again in a moment. If it keeps failing, check
              the admin API logs.
            </p>
            <button
              type="button"
              onClick={() => void runSearch(value.trim())}
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 text-sm font-bold text-[var(--text-1)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              Try again
            </button>
          </div>
        )}

        {state.kind === 'result' && (
          <ResultArea
            state={state}
            resultHeadingRef={resultHeadingRef}
            rowHeadingRef={rowHeadingRef}
            showAlertsInline={showAlertsInline}
            setShowAlertsInline={setShowAlertsInline}
            router={router}
          />
        )}
      </div>
    </div>
  )
}

function ResultArea({
  state,
  resultHeadingRef,
  rowHeadingRef,
  showAlertsInline,
  setShowAlertsInline,
}: {
  state: Extract<SearchState, { kind: 'result' }>
  resultHeadingRef: React.RefObject<HTMLHeadingElement | null>
  rowHeadingRef: React.RefObject<HTMLSpanElement | null>
  showAlertsInline: boolean
  setShowAlertsInline: (v: boolean) => void
  router: ReturnType<typeof useRouter>
}) {
  const { query, data } = state
  const { account, publicAlerts } = data

  // No match at all.
  if (!account && publicAlerts.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-muted)] px-5 py-6 text-center">
        <h2 ref={resultHeadingRef} tabIndex={-1} className="text-h3 text-[var(--text-1)] focus-visible:outline-none">
          No matching account or public alert
        </h2>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          Nothing matched &quot;{query}&quot;. Check the spelling, or try another identifier: email, user
          ID, Stripe customer ID, Stripe subscription ID, or price-alert email.
        </p>
      </div>
    )
  }

  // Public-alert-only.
  if (!account && publicAlerts.length > 0) {
    return (
      <div>
        <h2 ref={resultHeadingRef} tabIndex={-1} className="text-h3 text-[var(--text-1)] focus-visible:outline-none">
          No registered account — public price alerts found
        </h2>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          &quot;{query}&quot; isn&apos;t linked to a signed-in account, but it has public price alerts.
          These are created by email without an account.
        </p>
        <PublicAlertsList alerts={publicAlerts} />
      </div>
    )
  }

  // Single registered account, no public alerts.
  if (account && publicAlerts.length === 0) {
    return (
      <div>
        <h2 className="sr-only">Result</h2>
        <AdminResultRow account={account} headingRef={rowHeadingRef} />
      </div>
    )
  }

  // Account plus public alerts — two cards.
  return (
    <div>
      <h2 ref={resultHeadingRef} tabIndex={-1} className="text-h3 text-[var(--text-1)] focus-visible:outline-none">
        Multiple matches for &quot;{query}&quot;
      </h2>
      <p className="mt-2 text-sm text-[var(--text-2)]">
        This search matched more than one kind of record. Choose which to view.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
          <p className="text-sm font-bold text-[var(--text-1)]">Registered account</p>
          <div className="mt-2">
            <AdminResultRow account={account!} />
          </div>
        </div>
        <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-[var(--text-1)]">Public price alerts ({publicAlerts.length})</p>
            <button
              type="button"
              onClick={() => setShowAlertsInline(!showAlertsInline)}
              aria-expanded={showAlertsInline}
              className="text-sm font-bold text-[var(--brand)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              {showAlertsInline ? 'Hide alerts' : 'View alerts'}
            </button>
          </div>
          {showAlertsInline && <PublicAlertsList alerts={publicAlerts} />}
        </div>
      </div>
    </div>
  )
}

function PublicAlertsList({ alerts }: { alerts: AdminLookupResult['publicAlerts'] }) {
  return (
    <div className="mt-4 flex flex-col gap-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex flex-col gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="font-medium text-[var(--text-1)]">
            {alert.hotelId ? `Hotel ${alert.hotelId}` : `${alert.origin ?? '—'} → ${alert.destination ?? '—'}`}
          </span>
          <span className="text-[var(--text-2)]">{formatMoney({ priceCents: alert.targetCents, currency: alert.currency })}</span>
          <span
            className={`w-fit rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-medium ${
              alert.active
                ? 'bg-[var(--success-soft)] text-[var(--text-1)]'
                : 'bg-[var(--bg-muted)] text-[var(--text-2)]'
            }`}
          >
            {alert.active ? 'Active' : 'Inactive'}
          </span>
          <span className="text-xs text-[var(--text-3)]">
            {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(alert.createdAt))}
          </span>
        </div>
      ))}
    </div>
  )
}
