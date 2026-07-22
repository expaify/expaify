'use client'

import { useState } from 'react'
import { DealScore, HotelAmenityEvidence, HotelEvidenceFee, HotelOffer } from '@/lib/types'
import { formatMoney, isValidMoney } from '@/lib/money'
import { buildHotelBookingHref } from '@/lib/booking/config'
import { hasProviderName, providerDisplayName } from '@/lib/providerFreshness'
import DealScorePanel from './DealScorePanel'
import { getHotelLocationDisplay } from './hotelLocationContext'
import { PropertyPhoto } from './ui/PropertyPhoto'
import { getCollapsedSmokingPolicy, type HotelSmokingPolicyView } from './SmokingPolicyPanel'
import TrackedSmokingPolicyPanel from './TrackedSmokingPolicyPanel'

type Props = {
  hotel: HotelOffer
  score?: DealScore | null
  loading?: boolean
  amenityEvidence?: readonly HotelAmenityEvidence[]
  accessEvidenceState?: 'ready' | 'loading' | 'error'
  smokingPolicy?: HotelSmokingPolicyView
}

type AccessFactId =
  | 'elevator'
  | 'on_site_parking'
  | 'step_free_route'
  | 'room_pref_ground_floor'
  | 'room_pref_high_floor'
  | 'room_pref_near_elevator'
  | 'room_pref_connecting'

type NormalizedAccessEvidence = HotelAmenityEvidence & { id: AccessFactId }

const NON_GUARANTEE_CLAUSE = 'Request only — not guaranteed until the provider confirms.'

const ACCESS_FACTS: ReadonlyArray<{
  id: AccessFactId
  label: string
  kind: 'property' | 'room_request'
}> = [
  { id: 'elevator', label: 'Elevator', kind: 'property' },
  { id: 'on_site_parking', label: 'On-site parking', kind: 'property' },
  { id: 'step_free_route', label: 'Step-free route, entrance to room', kind: 'property' },
  { id: 'room_pref_ground_floor', label: 'Ground-floor room', kind: 'room_request' },
  { id: 'room_pref_high_floor', label: 'High-floor room', kind: 'room_request' },
  { id: 'room_pref_near_elevator', label: 'Room near the elevator', kind: 'room_request' },
  { id: 'room_pref_connecting', label: 'Connecting rooms', kind: 'room_request' },
]

const ACCESS_FACT_IDS = new Set<AccessFactId>(ACCESS_FACTS.map(fact => fact.id))

function isAccessFactId(id: string): id is AccessFactId {
  return ACCESS_FACT_IDS.has(id as AccessFactId)
}

function hasEvidenceSource(sourceLabel: unknown): sourceLabel is string {
  return typeof sourceLabel === 'string' && sourceLabel.trim().length > 0
}

function normalizeAccessEvidence(item: HotelAmenityEvidence): NormalizedAccessEvidence {
  const fact = ACCESS_FACTS.find(candidate => candidate.id === item.id)!
  const normalized = { ...item, id: fact.id, label: fact.label }
  const hasValidScope = fact.kind === 'property'
    ? item.scope === 'property'
    : item.scope === 'room' || item.scope === 'selected_stay'

  if (item.status !== 'confirmed') {
    if (item.status === 'unavailable' && (!hasEvidenceSource(item.sourceLabel) || !hasValidScope)) {
      return { ...normalized, status: 'unknown', certainty: undefined }
    }
    return { ...normalized, certainty: undefined }
  }

  const hasValidSource = hasEvidenceSource(item.sourceLabel)
  const isGuaranteedPropertyFact = fact.kind === 'property'
    && item.scope === 'property'
    && item.certainty === 'guaranteed'
  const isRequestableParking = item.id === 'on_site_parking'
    && item.scope === 'property'
    && item.certainty === 'requestable'
  const isGuaranteedRoom = fact.kind === 'room_request'
    && item.scope === 'selected_stay'
    && item.certainty === 'guaranteed'
  const isRequestableRoom = fact.kind === 'room_request'
    && (item.scope === 'room' || item.scope === 'selected_stay')
    && item.certainty === 'requestable'

  if (!hasValidSource || (!isGuaranteedPropertyFact && !isRequestableParking && !isGuaranteedRoom && !isRequestableRoom)) {
    return { ...normalized, status: 'unknown', certainty: undefined }
  }

  return normalized
}

function getAccessEvidence(items: readonly HotelAmenityEvidence[]): NormalizedAccessEvidence[] {
  const precedence = { unavailable: 0, unknown: 1, not_returned: 2, confirmed: 3 }
  const supplied = new Map<AccessFactId, NormalizedAccessEvidence>()

  for (const item of items) {
    if (!isAccessFactId(item.id)) continue
    const normalized = normalizeAccessEvidence(item)
    const current = supplied.get(normalized.id)

    if (!current || precedence[normalized.status] < precedence[current.status]) {
      supplied.set(normalized.id, normalized)
    }
  }

  return ACCESS_FACTS.map(fact => supplied.get(fact.id) ?? {
    id: fact.id,
    label: fact.label,
    status: 'not_returned',
    scope: fact.kind === 'property' ? 'property' : 'room',
    sourceLabel: 'Hotel provider',
  })
}

