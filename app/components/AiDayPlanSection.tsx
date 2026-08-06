import { getAiDayPlan } from '@/lib/providers/aiTripPlanner'
import { AiDayPlanCard } from '@/app/components/ui/AiDayPlanCard'

// Mirrors DealScorePanel's "we tried to show real data-driven content but
// couldn't" pattern (see app/components/DealScorePanel.tsx) instead of
// silently vanishing, while keeping AiDayPlanCard's existing visual
// language (border/bg tokens, radius, spacing) for this specific widget.
function AiDayPlanUnavailable({ city }: { city: string }) {
  return (
    <div
      className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-raised)] p-4"
      role="status"
      aria-label={`AI day plan unavailable for ${city}.`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--text-3)]">
        AI-suggested day plan
      </p>
      <p className="mt-0.5 text-sm font-bold text-[color:var(--text-1)]">Day plan unavailable</p>
      <p className="mt-1 text-xs text-[color:var(--text-3)]">
        We couldn&apos;t generate AI-suggested activities for {city} right now. Check back later.
      </p>
    </div>
  )
}

export async function AiDayPlanSection({ city }: { city: string }) {
  // A blank destination means there's nothing to plan around, not that a
  // fetch failed -- deal.city is a NOT NULL column, so this is effectively
  // unreachable for real deal rows. Render nothing rather than an
  // "unavailable" message that would misrepresent what happened.
  const trimmedCity = city.trim()
  if (!trimmedCity) return null

  const result = await getAiDayPlan(trimmedCity)
  if (!result.ok || result.data.activities.length === 0) {
    return <AiDayPlanUnavailable city={trimmedCity} />
  }

  return <AiDayPlanCard destination={result.data.destination} activities={result.data.activities} />
}
