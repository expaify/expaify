import type {
  HotelParkingConflictDimension,
  HotelParkingEvidence,
  HotelParkingOptionEvidence,
  ParkingCostBasis,
} from '@/lib/types'
import { formatMoney, isValidMoney } from '@/lib/money'

export type HotelParkingUiProps = {
  evidence?: HotelParkingEvidence | null
  conflictDimensions?: readonly HotelParkingConflictDimension[]
  hasSearchDates?: boolean
  malformed?: boolean
}

const confirmationCopy = 'Confirm location, cost, reservation rules, operator, and space availability with the booking partner.'
const recognizedProviders = new Map([
  ['travelpayouts', 'Travelpayouts'],
  ['duffel', 'Duffel'],
  ['amadeus', 'Amadeus'],
  ['kiwi', 'Kiwi'],
  ['hotellook', 'Hotellook'],
  ['booking.com', 'Booking.com'],
  ['bookingcomrapidapi', 'Booking.com'],
  ['expedia', 'Expedia'],
])

function providerName(value: string): string | null {
  const normalized = value.trim().toLowerCase()
  return recognizedProviders.get(normalized) ?? null
}

function locationSummary(option: HotelParkingOptionEvidence): string {
  if (option.location.kind === 'on_site') return 'On-site parking'
  if (option.location.kind === 'nearby_off_site') return 'Nearby parking'
  if (option.location.kind === 'street') return 'Street parking'
  return 'Parking location not provided'
}

function optionLabel(option: HotelParkingOptionEvidence): string {
  if (option.location.kind === 'on_site') return 'On site'
  if (option.location.kind === 'nearby_off_site') return 'Nearby, off site'
  if (option.location.kind === 'street') return 'Street parking'
  return 'Location not provided'
}

function basisLabel(basis: ParkingCostBasis): string | null {
  if (basis === 'per_night') return 'per night'
  if (basis === 'per_stay') return 'per stay'
  if (basis === 'per_entry') return 'per entry'
  if (basis === 'per_hour') return 'per hour'
  return null
}

function validParkingAmount(option: HotelParkingOptionEvidence) {
  return option.cost.state === 'paid' && isValidMoney(option.cost.amount)
    ? option.cost.amount
    : null
}

function costSummary(option: HotelParkingOptionEvidence): string {
  if (option.cost.state === 'included') return 'Included'
  if (option.cost.state === 'unknown') return 'Cost not provided'

  const amount = validParkingAmount(option)
  const basis = basisLabel(option.cost.basis)
  if (amount && basis) return `${formatMoney(amount)} ${basis}`
  if (amount) return `${formatMoney(amount)}; charge basis not provided`
  if (basis) return `Paid ${basis}; amount not provided`
  return 'Paid — amount and charge basis not provided'
}

function spaceSummary(option: HotelParkingOptionEvidence, hasSearchDates: boolean): string {
  if (option.selectedStaySpace === 'confirmed_for_selected_stay') {
    return hasSearchDates ? 'Space confirmed for these dates' : 'Space confirmed for a selected stay'
  }
  if (option.selectedStaySpace === 'unavailable_for_selected_stay') {
    return hasSearchDates ? 'No space reported for these dates' : 'No space reported for a selected stay'
  }
  return 'Space not confirmed'
}

function confirmedOptions(evidence?: HotelParkingEvidence | null) {
  return evidence?.options.filter(option => option.facilityStatus === 'confirmed') ?? []
}

function returnedOptions(evidence?: HotelParkingEvidence | null) {
  return evidence?.options.filter(option => option.facilityStatus !== 'not_returned') ?? []
}

function multiOptionSummary(options: HotelParkingOptionEvidence[], hasSearchDates: boolean): string {
  const kinds = new Set(options.map(option => option.location.kind))
  let locations = 'parking locations not fully provided'
  if (kinds.has('on_site') && kinds.has('nearby_off_site')) locations = 'on site and nearby'
  else if (kinds.has('on_site') && kinds.has('street')) locations = 'on site and street'
  else if (kinds.has('nearby_off_site') && kinds.has('street')) locations = 'nearby and street'
  else if (kinds.size === 1 && kinds.has('on_site')) locations = 'on site'
  else if (kinds.size === 1 && kinds.has('nearby_off_site')) locations = 'nearby'
  else if (kinds.size === 1 && kinds.has('street')) locations = 'street'

  const costs = options.map(costSummary)
  const cost = costs.every(value => value === 'Included')
    ? 'Included'
    : costs.every(value => value === costs[0])
      ? costs[0]
      : options.some(option => option.cost.state === 'included') && options.some(option => option.cost.state === 'paid')
        ? 'Costs vary by option'
        : 'Cost details vary'
  const hasUnavailable = options.some(option => option.selectedStaySpace === 'unavailable_for_selected_stay')
  const hasConfirmed = options.some(option => option.selectedStaySpace === 'confirmed_for_selected_stay')
  const space = hasUnavailable
    ? 'Stay-specific space status varies'
    : hasConfirmed
      ? hasSearchDates ? 'One space confirmed for these dates' : 'One space confirmed for a selected stay'
      : 'Spaces not confirmed'

  return `${options.length} parking options: ${locations}. ${cost}. ${space}.`
}