function getParkingFeeText(fee?: HotelEvidenceFee): string {
  if (fee === 'included') return 'Parking fee: included.'
  if (fee === 'paid') return 'Parking fee: additional charge applies.'
  return 'Parking fee: not documented.'
}

function getConfirmedCopy(item: NormalizedAccessEvidence): { visible: string; aria: string } {
  const provider = item.sourceLabel.trim()

  if (item.certainty === 'requestable') {
    const requestableCopy: Partial<Record<AccessFactId, readonly [string, string]>> = {
      on_site_parking: ['You can request an on-site parking space.', 'On-site parking space can be requested.'],
      room_pref_ground_floor: ['You can request a ground-floor room.', 'Ground-floor room can be requested.'],
      room_pref_high_floor: ['You can request a high-floor room.', 'High-floor room can be requested.'],
      room_pref_near_elevator: ['You can request a room near the elevator.', 'Room near the elevator can be requested.'],
      room_pref_connecting: ['You can request connecting rooms.', 'Connecting rooms can be requested.'],
    }
    const copy = requestableCopy[item.id]
    const fee = item.id === 'on_site_parking' ? ` ${getParkingFeeText(item.fee)}` : ''

    return {
      visible: `${copy?.[0] ?? `${item.label}: the provider's information is unclear.`} ${NON_GUARANTEE_CLAUSE}${fee}`,
      aria: `${copy?.[1] ?? `${item.label}. Information unclear.`} ${NON_GUARANTEE_CLAUSE}${fee}`,
    }
  }

  switch (item.id) {
    case 'elevator':
      return {
        visible: 'Provider confirms this property has an elevator.',
        aria: `Elevator. Guaranteed property attribute. ${provider} confirms this property has an elevator.`,
      }
    case 'on_site_parking': {
      const fee = getParkingFeeText(item.fee)
      return {
        visible: `Provider confirms this property has on-site parking. ${fee}`,
        aria: `On-site parking. Guaranteed property attribute. ${provider} confirms on-site parking. ${fee}`,
      }
    }
    case 'step_free_route':
      return {
        visible: 'Provider confirms a step-free route from the entrance to the room.',
        aria: `Step-free route from entrance to room. Guaranteed property attribute. ${provider} confirms every documented link in the route is step-free.`,
      }
    case 'room_pref_ground_floor':
      return {
        visible: 'The provider guarantees a ground-floor room for this selected stay.',
        aria: `Ground-floor room. Guaranteed for this selected stay by ${provider}.`,
      }
    case 'room_pref_high_floor':
      return {
        visible: 'The provider guarantees a high-floor room for this selected stay.',
        aria: `High-floor room. Guaranteed for this selected stay by ${provider}.`,
      }
    case 'room_pref_near_elevator':
      return {
        visible: 'The provider guarantees a room near the elevator for this selected stay.',
        aria: `Room near the elevator. Guaranteed for this selected stay by ${provider}.`,
      }
    case 'room_pref_connecting':
      return {
        visible: 'The provider guarantees connecting rooms for this selected stay.',
        aria: `Connecting rooms. Guaranteed for this selected stay by ${provider}.`,
      }
  }
}

function getUnavailableCopy(id: AccessFactId): string {
  return {
    elevator: 'The provider states this property has no elevator.',
    on_site_parking: 'The provider states this property has no on-site parking.',
    step_free_route: 'The provider documents a step or barrier on the route from the entrance to the room.',
    room_pref_ground_floor: 'The provider states a ground-floor room cannot be requested for this stay.',
    room_pref_high_floor: 'The provider states a high-floor room cannot be requested for this stay.',
    room_pref_near_elevator: 'The provider states a room near the elevator cannot be requested for this stay.',
    room_pref_connecting: 'The provider states connecting rooms cannot be requested for this stay.',
  }[id]
}

function getEvidenceMetadata(item: NormalizedAccessEvidence): string[] {
  const metadata: string[] = []

  if (item.status === 'confirmed' && item.certainty === 'guaranteed') {
    metadata.push(item.scope === 'selected_stay'
      ? 'Confirmed for this selected stay.'
      : 'Property-level fact; confirm your specific room and rate before payment.')
  }

  const updated = item.fetchedAt ? formatUpdatedDate(item.fetchedAt) : null
  if (hasEvidenceSource(item.sourceLabel)) {
    metadata.push(`Source: ${item.sourceLabel.trim()}.${updated ? ` Updated ${updated}.` : ''}`)
  }

  return metadata
}

