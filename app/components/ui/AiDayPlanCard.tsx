import type { AiDayPlanActivity } from '@/lib/providers/aiTripPlanner'

type AiDayPlanCardProps = {
  destination: string
  activities: AiDayPlanActivity[]
}

export function AiDayPlanCard({ destination, activities }: AiDayPlanCardProps) {
  if (activities.length === 0) return null

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-raised)] p-4">
      <p className="text-sm font-bold text-[color:var(--text-1)]">AI-suggested day plan for {destination}</p>
      <p className="mt-1 text-xs text-[color:var(--text-3)]">
        One AI-generated day of ideas near this stay -- not a full trip itinerary.
      </p>
      <ol className="mt-3 space-y-2">
        {activities.map((activity, index) => (
          <li key={`${activity.time}-${index}`} className="flex gap-3 text-sm">
            <span className="w-20 shrink-0 font-medium text-[color:var(--text-2)]">{activity.time}</span>
            <span className="text-[color:var(--text-2)]">{activity.description}</span>
          </li>
        ))}
      </ol>
    </div>
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
