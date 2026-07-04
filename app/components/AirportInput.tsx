'use client'

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { AirportLookupAirport, AirportLookupData, Result } from '@/lib/types'

const cache = new Map<string, AirportLookupData>()
type LookupState = 'idle' | 'loading' | 'too_short' | 'settled' | 'error'
type SelectionKind = 'selected' | 'resolved'

interface AirportInputProps {
  id: string
  value: string
  displayValue: string
  onChange: (iata: string, display: string) => void
  placeholder: string
  required?: boolean
  selectionKind?: SelectionKind | null
  error?: string | null
  nearbyAvailable?: boolean
}

export default function AirportInput({
  id,
  displayValue,
  value,
  onChange,
  placeholder,
  required,
  selectionKind = null,
  error = null,
  nearbyAvailable = false,
}: AirportInputProps) {
  const [inputText, setInputText] = useState(displayValue || '')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<AirportLookupAirport[]>([])
  const [highlighted, setHighlighted] = useState(0)
  const [lookupState, setLookupState] = useState<LookupState>('idle')
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = `${id}-airport-listbox`
  const statusId = `${id}-airport-status`
  const errorId = `${id}-airport-error`
  const helperId = `${id}-airport-helper`
  const nearbyId = `${id}-airport-nearby`
  const activeOptionId = open && results[highlighted] ? `${id}-airport-option-${results[highlighted].iata}` : undefined
  const selectedIata = value.trim().toUpperCase()
  const hasSelectedScope = Boolean(selectedIata && selectionKind)
  const describedBy = [
    statusId,
    hasSelectedScope ? helperId : null,
    nearbyAvailable && hasSelectedScope ? nearbyId : null,
    error ? errorId : null,
  ].filter(Boolean).join(' ')

  useEffect(() => {
    setInputText(displayValue || '')
  }, [displayValue])

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  useEffect(() => {
    const q = inputText.trim()
    if (q.length < 1) {
      setResults([])
      setOpen(false)
      setHighlighted(0)
      setLookupState('idle')
      return
    }
    if (selectedIata && displayValue && q === displayValue.trim()) {
      setResults([])
      setOpen(false)
      setHighlighted(0)
      setLookupState('idle')
      return
    }

    const handle = window.setTimeout(async () => {
      const cached = cache.get(q.toLowerCase())
      if (cached) {
        setResults(cached.airports)
        setHighlighted(0)
        setLookupState(cached.status === 'too_short' ? 'too_short' : 'settled')
        setOpen(true)
        return
      }

      try {
        setLookupState('loading')
        const data = await fetchAirportSuggestions(q)
        cache.set(q.toLowerCase(), data)
        setResults(data.airports)
        setHighlighted(0)
        setLookupState(data.status === 'too_short' ? 'too_short' : 'settled')
        setOpen(true)
      } catch {
        setResults([])
        setLookupState('error')
        setOpen(true)
      }
    }, 120)

    return () => window.clearTimeout(handle)
  }, [displayValue, inputText, selectedIata])

  function select(airport: AirportLookupAirport) {
    const display = `${airport.iata} - ${airport.city} (${airport.name})`
    onChange(airport.iata, display)
    setInputText(display)
    setOpen(false)
  }

  function handleInputChange(next: string) {
    setInputText(next)
    setOpen(next.trim().length > 0)
    setLookupState('idle')
    if (next === '') {
      onChange('', '')
    } else {
      onChange('', next)
    }
    setResults([])
  }

  function handleBlur() {
    setOpen(false)
    setHighlighted(0)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      setHighlighted(0)
      return
    }

    if (event.key === 'ArrowDown' && !open && inputText.trim().length > 0) {
      event.preventDefault()
      setOpen(true)
      return
    }

    if (event.key === 'Enter' && (!open || results.length === 0)) {
      if (selectedIata) return
      event.preventDefault()
      if (inputText.trim().length > 0) setOpen(true)
      return
    }

    if (!open || results.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted(i => Math.min(i + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted(i => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      select(results[highlighted])
    }
  }

  return (
    <div ref={rootRef} className="relative space-y-2">
      <div className="pointer-events-none absolute left-3.5 top-[1.625rem] -translate-y-1/2 text-[color:var(--text-3)]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2C8.69 2 6 4.69 6 8c0 5.25 6 14 6 14s6-8.75 6-14c0-3.31-2.69-6-6-6zm0 8.5A2.5 2.5 0 1112 5.5a2.5 2.5 0 010 5z" fill="currentColor" />
        </svg>
      </div>
      <input
        id={id}
        type="text"
        value={inputText}
        onChange={e => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={() => !selectedIata && inputText.length > 0 && setOpen(true)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-describedby={describedBy}
        aria-invalid={error ? 'true' : 'false'}
        className={`min-h-[3.25rem] w-full rounded-[var(--radius-control)] border bg-[var(--bg-raised)] px-4 py-3.5 pl-11 text-[0.9375rem] font-medium text-[var(--text-1)] transition-[border-color,background] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-0 ${
          error
            ? 'border-[var(--error)] bg-[var(--error-soft)] focus:border-[var(--error)]'
            : 'border-[var(--border)] focus:border-[var(--border-focus)]'
        }`}
      />
      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={`${placeholder} suggestions`}
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-raised)] p-1.5 shadow-[var(--shadow-lift)]"
        >
          {results.length > 0 ? (
            groupedResults(results).map(group => (
              <div key={group.key}>
                {group.grouped && (
                  <div className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-[var(--text-3)]">
                    {group.city} airports
                  </div>
                )}
                {group.airports.map(airport => {
                  const i = results.findIndex(item => item.iata === airport.iata)
                  return (
                    <div
                      id={`${id}-airport-option-${airport.iata}`}
                      key={airport.iata}
                      role="option"
                      aria-selected={i === highlighted}
                      onMouseDown={e => {
                        e.preventDefault()
                        select(airport)
                      }}
                      className={`grid min-h-[4.25rem] cursor-pointer grid-cols-[3.25rem_minmax(0,1fr)] gap-3 rounded-[var(--radius-control)] px-3 py-3 text-left transition-colors hover:bg-[var(--bg-muted)] ${i === highlighted ? 'bg-[var(--brand-soft)] shadow-[inset_0_0_0_1px_var(--border-hover)]' : ''}`}
                    >
                      <span className="inline-flex h-8 min-w-12 items-center justify-center rounded-[var(--radius-control)] bg-[var(--bg-muted)] px-2 text-xs font-medium text-[var(--brand)]">{airport.iata}</span>
                      <span className="min-w-0">
                        <span className="block min-w-0 break-words text-sm font-bold leading-5 text-[var(--text-1)]">{airport.name}</span>
                        <span className="mt-0.5 block min-w-0 break-words text-xs font-medium leading-5 text-[var(--text-2)]">{airport.city}, {airport.country}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            ))
          ) : lookupState === 'settled' ? (
            <div className="px-4 py-3 text-sm font-medium text-[var(--text-2)]">No matching airports found. Check the city or 3-letter airport code.</div>
          ) : lookupState === 'too_short' ? (
            <div className="px-4 py-3 text-sm font-medium text-[var(--text-2)]">Type at least 2 characters to search airports.</div>
          ) : lookupState === 'loading' ? (
            <div className="px-4 py-3 text-sm font-medium text-[var(--text-2)]">Searching airports...</div>
          ) : lookupState === 'error' ? (
            <div className="px-4 py-3 text-sm font-medium text-[var(--text-2)]">Airport lookup is unavailable. Try again in a moment.</div>
          ) : null}
        </div>
      )}
      {hasSelectedScope && (
        <div id={helperId} className={`flex min-h-5 items-start gap-1.5 text-xs font-bold leading-5 ${selectionKind === 'resolved' ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
          {selectionKind === 'resolved'
            ? `Resolved to ${selectedIata}. Review before searching.`
            : `Searching ${selectedIata} only.`}
        </div>
      )}
      {nearbyAvailable && hasSelectedScope && (
        <button
          id={nearbyId}
          type="button"
          onClick={() => window.alert(`Search still uses ${selectedIata} only. Nearby-airport search needs a separate provider update.`)}
          className="inline-flex min-h-6 items-center text-xs font-medium text-[var(--brand)] underline-offset-4 hover:underline focus-visible:outline-none"
        >
          Nearby airports available
        </button>
      )}
      {error && (
        <p id={errorId} className="text-xs font-bold leading-5 text-[var(--error)]" role="alert">
          {error}
        </p>
      )}
      <div id={statusId} role="status" aria-live="polite" className="sr-only">
        {open && lookupState === 'loading' ? 'Searching airports.' : ''}
        {open && lookupState === 'too_short' ? 'Type at least 2 characters to search airports.' : ''}
        {open && lookupState === 'settled' && results.length > 0 ? screenReaderResultsStatus(results) : ''}
        {open && lookupState === 'settled' && results.length === 0 ? 'No matching airports found. Check the city or 3-letter airport code.' : ''}
        {open && lookupState === 'error' ? 'Airport lookup is unavailable. Try again in a moment.' : ''}
        {!open && hasSelectedScope && selectionKind === 'selected' ? `${selectedIata} selected. Searching ${selectedIata} only.` : ''}
        {!open && hasSelectedScope && selectionKind === 'resolved' ? `${selectedIata} selected from shared route or ZIP. Review before searching.` : ''}
      </div>
    </div>
  )
}

function groupedResults(airports: AirportLookupAirport[]) {
  const cityCounts = airports.reduce<Record<string, number>>((counts, airport) => {
    counts[airport.city] = (counts[airport.city] ?? 0) + 1
    return counts
  }, {})
  const groups: Array<{ key: string; city: string; grouped: boolean; airports: AirportLookupAirport[] }> = []

  for (const airport of airports) {
    const grouped = cityCounts[airport.city] > 1
    const key = grouped ? airport.city : airport.iata
    let group = groups.find(item => item.key === key)
    if (!group) {
      group = { key, city: airport.city, grouped, airports: [] }
      groups.push(group)
    }
    group.airports.push(airport)
  }

  return groups
}

function screenReaderResultsStatus(airports: AirportLookupAirport[]) {
  const repeatedCity = airports.find(airport =>
    airports.filter(item => item.city === airport.city).length > 1
  )?.city

  if (repeatedCity) {
    return `${airports.length} airport suggestions available, including multiple ${repeatedCity} airports. Choose one airport before searching.`
  }

  return `${airports.length} airport suggestions available. Use arrow keys to review options.`
}

async function fetchAirportSuggestions(query: string): Promise<AirportLookupData> {
  const res = await fetch(`/api/airports?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Airport lookup failed')

  const body = await res.json() as Result<AirportLookupData>
  if (!body.ok) throw new Error('Airport lookup failed')

  return body.data
}