function AccessEvidenceRow({ item }: { item: NormalizedAccessEvidence }) {
  if (item.status === 'unknown') {
    const copy = `${item.label}: the provider's information is unclear. Confirm directly before booking.`
    const metadata = getEvidenceMetadata(item)
    return (
      <div aria-label={`${item.label}. Information unclear. Confirm directly with the provider before booking.`}>
        <dt className="font-bold text-[color:var(--text-1)]">{item.label}</dt>
        <dd className="mt-0.5 font-medium text-[color:var(--text-2)]">{copy}</dd>
        {metadata.length ? <dd className="mt-1 break-words text-[color:var(--text-3)]">{metadata.join(' ')}</dd> : null}
      </div>
    )
  }

  if (item.status === 'unavailable') {
    const copy = getUnavailableCopy(item.id)
    const metadata = getEvidenceMetadata(item)
    return (
      <div
        className="rounded-[var(--radius-control)] bg-[color:var(--warning-soft)] px-3 py-2"
        aria-label={`${item.label}. Unavailable. ${copy} Source: ${item.sourceLabel.trim()}.`}
      >
        <dt className="font-bold text-[color:var(--text-1)]">{item.label}</dt>
        <dd className="mt-0.5 font-medium text-[color:var(--warning)]">{copy}</dd>
        <dd className="mt-1 break-words text-[color:var(--text-3)]">{metadata.join(' ')}</dd>
      </div>
    )
  }

  const copy = getConfirmedCopy(item)
  const metadata = getEvidenceMetadata(item)
  return (
    <div aria-label={copy.aria}>
      <dt className="font-bold text-[color:var(--text-1)]">{item.label}</dt>
      <dd className="mt-0.5 font-medium text-[color:var(--text-2)]">{copy.visible}</dd>
      <dd className="mt-1 break-words text-[color:var(--text-3)]">{metadata.join(' ')}</dd>
    </div>
  )
}

function AccessEvidencePanel({
  hotelId,
  evidence,
  state,
}: {
  hotelId: string
  evidence: NormalizedAccessEvidence[]
  state: NonNullable<Props['accessEvidenceState']>
}) {
  const titleId = `hotel-access-title-${hotelId}`
  const returnedEvidence = evidence.filter(item => item.status !== 'not_returned')
  const allNotReturned = returnedEvidence.length === 0
  const allReturnedUnknown = returnedEvidence.length > 0
    && returnedEvidence.every(item => item.status === 'unknown')
  const hasNotReturned = evidence.some(item => item.status === 'not_returned')
  const defaultCopy = 'Access details not documented by this provider. Confirm elevator, parking, step-free access, and room requests directly with the provider before booking.'
  const errorCopy = 'Access details could not be checked. Confirm elevator, parking, step-free access, and room requests directly with the provider before booking.'
  const sectionLabel = allNotReturned && state === 'ready'
    ? 'Access and room requests. Access details not documented by this provider. Confirm directly before booking.'
    : undefined

  return (
    <section
      className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 text-xs leading-5 text-[color:var(--text-2)]"
      aria-labelledby={titleId}
      aria-label={sectionLabel}
    >
      <h4 id={titleId} className="font-bold text-[color:var(--text-1)]">Access &amp; room requests</h4>
      {state === 'loading' && allNotReturned ? (
        <p className="mt-2 font-medium text-[color:var(--text-3)]" role="status" aria-live="polite">
          Checking access details…
        </p>
      ) : state === 'error' ? (
        <p
          className="mt-2 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] px-3 py-2 font-medium text-[color:var(--text-3)]"
          role="status"
          aria-live="polite"
        >
          {errorCopy}
        </p>
      ) : allNotReturned ? (
        <p className="mt-2 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] px-3 py-2 font-medium text-[color:var(--text-3)]">
          {defaultCopy}
        </p>
      ) : allReturnedUnknown ? (
        <p
          className="mt-2 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] px-3 py-2 font-medium text-[color:var(--text-3)] sm:col-span-2"
          aria-label="Access and room-request information from this provider is unclear. Confirm details directly before booking."
        >
          Access and room-request information from this provider is unclear. Confirm details directly before booking.
        </p>
      ) : (
        <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6">
          {returnedEvidence.map(item => <AccessEvidenceRow key={item.id} item={item} />)}
          {hasNotReturned ? (
            <div
              className="sm:col-span-2 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] px-3 py-2 font-medium text-[color:var(--text-3)]"
              aria-label="Other access and room-request details were not documented by this provider. Confirm them directly before booking."
            >
              Other access and room-request details were not documented by this provider. Confirm them directly before booking.
            </div>
          ) : null}
        </dl>
      )}
      {state === 'loading' && !allNotReturned ? (
        <p className="mt-3 font-medium text-[color:var(--text-3)]" role="status" aria-live="polite">
          Refreshing access details…
        </p>
      ) : null}
    </section>
  )
}

