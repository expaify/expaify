'use client'

import { useId, useState } from 'react'
import type { AiDayPlanActivity } from '@/lib/providers/aiTripPlanner'

type AiDayPlanCardProps = {
  destination: string
  activities: AiDayPlanActivity[]
}

/**
 * The AI trip planner only ever returns a free-text `description` sentence
 * (e.g. "Visit Sagrada Familia"), never a structured place name -- so this
 * builds a genuine Google Maps *search* URL from that sentence plus the
 * destination city, the same honesty bar as buildGoogleFlightsDeeplink: a
 * real search link, never a claim of a specific verified location.
 */
function buildActivityMapSearchUrl(description: string, destination: string): string {
  const query = `${description} ${destination}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function AiDayPlanCard({ destination, activities }: AiDayPlanCardProps) {
  const [expanded, setExpanded] = useState(false)
  const planId = useId()
  if (activities.length === 0) return null

  const middleIndex = Math.floor((activities.length - 1) / 2)
  const teaserIndexes = new Set([0, middleIndex, activities.length - 1])
  const visibleActivities = expanded || activities.length <= 3
    ? activities.map((activity, index) => ({ activity, index }))
    : activities.flatMap((activity, index) => teaserIndexes.has(index) ? [{ activity, index }] : [])

  return (
    <section className="rounded-[var(--radius-card)] bg-[var(--bg-raised)] p-4 shadow-[var(--shadow-card-rest)]">
      <p className="text-sm font-bold text-[color:var(--text-1)]">AI-suggested day plan for {destination}</p>
      <p className="mt-1 text-xs text-[color:var(--text-3)]">
        One AI-generated day of ideas near this stay -- not a full trip itinerary.
      </p>
      <ol id={planId} className="mt-4">
        {visibleActivities.map(({ activity, index }, visibleIndex) => (
          <li key={`${activity.time}-${index}`} className="relative grid grid-cols-[1.25rem_4.5rem_minmax(0,1fr)] gap-3 pb-5 text-small last:pb-0">
            {visibleIndex < visibleActivities.length - 1 ? <span className="absolute bottom-0 left-[0.5625rem] top-3 w-px bg-[color:var(--primary-soft)]" aria-hidden="true" /> : null}
            <span className="relative z-[1] mt-1.5 h-3 w-3 rounded-full border-[3px] border-[color:var(--surface)] bg-[color:var(--primary)] shadow-[0_0_0_1px_var(--primary-soft)]" aria-hidden="true" />
            <span className="font-medium text-[color:var(--ink-soft)] text-tabular">{activity.time}</span>
            <a href={buildActivityMapSearchUrl(activity.description, destination)} target="_blank" rel="noopener noreferrer" className="text-[color:var(--ink)] underline decoration-1 underline-offset-2 hover:text-[color:var(--primary)]">
              {activity.description}<span className="sr-only"> (opens a map search in a new tab)</span>
            </a>
          </li>
        ))}
      </ol>
      {activities.length > 3 ? (
        <button type="button" aria-expanded={expanded} aria-controls={planId} onClick={() => setExpanded(value => !value)} className="mt-4 min-h-11 font-medium text-[color:var(--primary)] underline underline-offset-4">
          {expanded ? 'Show day plan teaser' : 'View full day plan'}
        </button>
      ) : null}
    </section>
  )
}

export function AiDayPlanCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-raised)] p-4 animate-pulse">
      <div className="h-4 w-48 rounded bg-[var(--bg-muted)]" />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-full rounded bg-[var(--bg-muted)]" />
        <div className="h-4 w-5/6 rounded bg-[var(--bg-muted)]" />
        <div className="h-4 w-3/4 rounded bg-[var(--bg-muted)]" />
      </div>
    </div>
  )
}
