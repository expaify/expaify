'use client'

import { useEffect, useState, useRef } from 'react'
import type { DealSearchFilters } from '@/lib/ai/dealSearchFilters'

type Props = {
  premium: boolean
  onResult: (filters: DealSearchFilters, rawQuery: string) => void
  onClear: () => void
}

export function SearchBar({ premium, onResult, onClear }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed] = useState<DealSearchFilters | null>(null)
  const [message, setMessage] = useState<string | null>(premium ? null : 'Natural-language search is included with Premium.')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (premium && message === 'Natural-language search is included with Premium.') {
      setMessage(null)
    }
    if (!premium) {
      setParsed(null)
      setMessage('Natural-language search is included with Premium.')
    }
  }, [premium, message])

  async function handleSearch(q: string) {
    const trimmed = q.trim()
    if (!premium) {
      setMessage('Natural-language search is included with Premium.')
      return
    }
    if (!trimmed) {
      setParsed(null)
      setMessage(null)
      onClear()
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/search/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      })
      const data = (await res.json()) as { filters?: DealSearchFilters; error?: string }
      if (!res.ok || data.error || !data.filters) {
        setParsed(null)
        setMessage(data.error || "Couldn't parse that — try the filters instead")
        return
      }
      setParsed(data.filters)
      onResult(data.filters, trimmed)
    } catch {
      setParsed(null)
      setMessage("Couldn't parse that — try the filters instead")
    } finally {
      setLoading(false)
    }
  }

  function clear() {
    setQuery('')
    setParsed(null)
    setMessage(premium ? null : 'Natural-language search is included with Premium.')
    onClear()
    inputRef.current?.focus()
  }

  const chips = parsed
    ? [
        parsed.destination_type ? 'Hotels' : null,
        parsed.city ? `City: ${parsed.city}` : null,
        parsed.max_price ? `≤$${parsed.max_price}/night` : null,
        parsed.min_stars ? `${parsed.min_stars}★ & up` : null,
        parsed.min_discount ? `${parsed.min_discount}%+ off` : null,
        parsed.date_from ? `From ${parsed.date_from}` : null,
        parsed.date_to ? `To ${parsed.date_to}` : null,
      ].filter(Boolean)
    : []

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(query) }}
          placeholder={premium ? "Search e.g. '4 star hotels in Miami under $150'" : 'Upgrade to search deals in plain English'}
          disabled={loading || !premium}
          className="w-full rounded-[var(--radius-input)] border border-[color:var(--line-ivory)] bg-white px-4 py-3 text-[14px] text-[color:var(--ink)] outline-none transition-colors focus:border-[color:var(--primary)] placeholder:text-[color:var(--ink-faint)] disabled:bg-[color:var(--surface)] disabled:opacity-75"
        />
        <button
          type="button"
          onClick={() => handleSearch(query)}
          disabled={loading || !premium}
          aria-label="Search deals"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-input)] bg-[color:var(--primary)] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          )}
        </button>
        {(parsed || query) && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="shrink-0 text-[13px] text-[color:var(--ink-faint)] hover:text-[color:var(--ink)]"
          >
            Clear
          </button>
        )}
      </div>

      {message && (
        <p className="mt-2 text-[12px] font-medium text-[color:var(--ink-soft)]">
          {message}
        </p>
      )}

      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map(chip => (
            <span
              key={chip!}
              className="inline-flex items-center rounded-[var(--radius-pill)] bg-[color:var(--primary-soft)] px-3 py-1 text-[12px] font-medium text-[color:var(--primary)]"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
