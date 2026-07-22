'use client'

import { useEffect, useRef, useState } from 'react'
import { signOut } from 'next-auth/react'
import { TRACKED_MARKET_NAMES } from '@/lib/trackedMarkets'

type AlertPreference = 'instant' | 'daily' | 'off'
type MinDiscountPct = 30 | 40 | 50

type Props = {
  stripeCustomerId?: string | null
  alertPreference?: AlertPreference
  watchlist?: string[]
  minDiscountPct?: MinDiscountPct
  userId?: string
  showAlerts?: boolean
  signOutOnly?: boolean
}

type GroupName = 'pref' | 'min' | 'city'
type GroupStatus = 'idle' | 'saving' | 'saved' | 'error' | 'cap'

type PersistResult = {
  // stale = aborted or superseded by a newer request; the newer request owns the state
  stale: boolean
  ok: boolean
  status: number
  data: { watchlist?: unknown; error?: unknown } | null
}

function StatusLine({ status }: { status: GroupStatus }) {
  return (
    <p aria-live="polite" className="mt-1.5 min-h-[18px] text-[12px] leading-[18px]">
      {status === 'saving' && <span className="text-[color:var(--ink-faint)]">Saving…</span>}
      {status === 'saved' && <span className="font-medium text-[color:var(--primary)]">Saved</span>}
      {status === 'error' && (
        <span role="alert" className="font-medium text-[color:var(--error)]">
          Couldn&rsquo;t save. Your change was undone — try again.
        </span>
      )}
      {status === 'cap' && (
        <span className="text-[color:var(--ink-faint)]">
          You&rsquo;re watching 10 cities — the maximum. Unwatch one first.
        </span>
      )}
    </p>
  )
}