function StarRow({ stars }: { stars: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(stars)))

  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <svg key={index} width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M6 1l1.39 2.82 3.11.45-2.25 2.19.53 3.09L6 8 3.22 9.55l.53-3.09L1.5 4.27l3.11-.45L6 1z"
            className={index < filled ? 'fill-amber-400' : 'fill-[color:var(--border-strong)]'}
          />
        </svg>
      ))}
    </div>
  )
}

function Price({ price, providerName, className = '' }: { price: HotelOffer['pricePerNight']; providerName: string; className?: string }) {
  return (
    <div className={`min-w-[6.75rem] max-w-[9.5rem] text-right ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
        Nightly rate
      </p>
      <p className="mt-1 font-display text-xl font-bold leading-none text-[color:var(--text-1)] tabular-nums sm:text-4xl">
        {formatMoney(price)}
      </p>
      <div className="mt-1 space-y-0.5 text-[11px] font-medium leading-4">
        <p className="text-[color:var(--text-3)]">per night before taxes and fees</p>
        <p className="text-[color:var(--text-2)]">Rate from {providerName}</p>
        <p className="text-[color:var(--warning)]">Last-checked time unavailable</p>
      </div>
    </div>
  )
}

function PriceUnavailable({ reason, providerName, showProvider, className = '' }: { reason: string; providerName: string; showProvider: boolean; className?: string }) {
  return (
    <div className={`min-w-[6.75rem] max-w-[9.5rem] text-right ${className}`} role="status" aria-label={`Hotel price unavailable. ${reason}${showProvider ? ` Rate from ${providerName}.` : ''} Last-checked time unavailable.`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
        Nightly rate
      </p>
      <p className="mt-1 font-display text-lg font-bold leading-none text-[color:var(--text-1)]">
        Price unavailable
      </p>
      <div className="mt-1 space-y-0.5 text-[11px] font-medium leading-4">
        <p className="text-[color:var(--text-3)]">{reason}</p>
        {showProvider ? <p className="text-[color:var(--text-2)]">Rate from {providerName}</p> : null}
        <p className="text-[color:var(--warning)]">Last-checked time unavailable</p>
      </div>
    </div>
  )
}

function getUnavailableReason(hasBookingUrl: boolean, hasValidPrice: boolean) {
  if (!hasValidPrice && !hasBookingUrl) {
    return 'No confirmed nightly price or valid booking link was returned.'
  }

  if (!hasValidPrice) {
    return 'No confirmed nightly price was returned.'
  }

  return 'No valid booking link was returned.'
}

function isValidBookingUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function ratingLabel(rating: number): string {
  return rating >= 8.5 ? 'Excellent' : rating >= 8 ? 'Very good' : 'Good'
}

function hasPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function formatDecimal(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
}

function formatReviewCount(count: number): string {
  return new Intl.NumberFormat('en-US').format(count)
}

function formatUpdatedDate(value: string): string | null {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function getHotelClassEvidence(hotel: HotelOffer) {
  if (hotel.hotelClass?.kind === 'hotel_class' && hasPositiveNumber(hotel.hotelClass.value)) {
    return hotel.hotelClass
  }

  if (hasPositiveNumber(hotel.stars)) {
    return {
      kind: 'hotel_class' as const,
      value: hotel.stars,
      scaleMax: 5,
      sourceLabel: hotel.source,
      confidence: 'provider_only' as const,
    }
  }

  return null
}

type RatingEvidenceWithScore = NonNullable<HotelOffer['guestRating']> & {
  value: number
  scaleMax: number
}

function isVerifiedGuestRating(evidence: HotelOffer['guestRating']): evidence is RatingEvidenceWithScore {
  return evidence?.kind === 'guest_review'
    && evidence.confidence === 'verified'
    && hasPositiveNumber(evidence.value)
    && hasPositiveNumber(evidence.scaleMax)
}

function isProviderRating(evidence: HotelOffer['guestRating']): evidence is RatingEvidenceWithScore {
  return evidence?.confidence === 'provider_only'
    && hasPositiveNumber(evidence.value)
    && hasPositiveNumber(evidence.scaleMax)
}

function getHotelClassCollapsedText(evidence: NonNullable<ReturnType<typeof getHotelClassEvidence>>): string {
  const value = evidence.value
  const scaleMax = evidence.scaleMax ?? 5

  if (!hasPositiveNumber(value)) {
    return 'Hotel class'
  }

  if (Number.isInteger(value) && scaleMax === 5) {
    return `${value}-star hotel`
  }

  return `${formatDecimal(value)} of ${formatDecimal(scaleMax)} hotel class`
}

function getHotelClassDetailText(evidence: ReturnType<typeof getHotelClassEvidence>, source: string): string {
  if (!evidence || !hasPositiveNumber(evidence.value)) {
    return 'Class not provided'
  }

  const sourceLabel = evidence.sourceLabel ?? source
  const scaleMax = evidence.scaleMax ?? 5

  if (Number.isInteger(evidence.value) && scaleMax === 5) {
    return `${evidence.value}-star hotel class from ${sourceLabel}`
  }

  return `${formatDecimal(evidence.value)} of ${formatDecimal(scaleMax)} hotel class from ${sourceLabel}`
}

function getGuestRatingCollapsedText(evidence: HotelOffer['guestRating']): string | null {
  if (!hasPositiveNumber(evidence?.value) || !hasPositiveNumber(evidence?.scaleMax)) {
    return null
  }

  const ratingText = `${formatDecimal(evidence.value)}/${formatDecimal(evidence.scaleMax)}`
  const reviews = hasPositiveNumber(evidence.reviewCount)
    ? ` · ${formatReviewCount(evidence.reviewCount)} reviews`
    : ''

  if (isVerifiedGuestRating(evidence)) {
    return `${ratingText} guest rating${reviews}`
  }

  if (isProviderRating(evidence)) {
    return `${ratingText} provider rating${reviews}`
  }

  return null
}

function getGuestRatingDetailText(evidence: HotelOffer['guestRating'], legacyRatingPresent: boolean, source: string): string {
  if (!evidence) {
    return legacyRatingPresent ? 'No verified guest rating' : 'Guest rating not provided'
  }

  if (!hasPositiveNumber(evidence.value) || !hasPositiveNumber(evidence.scaleMax)) {
    return evidence.confidence === 'inferred' ? 'No verified guest rating' : 'Guest rating not provided'
  }

  const sourceLabel = evidence.sourceLabel ?? source
  const ratingText = `${formatDecimal(evidence.value)}/${formatDecimal(evidence.scaleMax)}`

  if (isVerifiedGuestRating(evidence)) {
    const label = evidence.scaleMax === 10 && evidence.value >= 7 ? `${ratingLabel(evidence.value)} guest rating: ` : ''
    return label ? `${label}${ratingText}` : `${ratingText} guest rating from ${sourceLabel}`
  }

  if (isProviderRating(evidence)) {
    return `${ratingText} provider rating from ${sourceLabel}`
  }

  if (evidence.confidence === 'inferred') {
    return 'No verified guest rating'
  }

  return 'Guest rating not provided'
}

function getReviewCountText(evidence: HotelOffer['guestRating']): string {
  if (!evidence || !hasPositiveNumber(evidence.value)) {
    return 'No review count available'
  }

  if (hasPositiveNumber(evidence.reviewCount)) {
    return `${formatReviewCount(evidence.reviewCount)} guest reviews`
  }

  return 'Review count not provided'
}

function getConfidenceText(evidence: HotelOffer['guestRating'], legacyRatingPresent: boolean): string {
  if (isVerifiedGuestRating(evidence)) {
    return 'Verified guest reviews'
  }

  if (isProviderRating(evidence)) {
    return 'Provider rating; review source not confirmed'
  }

  if (evidence?.confidence === 'inferred' || legacyRatingPresent) {
    return 'Not shown as a guest rating because it matches hotel class data'
  }

  return 'No rating evidence from this provider'
}

function getQualityHelperText(evidence: HotelOffer['guestRating'], hasClass: boolean, legacyRatingPresent: boolean): string {
  if (isVerifiedGuestRating(evidence)) {
    return 'Guest ratings are shown only when the provider identifies the score as guest-review data.'
  }

  if (isProviderRating(evidence)) {
    return 'This score is shown for context, but the provider did not include enough review evidence to verify it.'
  }

  if (evidence?.confidence === 'inferred' || legacyRatingPresent) {
    return 'We do not label inferred hotel data as a guest rating.'
  }

  if (!hasClass) {
    return 'This provider did not return hotel class or verified guest-rating evidence.'
  }

  return 'No verified guest-rating evidence from this provider.'
}

function getQualityAriaLabel(
  hotelClass: ReturnType<typeof getHotelClassEvidence>,
  guestRating: HotelOffer['guestRating'],
  legacyRatingPresent: boolean,
) {
  const classText = hotelClass && hasPositiveNumber(hotelClass.value)
    ? `Hotel class: ${formatDecimal(hotelClass.value)} out of ${formatDecimal(hotelClass.scaleMax ?? 5)}.`
    : 'Hotel class not provided.'

  let guestText = 'Guest rating not provided.'

  if (isVerifiedGuestRating(guestRating)) {
    const reviews = hasPositiveNumber(guestRating.reviewCount)
      ? ` from ${formatReviewCount(guestRating.reviewCount)} guest reviews`
      : ''
    guestText = `Guest rating: ${formatDecimal(guestRating.value)}/${formatDecimal(guestRating.scaleMax)}${reviews}.`
  } else if (isProviderRating(guestRating)) {
    guestText = `Provider rating: ${formatDecimal(guestRating.value)} out of ${formatDecimal(guestRating.scaleMax)}. ${getReviewCountText(guestRating)}.`
  } else if (guestRating?.confidence === 'inferred' || legacyRatingPresent) {
    guestText = 'No verified guest rating. Provider value matches hotel class data.'
  }

  return `${classText} ${guestText}`
}

function QualityEvidencePanel({ hotelClass, guestRating, legacyRatingPresent, source }: {
  hotelClass: ReturnType<typeof getHotelClassEvidence>
  guestRating: HotelOffer['guestRating']
  legacyRatingPresent: boolean
  source: string
}) {
  const updatedDate = guestRating?.fetchedAt ? formatUpdatedDate(guestRating.fetchedAt) : null
  const helperText = getQualityHelperText(guestRating, Boolean(hotelClass), legacyRatingPresent)
  const helperClasses = guestRating?.confidence === 'inferred' || legacyRatingPresent
    ? 'mt-3 rounded-[var(--radius-control)] bg-[color:var(--warning-soft)] px-3 py-2 text-xs font-medium leading-5 text-[color:var(--warning)]'
    : 'mt-3 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] px-3 py-2 text-xs font-medium leading-5 text-[color:var(--text-3)]'

  return (
    <section
      className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 text-xs leading-5 text-[color:var(--text-2)]"
      aria-label="Quality evidence"
    >
      <p className="font-bold text-[color:var(--text-1)]">Quality evidence</p>
      <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6">
        <div>
          <dt className="font-bold text-[color:var(--text-1)]">Hotel class</dt>
          <dd className="mt-0.5 font-medium text-[color:var(--text-2)]">
            {getHotelClassDetailText(hotelClass, source)}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-[color:var(--text-1)]">Guest rating</dt>
          <dd className="mt-0.5 font-medium text-[color:var(--text-2)]">
            {getGuestRatingDetailText(guestRating, legacyRatingPresent, source)}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-[color:var(--text-1)]">Review count</dt>
          <dd className="mt-0.5 font-medium text-[color:var(--text-2)]">
            {getReviewCountText(guestRating)}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-[color:var(--text-1)]">Confidence</dt>
          <dd className="mt-0.5 font-medium text-[color:var(--text-2)]">
            {getConfidenceText(guestRating, legacyRatingPresent)}
          </dd>
        </div>
        <div>
          <dt className="font-bold text-[color:var(--text-1)]">Updated</dt>
          <dd className="mt-0.5 font-medium text-[color:var(--text-2)]">
            {updatedDate ? `Updated ${updatedDate}` : 'Freshness not provided'}
          </dd>
        </div>
      </dl>
      <p className={helperClasses}>{helperText}</p>
    </section>
  )
}

function ScoreChip({ score, loading }: { score: DealScore | null; loading: boolean }) {
  if (loading) {
    return (
      <span
        className="inline-flex min-h-7 items-center rounded-full border border-[color:var(--border)] bg-[color:var(--bg-muted)] px-3 py-1 text-xs font-medium text-[color:var(--text-2)]"
        aria-live="polite"
      >
        Score pending
      </span>
    )
  }

  if (!score) {
    return (
      <span className="inline-flex min-h-7 items-center rounded-full border border-[color:var(--border)] bg-[color:var(--bg-muted)] px-3 py-1 text-xs font-medium text-[color:var(--text-2)]">
        Score unavailable
      </span>
    )
  }

  const label = score.confidence === 'low' ? 'Limited history' : score.verdict
  const classes = score.confidence === 'low'
    ? 'border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]'
    : score.verdict === 'Great'
      ? 'border-[color:var(--border-strong)] bg-[color:var(--success-soft)] text-[color:var(--success)]'
      : score.verdict === 'Good'
        ? 'border-[color:var(--border-strong)] bg-[color:var(--brand-soft)] text-[color:var(--brand)]'
        : 'border-[color:var(--border)] bg-[color:var(--bg-muted)] text-[color:var(--text-2)]'

  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-xs font-medium ${classes}`}>
      {label}
    </span>
  )
}

