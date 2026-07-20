'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { track } from '@/lib/analytics'

type WatchCityCtaProps = {
  city: string
  tier: 'anonymous' | 'free' | 'premium'
  watching?: boolean
  watchlist?: string[]
}

export function WatchCityCta({ city, tier, watching = false, watchlist = [] }: WatchCityCtaProps) {
  const [saved, setSaved] = useState(watching)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    track('city_empty_viewed', { city, tier })
  }, [city, tier])

  async function saveWatch() {
    setError(null)
    if (watchlist.length >= 10 && !watchlist.includes(city)) {
      setError('Your watchlist is full (10 cities). Manage it in your account.')
      return
    }

    track('city_watch_clicked', { city })
    setSaving(true)
    try {
      const nextWatchlist = Array.from(new Set([...watchlist, city]))
      const res = await fetch('/api/account/watchlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchlist: nextWatchlist }),
      })
      if (!res.ok) throw new Error('watchlist save failed')
      setSaved(true)
      track('city_watch_saved', { city })
    } catch {
      setError("Couldn't save — check your connection and try again.")
      track('city_watch_failed', { city })
    } finally {
      setSaving(false)
    }
  }

  if (tier === 'premium') {
    return (
      <div className="mt-6 flex flex-col items-center gap-3">
        {saved ? (
          <>
            <p className="text-[13px] font-medium text-[color:var(--text-1)]">
              {watching ? `You're watching ${city} — you'll get an email when a deal appears.` : `Watching ${city} — new deals will be in your daily digest.`}
            </p>
            <Link href="/account" className="text-[13px] font-medium text-[color:var(--brand)] no-underline hover:underline">
              Manage watchlist
            </Link>
          </>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={saveWatch}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-pill)] bg-[color:var(--brand)] px-5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving…' : `Watch ${city}`}
          </button>
        )}
        {error ? <p className="text-[12px] font-medium text-[color:var(--error)]">{error}</p> : null}
      </div>
    )
  }

  if (tier === 'free') {
    return (
      <div className="mt-6 flex flex-col items-center gap-3">
        <p className="text-[13px] font-medium text-[color:var(--text-1)]">
          Premium members get an email the moment a {city} deal appears.
        </p>
        <Link
          href="/join"
          onClick={() => track('city_join_cta_clicked', { city, tier })}
          className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-pill)] bg-[color:var(--brand)] px-5 text-[13px] font-medium text-white no-underline transition-opacity hover:opacity-90"
        >
          Get {city} alerts with Premium
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <p className="text-[13px] font-medium text-[color:var(--text-1)]">
        Want an email when a {city} deal appears?
      </p>
      <Link
        href="/join"
        onClick={() => track('city_join_cta_clicked', { city, tier })}
        className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-pill)] bg-[color:var(--brand)] px-5 text-[13px] font-medium text-white no-underline transition-opacity hover:opacity-90"
      >
        Get {city} deal alerts
      </Link>
    </div>
  )
}
