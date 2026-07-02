'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'

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

  async function saveAlertPref() {
    if (!userId) return
    setSaving(true)
    await fetch('/api/account/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertPreference: pref }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (showAlerts) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {(['instant', 'daily', 'off'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPref(p)}
              className={`btn-pill capitalize ${pref === p ? 'active' : ''}`}
            >
              {p === 'daily' ? 'Daily digest' : p === 'instant' ? 'Instant' : 'Off'}
            </button>
          ))}
        </div>
        {watchlist.length > 0 && (
          <p className="text-[13px] text-[color:var(--ink-faint)]">
            Watching: {watchlist.join(', ')}
          </p>
        )}
        <button
          type="button"
          onClick={saveAlertPref}
          disabled={saving}
          className="btn btn-primary self-start"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save preference'}
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
          className="btn btn-outline"
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