export default function HotelCard({
  hotel,
  score = null,
  loading = false,
  amenityEvidence,
  accessEvidenceState,
  smokingPolicy,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [photoFailed, setPhotoFailed] = useState(false)
  const location = getHotelLocationDisplay(hotel)
  const hasBookingUrl = isValidBookingUrl(hotel.deeplink)
  const hasValidPrice = isValidMoney(hotel.pricePerNight)
  const canBook = hasBookingUrl && hasValidPrice
  const unavailableReason = getUnavailableReason(hasBookingUrl, hasValidPrice)
  const unavailableLabel = 'Booking unavailable'
  const hotelClass = getHotelClassEvidence(hotel)
  const legacyRatingPresent = !hotel.guestRating && hasPositiveNumber(hotel.rating)
  const collapsedGuestRating = getGuestRatingCollapsedText(hotel.guestRating)
  const qualityAriaLabel = getQualityAriaLabel(hotelClass, hotel.guestRating, legacyRatingPresent)
  const bookingHref = canBook ? buildHotelBookingHref(hotel) : ''
  const formattedPrice = hasValidPrice ? formatMoney(hotel.pricePerNight) : ''
  const providerName = providerDisplayName(hotel.source)
  const hasHotelProviderName = hasProviderName(hotel.source)
  const rateCheckCopy = `Rate from ${providerName}. Last-checked time unavailable.`
  const providerConfirmationCopy = 'Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms.'
  const reviewDisclosure = providerConfirmationCopy
  const reviewAriaLabel = `Review ${hotel.name}. Nightly rate ${formattedPrice} before taxes and fees. Rate from ${providerName}. Last-checked time unavailable. Opens expaify review before provider handoff. ${providerConfirmationCopy}`
  const unavailableAriaLabel = hasValidPrice
    ? `Provider link unavailable for ${hotel.name}. ${unavailableReason}${hasHotelProviderName ? ` Rate from ${providerName}.` : ''} Last-checked time unavailable.`
    : `Hotel price unavailable. ${unavailableReason}${hasHotelProviderName ? ` Rate from ${providerName}.` : ''} Last-checked time unavailable.`
  const detailsId = `hotel-details-${hotel.id}`
  const accessEvidence = getAccessEvidence(amenityEvidence ?? hotel.amenityEvidence ?? [])
  const resolvedAccessEvidenceState = accessEvidenceState ?? hotel.accessEvidenceState ?? 'ready'
  const collapsedAccessFact = accessEvidence.find(item => (
    (item.id === 'elevator' || item.id === 'on_site_parking')
    && item.status === 'confirmed'
    && item.certainty === 'guaranteed'
    && item.scope === 'property'
    && hasEvidenceSource(item.sourceLabel)
  ))
  const collapsedAccessAriaLabel = collapsedAccessFact?.id === 'elevator'
    ? `Elevator. ${collapsedAccessFact.sourceLabel.trim()} confirms this property has an elevator.`
    : collapsedAccessFact?.id === 'on_site_parking'
      ? `On-site parking. ${collapsedAccessFact.sourceLabel.trim()} confirms this property has on-site parking. Review parking fees and space availability in details.`
      : undefined
  const resolvedSmokingPolicy = smokingPolicy ?? hotel.smokingPolicy
  const collapsedSmokingPolicy = getCollapsedSmokingPolicy(resolvedSmokingPolicy)

  return (
    <article className="card @container overflow-hidden rounded-[var(--radius-card)]">
      <div className="p-3 sm:p-5">
        <div className="grid grid-cols-[5rem_minmax(0,1fr)_minmax(6.75rem,auto)] gap-2 @max-[351px]:grid-cols-[5rem_minmax(0,1fr)] sm:gap-3">
          <PropertyPhoto
            src={photoFailed ? undefined : hotel.photoUrl}
            size="thumbnail"
            onFailure={() => setPhotoFailed(true)}
          />

          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-bold leading-5 text-[color:var(--text-1)] sm:text-base">
              {hotel.name}
            </h3>
            {hotelClass || collapsedGuestRating ? (
              <div
                className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-medium leading-4 text-[color:var(--text-2)]"
                aria-label={qualityAriaLabel}
              >
                {hotelClass ? (
                  <span className="inline-flex max-w-full items-center gap-1 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-2 py-1 text-xs font-medium leading-4 text-[color:var(--text-2)]">
                    <StarRow stars={hotelClass.value ?? 0} />
                    <span className="truncate">{getHotelClassCollapsedText(hotelClass)}</span>
                  </span>
                ) : null}
                {collapsedGuestRating ? (
                  <span className={`inline-flex max-w-full items-center gap-1 rounded-[var(--radius-control)] border px-2 py-1 text-xs leading-4 ${
                    isVerifiedGuestRating(hotel.guestRating)
                      ? 'border-[color:var(--border-strong)] bg-[color:var(--success-soft)] font-bold text-[color:var(--success)]'
                      : 'border-[color:var(--border)] bg-[color:var(--bg-muted)] font-medium text-[color:var(--text-2)]'
                  }`}>
                    <span className="truncate">{collapsedGuestRating}</span>
                  </span>
                ) : null}
              </div>
            ) : null}
            {collapsedAccessFact ? (
              <span
                className="mt-1.5 inline-flex max-w-full items-center rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-2 py-1 text-xs font-medium leading-4 text-[color:var(--text-2)]"
                aria-label={collapsedAccessAriaLabel}
              >
                <span className="truncate">{collapsedAccessFact.label}</span>
              </span>
            ) : null}
            <div className="mt-2 min-w-0 text-xs leading-5">
              <p className={`font-bold ${location.isWarning ? 'text-[color:var(--warning)]' : 'text-[color:var(--text-2)]'}`}>
                {location.label}
              </p>
              <p className="break-words font-medium text-[color:var(--text-2)]">{location.value}</p>
            </div>
          </div>

          {hasValidPrice ? (
            <Price
              price={hotel.pricePerNight}
              providerName={providerName}
              className="@max-[351px]:col-span-2 @max-[351px]:min-w-0 @max-[351px]:max-w-none @max-[351px]:pt-1 @max-[351px]:text-left"
            />
          ) : (
            <PriceUnavailable
              reason={unavailableReason}
              providerName={providerName}
              showProvider={hasHotelProviderName}
              className="@max-[351px]:col-span-2 @max-[351px]:min-w-0 @max-[351px]:max-w-none @max-[351px]:pt-1 @max-[351px]:text-left"
            />
          )}
        </div>

        {collapsedSmokingPolicy ? (
          <p
            className="mt-1.5 line-clamp-2 text-xs font-bold leading-5 text-[color:var(--text-2)]"
            aria-label={collapsedSmokingPolicy.ariaLabel}
          >
            {collapsedSmokingPolicy.label}
          </p>
        ) : null}

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="min-w-0">
            <ScoreChip score={score} loading={loading} />
          </div>
          {canBook ? (
            <a
              href={bookingHref}
              aria-label={reviewAriaLabel}
              className="btn-primary inline-flex min-h-10 max-w-[8.5rem] items-center justify-center gap-2 rounded-[var(--radius-control)] px-3 text-xs font-bold sm:min-h-12 sm:max-w-none sm:px-4 sm:text-sm"
            >
              <span className="truncate">Review hotel</span>
              <svg className="shrink-0" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ) : (
            <span
              className="inline-flex min-h-10 max-w-[8.5rem] cursor-not-allowed items-center justify-center rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-muted)] px-3 text-xs font-bold text-[color:var(--text-3)] sm:min-h-12 sm:max-w-none sm:px-4 sm:text-sm"
              role="status"
              aria-label={unavailableAriaLabel}
            >
              <span className="truncate">{unavailableLabel}</span>
            </span>
          )}
        </div>

        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={detailsId}
          onClick={() => setIsExpanded(value => !value)}
          className="mt-3 flex min-h-10 w-full items-center justify-center rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] text-sm font-bold text-[color:var(--text-1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        >
          {isExpanded ? 'Hide details' : 'Details'}
        </button>
      </div>

      {isExpanded && (
        <div id={detailsId} className="border-t border-[color:var(--border)] px-3 pb-3 pt-3 sm:px-5 sm:pb-5">
          <div className="space-y-3">
            <DealScorePanel
              score={score}
              loading={loading}
              scope="hotel"
              priceNoun="nightly rate"
              unavailableCopy="We could not compare this hotel rate against recent history yet."
            />
            <QualityEvidencePanel
              hotelClass={hotelClass}
              guestRating={hotel.guestRating}
              legacyRatingPresent={legacyRatingPresent}
              source={hotel.source}
            />
            {score?.confidence === 'low' ? (
              <p className="text-xs font-medium leading-5 text-[color:var(--warning)]">
                Limited hotel history. Treat this as a rough comparison, not a confirmed deal.
              </p>
            ) : null}

            <div className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 text-xs font-medium leading-5 text-[color:var(--text-2)]">
              <p className="font-bold text-[color:var(--text-1)]">Location</p>
              <p className="mt-1 break-words">
                <span className="font-medium text-[color:var(--text-2)]">{location.label}: </span>
                {location.value}
              </p>
              <p className={`mt-2 ${location.isWarning ? 'font-medium text-[color:var(--warning)]' : 'text-[color:var(--text-2)]'}`}>
                {location.note}
              </p>
              {location.distanceText ? (
                <p className="mt-2 break-words text-[color:var(--text-2)]">{location.distanceText}</p>
              ) : null}
            </div>

            {resolvedSmokingPolicy ? (
              <TrackedSmokingPolicyPanel offerId={hotel.id} provider={hotel.source} policy={resolvedSmokingPolicy} surface="result_detail" />
            ) : null}

            <AccessEvidencePanel
              hotelId={hotel.id}
              evidence={accessEvidence}
              state={resolvedAccessEvidenceState}
            />

            <div className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 text-xs font-medium leading-5 text-[color:var(--text-2)]">
              <p className="font-bold text-[color:var(--text-1)]">Price scope</p>
              <p>per night before taxes and fees</p>
              <p className="mt-2 font-bold text-[color:var(--text-1)]">Rate check</p>
              <p>{rateCheckCopy}</p>
              <p className="mt-2 font-bold text-[color:var(--text-1)]">Provider handoff</p>
              <p>{canBook ? reviewDisclosure : unavailableReason}</p>
              {!hasValidPrice || !hasBookingUrl ? <p className="mt-2">{unavailableReason}</p> : null}
            </div>

            {hotel.photoUrl && !photoFailed ? (
              <PropertyPhoto src={hotel.photoUrl} size="expanded" onFailure={() => setPhotoFailed(true)} />
            ) : null}
          </div>
        </div>
      )}
    </article>
  )
}
