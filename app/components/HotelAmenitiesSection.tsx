import { fetchHotelAmenities } from '@/lib/pipeline/hotelAmenities'

const MAX_AMENITIES_SHOWN = 12

// Optional bonus enrichment, same treatment as LocationQualitySection: lazy,
// per-render fetch from Booking.com's getHotelDetails endpoint for a
// confirmed Booking-sourced deal only. If the provider has nothing (not a
// Booking hotel, rate limited, no real facilities), say nothing rather than
// add an "amenities unavailable" line to a page most visitors won't notice
// the absence of.
export async function HotelAmenitiesSection({
  hotelId,
  checkInDate,
  checkOutDate,
}: {
  hotelId: string
  checkInDate: string
  checkOutDate: string
}) {
  const result = await fetchHotelAmenities(hotelId, checkInDate, checkOutDate)
  if (!result.ok) return null

  const amenities = result.data.slice(0, MAX_AMENITIES_SHOWN)
  const omittedCount = result.data.length - amenities.length

  return (
    <section aria-labelledby="hotel-amenities-title" className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5 sm:p-4">
      <h3 id="hotel-amenities-title" className="text-body font-display font-bold leading-snug text-[color:var(--text-1)]">Amenities</h3>
      <ul className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        {amenities.map((amenity, idx) => (
          <li key={`${amenity.name}-${idx}`} className="flex min-w-0 items-center gap-2 text-small leading-5 text-[color:var(--text-1)]">
            <span aria-hidden className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[color:var(--brand)]" />
            <span className="break-words">{amenity.name}</span>
          </li>
        ))}
      </ul>
      {omittedCount > 0 ? (
        <p className="mt-3 text-caption leading-5 text-[color:var(--text-3)]">+{omittedCount} more reported by the provider.</p>
      ) : null}
      <p className="mt-3 text-caption leading-5 text-[color:var(--text-3)]">Reported by Booking.com. Confirm specific amenities with the provider before you book.</p>
    </section>
  )
}
