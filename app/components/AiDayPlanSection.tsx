import { getAiDayPlan } from '@/lib/providers/aiTripPlanner'
import { AiDayPlanCard } from '@/app/components/ui/AiDayPlanCard'

export async function AiDayPlanSection({ city }: { city: string }) {
  const result = await getAiDayPlan(city)
  if (!result.ok) return null

  return <AiDayPlanCard destination={result.data.destination} activities={result.data.activities} />
}
