'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'

const CITIES = [
  'Miami', 'New York', 'Cancún', 'Paris', 'Rome', 'Barcelona', 'Lisbon',
  'London', 'Tokyo', 'Bangkok', 'Dubai', 'Las Vegas', 'Orlando', 'San Juan',
  'Tulum', 'Amsterdam', 'Athens', 'Punta Cana', 'Charlotte', 'Nashville',
]

type Props = {
  stripeCustomerId?: string | null
  alertPreference?: string
  watchlist?: string[]
  userId?: string
  showAlerts?: boolean
}

export function AccountClient({ stripeCustomerId, alertPreference, watchlist = [], userId, showAlerts }: Props) {
  const [portalLoading, setPortalLoading] = useState(false)
  const [pref, setPref] = useState<string>(alertPreference ?? 'daily')
  const [cities, setCities] = useState<string[]>(watchlist)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function openPortal() {
    if (!stripeCustomerId) return
    setPortalLoading(true)
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = (await res.json()) as { url?: string }
    if (data.url) window.location.href = data.url
    setPortalLoading(false)
  }

  function toggleCity(city: string) {
    setCities(prev =>
      prev.includes(city)
        ? prev.filter(c => c !== city)
        : prev.length < 10 ? [...prev, city] : prev
    )
  }

  async function savePreferences() {
    if (!userId) return
    setSaving(true)
    await Promise.all([
      fetch('/api/account/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertPreference: pref }),
      }),
      fetch('/api/account/watchlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchlist: cities }),
      }),
    ])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (showAlerts) {
    return (
      <div className="flex flex-col gap-5">
        {/* Alert frequency */}
        <div>
          <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">Frequency</p>
          <div className="flex flex-wrap gap-2">
            {(['instant', 'daily', 'off'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPref(p)}
                className={`rounded-[var(--radius-pill)] px-4 py-2 text-[13px] font-medium transition-colors duration-100 ${
                  pref === p
                    ? 'bg-[color:var(--primary)] text-white'
                    : 'border border-[color:var(--line-ivory)] bg-white text-[color:var(--ink)] hover:border-[color:var(--primary-soft)]'
                }`}
              >
                {p === 'daily' ? 'Daily digest' : p === 'instant' ? 'Instant' : 'Off'}
              </button>
            ))}
          </div>
        </div>

        {/* Watchlist */}
        <div>
          <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">
            Cities I&apos;m watching ({cities.length}/10)
          </p>
          <div className="flex flex-wrap gap-2">
            {CITIES.map(city => {
              const selected = cities.includes(city)
              const disabled = !selected && cities.length >= 10
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => toggleCity(city)}
                  disabled={disabled}
                  className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-[12px] font-medium transition-colors duration-100 disabled:opacity-40 ${
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
        </div>

        <button
          type="button"
          onClick={savePreferences}
          disabled={saving}
          className="btn btn-primary self-start disabled:opacity-60"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save preferences'}
        </button>
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