function PillRadioGroup<T extends string | number>({ label, options, value, onChange }: {
  label: string
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    let next: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index - 1 + options.length) % options.length
    if (next === null) return
    e.preventDefault()
    refs.current[next]?.focus()
    onChange(options[next].value)
  }

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((opt, i) => {
        const checked = opt.value === value
        return (
          <button
            key={String(opt.value)}
            ref={el => { refs.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={e => onKeyDown(e, i)}
            className={`rounded-[var(--radius-pill)] px-4 py-2 text-[13px] font-medium transition-colors duration-100 ${
              checked
                ? 'bg-[color:var(--primary)] text-white'
                : 'border border-[color:var(--line-ivory)] bg-white text-[color:var(--ink)] hover:border-[color:var(--primary-soft)]'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function AccountClient({ stripeCustomerId, alertPreference, watchlist = [], minDiscountPct = 40, userId, showAlerts, signOutOnly }: Props) {
  const [portalLoading, setPortalLoading] = useState(false)
  const [pref, setPref] = useState<AlertPreference>(alertPreference ?? 'daily')
  const [discountPct, setDiscountPct] = useState<MinDiscountPct>(minDiscountPct)
  const [cities, setCities] = useState<string[]>(watchlist)
  const [groupStatus, setGroupStatus] = useState<Record<GroupName, GroupStatus>>({
    pref: 'idle',
    min: 'idle',
    city: 'idle',
  })
  const controllers = useRef<Partial<Record<GroupName, AbortController>>>({})
  const savingTimers = useRef<Partial<Record<GroupName, ReturnType<typeof setTimeout>>>>({})
  const savedTimers = useRef<Partial<Record<GroupName, ReturnType<typeof setTimeout>>>>({})

  useEffect(() => () => {
    Object.values(controllers.current).forEach(controller => controller?.abort())
    Object.values(savingTimers.current).forEach(timer => clearTimeout(timer))
    Object.values(savedTimers.current).forEach(timer => clearTimeout(timer))
  }, [])

  function setStatus(group: GroupName, status: GroupStatus) {
    setGroupStatus(s => ({ ...s, [group]: status }))
  }

  async function persist(group: GroupName, url: string, body: unknown): Promise<PersistResult> {
    controllers.current[group]?.abort()
    const ctrl = new AbortController()
    controllers.current[group] = ctrl

    clearTimeout(savingTimers.current[group])
    clearTimeout(savedTimers.current[group])
    setStatus(group, 'idle')
    // Skip the "Saving…" flash for fast saves.
    savingTimers.current[group] = setTimeout(() => setStatus(group, 'saving'), 300)

    let res: Response | null = null
    let data: PersistResult['data'] = null
    try {
      res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
      data = (await res.json().catch(() => null)) as PersistResult['data']
    } catch {
      clearTimeout(savingTimers.current[group])
      if (ctrl.signal.aborted) return { stale: true, ok: false, status: 0, data: null }
      setStatus(group, 'idle')
      return { stale: false, ok: false, status: 0, data: null }
    }
    clearTimeout(savingTimers.current[group])
    if (controllers.current[group] !== ctrl) return { stale: true, ok: false, status: 0, data: null }

    if (res.ok) {
      setStatus(group, 'saved')
      savedTimers.current[group] = setTimeout(() => {
        setGroupStatus(s => (s[group] === 'saved' ? { ...s, [group]: 'idle' } : s))
      }, 2000)
    } else {
      setStatus(group, 'idle')
    }
    return { stale: false, ok: res.ok, status: res.status, data }
  }

  async function openPortal() {
    if (!stripeCustomerId) return
    setPortalLoading(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = (await res.json()) as { url?: string }
    if (data.url) window.location.href = data.url
    setPortalLoading(false)
  }

  function saveFrequency(next: AlertPreference) {
    if (next === pref) return
    const prev = pref
    setPref(next)
    void persist('pref', '/api/account/alerts', { alertPreference: next }).then(r => {
      if (r.stale || r.ok) return
      setPref(prev)
      setStatus('pref', 'error')
    })
  }

  function saveMinDiscount(next: MinDiscountPct) {
    if (next === discountPct) return
    const prev = discountPct
    setDiscountPct(next)
    void persist('min', '/api/account/alerts', { alertMinDiscount: next }).then(r => {
      if (r.stale || r.ok) return
      setDiscountPct(prev)
      setStatus('min', 'error')
    })
  }

  function toggleCity(city: string) {
    const selected = cities.includes(city)
    if (!selected && cities.length >= 10) {
      setStatus('city', 'cap')
      return
    }
    const prev = cities
    setCities(selected ? prev.filter(c => c !== city) : [...prev, city])
    void persist('city', '/api/account/watchlist', { op: selected ? 'remove' : 'add', city }).then(r => {
      if (r.stale) return
      if (r.ok) {
        // Reconcile from the server's resulting list when provided.
        if (Array.isArray(r.data?.watchlist)) {
          setCities((r.data.watchlist as unknown[]).filter((c): c is string => typeof c === 'string'))
        }
        return
      }
      setCities(prev)
      setStatus('city', r.status === 400 && r.data?.error === 'watchlist_full' ? 'cap' : 'error')
    })
  }

  if (signOutOnly) {
    return (
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/' })}
        className="text-[13px] text-[color:var(--ink-faint)] hover:text-[color:var(--ink)]"
      >
        Sign out
      </button>
    )
  }

  if (showAlerts) {
    const atCap = cities.length >= 10
    return (
      <div className="flex flex-col gap-5">
        {/* Alert frequency */}
        <div>
          <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">Frequency</p>
          <PillRadioGroup<AlertPreference>
            label="Alert frequency"
            options={[
              { value: 'instant', label: 'Instant' },
              { value: 'daily', label: 'Daily digest' },
              { value: 'off', label: 'Off' },
            ]}
            value={pref}
            onChange={saveFrequency}
          />
          <StatusLine status={groupStatus.pref} />
        </div>

        {/* Deal threshold */}
        <div>
          <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">Minimum deal size</p>
          <PillRadioGroup<MinDiscountPct>
            label="Minimum deal size"
            options={[
              { value: 50, label: '50%+' },
              { value: 40, label: '40%+' },
              { value: 30, label: '30%+' },
            ]}
            value={discountPct}
            onChange={saveMinDiscount}
          />
          <StatusLine status={groupStatus.min} />
        </div>

        {/* Watchlist */}
        <div>
          <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">
            Cities I&apos;m watching ({cities.length}/10)
          </p>
          <div className="flex flex-wrap gap-2">
            {TRACKED_MARKET_NAMES.map(city => {
              const selected = cities.includes(city)
              const capped = !selected && atCap
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => toggleCity(city)}
                  aria-pressed={selected}
                  aria-disabled={capped || undefined}
                  className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-[12px] font-medium transition-colors duration-100 ${
                    capped ? 'opacity-40' : ''
                  } ${
                    selected
                      ? 'bg-[color:var(--primary)] text-white'
                      : 'border border-[color:var(--line-ivory)] bg-white text-[color:var(--ink)] hover:border-[color:var(--primary-soft)]'
                  }`}
                >
                  {city}
                </button>
              )
            })}
          </div>
          <StatusLine status={groupStatus.city} />
          <p className="mt-1 text-[12px] text-[color:var(--ink-faint)]">
            Select none to watch every destination.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {stripeCustomerId && (
        <button
          type="button"
          onClick={openPortal}
          disabled={portalLoading}
          className="btn btn-primary"
        >
          {portalLoading ? 'Loading…' : 'Manage billing'}
        </button>
      )}
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/' })}
        className="text-[14px] text-[color:var(--ink-faint)] hover:text-[color:var(--ink)]"
      >
        Sign out
      </button>
    </div>
  )
}
