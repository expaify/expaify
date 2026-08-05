import type { HotelAmenityEvidence } from '@/lib/types'
import {
  CONNECTING_ROOMS_LABEL,
  CONNECTING_ROOMS_ERROR_COPY,
  CONNECTING_ROOMS_LOADING_COPY,
  CONNECTING_ROOMS_NOT_RETURNED_COPY,
  CONNECTING_ROOMS_SCOPE_CAVEAT,
  CONNECTING_ROOMS_UNAVAILABLE_COPY,
  CONNECTING_ROOMS_UNKNOWN_COPY,
  getConnectingRoomsConfirmedCopy,
  getConnectingRoomsMetadata,
  resolveConnectingRoomsEvidence,
} from '@/lib/hotels/connectingRoomsEvidence'

type Props = {
  amenityEvidence?: readonly HotelAmenityEvidence[]
  loadState?: 'loading' | 'ready' | 'error'
}

/**
 * Mounts the existing, shipped `room_pref_connecting` fact (built by
 * DEV-HOTEL-ACCESS-REQUIREMENTS-01, previously readable only inside the
 * never-mounted `HotelCard`) onto the booking review page, where a real,
 * per-offer `HotelOffer.amenityEvidence` array is actually available via
 * `hotelContext`. See docs/pipeline/hotel-adjoining-rooms/03-design.md.
 */
export function HotelConnectingRoomsEvidence({ amenityEvidence, loadState = 'ready' }: Props) {
  const live = loadState === 'loading' || loadState === 'error'

  return (
    <section
      aria-labelledby="hotel-connecting-rooms-title"
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
      aria-busy={loadState === 'loading' ? 'true' : undefined}
      className="mt-5 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5 sm:p-5"
    >
      <h3 id="hotel-connecting-rooms-title" className="text-base font-medium leading-6 text-[color:var(--text-1)] sm:text-lg">
        {CONNECTING_ROOMS_LABEL}
      </h3>
      <p className="mt-1 text-xs leading-5 text-[color:var(--text-3)]">{CONNECTING_ROOMS_SCOPE_CAVEAT}</p>

      {loadState === 'loading' ? (
        <>
          <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-1)]">{CONNECTING_ROOMS_LOADING_COPY}</p>
          <div className="mt-4 space-y-3" aria-hidden="true">
            <div className="skeleton h-3 w-2/3 rounded-full" />
            <div className="skeleton h-3 w-full rounded-full" />
          </div>
        </>
      ) : loadState === 'error' ? (
        <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-1)]">{CONNECTING_ROOMS_ERROR_COPY}</p>
      ) : (
        <ConnectingRoomsBody amenityEvidence={amenityEvidence} />
      )}
    </section>
  )
}

function ConnectingRoomsBody({ amenityEvidence }: { amenityEvidence?: readonly HotelAmenityEvidence[] }) {
  const resolved = resolveConnectingRoomsEvidence(amenityEvidence)
  const metadata = getConnectingRoomsMetadata(resolved)

  if (resolved.status === 'not_returned') {
    return <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">{CONNECTING_ROOMS_NOT_RETURNED_COPY}</p>
  }

  if (resolved.status === 'unknown') {
    return <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-2)]">{CONNECTING_ROOMS_UNKNOWN_COPY}</p>
  }

  if (resolved.status === 'unavailable') {
    return (
      <div className="mt-2 rounded-[var(--radius-control)] bg-[color:var(--warning-soft)] px-3 py-2.5">
        <p className="text-sm font-medium leading-6 text-[color:var(--warning)]">{CONNECTING_ROOMS_UNAVAILABLE_COPY}</p>
        {metadata.length ? <p className="mt-1 break-words text-xs leading-5 text-[color:var(--text-3)]">{metadata.join(' ')}</p> : null}
      </div>
    )
  }

  const copy = getConnectingRoomsConfirmedCopy(resolved)
  return (
    <div aria-label={copy.aria} className="mt-2">
      <p className="text-sm font-medium leading-6 text-[color:var(--text-2)]">{copy.visible}</p>
      {metadata.length ? <p className="mt-1 break-words text-xs leading-5 text-[color:var(--text-3)]">{metadata.join(' ')}</p> : null}
    </div>
  )
}

export default HotelConnectingRoomsEvidence
