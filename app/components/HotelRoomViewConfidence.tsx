export type HotelRoomViewPresentation =
  | { state: 'not_confirmed' }
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'guaranteed'; viewLabel: string; sourceMetadata: string }
  | { state: 'request_only'; viewLabel: string; sourceMetadata?: string }
  | { state: 'category_only'; viewLabel: string; sourceMetadata?: string }
  | { state: 'stale'; sourceMetadata: string }
  | { state: 'conflict'; sourceMetadata?: string }
  | { state: 'no_view'; sourceMetadata?: string }

type HotelRoomViewConfidenceProps = {
  presentation?: HotelRoomViewPresentation
  roomName?: string
}

const blockClassName = 'mt-5 min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 sm:px-4 sm:py-4'

function RoomViewCopy({ presentation }: { presentation: Exclude<HotelRoomViewPresentation, { state: 'loading' }> }) {
  if (presentation.state === 'guaranteed') {
    return (
      <>
        <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--success)]">Guaranteed room view</p>
        <p className="mt-1 max-w-3xl break-words text-sm leading-6 text-[color:var(--text-2)]">
          Provider lists <bdi>“{presentation.viewLabel}”</bdi> for this room and rate.
        </p>
        <p className="mt-2 break-words text-xs leading-5 text-[color:var(--text-3)]">{presentation.sourceMetadata}</p>
      </>
    )
  }

  if (presentation.state === 'request_only') {
    return (
      <>
        <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--text-1)]">View request only</p>
        <p className="mt-1 max-w-3xl break-words text-sm leading-6 text-[color:var(--text-2)]">
          Provider offers <bdi>“{presentation.viewLabel}”</bdi> as a request for this stay. Not guaranteed until the property confirms it for this stay.
        </p>
        {presentation.sourceMetadata ? <p className="mt-2 break-words text-xs leading-5 text-[color:var(--text-3)]">{presentation.sourceMetadata}</p> : null}
      </>
    )
  }

  let explanation = 'View not confirmed for the room you choose. Photos may show the property or other room categories. Confirm the room’s view with the provider before booking.'
  let caveat: string | undefined
  let metadata: string | undefined

  if (presentation.state === 'error') {
    explanation = 'Room-view details could not be checked. Confirm the room’s view with the provider before booking.'
    caveat = 'Photos may show the property or other room categories.'
  } else if (presentation.state === 'category_only') {
    explanation = `Provider lists “${presentation.viewLabel}” for this room category, but not for this rate. Confirm the room’s view with the provider before booking.`
    caveat = 'Photos may show the property or other room categories.'
    metadata = presentation.sourceMetadata
  } else if (presentation.state === 'stale') {
    explanation = 'The provider’s room-view details are out of date. Confirm the room’s view with the provider before booking.'
    caveat = 'Photos may show the property or other room categories.'
    metadata = presentation.sourceMetadata
  } else if (presentation.state === 'conflict') {
    explanation = 'The provider’s room-view details do not agree. Confirm the room’s view with the provider before booking.'
    caveat = 'Photos may show the property or other room categories.'
    metadata = presentation.sourceMetadata
  } else if (presentation.state === 'no_view') {
    explanation = 'Provider states this room and rate do not include a specified view. Check the room details with the provider before booking.'
    metadata = presentation.sourceMetadata
  }

  return (
    <>
      <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--text-1)]">View not confirmed</p>
      <p className="mt-1 max-w-3xl break-words text-sm leading-6 text-[color:var(--text-2)]">{explanation}</p>
      {caveat ? <p className="mt-2 break-words text-xs leading-5 text-[color:var(--text-3)]">{caveat}</p> : null}
      {metadata ? <p className="mt-2 break-words text-xs leading-5 text-[color:var(--text-3)]">{metadata}</p> : null}
    </>
  )
}

export function HotelRoomViewConfidence({
  presentation = { state: 'not_confirmed' },
  roomName,
}: HotelRoomViewConfidenceProps) {
  return (
    <div className="mt-5 min-w-0 space-y-3">
      {roomName ? (
        <div className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-3.5 py-3 sm:px-4">
          <p className="text-xs font-medium leading-5 text-[color:var(--text-3)]">Provider room name</p>
          <p className="mt-1 break-words text-sm font-medium leading-6 text-[color:var(--text-1)]"><bdi>{roomName}</bdi></p>
        </div>
      ) : null}

      <section aria-labelledby="hotel-room-view-title" aria-busy={presentation.state === 'loading' ? true : undefined} className={blockClassName}>
        <h3 id="hotel-room-view-title" className="text-sm font-medium leading-5 text-[color:var(--text-1)]">Room view</h3>
        {presentation.state === 'loading' ? (
          <>
            <div aria-hidden="true" className="mt-2 space-y-2">
              <div className="h-4 w-40 max-w-full rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] motion-safe:animate-pulse" />
              <div className="h-4 w-full rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] motion-safe:animate-pulse" />
            </div>
            <span className="sr-only" role="status">Checking room-view details.</span>
          </>
        ) : <RoomViewCopy presentation={presentation} />}
      </section>
    </div>
  )
}
