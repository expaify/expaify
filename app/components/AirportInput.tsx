'use client'

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { AirportLookupAirport, AirportLookupData, Result } from '@/lib/types'

const cache = new Map<string, AirportLookupData>()
type LookupState = 'idle' | 'loading' | 'too_short' | 'settled' | 'error'

interface AirportInputProps {
  id: string
  value: string
  displayValue: string
  onChange: (iata: string, display: string) => void
  placeholder: string
  required?: boolean
}

export default function AirportInput({
  id,
  displayValue,
  onChange,
  placeholder,
  required,
}: AirportInputProps) {
  const [inputText, setInputText] = useState(displayValue || '')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<AirportLookupAirport[]>([])
  const [highlighted, setHighlighted] = useState(0)
  const [lookupState, setLookupState] = useState<LookupState>('idle')
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = `${id}-airport-listbox`
  const statusId = `${id}-airport-status`
  const activeOptionId = open && results[highlighted] ? `${id}-airport-option-${results[highlighted].iata}` : undefined

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
  }, [inputText])

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

  async function selectFirstMatch() {
    const q = inputText.trim()
    if (!q) return

    try {
      const data = await fetchAirportSuggestions(q)
      const airport = data.airports[0]
      if (airport) select(airport)
    } catch {
      // Keep the user's text in place if lookup fails.
    }
  }

  function handleBlur() {
    setOpen(false)
    setHighlighted(0)
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
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
      event.preventDefault()
      await selectFirstMatch()
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
    <div ref={rootRef} className="relative">
      <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
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
        onFocus={() => inputText.length > 0 && setOpen(true)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-describedby={statusId}
        className="min-h-[3.25rem] w-full rounded-[0.875rem] border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-[0.9375rem] font-semibold text-slate-950 transition-[border-color,box-shadow,background] placeholder:text-slate-400 placeholder:font-medium focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
      />
      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={`${placeholder} suggestions`}
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-[0_22px_60px_rgba(15,23,42,0.16)]"
        >
          {results.length > 0 ? (
            results.map((airport, i) => (
              <div
                id={`${id}-airport-option-${airport.iata}`}
                key={airport.iata}
                role="option"
                aria-selected={i === highlighted}
                onMouseDown={e => {
                  e.preventDefault()
                  select(airport)
                }}
                className={`grid cursor-pointer grid-cols-[2.75rem_minmax(0,1fr)_auto] items-start gap-3 rounded-[0.9rem] px-4 py-3 transition-colors hover:bg-slate-50 ${i === highlighted ? 'bg-indigo-50 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.12)]' : ''}`}
              >
                <span className="rounded-full bg-slate-100 px-2 py-1 text-center text-[11px] font-bold text-indigo-700">{airport.iata}</span>
                <span className="min-w-0 leading-tight">
                  <span className="block break-words text-sm font-semibold text-slate-900">{airport.city}</span>
                  <span className="mt-0.5 block break-words text-xs leading-snug text-slate-500">{airport.name}</span>
                </span>
                <span className="pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{airport.country}</span>
              </div>
            ))
          ) : lookupState === 'settled' ? (
            <div className="px-4 py-3 text-sm font-medium text-slate-600">No matching airports found. Check the city or 3-letter airport code.</div>
          ) : lookupState === 'too_short' ? (
            <div className="px-4 py-3 text-sm font-medium text-slate-600">Type at least 2 characters to search airports.</div>
          ) : lookupState === 'loading' ? (
            <div className="px-4 py-3 text-sm font-medium text-slate-600">Searching airports...</div>
          ) : lookupState === 'error' ? (
            <div className="px-4 py-3 text-sm font-medium text-slate-600">Airport lookup is unavailable. Try again in a moment.</div>
          ) : null}
        </div>
      )}
      <div id={statusId} role="status" aria-live="polite" className="sr-only">
        {open && lookupState === 'loading' ? 'Searching airports.' : ''}
        {open && lookupState === 'too_short' ? 'Type at least 2 characters to search airports.' : ''}
        {open && lookupState === 'settled' && results.length === 0 ? 'No matching airports found. Check the city or 3-letter airport code.' : ''}
        {open && lookupState === 'error' ? 'Airport lookup is unavailable. Try again in a moment.' : ''}
      </div>
    </div>
  )
}

async function fetchAirportSuggestions(query: string): Promise<AirportLookupData> {
  const res = await fetch(`/api/airports?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('Airport lookup failed')

  const body = await res.json() as Result<AirportLookupData>
  if (!body.ok) throw new Error('Airport lookup failed')

  return body.data
}
