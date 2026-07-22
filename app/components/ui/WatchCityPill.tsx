'use client'

import { useEffect, useRef, useState } from 'react'

export type WatchCityPillProps = {
  city: string             // display name, must be in TRACKED_MARKET_NAMES
  initialWatching: boolean // server-derived: sub.watchlist.includes(city)
  initialCount: number     // server-derived: sub.watchlist.length
}

type Status = 'idle' | 'error' | 'cap' | 'emptied'
type WatchlistResponse = { watchlist?: unknown; error?: unknown }

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
      <path d="M8 3v10M3 8h10" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8.5l3.2 3.2L13 5" />
    </svg>
  )
}

export function WatchCityPill({ city, initialWatching, initialCount }: WatchCityPillProps) {
  const [watching, setWatching] = useState(initialWatching)
  const [count, setCount] = useState(initialCount)
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const controller = useRef<AbortController | null>(null)
  const emptiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const atCap = !watching && count >= 10

  useEffect(() => () => {
    controller.current?.abort()
    if (emptiedTimer.current) clearTimeout(emptiedTimer.current)
  }, [])

  function showEmptied() {
    setStatus('emptied')
    if (emptiedTimer.current) clearTimeout(emptiedTimer.current)
    emptiedTimer.current = setTimeout(() => {
      setStatus(s => (s === 'emptied' ? 'idle' : s))
    }, 6000)
  }

  async function toggle() {
    if (emptiedTimer.current) {
      clearTimeout(emptiedTimer.current)
      emptiedTimer.current = null
    }
    if (atCap) {
      setStatus('cap')
      return
    }

    const prevWatching = watching
    const prevCount = count
    const op = watching ? 'remove' : 'add'

    setWatching(!prevWatching)
    setCount(op === 'add' ? prevCount + 1 : Math.max(0, prevCount - 1))
    setStatus('idle')
    setPending(true)

    controller.current?.abort()
    const ctrl = new AbortController()
    controller.current = ctrl

    let res: Response | null = null
    let data: WatchlistResponse | null = null
    try {
      res = await fetch('/api/account/watchlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op, city }),
        signal: ctrl.signal,
      })
      data = (await res.json().catch(() => null)) as WatchlistResponse | null
    } catch {
      // Aborted by a newer click — that click owns the state now.
      if (ctrl.signal.aborted) return
    }
    if (controller.current !== ctrl) return

    setPending(false)

    if (res?.ok) {
      const list = Array.isArray(data?.watchlist)
        ? (data.watchlist as unknown[]).filter((c): c is string => typeof c === 'string')
        : null
      const nowWatching = list ? list.includes(city) : !prevWatching
      const nowCount = list ? list.length : (op === 'add' ? prevCount + 1 : Math.max(0, prevCount - 1))
      setWatching(nowWatching)
      setCount(nowCount)
      if (op === 'remove' && nowCount === 0) showEmptied()
      return
    }

    setWatching(prevWatching)
    setCount(prevCount)
    if (res?.status === 400 && data?.error === 'watchlist_full') {
      // Race: cap reached in another tab.
      setStatus('cap')
    } else {
      setStatus('error')
    }
  }

  const pillClass = [
    'btn-pill min-h-[36px] gap-1.5 px-4 transition-colors duration-100',
    watching ? 'active' : 'hover:border-[color:var(--primary-soft)]',
    atCap ? 'opacity-60' : '',
  ].filter(Boolean).join(' ')

  return (
    <div>
      <button
        type="button"
        aria-pressed={watching}
        aria-busy={pending || undefined}
        aria-disabled={atCap || undefined}
        onClick={toggle}
        className={pillClass}
      >
        {pending ? <span className="spinner" aria-hidden /> : watching ? <CheckIcon /> : <PlusIcon />}
        {watching ? `Watching ${city}` : `Watch ${city}`}
      </button>
      <p aria-live="polite" className="mt-1.5 min-h-[18px] text-[12px] leading-[18px]">
        {status === 'error' && (
          <span role="alert" className="font-medium text-[color:var(--error)]">
            Couldn&rsquo;t update your watchlist. Try again.
          </span>
        )}
        {status === 'cap' && (
          <span className="text-[color:var(--ink-faint)]">
            You&rsquo;re watching 10 cities — the maximum.{' '}
            <a href="/account#alerts" className="font-medium text-[color:var(--primary)] underline">
              Manage watchlist
            </a>
          </span>
        )}
        {status === 'emptied' && (
          <span className="text-[color:var(--ink-faint)]">
            You&rsquo;re not watching any specific cities — alerts now cover every destination.
          </span>
        )}
      </p>
    </div>
  )
}
