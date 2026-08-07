import { getLocationQuality } from '@/lib/providers/locationQuality'
import { LocationQualityBadge } from '@/app/components/ui/LocationQualityBadge'

// Unlike AiDayPlanSection (a primary widget that shows an honest "unavailable"
// state on failure), this is optional bonus enrichment -- same treatment as
// the disruption/quiet-stay/pool evidence cues elsewhere on this page: if we
// can't assess it (hotel not found, too few real nearby POIs), say nothing
// rather than adding a not-every-hotel-has-this "unavailable" line to a page
// most visitors will never notice the absence of.
export async function LocationQualitySection({ hotelName, city }: { hotelName: string; city: string }) {
  const result = await getLocationQuality(hotelName, city)
  if (!result.ok) return null

  return <LocationQualityBadge data={result.data} />
}