export function getParkingSummary({ evidence, hasSearchDates = true, malformed = false }: HotelParkingUiProps): string {
  const known = returnedOptions(evidence)
  if (malformed) return 'Parking details are unclear.'
  if (!evidence) return 'Parking details not provided.'
  if (evidence.state === 'loading' && known.length === 0) return 'Checking parking details…'
  if (evidence.state === 'error' && known.length === 0) return 'Parking details could not be checked.'
  if (evidence.conflict) return 'Parking details conflict across sources. Confirm with the booking partner.'
  if (known.length === 0) return 'Parking details not provided.'
  if (known.every(option => option.facilityStatus === 'unknown')) return 'Parking details are unclear.'

  const unavailable = known.find(option => option.facilityStatus === 'unavailable')
  if (unavailable) {
    const source = providerName(unavailable.sourceLabel)
    return `${source ?? 'The provider'} reports no parking option at this property.`
  }

  const options = confirmedOptions(evidence)
  if (options.length === 0) return 'Parking details are unclear.'
  const base = options.length === 1
    ? `${locationSummary(options[0])}. ${costSummary(options[0])}. ${spaceSummary(options[0], hasSearchDates)}.`
    : multiOptionSummary(options, hasSearchDates)

  if (evidence.state === 'loading') return `${base} Refreshing details…`
  if (evidence.state === 'error') return `${base} Latest check failed.`
  return base
}

