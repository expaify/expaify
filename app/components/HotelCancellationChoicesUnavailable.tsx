export const HOTEL_CANCELLATION_CHOICES_UNAVAILABLE_HEADING = 'Cancellation choices unavailable'
export const HOTEL_CANCELLATION_CHOICES_UNAVAILABLE_BODY = 'Cancellation choices are not available for this observed price. Compare room rates and cancellation terms with the booking partner.'

type Props = {
  headingLevel?: 'h2' | 'h3' | 'h4'
}

export default function HotelCancellationChoicesUnavailable({ headingLevel: Heading = 'h3' }: Props = {}) {
  return (
    <div
      data-hotel-cancellation-availability="unsupported"
      className="w-full min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] p-4"
    >
      <Heading className="break-words font-display text-small font-bold leading-5 text-[color:var(--text-1)]">
        {HOTEL_CANCELLATION_CHOICES_UNAVAILABLE_HEADING}
      </Heading>
      <p className="mt-1 break-words text-small leading-5 text-[color:var(--text-2)] [overflow-wrap:anywhere]">
        {HOTEL_CANCELLATION_CHOICES_UNAVAILABLE_BODY}
      </p>
    </div>
  )
}
