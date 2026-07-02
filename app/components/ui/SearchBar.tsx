'use client'

import { useState, useRef } from 'react'

type ParseResult = {
  city?: string
  maxPriceCents?: number
  minDiscount?: number
}

type Props = {
  onResult: (result: ParseResult, rawQuery: string) => void
  onClear: () => void
}

export function SearchBar({ onResult, onClear }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSearch(q: string) {
    const trimmed = q.trim()
    if (!trimmed) {
      setParsed(null)
      onClear()
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/search/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      })
      const data = (await res.json()) as ParseResult
      setParsed(data)
      onResult(data, trimmed)
    } catch {
      onClear()
    } finally {
      setLoading(false)
    }
  }

  function clear() {
    setQuery('')
    setParsed(null)
    onClear()
    inputRef.current?.focus()
  }

  const chips = parsed
    ? [
        parsed.city ? `City: ${parsed.city}` : null,
        parsed.maxPriceCents ? `≤$${Math.round(parsed.maxPriceCents / 100)}/night` : null,
        parsed.minDiscount ? `${parsed.minDiscount}%+ off` : null,
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
          placeholder="Search e.g. 'beach hotels in Miami under $150'"
          disabled={loading}
          className="w-full rounded-[12px] border border-[color:var(--line-ivory)] bg-white px-4 py-3 text-[14px] text-[color:var(--ink)] outline-none transition-colors focus:border-[color:var(--primary)] placeholder:text-[color:var(--ink-faint)] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => handleSearch(query)}
          disabled={loading}
          aria-label="Search"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[color:var(--primary)] text-white transition-opacity hover:opacity-90 disabled:opacity-60"
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
        {parsed && (
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

      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map(chip => (
            <span
              key={chip!}
              className="inline-flex items-center rounded-[999px] bg-[color:var(--primary-soft)] px-3 py-1 text-[12px] font-medium text-[color:var(--primary)]"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
