'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { track } from '@/lib/analytics'

export type CityEmptyTier = 'anonymous' | 'free' | 'premium' | 'premium_watching'

type WatchCityCtaProps = {
  city: string
  tier: CityEmptyTier
  watchlist: string[]
}

function ManageWatchlistLink() {
  return (
    <Link href="/account" className="mt-2 inline-flex min-h-[44px] items-center text-[13px] font-medium text-[color:var(--brand)] hover:underline">
      Manage watchlist
    </Link>
  )
}

export function WatchCityCta({ city, tier, watchlist }: WatchCityCtaProps) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'full'>(
    tier === 'premium_watching' ? 'saved' : 'idle'
  )

  useEffect(() => {
    track('city_empty_viewed', { city, tier })
  }, [city, tier])

  async function watchCity() {
    track('city_watch_clicked', { city })
    if (watchlist.length >= 10) {
      setState('full')
      track('city_watch_failed', { city })
      return
    }

    setState('saving')
    try {
      const response = await fetch('/api/account/watchlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchlist: [...watchlist, city] }),
      })
      if (!response.ok) throw new Error('watchlist update failed')
      setState('saved')
      track('city_watch_saved', { city })
    } catch {
      setState('error')
      track('city_watch_failed', { city })
    }
  }

  if (tier === 'anonymous') {
    return (
      <div className="mt-6">
        <p className="text-[13px] text-[color:var(--text-2)]">Want an email when a {city} deal appears?</p>
        <Link
          href="/join"
          onClick={() => track('city_join_cta_clicked', { city, tier: 'anonymous' })}
          className="btn btn-primary mt-3 min-h-[44px] px-6"
        >
          Get {city} deal alerts
        </Link>
      </div>
    )
  }

  if (tier === 'free') {
    return (
      <div className="mt-6">
        <p className="text-[13px] text-[color:var(--text-2)]">Premium members get an email the moment a {city} deal appears.</p>
        <Link
          href="/join"
          onClick={() => track('city_join_cta_clicked', { city, tier: 'free' })}
          className="btn btn-conversion mt-3 min-h-[44px] px-6"
        >
          Get {city} alerts with Premium
        </Link>
      </div>
    )
  }

  if (tier === 'premium_watching') {
    return (
      <div className="mt-6">
        <p role="status" className="text-[13px] font-medium text-[color:var(--primary)]">
          <span aria-hidden>✓ </span>You&apos;re watching {city} — you&apos;ll get an email when a deal appears.
        </p>
        <ManageWatchlistLink />
      </div>
    )
  }

  if (state === 'saved') {
    return (
      <div className="mt-6">
        <p role="status" className="text-[13px] font-medium text-[color:var(--primary)]">
          <span aria-hidden>✓ </span>Watching {city} — new deals will be in your daily digest.
        </p>
        <ManageWatchlistLink />
      </div>
    )
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={state === 'saving'}
        onClick={watchCity}
        className="btn btn-primary min-h-[44px] px-6 disabled:cursor-wait disabled:opacity-70"
      >
        {state === 'saving' && <span className="spinner mr-2" aria-hidden />}
        {state === 'saving' ? 'Saving…' : `Watch ${city}`}
      </button>
      {state === 'error' && (
        <p role="alert" className="mt-2 text-[12px] text-[color:var(--error)]">
          Couldn&apos;t save — check your connection and try again.
        </p>
      )}
      {state === 'full' && (
        <div>
          <p role="alert" className="mt-2 text-[12px] text-[color:var(--error)]">
            Your watchlist is full (10 cities). Manage it in your account.
          </p>
          <ManageWatchlistLink />
        </div>
      )}
    </div>
  )
}
