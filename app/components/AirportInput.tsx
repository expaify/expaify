'use client'

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { Airport } from '@/lib/airports/data'

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
  value: _value,
  displayValue,
  onChange,
  placeholder,
  required,
}: AirportInputProps) {
  const [inputText, setInputText] = useState(displayValue || '')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<Airport[]>([])
  const [highlighted, setHighlighted] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

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
      return
    }

    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/airports?q=${encodeURIComponent(q)}`)
        if (!res.ok) throw new Error('Airport lookup failed')
        const airports = (await res.json()) as Airport[]
        setResults(airports)
        setHighlighted(0)
        setOpen(airports.length > 0)
      } catch {
        setResults([])
        setOpen(false)
      }
    }, 120)

    return () => window.clearTimeout(handle)
  }, [inputText])

  function select(airport: Airport) {
    const display = `${airport.city} (${airport.iata})`
    onChange(airport.iata, display)
    setInputText(display)
    setOpen(false)
  }

  function handleInputChange(next: string) {
    setInputText(next)
    setOpen(true)
    if (next === '') {
      onChange('', '')
      setResults([])
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
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
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600">
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
        onFocus={() => inputText.length > 0 && setOpen(true)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className="field-input"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-white/8 bg-[#111827] shadow-xl">
          {results.map((airport, i) => (
            <div
              key={airport.iata}
              onMouseDown={e => {
                e.preventDefault()
                select(airport)
              }}
              className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5 ${i === highlighted ? 'bg-indigo-500/10' : ''}`}
            >
              <span className="w-8 flex-shrink-0 text-xs font-bold text-indigo-400">{airport.iata}</span>
              <span className="min-w-0">
                <span className="text-sm font-medium text-gray-200">{airport.city}</span>
                <span className="ml-1 text-xs text-gray-500">{airport.name}</span>
              </span>
              <span className="ml-auto text-[10px] text-gray-600">{airport.country}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