function formatParkingDate(value?: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function sourceCopy(option: HotelParkingOptionEvidence): string {
  const source = providerName(option.sourceLabel)
  const updated = formatParkingDate(option.fetchedAt)
  if (source && updated) return `${source} · Updated ${updated}`
  if (source) return `${source} · Update time not provided`
  if (updated) return `Provider name not provided · Updated ${updated}`
  return 'Provider and update time not provided'
}

function spaceDetail(option: HotelParkingOptionEvidence, hasSearchDates: boolean): string {
  const stay = hasSearchDates ? 'these dates' : 'a selected stay'
  if (option.selectedStaySpace === 'confirmed_for_selected_stay') return `Provider reports a space for ${stay}. expaify has not reserved it.`
  if (option.selectedStaySpace === 'unavailable_for_selected_stay') return `Provider reports no space for ${stay}.`
  if (option.selectedStaySpace === 'not_returned') return 'Provider did not provide stay-specific space information.'
  return 'Stay-specific space status is unclear.'
}

function reservationCopy(option: HotelParkingOptionEvidence): string {
  if (option.reservation === 'required') return 'Advance reservation required. expaify has not made it.'
  if (option.reservation === 'not_required') return 'Advance reservation not required. A space is still not promised.'
  if (option.reservation === 'not_possible') return 'Advance reservation is not accepted.'
  if (option.reservation === 'available_on_request') return 'A request can be made; it is not guaranteed.'
  if (option.reservation === 'first_come_first_served') return 'First come, first served. A space is not guaranteed.'
  return 'Reservation rule not provided.'
}

function operatorCopy(option: HotelParkingOptionEvidence): string {
  if (option.operator === 'hotel_operated') return 'Hotel'
  if (option.operator === 'third_party') return 'Third party'
  return 'Operator not provided'
}

function distanceCopy(option: HotelParkingOptionEvidence): string | null {
  const distance = option.location.distance
  if (option.location.kind !== 'nearby_off_site' || distance?.source !== 'provider_documented') return null
  const source = providerName(option.sourceLabel) ?? 'the provider'
  return `${distance.value} ${distance.unit} from the hotel, as reported by ${source}.`
}

function ParkingFact({ label, children, muted = false }: { label: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">{label}</dt>
      <dd className={`mt-1 break-words text-small font-medium leading-5 ${muted ? 'text-[color:var(--text-3)]' : 'text-[color:var(--text-1)]'}`}>{children}</dd>
    </div>
  )
}

function ParkingOption({ option, index, hasSearchDates }: { option: HotelParkingOptionEvidence; index: number; hasSearchDates: boolean }) {
  const address = option.location.kind === 'nearby_off_site' && option.location.address?.trim()
  const distance = distanceCopy(option)
  const paid = option.cost.state === 'paid'
  return (
    <li aria-label={`Parking option ${index + 1}`} className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-3 border-t border-[color:var(--border)] pt-4 first:border-t-0 first:pt-0 md:grid-cols-2">
      <ParkingFact label="Option">
        {optionLabel(option)}
        {address ? <span className="mt-1 block break-words text-[color:var(--text-2)]">Parking address: {address}</span> : null}
        {distance ? <span className="mt-1 block text-[color:var(--text-2)]">{distance}</span> : null}
      </ParkingFact>
      <ParkingFact label="Space for your stay">{spaceDetail(option, hasSearchDates)}</ParkingFact>
      <ParkingFact label="Cost">
        {costSummary(option)}.
        {paid ? <span className="mt-1 block text-[color:var(--text-2)]">Parking is separate from the nightly room rate shown.</span> : null}
      </ParkingFact>
      <ParkingFact label="Advance action">{reservationCopy(option)}</ParkingFact>
      <ParkingFact label="Operated by">{operatorCopy(option)}</ParkingFact>
      <ParkingFact label="Source" muted>{sourceCopy(option)}</ParkingFact>
    </li>
  )
}

function conflictCopy(dimensions: readonly HotelParkingConflictDimension[] = []): string {
  if (dimensions.length === 0 || dimensions.length > 2) return 'Sources disagree about multiple parking details. Confirm the current details with the booking partner.'
  const list = dimensions.length === 2 ? `${dimensions[0]} and ${dimensions[1]}` : dimensions[0]
  return `Sources disagree about ${list}. Confirm the current details with the booking partner.`
}

export function getParkingBeforePay({ evidence, malformed = false }: HotelParkingUiProps): string {
  const options = confirmedOptions(evidence)
  const returned = returnedOptions(evidence)
  if (options.some(option => option.selectedStaySpace === 'unavailable_for_selected_stay')) return 'The provider reports no parking space for these dates. Choose another parking plan or confirm a changed status before you pay.'
  const unknownDominant = malformed || evidence?.conflict || options.length > 1 && options.some(option => (
    option.location.kind === 'unknown' || option.cost.state === 'unknown' || option.reservation === 'unknown' || option.operator === 'unknown' || option.selectedStaySpace === 'unknown'
  ))
  if (unknownDominant) return 'Parking location, cost, reservation rules, operator, or space availability are still not fully documented. Confirm them before you pay.'
  if (options.some(option => option.reservation === 'required')) return 'This parking option requires advance reservation. Complete or confirm it with the booking partner; expaify has not reserved a space.'
  if (options.some(option => option.operator === 'third_party')) return 'This option is operated by a third party. Confirm payment, access, and cancellation terms with that operator or the booking partner.'
  if (options.some(option => option.selectedStaySpace === 'confirmed_for_selected_stay')) return 'The provider reports a parking space for these dates. Recheck the live booking terms before payment.'
  if (options.length > 0) return 'Parking is documented, but expaify has not confirmed a space for your dates. Check availability with the booking partner before you pay.'
  if (returned.some(option => option.facilityStatus === 'unavailable')) return 'The provider reports no parking option at this property. Make another parking plan before you pay.'
  return 'Parking details were not provided or could not be checked. Confirm your parking plan before you pay.'
}

export function getParkingCtaStatus({ evidence, malformed = false }: HotelParkingUiProps): string {
  const options = malformed ? [] : confirmedOptions(evidence)
  if (options.some(option => option.selectedStaySpace === 'unavailable_for_selected_stay')) return 'Provider reports no parking space for these dates.'
  if (options.some(option => option.selectedStaySpace === 'confirmed_for_selected_stay')) return 'Provider reports a parking space for these dates; expaify has not reserved it.'
  return 'Parking space not confirmed.'
}

export function ParkingSummary(props: HotelParkingUiProps) {
  const copy = getParkingSummary(props)
  const isLoading = props.evidence?.state === 'loading'
  const isError = props.evidence?.state === 'error'
  const isWarning = props.malformed || props.evidence?.conflict || copy.includes('unclear') || copy.includes('No space') || copy.includes('failed')
  return (
    <div className="mt-3 flex min-w-0 items-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3 py-2 text-small leading-5 text-[color:var(--text-2)]">
      <span aria-hidden="true" className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${isError ? 'bg-[color:var(--error)]' : isWarning ? 'bg-[color:var(--warning)]' : 'bg-[color:var(--text-3)]'}`} />
      <p className="min-w-0 whitespace-normal break-words" role={isLoading || isError ? 'status' : undefined} aria-live={isLoading || isError ? 'polite' : undefined} aria-atomic={isLoading || isError ? 'true' : undefined}>{copy}</p>
    </div>
  )
}

export function ParkingSection({
  evidence,
  conflictDimensions,
  hasSearchDates = true,
  malformed = false,
  hotelId,
  bookingReview = false,
}: HotelParkingUiProps & { hotelId: string; bookingReview?: boolean }) {
  const titleId = `${bookingReview ? 'booking' : 'hotel'}-parking-title-${hotelId}`
  const known = returnedOptions(evidence)
  const options = confirmedOptions(evidence)
  const unavailable = known.find(option => option.facilityStatus === 'unavailable')
  const allUnknown = known.length > 0 && known.every(option => option.facilityStatus === 'unknown')
  const initialLoading = evidence?.state === 'loading' && known.length === 0
  const noEvidenceError = evidence?.state === 'error' && known.length === 0
  const noEvidence = !evidence || evidence.state === 'ready' && known.length === 0
  const source = unavailable ? providerName(unavailable.sourceLabel) : null
  const heading = bookingReview ? 'Parking for this stay' : 'Parking'

  return (
    <section aria-labelledby={titleId} className={`${bookingReview ? 'rounded-lg px-4 py-4 sm:px-5 sm:py-5' : 'rounded-[var(--radius-card)] px-3.5 py-3 sm:px-4 sm:py-4'} border border-[color:var(--border)] bg-[color:var(--bg-raised)] text-small leading-5 text-[color:var(--text-2)]`}>
      <h3 id={titleId} className="text-sm font-bold text-[color:var(--text-1)]">{heading}</h3>
      {initialLoading ? (
        <div className="mt-3" role="status" aria-live="polite" aria-atomic="true">
          <p>Checking parking details…</p>
          <div className="mt-3 space-y-2" aria-hidden="true">
            <div className="skeleton h-2.5 w-2/3 rounded-full" />
            <div className="skeleton h-2.5 w-full rounded-full" />
            <div className="skeleton h-2.5 w-4/5 rounded-full" />
          </div>
        </div>
      ) : malformed || allUnknown ? (
        <div className="mt-3 rounded-lg bg-[color:var(--warning-soft)] px-3 py-2 text-[color:var(--warning)]" role={bookingReview ? 'status' : undefined} aria-live={bookingReview ? 'polite' : undefined}>
          <p className="font-bold">Parking details are unclear.</p><p className="mt-1">{confirmationCopy}</p>
        </div>
      ) : noEvidenceError ? (
        <div className="mt-3 rounded-lg bg-[color:var(--error-soft)] px-3 py-2 text-[color:var(--error)]" role="status" aria-live="polite" aria-atomic="true">
          <p className="font-bold">Parking details could not be checked.</p><p className="mt-1">{confirmationCopy}</p>
        </div>
      ) : noEvidence ? (
        <div className="mt-3 rounded-lg bg-[color:var(--bg-muted)] px-3 py-2 text-[color:var(--text-3)]">
          <p className="font-bold text-[color:var(--text-2)]">Parking details not provided.</p><p className="mt-1">{confirmationCopy}</p>
        </div>
      ) : unavailable ? (
        <div className="mt-3 rounded-lg bg-[color:var(--bg-muted)] px-3 py-2">
          <p className="font-bold text-[color:var(--text-1)]">{source ?? 'The provider'} reports no parking option at this property.</p>
          <p className="mt-1 text-[color:var(--text-3)]">This is a property-level statement; street or third-party options were not assessed unless listed separately.</p>
        </div>
      ) : (
        <>
          {evidence?.conflict ? (
            <div className="mt-3 rounded-lg bg-[color:var(--warning-soft)] px-3 py-2 text-[color:var(--warning)]">
              <p className="font-bold">Parking details conflict.</p><p className="mt-1">{conflictCopy(conflictDimensions)}</p>
            </div>
          ) : null}
          <p className="mt-2 text-[color:var(--text-3)]">{options.length > 1 ? `${options.length} parking options reported. ` : ''}Property details and stay-specific space status are shown separately.</p>
          <ul className="mt-4 space-y-4">
            {options.map((option, index) => <ParkingOption key={option.id} option={option} index={index} hasSearchDates={hasSearchDates} />)}
          </ul>
          {evidence?.state === 'loading' ? <p className="mt-3 text-[color:var(--text-3)]" role="status" aria-live="polite" aria-atomic="true">Refreshing parking details…</p> : null}
          {evidence?.state === 'error' ? <p className="mt-3 rounded-lg bg-[color:var(--warning-soft)] px-3 py-2 text-[color:var(--warning)]" role="status" aria-live="polite" aria-atomic="true">The latest parking check failed. Confirm these details with the booking partner.</p> : null}
        </>
      )}
      {bookingReview ? (
        <div className="mt-4 border-t border-[color:var(--border)] pt-4">
          <p className="font-bold text-[color:var(--text-1)]">Before you pay</p>
          <p className="mt-1 text-[color:var(--text-2)]">{getParkingBeforePay({ evidence, malformed })}</p>
        </div>
      ) : null}
    </section>
  )
}
