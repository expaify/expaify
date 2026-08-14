'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type MouseEventHandler, type ReactNode, type SyntheticEvent } from 'react'
import { BOOKING_FORM_PASSENGER_LIMIT, isValidatedAffiliateProviderUrl, type BookingFareContext, type BookingHotelContext } from '@/lib/booking/config'
import { getHotelLocationDisplay } from '@/app/components/hotelLocationContext'
import {
  getStayStubSnapshot,
  isStayStorageAvailable,
  subscribeToStayStoreChanges,
  writeStayStub,
  type HotelStayStub,
} from '@/lib/booking/hotelStayStore'
import DealScorePanel from '@/app/components/DealScorePanel'
import { track } from '@/lib/analytics'
import { hasProviderName, providerDisplayName } from '@/lib/providerFreshness'
import type {
  HotelDocumentCheckState,
  HotelDocumentReadiness,
  HotelParkingConflictDimension,
  HotelParkingEvidence,
} from '@/lib/types'
import { normalizeHotelDocumentReadiness } from '@/lib/providers/hotelDocumentReadiness'
import { ParkingSection } from '@/app/components/HotelParking'
import { HotelRateRestrictionsSection } from '@/app/components/HotelRateRestrictions'
import { deriveRateEligibilityPresentation } from '@/lib/hotels/rateEligibility'
import { HotelAdmissionPolicySection } from '@/app/components/HotelAdmissionPolicy'
import { deriveAdmissionPolicyPresentation } from '@/lib/hotels/admissionPolicy'
import {
  deriveGuestIdentityPresentation,
  getGuestIdentityAccessibleAction,
  HotelGuestIdentityRules,
} from '@/app/components/HotelGuestIdentityRules'
import {
  trackHotelHandoffWithAdmissionRestriction,
  useHotelAdmissionPolicyViewed,
} from '@/app/components/hotelAdmissionPolicyAnalytics'
import {
  HotelDocumentIntentControl,
  HotelDocumentReadinessDisclosure,
} from '@/app/components/HotelDocumentReadiness'
import HotelFundsPolicyPanel, {
  type HotelFundsPolicyEvidence,
  type HotelFundsPolicyLoadState,
} from '@/app/components/HotelFundsPolicyPanel'
import { useHotelFundsPolicyExposure } from '@/app/components/hotelFundsPolicyAnalytics'
import { HotelPaymentAcceptanceSection } from '@/app/components/HotelPaymentAcceptance'
import { deriveHotelPaymentAcceptancePresentation } from '@/lib/hotels/paymentAcceptance'
import { HotelConnectingRoomsEvidence } from '@/app/components/HotelConnectingRoomsEvidence'
import {
  trackHotelHandoffWithPaymentUnconfirmed,
  useHotelPaymentAcceptanceViewed,
} from '@/app/components/hotelPaymentAcceptanceAnalytics'
import { getHotelFundsAnalyticsDimensions } from '@/lib/hotels/fundsPolicy'
import type { HotelSmokingPolicyView } from '@/app/components/SmokingPolicyPanel'
import TrackedSmokingPolicyPanel from '@/app/components/TrackedSmokingPolicyPanel'
import { HotelBookingOwnershipDisclosure } from '@/app/components/HotelBookingOwnership'
import { HotelLoyaltyEligibilityDisclosure } from '@/app/components/HotelLoyaltyEligibility'
import { HotelRoomViewConfidence } from '@/app/components/HotelRoomViewConfidence'
import {
  getHotelTransportHandoffGuidance,
  HotelTransportSection,
} from '@/app/components/HotelTransport'
import HotelCancellationChoicesUnavailable from '@/app/components/HotelCancellationChoicesUnavailable'
import { HotelBookingModificationCue } from '@/app/components/HotelBookingModificationCue'
import {
  getHotelPriceCompositionAccessibleSummary,
  HotelPriceComposition,
} from '@/app/components/HotelPriceComposition'
import { HotelSustainabilityCredentialEvidence } from '@/app/components/HotelSustainabilityCredentialEvidence'
import { buildHotelPriceComposition } from '@/lib/hotels/priceDisclosure'
import { WifiEvidenceLedger } from '@/app/components/research/WifiEvidenceLedger'
import type { HotelWifiEvidence } from '@/app/components/research/hotelWifiFixtures'
import GuestReviewEvidence from '@/app/components/GuestReviewEvidence'

type BookingState = 'idle' | 'loading' | 'success' | 'error'
type Title = 'mr' | 'ms' | 'mrs' | 'miss' | 'dr'
type HotelReturnReason =
  | 'smoking_policy_or_room_mismatch'
  | 'tax_amount_changed_or_appeared'
  | 'mandatory_property_charge_changed_or_appeared'
  | 'displayed_total_other_mismatch'
  | 'pay_at_property_amount_unexpected'
  | 'pay_at_property_method_not_accepted'
  | 'room_availability_mismatch'
  | 'other_hotel_details_mismatch'
  | 'loyalty_or_points_uncertainty'
  | 'prefer_not_to_say'

const HOTEL_RETURN_REASONS: ReadonlyArray<{ value: HotelReturnReason; label: string }> = [
  { value: 'smoking_policy_or_room_mismatch', label: 'Smoking policy or room did not match' },
  { value: 'tax_amount_changed_or_appeared', label: 'Tax amount changed or appeared' },
  { value: 'mandatory_property_charge_changed_or_appeared', label: 'Mandatory property charge changed or appeared' },
  { value: 'displayed_total_other_mismatch', label: 'Displayed total did not match for another reason' },
  { value: 'pay_at_property_amount_unexpected', label: 'Pay-at-property amount was unexpected' },
  { value: 'pay_at_property_method_not_accepted', label: 'My card or payment method was not accepted at the property' },
  { value: 'room_availability_mismatch', label: 'Room availability did not match' },
  { value: 'other_hotel_details_mismatch', label: 'Other hotel details did not match' },
  { value: 'loyalty_or_points_uncertainty', label: 'Not sure this stay earns points or status' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

// --- Hotel booking confirmation & itinerary access (D1-D5, D5b) ---------
// expaify never observes a hotel reservation. Every state below is one of
// exactly four kinds of string: observed by expaify, declared by the
// traveler (always attributed), held by the partner (attributed), or
// explicitly not known to expaify. See
// docs/pipeline/hotel-booking-confirmation/03-design.md section 0.
type HotelReturnPhase =
  | 'none' // pre-handoff, no stub, first visit (or "I didn't book" was declared)
  | 'asking' // returned from partner, outcome not declared
  | 'declared' // traveler declared "I booked" this session
  | 'recognized' // a stored stub for this offerId was found on mount

type AwayDurationBucket = '<5s' | '5–30s' | '30–120s' | '120s+'

const OPAQUE_ANALYTICS_VALUE = /^[A-Za-z0-9_-]{1,100}$/

function partnerPhrase(partner: HotelPartnerIdentity): string {
  return partner.named ? partner.label : 'the booking partner'
}

function formatDeclaredAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatStayRange(checkIn: string, checkOut: string, nightCount: number): string {
  const checkOutDate = new Date(checkOut)
  const year = Number.isNaN(checkOutDate.getTime()) ? '' : `, ${checkOutDate.getFullYear()}`
  const nightsLabel = `${nightCount} night${nightCount === 1 ? '' : 's'}`
  return `${formatDateTime(checkIn)} → ${formatDateTime(checkOut)}${year} · ${nightsLabel}`
}

function stayLineCopy(hotelContext: BookingHotelContext | HotelStayStub): string {
  const { checkIn, checkOut, nightCount } = hotelContext
  if (checkIn && checkOut && nightCount !== undefined) return formatStayRange(checkIn, checkOut, nightCount)
  return 'Stay dates were not provided for this offer.'
}

function analyticsOfferId(offerId: string): string | undefined {
  return OPAQUE_ANALYTICS_VALUE.test(offerId) ? offerId : undefined
}

export function beginHotelDocumentReadinessCheck(
  pendingRef: { current: boolean },
  onStarted?: () => void,
): boolean {
  if (pendingRef.current) return false
  pendingRef.current = true
  onStarted?.()
  return true
}

export function focusHotelDocumentRetryStatus(
  focusPendingRef: { current: boolean },
  statusRegion: Pick<HTMLElement, 'focus'> | null,
): boolean {
  if (!focusPendingRef.current || !statusRegion) return false
  focusPendingRef.current = false
  statusRegion.focus()
  return true
}

const labelCls = 'mb-1.5 block text-xs font-medium uppercase tracking-wide text-[color:var(--text-2)]'
const inputCls = 'field-input !px-4'
const factLabelCls = 'text-xs font-medium uppercase tracking-wide text-[color:var(--text-3)]'
const factValueCls = 'mt-1 text-sm font-medium leading-5 text-[color:var(--text-1)]'
const panelCls = 'rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] shadow-[var(--shadow-card)]'
const insetPanelCls = 'rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)]'
const secondaryButtonCls = 'inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-4 text-sm font-medium text-[color:var(--text-1)] transition-colors hover:border-[color:var(--border-hover)] hover:bg-[color:var(--brand-soft)] focus-visible:border-[color:var(--border-focus)] focus-visible:shadow-[var(--focus-ring)]'
const actionStackCls = 'mt-5 flex flex-col gap-3'
const partnerLabelWrapCls = 'min-w-0 [overflow-wrap:anywhere]'
const trustClaims = [
  'Required by Duffel for this booking request',
  'Sent only when you choose verify',
  'No payment details are collected on this page',
]

export type HotelPartnerIdentity = {
  host: string
  label: string
  named: boolean
  allowlistVerified: boolean
}

const knownHotelPartners: Record<string, string> = {
  'booking.com': 'Booking.com',
  'hotels.com': 'Hotels.com',
  'expedia.com': 'Expedia',
  'agoda.com': 'Agoda',
  'priceline.com': 'Priceline',
}

const opaquePartnerHosts = new Set(['tp.media', 'localhost'])
const commonRoutingSubdomains = new Set(['www', 'm', 'go', 'redirect', 'click'])
const compoundPublicSuffixes = new Set(['co.uk', 'com.au', 'com.br', 'com.mx', 'co.nz', 'co.jp', 'co.in'])

function getHotelPartnerIdentity(providerUrl: string): HotelPartnerIdentity {
  const unresolved = (host = ''): HotelPartnerIdentity => ({ host, label: 'booking partner', named: false, allowlistVerified: false })

  try {
    const parsed = new URL(providerUrl)
    const host = parsed.hostname.toLowerCase().replace(/\.$/, '')
    const matchingHost = host.replace(/^www\./, '')
    if (
      !host ||
      opaquePartnerHosts.has(matchingHost) ||
      host.includes(':') ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
    ) {
      return unresolved(host)
    }

    for (const [domain, label] of Object.entries(knownHotelPartners)) {
      if (matchingHost === domain || matchingHost.endsWith(`.${domain}`)) {
        return { host, label, named: true, allowlistVerified: true }
      }
    }

    const labels = matchingHost.split('.').filter(Boolean)
    while (labels.length > 2 && commonRoutingSubdomains.has(labels[0])) labels.shift()

    const suffixLength = compoundPublicSuffixes.has(labels.slice(-2).join('.')) ? 2 : 1
    const brandIndex = labels.length - suffixLength - 1
    const brand = labels[brandIndex]
    const suffix = labels.slice(brandIndex + 1).join('.')

    if (!brand || !suffix || brand.length > 40 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(brand)) {
      return unresolved(host)
    }

    const label = `${brand.charAt(0).toUpperCase()}${brand.slice(1)}.${suffix}`
    if (label.length > 40) return unresolved(host)

    return { host, label, named: true, allowlistVerified: false }
  } catch {
    return unresolved()
  }
}

function getAwayDurationBucket(durationMs: number) {
  if (durationMs < 5_000) return '<5s'
  if (durationMs < 30_000) return '5–30s'
  if (durationMs < 120_000) return '30–120s'
  return '120s+'
}

function emitAnalytics(event: string, props: Record<string, string | number | boolean>) {
  try {
    track(event, props)
  } catch {
    // Analytics must never block or alter the booking handoff.
  }
}

function createHandoffAttemptId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

function hotelInvoiceAnalyticsSource(source: string): 'hotellook' | 'other' {
  return source.trim().toLowerCase() === 'hotellook' ? 'hotellook' : 'other'
}

function invoiceReadinessAnalytics(readiness: HotelDocumentReadiness, source: string) {
  return {
    status: readiness.status,
    documentTypes: readiness.documentTypes.join(',') || 'none',
    invoiceIssuerRole: readiness.issuerByDocument.invoice?.role ?? 'unknown',
    receiptIssuerRole: readiness.issuerByDocument.receipt?.role ?? 'unknown',
    billingDetailsStep: readiness.billingDetailsStep,
    source: hotelInvoiceAnalyticsSource(source),
    scope: readiness.scope,
  }
}

type BookingFlowProps = {
  bookingEnabled: boolean
  duffelSandbox: boolean
  fareContext: BookingFareContext | null
  hotelContext?: BookingHotelContext | null
  invalidHotelSelection?: boolean
  recoveryOfferId?: string
  parkingEvidence?: HotelParkingEvidence | null
  parkingConflictDimensions?: readonly HotelParkingConflictDimension[]
  parkingEvidenceMalformed?: boolean
  hasSearchDates?: boolean
  hotelFundsPolicy?: HotelFundsPolicyEvidence | null
  hotelFundsPolicyLoadState?: HotelFundsPolicyLoadState
  hotelSmokingPolicy?: HotelSmokingPolicyView
  /** Validated fallback for the flight review's "Back to search" links when
   * `fareContext` itself is missing or invalid (so `fareContext.returnTo`
   * isn't available). Parsed and validated independently in `app/book/page.tsx`
   * via `validateInternalReturnPath` since a malformed/expired fare should
   * not also cost the traveler their return-to-results link. */
  returnTo?: string
  hotelWifiEvidence?: HotelWifiEvidence | null
}

function formatMoney(cents: number, currency: string) {
  const sign = cents < 0 ? '-' : ''
  const absoluteCents = Math.abs(cents)
  const whole = Math.floor(absoluteCents / 100).toLocaleString('en-US')
  const fractional = String(absoluteCents % 100).padStart(2, '0')

  if (currency === 'USD') return `${sign}$${whole}.${fractional}`

  return `${currency} ${sign}${whole}.${fractional}`
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }

  if (value.includes('T')) {
    options.hour = 'numeric'
    options.minute = '2-digit'
  }

  return date.toLocaleString('en-US', options)
}

function getProviderLabel(provider: string, duffelSandbox: boolean) {
  if (provider === 'duffel') return `Duffel${duffelSandbox ? ' sandbox' : ''}`
  return provider
}

function getStopsLabel(stops: number) {
  return stops === 0 ? 'Nonstop' : `${stops} stop${stops === 1 ? '' : 's'}`
}

function getPassengerLabel(count: number) {
  return `${count} adult${count === 1 ? '' : 's'}`
}

function getPriceBasisLabel(fareContext: BookingFareContext) {
  return fareContext.priceScope === 'party_total'
    ? `total for ${getPassengerLabel(fareContext.passengerCount)}`
    : 'per person'
}

/**
 * Where the flight review's "Back to search"/recovery/error/success links
 * should point. `fareContext.returnTo` (validated by `validateInternalReturnPath`
 * in `parseBookingFareContext`) is preferred since it is the exact fare the
 * traveler is reviewing; the page-level `returnTo` fallback covers states
 * that render without a valid `fareContext` (e.g. `InvalidBookingState`).
 * Both are already validated — this never receives raw, unvalidated input —
 * and the ultimate fallback is `/`, unchanged from pre-repair behavior.
 */
function getBookingBackHref(fareContext: BookingFareContext | null, returnTo?: string): string {
  return fareContext?.returnTo ?? returnTo ?? '/'
}

function isChangedFareReason(reason: string) {
  return /\b(price|currency|passenger|passenger-count|passenger count|fare changed)\b/i.test(reason)
}

function getErrorStatus(reason: string) {
  if (isChangedFareReason(reason)) {
    return {
      title: 'This fare changed since search',
      message: 'Return to search and choose the current fare. expaify did not create an order.',
    }
  }

  if (/network/i.test(reason)) {
    return {
      title: 'Booking request stopped',
      message: 'Network error. expaify did not create an order. Check your connection and review the selected fare before trying again.',
    }
  }

  return {
    title: 'Booking request stopped',
    message: `expaify did not create an order. ${reason}`,
  }
}

function FareFact({ label, value }: { label: string; value: string }) {
  return (
    <div className={`min-w-0 px-3.5 py-3 sm:px-4 ${insetPanelCls}`}>
      <p className={factLabelCls}>{label}</p>
      <p className={`${factValueCls} break-words`}>{value}</p>
    </div>
  )
}

function FareSummary({ fareContext, duffelSandbox }: { fareContext: BookingFareContext; duffelSandbox: boolean }) {
  return (
    <section aria-labelledby="fare-review-title" className={`${panelCls} p-4 sm:p-6`}>
      <div className="flex flex-col gap-4 border-b border-[color:var(--border)] pb-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--brand)]">Fare review</p>
          <h2 id="fare-review-title" className="mt-2 text-2xl font-medium leading-tight text-[color:var(--text-1)] sm:text-3xl">
            {fareContext.origin} to {fareContext.destination}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            {fareContext.carrier} flight, {getStopsLabel(fareContext.stops).toLowerCase()}, departing {formatDateTime(fareContext.depart)}
          </p>
        </div>
        <div className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-raised)] px-4 py-3 md:shrink-0 md:text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--text-3)]">Selected fare</p>
          <p className="mt-1 text-2xl font-medium leading-none text-[color:var(--text-1)]">{formatMoney(fareContext.priceCents, fareContext.currency)}</p>
          <p className="mt-1 text-xs font-medium text-[color:var(--text-2)]">{getPriceBasisLabel(fareContext)}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <FareFact label="Route" value={`${fareContext.origin} → ${fareContext.destination}`} />
        <FareFact label="Carrier" value={fareContext.carrier} />
        <FareFact label="Depart" value={formatDateTime(fareContext.depart)} />
        {fareContext.return && (
          <FareFact label="Return" value={formatDateTime(fareContext.return)} />
        )}
        <FareFact label="Stops" value={getStopsLabel(fareContext.stops)} />
        <FareFact label="Passengers" value={getPassengerLabel(fareContext.passengerCount)} />
        <FareFact label="Price basis" value={getPriceBasisLabel(fareContext)} />
        <FareFact label="Provider" value={getProviderLabel(fareContext.provider, duffelSandbox)} />
      </div>
      <div className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-3 text-xs">
        <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--text-3)]">Offer reference</p>
        <p className="mt-2 break-all font-mono leading-5 text-[color:var(--text-2)]">{fareContext.offerId}</p>
      </div>
    </section>
  )
}

function HotelDecisionSummary({ hotelContext }: { hotelContext: BookingHotelContext }) {
  const location = getHotelLocationDisplay(hotelContext)
  const rateSource = providerDisplayName(hotelContext.provider)
  const admissionPolicy = deriveAdmissionPolicyPresentation({
    propertyId: hotelContext.offerId,
    supplier: hotelContext.provider,
    providerName: hasProviderName(hotelContext.provider) ? rateSource : '',
    evidence: hotelContext.admissionPolicy,
    capability: hotelContext.admissionPolicyCapability,
  })
  useHotelAdmissionPolicyViewed({
    presentation: admissionPolicy,
    hotelId: hotelContext.offerId,
    source: hotelContext.provider,
    surface: 'handoff',
  })

  return (
    <>
      <section aria-labelledby="hotel-property-title" className={`${panelCls} p-4 sm:p-6`}>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--brand)]">Hotel review</p>
          <h1 id="hotel-property-title" className="mt-2 break-words font-display text-2xl font-bold leading-tight text-[color:var(--text-1)] sm:text-3xl">
            {hotelContext.name}
          </h1>
          <p className="mt-2 break-words text-sm font-medium leading-6 text-[color:var(--text-2)]">
            {location.label}: {location.value}
          </p>
          <p className={`mt-1 text-xs leading-5 ${location.isWarning ? 'font-medium text-[color:var(--warning)]' : 'font-medium text-[color:var(--text-3)]'}`}>
            {location.note}
          </p>
        </div>
        <div className="mt-5 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-3">
          <p className={factLabelCls}>Stay dates not provided</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            Stay dates are incomplete. Choose or confirm dates with the provider before comparing room options.
          </p>
        </div>
      </section>

      <section aria-labelledby="hotel-price-score-title" className={`${panelCls} p-4 sm:p-6`}>
        <h2 id="hotel-price-score-title" className="text-xl font-medium leading-tight text-[color:var(--text-1)] sm:text-2xl">Price and Deal Score</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-4">
            <p className={factLabelCls}>Observed nightly rate</p>
            <p className="mt-2 break-words font-display text-3xl font-bold leading-none tabular-nums text-[color:var(--text-1)] sm:text-4xl">
              {formatMoney(hotelContext.priceCents, hotelContext.currency)}
            </p>
            <p className="mt-2 text-xs font-medium text-[color:var(--text-2)]">per night</p>
            <p className={`mt-2 text-xs font-medium leading-5 text-[color:var(--text-2)] ${partnerLabelWrapCls}`}>Rate observed from {rateSource}.</p>
            <p className="mt-2 text-xs font-medium leading-5 text-[color:var(--warning)]">Last-checked time not provided.</p>
          </div>
          <DealScorePanel
            score={hotelContext.dealScore ?? null}
            loading={false}
            scope="hotel"
            priceNoun="nightly rate"
            unavailableCopy="We could not compare this nightly rate with enough recent hotel prices."
          />
        </div>
      </section>

      <section aria-labelledby="hotel-fit-title" className={`${panelCls} p-4 sm:p-6`}>
        <h2 id="hotel-fit-title" className="text-xl font-medium leading-tight text-[color:var(--text-1)] sm:text-2xl">Hotel fit</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4">
          <div className={`p-3.5 ${insetPanelCls}`}>
            <dt className={factLabelCls}>Hotel class</dt>
            <dd className={factValueCls}>{hotelContext.hotelClass?.value && hotelContext.hotelClass.scaleMax ? `${hotelContext.hotelClass.value}/${hotelContext.hotelClass.scaleMax} hotel class from ${hotelContext.hotelClass.sourceLabel ?? 'provider'}` : 'Hotel class not provided'}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <GuestReviewEvidence evidence={hotelContext.reviewEvidence} expectedProviderId={hotelContext.provider} expectedPropertyId={hotelContext.offerId} />
        </div>
        <HotelAdmissionPolicySection
          presentation={admissionPolicy}
          providerName={hasProviderName(hotelContext.provider) ? rateSource : ''}
          includeIdentityRules={false}
        />
        <HotelSustainabilityCredentialEvidence />
      </section>
    </>
  )
}

function StatusPanel({
  title,
  message,
  tone = 'amber',
  live = 'polite',
}: {
  title: string
  message: string
  tone?: 'amber' | 'red' | 'green'
  live?: 'polite' | 'assertive'
}) {
  const toneClasses = {
    amber: 'border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]',
    red: 'border-[color:var(--border-strong)] bg-[color:var(--error-soft)] text-[color:var(--error-text)]',
    green: 'border-[color:var(--border-strong)] bg-[color:var(--success-soft)] text-[color:var(--success)]',
  }

  return (
    <div role={live === 'assertive' ? 'alert' : 'status'} aria-live={live} aria-atomic="true" className={`rounded-[var(--radius-control)] border p-4 sm:p-5 ${toneClasses[tone]}`}>
      <div className="flex gap-3">
        <span aria-hidden="true" className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-current" />
        <div className="min-w-0">
          <h2 className="text-base font-medium text-[color:var(--text-1)]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">{message}</p>
        </div>
      </div>
    </div>
  )
}

function TrustSummary() {
  return (
    <section aria-labelledby="traveler-trust-title" className={`p-4 ${insetPanelCls}`}>
      <h3 id="traveler-trust-title" className="text-sm font-medium text-[color:var(--text-1)]">
        Before you enter details
      </h3>
      <ul className="mt-3 space-y-2">
        {trustClaims.map((claim) => (
          <li key={claim} className="flex gap-2 text-sm leading-5 text-[color:var(--text-2)]">
            <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--brand)]" />
            <span>{claim}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">
        expaify keeps the selected fare visible so you can compare the itinerary, price basis, and passenger count before submitting.
      </p>
    </section>
  )
}

function FormStatusPanel({ loading }: { loading: boolean }) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy={loading}
      className={`p-4 ${insetPanelCls}`}
    >
      <p className={factLabelCls}>{loading ? 'Verifying with Duffel' : 'Provider verification pending'}</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
        {loading
          ? 'Do not refresh this page. Duffel is checking the selected fare and traveler details before returning a booking reference.'
          : 'After you choose verify, expaify sends these traveler details to Duffel. Duffel rechecks price, currency, passenger count, and availability before any order is created.'}
      </p>
    </section>
  )
}

function TravelerCountContext() {
  return (
    <section aria-labelledby="traveler-count-title" className={`p-4 ${insetPanelCls}`}>
      <p id="traveler-count-title" className={factLabelCls}>Traveler</p>
      <p className={factValueCls}>1 adult traveler</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
        This review path supports one adult traveler. Multi-passenger fares must be searched again with one passenger.
      </p>
    </section>
  )
}

function FieldGroup({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <fieldset className={`space-y-4 p-4 ${insetPanelCls}`}>
      <legend className="text-sm font-medium text-[color:var(--text-1)]">{title}</legend>
      <p className="text-sm leading-6 text-[color:var(--text-2)]">{description}</p>
      {children}
    </fieldset>
  )
}

function ReviewShell({
  eyebrow = 'Checkout review',
  title,
  message,
  fareContext,
  hotelContext = null,
  hotelParking,
  duffelSandbox,
  status,
  onBackClick,
  hotelSupplement,
  returnTo,
  children,
}: {
  eyebrow?: string
  title: string
  message: string
  fareContext: BookingFareContext | null
  hotelContext?: BookingHotelContext | null
  hotelParking?: ReactNode
  duffelSandbox: boolean
  status?: ReactNode
  onBackClick?: MouseEventHandler<HTMLAnchorElement>
  hotelSupplement?: ReactNode
  returnTo?: string
  children: ReactNode
}) {
  if (hotelContext) {
    return (
      <main className="mx-auto w-full max-w-[1080px] px-4 py-5 sm:px-6 sm:py-8">
        <a href="/" onClick={onBackClick} className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-1 text-sm font-medium text-[color:var(--text-2)] transition-colors hover:text-[color:var(--brand)] focus-visible:shadow-[var(--focus-ring)]">
          ← Back to results
        </a>
        <div className="mt-4 space-y-4 sm:mt-6">
          <HotelDecisionSummary hotelContext={hotelContext} />
          {status}
          {children}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-10 lg:px-8">
      <a href={getBookingBackHref(fareContext, returnTo)} onClick={onBackClick} className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-1 text-sm font-medium text-[color:var(--text-2)] transition-colors hover:text-[color:var(--brand)] focus-visible:shadow-[var(--focus-ring)]">
        ← Back to search
      </a>
      <div className="mt-4 grid gap-5 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="min-w-0 space-y-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--brand)]">{eyebrow}</p>
            <h1 className="mt-2 text-2xl font-medium leading-tight text-[color:var(--text-1)] sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--text-2)]">{message}</p>
          </div>
          {status}
          {fareContext && (
            <FareSummary fareContext={fareContext} duffelSandbox={duffelSandbox} />
          )}
          {hotelParking}
        </div>
        <div className="min-w-0 lg:sticky lg:top-6">
          {children}
        </div>
      </div>
    </main>
  )
}

function RecoveryState({
  title,
  message,
  statusTitle = 'Booking remains review-only',
  actionLabel = 'Back to search',
  fareContext,
  duffelSandbox,
  returnTo,
}: {
  title: string
  message: string
  statusTitle?: string
  actionLabel?: string
  fareContext: BookingFareContext | null
  duffelSandbox: boolean
  returnTo?: string
}) {
  const statusLive = statusTitle === 'One passenger is supported' ? 'assertive' : 'polite'
  const statusTone = statusTitle === 'One passenger is supported' ? 'red' : 'amber'

  return (
    <ReviewShell
      title={title}
      message={message}
      fareContext={fareContext}
      duffelSandbox={duffelSandbox}
      status={<StatusPanel title={statusTitle} message={message} tone={statusTone} live={statusLive} />}
      returnTo={returnTo}
    >
      <div className={`${panelCls} p-4 sm:p-6`}>
        <div className={`mt-5 p-4 ${insetPanelCls}`}>
          <p className={factLabelCls}>What happens now</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            This page is review-only. expaify is not collecting payment details, submitting traveler information, or creating an airline order from this fare.
          </p>
        </div>
        <div className={actionStackCls}>
          <a href={getBookingBackHref(fareContext, returnTo)} className="btn-primary">
            {actionLabel}
          </a>
        </div>
      </div>
    </ReviewShell>
  )
}

function InvalidBookingState({ duffelSandbox, returnTo }: { duffelSandbox: boolean; returnTo?: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <ReviewShell
      title="We can't identify this fare"
      message="Return to search and choose a current result before reviewing booking options."
      fareContext={null}
      duffelSandbox={duffelSandbox}
      returnTo={returnTo}
      status={
        <StatusPanel
          title="Selection details are missing"
          message="Return to search and choose a current result before reviewing booking options."
          tone="red"
          live="assertive"
        />
      }
    >
      <div className={`${panelCls} p-4 sm:p-6`}>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="sr-only outline-none"
        >
          Booking unavailable
        </h2>
        <div className={`mt-5 p-4 ${insetPanelCls}`}>
          <p className={factLabelCls}>What happens now</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            Use a current search result so the review page receives a verified provider, route, dates, passenger count, and integer-cent price.
          </p>
        </div>
        <div className={actionStackCls}>
          <a href={getBookingBackHref(null, returnTo)} className="btn-primary">
            Back to search
          </a>
        </div>
      </div>
    </ReviewShell>
  )
}

function InvalidHotelState({ duffelSandbox }: { duffelSandbox: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <ReviewShell
      title="We can't identify this hotel"
      message="Return to search and choose a current hotel result before reviewing provider handoff options."
      fareContext={null}
      duffelSandbox={duffelSandbox}
      status={
        <StatusPanel
          title="Selection details are missing"
          message="Return to search and choose a current hotel result before reviewing provider handoff options."
          tone="red"
          live="assertive"
        />
      }
    >
      <div className={`${panelCls} p-4 sm:p-6`}>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="sr-only outline-none"
        >
          Hotel handoff unavailable
        </h2>
        <div className={`mt-5 p-4 ${insetPanelCls}`}>
          <p className={factLabelCls}>What happens now</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            Use a current hotel result so the review page receives a verified provider, offer identifier, hotel name, integer-cent price, currency, price basis, and provider handoff URL.
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            If you booked a hotel from this page, your reservation is with the booking partner. Check your email for its confirmation.
          </p>
        </div>
        <div className={actionStackCls}>
          <a href="/" className="btn-primary">
            Back to search
          </a>
        </div>
      </div>
    </ReviewShell>
  )
}

/**
 * D5 recovery. A reference-path offer whose 30-minute context has expired
 * used to fall straight into `InvalidHotelState` with no way back — a dead
 * end for a traveler who may have just paid. When a stay stub exists for
 * `recoveryOfferId`, this renders what expaify still knows instead.
 * Cannot use `ReviewShell`'s hotel branch: there is no `hotelContext`.
 */
function HotelRecoveryState({ stub }: { stub: HotelStayStub }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const announcedRef = useRef(false)
  const partner: HotelPartnerIdentity = useMemo(() => ({
    host: stub.partnerHost,
    label: stub.partnerLabel || 'booking partner',
    named: stub.partnerLabel.length > 0,
    allowlistVerified: false,
  }), [stub.partnerHost, stub.partnerLabel])
  const reopenValid = isValidatedAffiliateProviderUrl(stub.providerUrl)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    if (announcedRef.current) return
    announcedRef.current = true
    const offerId = analyticsOfferId(stub.offerId)
    if (offerId) {
      emitAnalytics('hotel_repeat_offer_recognized', { offerId, entryPath: 'reference_expired', rebooked: false })
    }
  }, [stub.offerId])

  return (
    <main className="mx-auto w-full max-w-[1080px] px-4 py-5 sm:px-6 sm:py-8">
      <a href="/" className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-1 text-sm font-medium text-[color:var(--text-2)] transition-colors hover:text-[color:var(--brand)] focus-visible:shadow-[var(--focus-ring)]">
        ← Back to search
      </a>
      <div className="mt-4 sm:mt-6">
        <section aria-labelledby="hotel-recovery-title" className={`${panelCls} border-[color:var(--border-strong)] p-4 sm:p-6`}>
          <p className="sr-only" role="status" aria-live="polite">
            This page&rsquo;s offer details have expired. expaify still has what you told it about this stay.
          </p>
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--brand)]">Earlier from this browser</p>
          <h2 id="hotel-recovery-title" ref={headingRef} tabIndex={-1} className="mt-2 text-xl font-medium leading-tight text-[color:var(--text-1)] outline-none sm:text-2xl">
            You told us you booked this stay
          </h2>
          <p className="mt-2 text-xs font-medium leading-5 text-[color:var(--text-3)]">
            You told us you booked this on {formatDeclaredAt(stub.declaredBookedAt)}. expaify has not confirmed this with {partnerPhrase(partner)}.
          </p>
          <h3 className="mt-4 break-words font-display text-2xl font-bold leading-tight text-[color:var(--text-1)]">{stub.name}</h3>
          {stub.areaLabel ? (
            <p className="mt-1 break-words text-sm font-medium leading-6 text-[color:var(--text-2)]">{stub.areaLabel}</p>
          ) : null}
          <div className={`mt-4 p-3.5 sm:p-4 ${insetPanelCls}`}>
            <p className={factLabelCls}>Stay</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">{stayLineCopy(stub)}</p>
          </div>
          <div className={`mt-3 p-3.5 sm:p-4 ${insetPanelCls}`}>
            <p className={factLabelCls}>Rate expaify showed</p>
            <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">{formatMoney(stub.priceCents, stub.currency)} per night</p>
          </div>
          <p className="mt-4 text-sm leading-6 text-[color:var(--text-2)]">
            The full offer details for this page have expired. expaify keeps offer pages for 30 minutes.
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            Your confirmation is in {partnerPhrase(partner)}&rsquo;s email. expaify has no copy of it.
          </p>
          <div className={`mt-4 p-3.5 sm:p-4 ${insetPanelCls}`}>
            <p className={factLabelCls}>expaify offer reference</p>
            <p className="mt-2 break-all font-mono leading-5 text-[color:var(--text-2)]">{stub.offerId}</p>
            <p className="mt-2 text-xs leading-5 text-[color:var(--text-3)]">
              Save this with your confirmation. It tells expaify support exactly which rate you were shown — it is not your reservation number.
            </p>
          </div>
          <div className={`${actionStackCls} sm:flex-row`}>
            <a href="/" className="btn-primary inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] px-4 text-sm font-medium sm:w-auto">
              Back to search
            </a>
            {reopenValid ? (
              <a
                href={stub.providerUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className={`${secondaryButtonCls} sm:w-auto`}
              >
                {partner.named ? `Open ${partner.label} again` : 'Open the booking partner again'}
              </a>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}

/**
 * Chooses between the D5 recovery state and the unchanged `InvalidHotelState`
 * for a reference-path offer whose context has expired. The check for a
 * matching stay stub is client-only (localStorage), so it runs after mount;
 * the safe SSR/first-paint fallback is `InvalidHotelState`.
 */
function HotelSelectionUnavailable({
  duffelSandbox,
  recoveryOfferId,
}: {
  duffelSandbox: boolean
  recoveryOfferId?: string
}) {
  // `localStorage` is an external store: React's rule is to read it via
  // `useSyncExternalStore`, not by stashing it in a ref during an effect
  // and mutating that ref to force a re-render (unsafe under React's
  // memoization rules, and misses same-key writes from other tabs).
  const recoveredStub = useSyncExternalStore(
    subscribeToStayStoreChanges,
    () => (recoveryOfferId ? getStayStubSnapshot(recoveryOfferId) : null),
    () => null,
  )

  if (recoveredStub) {
    return <HotelRecoveryState stub={recoveredStub} />
  }

  return <InvalidHotelState duffelSandbox={duffelSandbox} />
}

const CAPTURE_CHECKLIST_ITEMS: ReadonlyArray<{
  term: string
  detail: (partner: HotelPartnerIdentity) => string
}> = [
  {
    term: 'Confirmation number',
    detail: partner => `On ${partnerPhrase(partner)}'s confirmation page and in its email. expaify never receives this.`,
  },
  {
    term: 'Cancellation deadline',
    detail: partner => `${partner.named ? partner.label : 'The booking partner'} set this at checkout. expaify was not told the deadline for this rate.`,
  },
  {
    term: 'Property phone number',
    detail: partner => `On ${partnerPhrase(partner)}'s confirmation. Use it to reach the property directly.`,
  },
  {
    term: 'The email address you used',
    detail: () => 'Your confirmation goes there. Check spam if it has not arrived within an hour.',
  },
]

/**
 * D1/D2/D3/D4/D5b — the return state. Mounts in `ReviewShell`'s `status`
 * slot, directly above the "Check rooms with provider" section, independent
 * of smoking-policy evidence. Renders S1 (asking), S2 (declared), or S4
 * (recognized) depending on `phase`; the `'none'` phase renders nothing
 * here (see docs/pipeline/hotel-booking-confirmation/03-design.md section 5).
 */
export function HotelReturnStatePanel({
  phase,
  partner,
  stub,
  storageAvailable,
  headingRef,
  onDeclareBooked,
  onDeclareNotBooked,
}: {
  phase: 'asking' | 'declared' | 'recognized'
  partner: HotelPartnerIdentity
  stub: HotelStayStub | null
  storageAvailable: boolean
  headingRef: { current: HTMLHeadingElement | null }
  onDeclareBooked: () => void
  onDeclareNotBooked: () => void
}) {
  const partnerText = partnerPhrase(partner)
  const reopenLabel = partner.named ? `Open ${partner.label} again` : 'Open the booking partner again'

  if (phase === 'asking') {
    return (
      <section aria-labelledby="hotel-return-title" className={`${panelCls} border-[color:var(--border-strong)] p-4 sm:p-6`}>
        <p className="sr-only" role="status" aria-live="polite">
          {`Back from ${partnerText}. Tell expaify what happened so it can show the right next step.`}
        </p>
        <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--brand)]">After the handoff</p>
        <h2 id="hotel-return-title" ref={headingRef} tabIndex={-1} className="mt-2 break-words text-xl font-medium leading-tight text-[color:var(--text-1)] outline-none sm:text-2xl">
          {`Back from ${partnerText}`}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-2)]">
          {`expaify does not receive your reservation from ${partnerText}. Tell us what happened so we can show you the right next step.`}
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onDeclareBooked}
            className="btn-primary inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] px-4 text-sm font-medium sm:w-auto"
          >
            I booked
          </button>
          <button type="button" onClick={onDeclareNotBooked} className={`${secondaryButtonCls} sm:w-auto`}>
            I didn&rsquo;t book
          </button>
        </div>
        <p className="mt-3 text-xs leading-5 text-[color:var(--text-3)]">
          {`Your answer stays in this browser. expaify does not send it to ${partnerText} and cannot check it.`}
        </p>
      </section>
    )
  }

  if (!stub) return null

  const reopenValid = isValidatedAffiliateProviderUrl(stub.providerUrl)
  const eyebrow = phase === 'declared' ? 'After the handoff' : 'Earlier from this browser'
  const announcement = phase === 'declared'
    ? `Saved in this browser. Four details to copy from ${partnerText} now.`
    : `You told us you booked this stay on ${formatDeclaredAt(stub.declaredBookedAt)}.`

  return (
    <section aria-labelledby="hotel-return-title" className={`${panelCls} border-[color:var(--border-strong)] p-4 sm:p-6`}>
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--brand)]">{eyebrow}</p>
      <h2 id="hotel-return-title" ref={headingRef} tabIndex={-1} className="mt-2 text-xl font-medium leading-tight text-[color:var(--text-1)] outline-none sm:text-2xl">
        You told us you booked this stay
      </h2>
      <p className="mt-2 text-xs font-medium leading-5 text-[color:var(--text-3)]">
        {`You told us you booked this on ${formatDeclaredAt(stub.declaredBookedAt)}. expaify has not confirmed this with ${partnerText}.`}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className={`p-3.5 ${insetPanelCls}`}>
          <p className={factLabelCls}>Stay</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">{stayLineCopy(stub)}</p>
        </div>
        <div className={`p-3.5 ${insetPanelCls}`}>
          <p className={factLabelCls}>Rate expaify showed</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">{formatMoney(stub.priceCents, stub.currency)} per night</p>
        </div>
      </div>

      {phase === 'declared' ? (
        <div className={`mt-4 p-3.5 sm:p-4 ${insetPanelCls}`}>
          <h3 className="text-sm font-medium leading-5 text-[color:var(--text-1)]">
            {`Save these from ${partnerText} now — expaify cannot retrieve them later.`}
          </h3>
          <dl className="mt-3 space-y-3">
            {CAPTURE_CHECKLIST_ITEMS.map((item, index) => (
              <div key={item.term} className="flex gap-3">
                <span aria-hidden="true" className="mt-0.5 shrink-0 text-xs font-medium text-[color:var(--text-3)]">{index + 1}.</span>
                <div className="min-w-0 [overflow-wrap:anywhere]">
                  <dt className="text-sm font-medium leading-5 text-[color:var(--text-1)]">{item.term}</dt>
                  <dd className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">{item.detail(partner)}</dd>
                </div>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">
            {`${partner.named ? partner.label : 'The booking partner'} holds this reservation. expaify cannot look it up, change it, or cancel it.`}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[color:var(--text-2)]">
          {`Your confirmation is in ${partnerText}'s email. expaify has no copy of it.`}
        </p>
      )}

      <div className={`mt-4 p-3.5 sm:p-4 ${insetPanelCls}`}>
        <p className={factLabelCls}>expaify offer reference</p>
        <p className="mt-2 break-all font-mono leading-5 text-[color:var(--text-2)]">{stub.offerId}</p>
        <p className="mt-2 text-xs leading-5 text-[color:var(--text-3)]">
          Save this with your confirmation. It tells expaify support exactly which rate you were shown — it is not your reservation number.
        </p>
        {phase === 'declared' && !storageAvailable ? (
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            This browser is not saving the stay. Copy the details above before you close this tab.
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <a href="/" className="btn-primary inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] px-4 text-sm font-medium sm:w-auto">
          Back to results
        </a>
        {reopenValid ? (
          <a href={stub.providerUrl} target="_blank" rel="noopener noreferrer sponsored" className={`${secondaryButtonCls} sm:w-auto`}>
            {reopenLabel}
          </a>
        ) : null}
      </div>
    </section>
  )
}

function HotelHandoffReview({
  hotelContext,
  duffelSandbox,
  parkingEvidence,
  parkingConflictDimensions,
  parkingEvidenceMalformed = false,
  hasSearchDates = true,
  fundsPolicy,
  fundsPolicyLoadState = 'ready',
  hotelSmokingPolicy,
  hotelWifiEvidence,
}: {
  hotelContext: BookingHotelContext
  duffelSandbox: boolean
  parkingEvidence?: HotelParkingEvidence | null
  parkingConflictDimensions?: readonly HotelParkingConflictDimension[]
  parkingEvidenceMalformed?: boolean
  hasSearchDates?: boolean
  fundsPolicy?: HotelFundsPolicyEvidence | null
  fundsPolicyLoadState?: HotelFundsPolicyLoadState
  hotelSmokingPolicy?: HotelSmokingPolicyView
  hotelWifiEvidence?: HotelWifiEvidence | null
}) {
  const partner = useMemo(() => getHotelPartnerIdentity(hotelContext.providerUrl), [hotelContext.providerUrl])
  const verifiedModificationPartner = useMemo(() => (
    partner.allowlistVerified
      ? { label: partner.label, named: true }
      : { label: 'booking partner', named: false }
  ), [partner.allowlistVerified, partner.label])
  const location = getHotelLocationDisplay(hotelContext)
  const admissionPolicy = deriveAdmissionPolicyPresentation({
    propertyId: hotelContext.offerId,
    supplier: hotelContext.provider,
    providerName: hasProviderName(hotelContext.provider) ? providerDisplayName(hotelContext.provider) : '',
    evidence: hotelContext.admissionPolicy,
    capability: hotelContext.admissionPolicyCapability,
  })
  const guestIdentity = deriveGuestIdentityPresentation(
    admissionPolicy,
    hasProviderName(hotelContext.provider) ? providerDisplayName(hotelContext.provider) : '',
  )
  const resolvedFundsPolicy = fundsPolicy ?? hotelContext.fundsPolicy
  // No reachable provider (Hotellook, Booking.com RapidAPI, Hotelbeds) supplies payment-acceptance
  // evidence today — see docs/pipeline/hotel-payment-method/02-research.md §1.3. All three declare
  // HOTEL_PAYMENT_ACCEPTANCE_UNSUPPORTED, so this always resolves to all-not_confirmed rows until a
  // future adapter can answer a fact.
  const paymentAcceptancePresentation = deriveHotelPaymentAcceptancePresentation({
    propertyId: hotelContext.offerId,
    supplier: hotelContext.provider,
    providerName: hasProviderName(hotelContext.provider) ? providerDisplayName(hotelContext.provider) : '',
    evidence: hotelContext.paymentAcceptance,
    capability: hotelContext.paymentAcceptanceCapability,
  })
  useHotelPaymentAcceptanceViewed({
    presentation: paymentAcceptancePresentation,
    hotelId: hotelContext.offerId,
    source: hotelContext.provider,
  })
  const policyDimensions = getHotelFundsAnalyticsDimensions({
    evidence: resolvedFundsPolicy,
    loadState: fundsPolicyLoadState,
    provider: hotelContext.provider,
    surface: 'book_handoff',
  })
  const priceComposition = useMemo(() => buildHotelPriceComposition({
    offerId: hotelContext.offerId,
    supplier: hotelContext.provider,
    stayCostState: 'nightly_only',
    taxEvidence: hotelContext.taxEvidence,
    mandatoryPropertyChargeEvidence: hotelContext.mandatoryPropertyChargeEvidence,
    capabilities: hotelContext.requiredChargeCapabilities,
  }), [
    hotelContext.mandatoryPropertyChargeEvidence,
    hotelContext.offerId,
    hotelContext.provider,
    hotelContext.requiredChargeCapabilities,
    hotelContext.taxEvidence,
  ])
  const analyticsProps = useMemo(() => ({
    source: hotelContext.provider,
    partnerHost: partner.host,
    currency: hotelContext.currency,
    priceCents: hotelContext.priceCents,
    priceBasis: hotelContext.priceBasis,
    locationPrecision: location.precision,
    policyState: policyDimensions.policyState,
    obligationTypes: policyDimensions.obligationTypes,
  }), [hotelContext.currency, hotelContext.priceBasis, hotelContext.priceCents, hotelContext.provider, location.precision, partner.host, policyDimensions.obligationTypes, policyDimensions.policyState])
  const handoffAttemptId = useMemo(createHandoffAttemptId, [])
  const handoffViewedRef = useRef(false)
  const didContinueRef = useRef(false)
  const guidanceBlockRef = useRef<HTMLElement>(null)
  const documentDisclosureRef = useRef<HTMLDivElement>(null)
  const documentStatusRegionRef = useRef<HTMLElement>(null)
  const documentReadinessViewedRef = useRef(false)
  const documentCheckRequestRef = useRef(0)
  const documentCheckPendingRef = useRef(false)
  const documentRetryFocusPendingRef = useRef(false)
  const invoiceNeededRef = useRef(false)
  const guidanceViewedRef = useRef(false)
  const helpOpenRef = useRef(false)
  const helpViewedRef = useRef(false)
  const loyaltyViewedRef = useRef(false)
  const returnArmedRef = useRef(false)
  const hiddenAfterContinueRef = useRef(false)
  const continueStartedAtRef = useRef<number | undefined>(undefined)
  const [invoiceNeeded, setInvoiceNeeded] = useState(false)
  const [documentReadiness, setDocumentReadiness] = useState(hotelContext.documentReadiness)
  const [documentCheckState, setDocumentCheckState] = useState<HotelDocumentCheckState>('idle')

  useEffect(() => {
    if (handoffViewedRef.current) return
    handoffViewedRef.current = true
    emitAnalytics('hotel_handoff_viewed', {
      handoffAttemptId,
      priceDisclosureState: priceComposition.priceDisclosureState,
      stayCostState: priceComposition.stayCostState,
      taxState: priceComposition.taxes.state,
      mandatoryChargeState: priceComposition.mandatoryPropertyCharges.state,
      source: hotelInvoiceAnalyticsSource(hotelContext.provider),
    })
  }, [handoffAttemptId, hotelContext.provider, priceComposition])

  const runDocumentReadinessCheck = async (onStarted?: () => void) => {
    if (!beginHotelDocumentReadinessCheck(documentCheckPendingRef, onStarted)) return
    const requestId = documentCheckRequestRef.current + 1
    documentCheckRequestRef.current = requestId
    setDocumentCheckState('loading')
    try {
      const response = await fetch('/api/hotels/document-readiness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelContext }),
      })
      const payload = await response.json() as { ok?: unknown; data?: unknown }
      if (!response.ok || payload.ok !== true) throw new Error('document check failed')
      if (documentCheckRequestRef.current !== requestId) return
      setDocumentReadiness(normalizeHotelDocumentReadiness(payload.data, providerDisplayName(hotelContext.provider)))
      setDocumentCheckState('ready')
    } catch {
      if (documentCheckRequestRef.current === requestId) setDocumentCheckState('error')
    } finally {
      if (documentCheckRequestRef.current === requestId) documentCheckPendingRef.current = false
    }
  }

  const handleInvoiceNeedChange = (needed: boolean) => {
    if (needed === invoiceNeededRef.current) return
    invoiceNeededRef.current = needed
    setInvoiceNeeded(needed)
    emitAnalytics('hotel_invoice_need_changed', {
      needed,
      source: hotelInvoiceAnalyticsSource(hotelContext.provider),
      partnerNamed: partner.named,
    })
    if (needed && documentCheckState === 'idle') void runDocumentReadinessCheck()
  }

  const handleDocumentRetry = () => {
    void runDocumentReadinessCheck(() => {
      documentRetryFocusPendingRef.current = true
      emitAnalytics('hotel_invoice_retry_clicked', {
        priorCheckState: documentCheckState,
        source: hotelInvoiceAnalyticsSource(hotelContext.provider),
        scope: documentReadiness.scope,
      })
    })
  }

  const handleDocumentVerification = () => {
    const targetRole = documentReadiness.verificationTarget?.role
    if (!targetRole || !documentReadiness.verificationTarget?.url) return
    emitAnalytics('hotel_invoice_verification_clicked', {
      ...invoiceReadinessAnalytics(documentReadiness, hotelContext.provider),
      targetRole,
    })
  }

  useEffect(() => {
    if (documentCheckState !== 'loading') return
    focusHotelDocumentRetryStatus(documentRetryFocusPendingRef, documentStatusRegionRef.current)
  }, [documentCheckState])

  useEffect(() => {
    const disclosure = documentDisclosureRef.current
    if (!invoiceNeeded || !disclosure || typeof IntersectionObserver === 'undefined') return

    let exposureTimer: ReturnType<typeof setTimeout> | undefined
    const clearExposureTimer = () => {
      if (exposureTimer === undefined) return
      clearTimeout(exposureTimer)
      exposureTimer = undefined
    }
    const observer = new IntersectionObserver((entries) => {
      const exposed = entries.some(entry => (
        entry.target === disclosure && entry.isIntersecting && entry.intersectionRatio >= 0.5
      ))
      if (!exposed) {
        clearExposureTimer()
        return
      }
      if (documentReadinessViewedRef.current || exposureTimer !== undefined) return
      exposureTimer = setTimeout(() => {
        exposureTimer = undefined
        documentReadinessViewedRef.current = true
        emitAnalytics('hotel_invoice_readiness_viewed', invoiceReadinessAnalytics(documentReadiness, hotelContext.provider))
      }, 1_000)
    }, { threshold: 0.5 })
    observer.observe(disclosure)
    return () => {
      clearExposureTimer()
      observer.disconnect()
    }
  }, [documentReadiness, hotelContext.provider, invoiceNeeded])
  const fundsPolicyExposureRef = useHotelFundsPolicyExposure({
    evidence: resolvedFundsPolicy,
    loadState: fundsPolicyLoadState,
    offerId: hotelContext.offerId,
    provider: hotelContext.provider,
    surface: 'book_handoff',
  })
  const feedbackTriggerRef = useRef<HTMLButtonElement>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [selectedReturnReason, setSelectedReturnReason] = useState<HotelReturnReason | ''>('')
  const [feedbackSent, setFeedbackSent] = useState(false)
  const policy = hotelSmokingPolicy ?? hotelContext.smokingPolicy

  // D1-D5: the return state.
  //
  // `recognizedStub` subscribes to the client-only stay-stub store via
  // `useSyncExternalStore` — the correct primitive for an external mutable
  // source like `localStorage` (reading it into a ref during an effect and
  // mutating that ref to force a repaint is unsafe under React's rules and
  // misses writes made by other tabs). `sessionOutcome` covers the part of
  // the state machine that is purely this render session's doing: the
  // outcome question appearing and being answered. `phase`/`stub` below
  // merge the two: a stub found before any interaction this session reads
  // as "recognized"; declaring "I booked" this session reads as "declared"
  // even though, from that point on, it is backed by the same store entry.
  const recognizedStub = useSyncExternalStore(
    subscribeToStayStoreChanges,
    () => getStayStubSnapshot(hotelContext.offerId),
    () => null,
  )
  const [sessionOutcome, setSessionOutcome] = useState<'none' | 'asking' | 'declared'>('none')
  const [mismatchAvailable, setMismatchAvailable] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const awayDurationBucketRef = useRef<AwayDurationBucket>('<5s')
  const returnHeadingRef = useRef<HTMLHeadingElement>(null)
  // S3: "I didn't book" unmounts the return-state panel (and the heading it
  // held focus). Left alone, the browser drops focus to <body>. This ref
  // flag, checked in an effect keyed on `sessionOutcome`, redirects focus to
  // the now-restored primary handoff CTA instead — mirrors the existing
  // `documentRetryFocusPendingRef` pattern above for the same reason: a ref
  // read inside an effect body, never during render.
  const handoffCtaRef = useRef<HTMLAnchorElement>(null)
  const focusHandoffCtaPendingRef = useRef(false)
  useEffect(() => {
    if (!focusHandoffCtaPendingRef.current) return
    focusHandoffCtaPendingRef.current = false
    handoffCtaRef.current?.focus()
  }, [sessionOutcome])
  const returnStateViewedRef = useRef(false)
  const recognizedAnnouncedRef = useRef(false)
  const rebookedAnnouncedRef = useRef(false)
  // Read inside the visibilitychange listener only (never during render) so
  // that a stale closure doesn't downgrade a 'declared' session back to
  // 'asking' on a later return trip.
  const sessionOutcomeRef = useRef(sessionOutcome)
  useEffect(() => {
    sessionOutcomeRef.current = sessionOutcome
  }, [sessionOutcome])

  const phase: HotelReturnPhase = sessionOutcome === 'asking'
    ? 'asking'
    : sessionOutcome === 'declared'
      ? 'declared'
      : recognizedStub ? 'recognized' : 'none'
  const stub = phase === 'asking' ? null : recognizedStub

  const emitReturnStateViewed = (stubPresent: boolean) => {
    if (returnStateViewedRef.current) return
    returnStateViewedRef.current = true
    emitAnalytics('hotel_return_state_viewed', {
      handoffAttemptId,
      awayDurationBucket: awayDurationBucketRef.current,
      stubPresent,
    })
  }

  // D5: recognise a prior handoff for this exact offer, found via the
  // external-store subscription above. Wins over the visibilitychange-
  // driven "asking" phase (a returning traveler who already declared an
  // outcome is never re-asked). This effect only emits analytics — it
  // never calls a state setter — so it does not trigger a cascading
  // render; `recognizedStub` already drives `phase` directly above.
  useEffect(() => {
    if (sessionOutcome !== 'none' || !recognizedStub) return
    emitReturnStateViewed(true)
    if (recognizedAnnouncedRef.current) return
    recognizedAnnouncedRef.current = true
    const offerId = analyticsOfferId(hotelContext.offerId)
    if (offerId) {
      emitAnalytics('hotel_repeat_offer_recognized', { offerId, entryPath: 'inline', rebooked: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelContext.offerId, recognizedStub, sessionOutcome])

  useEffect(() => {
    if (phase === 'none') return
    returnHeadingRef.current?.focus()
  }, [phase])

  useEffect(() => {
    const guidanceBlock = guidanceBlockRef.current
    if (!guidanceBlock || typeof IntersectionObserver === 'undefined') return

    let exposureTimer: ReturnType<typeof setTimeout> | undefined
    const clearExposureTimer = () => {
      if (exposureTimer === undefined) return
      clearTimeout(exposureTimer)
      exposureTimer = undefined
    }
    const observer = new IntersectionObserver((entries) => {
      const isExposed = entries.some((entry) => (
        entry.target === guidanceBlock && entry.isIntersecting && entry.intersectionRatio >= 0.5
      ))

      if (!isExposed) {
        clearExposureTimer()
        return
      }
      if (guidanceViewedRef.current || exposureTimer !== undefined) return

      exposureTimer = setTimeout(() => {
        exposureTimer = undefined
        guidanceViewedRef.current = true
        emitAnalytics('hotel_request_guidance_viewed', {
          source: hotelContext.provider,
          partnerHost: partner.host,
          capabilityState: 'provider_directed_only',
          eligibleRequestCount: 4,
        })
      }, 1_000)
    }, { threshold: 0.5 })

    observer.observe(guidanceBlock)
    return () => {
      clearExposureTimer()
      observer.disconnect()
    }
  }, [hotelContext.provider, partner.host])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const handleVisibilityChange = () => {
      if (!returnArmedRef.current) return

      if (document.visibilityState === 'hidden') {
        hiddenAfterContinueRef.current = true
        return
      }

      if (document.visibilityState !== 'visible' || !hiddenAfterContinueRef.current) return

      const startedAt = continueStartedAtRef.current
      const durationMs = startedAt === undefined ? 0 : Math.max(0, performance.now() - startedAt)
      const bucket = getAwayDurationBucket(durationMs)
      awayDurationBucketRef.current = bucket
      emitAnalytics('hotel_handoff_returned', {
        handoffAttemptId,
        priceDisclosureState: priceComposition.priceDisclosureState,
        awayDurationBucket: bucket,
      })
      // D2: awayDurationBucket is an analytics dimension only. It never
      // gates which branch renders, and it never preselects an answer — a
      // 3-second bounce and a completed checkout render byte-identical
      // markup. It is not read again below this line for that purpose.
      if (sessionOutcomeRef.current === 'none') {
        setSessionOutcome('asking')
        emitReturnStateViewed(false)
      }
      returnArmedRef.current = false
      hiddenAfterContinueRef.current = false
      continueStartedAtRef.current = undefined
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [handoffAttemptId, priceComposition.priceDisclosureState])

  const handleContinue = () => {
    didContinueRef.current = true
    returnArmedRef.current = true
    hiddenAfterContinueRef.current = false
    continueStartedAtRef.current = performance.now()
    emitAnalytics('hotel_handoff_continue_clicked', {
      handoffAttemptId,
      priceDisclosureState: priceComposition.priceDisclosureState,
      source: hotelInvoiceAnalyticsSource(hotelContext.provider),
      partnerNamed: partner.named,
    })
    trackHotelHandoffWithAdmissionRestriction({
      presentation: admissionPolicy,
      hotelId: hotelContext.offerId,
      source: hotelContext.provider,
    })
    trackHotelHandoffWithPaymentUnconfirmed({
      presentation: paymentAcceptancePresentation,
      hotelId: hotelContext.offerId,
      source: hotelContext.provider,
    })
    if (guidanceViewedRef.current) {
      emitAnalytics('hotel_request_handoff_continued', {
        source: hotelContext.provider,
        partnerHost: partner.host,
        capabilityState: 'provider_directed_only',
        eligibleRequestCount: 4,
        selectedRequestCount: 0,
        guidanceSeen: true,
      })
    }
  }

  // D2 + D3 + D4: the traveler declares the outcome. expaify never infers
  // it from awayDurationBucket.
  const handleDeclareBooked = () => {
    const declaredBookedAt = new Date().toISOString()
    const newStub: HotelStayStub = {
      v: 1,
      offerId: hotelContext.offerId,
      provider: hotelContext.provider,
      partnerHost: partner.host,
      partnerLabel: partner.named ? partner.label : '',
      name: hotelContext.name,
      areaLabel: location.precision === 'missing' ? '' : location.value,
      priceCents: hotelContext.priceCents,
      currency: hotelContext.currency,
      priceBasis: 'per_night_before_taxes_fees',
      providerUrl: hotelContext.providerUrl,
      declaredBookedAt,
      handoffAttemptId,
      ...(hotelContext.checkIn !== undefined ? { checkIn: hotelContext.checkIn } : {}),
      ...(hotelContext.checkOut !== undefined ? { checkOut: hotelContext.checkOut } : {}),
      ...(hotelContext.nightCount !== undefined ? { nightCount: hotelContext.nightCount } : {}),
    }
    const writeResult = writeStayStub(newStub)
    const nextStorageAvailable = writeResult.ok || isStayStorageAvailable()
    setStorageAvailable(nextStorageAvailable)
    // `recognizedStub` (useSyncExternalStore) picks up `newStub` on the
    // next render — the write above already landed in localStorage, and
    // `setSessionOutcome` below is what triggers that render.
    setSessionOutcome('declared')
    emitAnalytics('hotel_return_outcome_declared', {
      handoffAttemptId,
      outcome: 'booked',
      awayDurationBucket: awayDurationBucketRef.current,
    })
    const offerId = analyticsOfferId(hotelContext.offerId)
    if (offerId) {
      emitAnalytics('hotel_stay_stub_written', {
        offerId,
        hasStayDates: Boolean(hotelContext.checkIn && hotelContext.checkOut),
        storageAvailable: nextStorageAvailable,
      })
    }
  }

  const handleDeclareNotBooked = () => {
    setMismatchAvailable(true)
    focusHandoffCtaPendingRef.current = true
    setSessionOutcome('none')
    emitAnalytics('hotel_return_outcome_declared', {
      handoffAttemptId,
      outcome: 'not_booked',
      awayDurationBucket: awayDurationBucketRef.current,
    })
  }

  const handleRebook = () => {
    handleContinue()
    if (!rebookedAnnouncedRef.current) {
      rebookedAnnouncedRef.current = true
      const offerId = analyticsOfferId(hotelContext.offerId)
      if (offerId) {
        emitAnalytics('hotel_repeat_offer_recognized', {
          offerId,
          entryPath: 'inline',
          rebooked: true,
        })
      }
    }
  }

  const handleReturnFeedback = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedReturnReason) return
    emitAnalytics('hotel_handoff_return_reason_selected', {
      handoffAttemptId,
      priceDisclosureState: priceComposition.priceDisclosureState,
      reason: selectedReturnReason,
    })
    setFeedbackSent(true)
    setFeedbackOpen(false)
  }

  const handleBookingOwnershipOpen = () => {
    helpViewedRef.current = true
    emitAnalytics('hotel_booking_help_opened', {
      source: hotelInvoiceAnalyticsSource(hotelContext.provider),
      partnerHost: analyticsProps.partnerHost,
      partnerNamed: partner.named,
      locationPrecision: analyticsProps.locationPrecision,
    })
  }

  const handleLoyaltyDisclosureOpen = () => {
    loyaltyViewedRef.current = true
    emitAnalytics('hotel_loyalty_disclosure_opened', {
      source: hotelInvoiceAnalyticsSource(hotelContext.provider),
      partnerHost: analyticsProps.partnerHost,
      partnerNamed: partner.named,
      handoffSessionId: handoffAttemptId,
    })
  }

  const handleBookingOwnershipContactClick = (owner: 'partner' | 'expaify', destinationType: 'help_center' | 'mailto') => {
    emitAnalytics('hotel_booking_help_contact_clicked', {
      source: hotelInvoiceAnalyticsSource(hotelContext.provider),
      partnerHost: analyticsProps.partnerHost,
      partnerNamed: partner.named,
      locationPrecision: analyticsProps.locationPrecision,
      owner,
      destinationType,
    })
  }

  const handleHelpToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    const isOpen = event.currentTarget.open
    if (isOpen && !helpOpenRef.current) {
      emitAnalytics('hotel_request_help_opened', {
        source: hotelContext.provider,
        partnerHost: partner.host,
        capabilityState: 'provider_directed_only',
      })
    }
    helpOpenRef.current = isOpen
  }

  const handleBack = () => {
    if (didContinueRef.current) return
    emitAnalytics('hotel_handoff_back_clicked', {
      handoffAttemptId,
      priceDisclosureState: priceComposition.priceDisclosureState,
    })
  }

  // D2/D5: while a return decision is pending or already declared, and on a
  // recognised repeat visit, the handoff CTA is demoted and re-labelled so
  // it never reads as the traveler's first path to this hotel again.
  const isDemotedHandoff = phase === 'asking' || phase === 'declared'
  const isRecognizedHandoff = phase === 'recognized'
  const reopenLabel = partner.named ? `Open ${partner.label} again` : 'Open the booking partner again'
  const continueLabel = isRecognizedHandoff
    ? 'Book this again'
    : isDemotedHandoff
      ? reopenLabel
      : partner.named ? `Check rooms at ${partner.label}` : 'Check rooms at provider'
  const handoffCtaOnClick = isRecognizedHandoff ? handleRebook : handleContinue
  const newTabCue = partner.named
    ? `Opens ${partner.label} in a new tab. Your expaify search stays open here.`
    : 'Opens the booking partner’s site in a new tab. Your expaify search stays open here.'
  const accessiblePartner = partner.named ? partner.label : 'the booking partner’s site'
  const finalTotalBoundary = partner.named
    ? `${partner.label} confirms the final total before you pay.`
    : 'The booking partner confirms the final total before you pay.'
  const transportGuidance = getHotelTransportHandoffGuidance(hotelContext.transportEvidence)
  const accessibleName = `${continueLabel} for ${hotelContext.name}. Opens ${accessiblePartner} in a new tab. The selected nightly rate is ${formatMoney(hotelContext.priceCents, hotelContext.currency)} per night. ${getHotelPriceCompositionAccessibleSummary(priceComposition)} ${finalTotalBoundary} ${transportGuidance} Confirm the room's smoking status and the property's current smoking rules on the booking partner. ${getGuestIdentityAccessibleAction(guestIdentity)}`
  const rebookWarning = `You already told us you booked this stay on ${stub ? formatDeclaredAt(stub.declaredBookedAt) : ''}. Booking again creates a second reservation with ${partnerPhrase(partner)}.`

  return (
    <ReviewShell
      eyebrow="Hotel review"
      title={hotelContext.name}
      message="Review the property, observed nightly rate, hotel fit, and provider handoff."
      fareContext={null}
      hotelContext={hotelContext}
      duffelSandbox={duffelSandbox}
      onBackClick={handleBack}
      status={phase === 'none' ? undefined : (
        <HotelReturnStatePanel
          phase={phase}
          partner={partner}
          stub={stub}
          storageAvailable={storageAvailable}
          headingRef={returnHeadingRef}
          onDeclareBooked={handleDeclareBooked}
          onDeclareNotBooked={handleDeclareNotBooked}
        />
      )}
      hotelSupplement={policy ? (
        <div className="space-y-3">
          <TrackedSmokingPolicyPanel offerId={hotelContext.offerId} provider={hotelContext.provider} policy={policy} surface="review" />
        </div>
      ) : undefined}
    >
      {hotelWifiEvidence ? <WifiEvidenceLedger evidence={hotelWifiEvidence} idSuffix="hotel-review" /> : null}

      <section aria-labelledby="hotel-provider-title" className={`${panelCls} border-[color:var(--border-strong)] p-4 sm:p-6`}>
        <h2 id="hotel-provider-title" className="text-xl font-medium leading-tight text-[color:var(--text-1)] sm:text-2xl">Check rooms with provider</h2>
        <p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">
          The provider shows room options, live availability, its final price, cancellation policy, and terms. Compare its tax and mandatory-charge details with the expaify summary before you continue.
        </p>
        <p className="mt-3 break-words text-sm font-medium leading-6 text-[color:var(--text-2)]">
          {transportGuidance}
        </p>
        <HotelBookingOwnershipDisclosure
          partner={verifiedModificationPartner}
          expaifyIssueRoute={null}
          onOpen={handleBookingOwnershipOpen}
          onContactClick={handleBookingOwnershipContactClick}
        />
        <HotelLoyaltyEligibilityDisclosure
          partner={partner}
          onOpen={handleLoyaltyDisclosureOpen}
        />
        <HotelRoomViewConfidence />
        <HotelPriceComposition
          headingId="hotel-handoff-price-composition"
          stayCostState="nightly_only"
          composition={priceComposition}
          variant="handoff"
          boundaryCopy={finalTotalBoundary}
        />
        <div className="mt-3">
          <HotelCancellationChoicesUnavailable />
        </div>
        <div className="mt-3">
          <HotelBookingModificationCue partner={verifiedModificationPartner} />
        </div>
        <HotelGuestIdentityRules
          presentation={guestIdentity}
          headingId="hotel-handoff-guest-identity-title"
        />
        <div className="mt-3 flex flex-col gap-3">
          {isRecognizedHandoff ? (
            <p className={`text-sm font-medium leading-6 text-[color:var(--warning)] ${partnerLabelWrapCls}`}>
              {rebookWarning}
            </p>
          ) : null}
          <a
            ref={handoffCtaRef}
            href={hotelContext.providerUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            aria-label={accessibleName}
            onClick={handoffCtaOnClick}
            className={
              isDemotedHandoff || isRecognizedHandoff
                ? `${secondaryButtonCls} gap-2`
                : 'btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-center text-sm font-medium'
            }
          >
            <span className={partnerLabelWrapCls}>{continueLabel}</span>
            <svg aria-hidden="true" focusable="false" className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none">
              <path d="M5 11 11 5M6 5h5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <p className={`text-center text-xs leading-5 text-[color:var(--text-3)] ${partnerLabelWrapCls}`}>{newTabCue}</p>
          {phase === 'none' && mismatchAvailable ? (
            <div>
              <button
                ref={feedbackTriggerRef}
                type="button"
                onClick={() => setFeedbackOpen(true)}
                className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-1 text-sm font-medium text-[color:var(--brand)] underline underline-offset-2 focus-visible:shadow-[var(--focus-ring)]"
              >
                {partner.named ? `Something didn’t match on ${partner.label}` : 'Something didn’t match on the booking partner'}
              </button>
              {feedbackOpen || feedbackSent ? (
                <section className={`mt-3 p-4 ${insetPanelCls}`} aria-labelledby="hotel-return-feedback-title">
                  <h3 id="hotel-return-feedback-title" className="text-sm font-medium text-[color:var(--text-1)]">What was the main mismatch?</h3>
                  {feedbackSent ? (
                    <p className="mt-3 text-sm font-medium text-[color:var(--brand)]" role="status">Thanks. Your feedback was recorded.</p>
                  ) : (
                    <form className="mt-3" onSubmit={handleReturnFeedback}>
                      <fieldset>
                        <legend className="sr-only">What was the main mismatch?</legend>
                        <div className="mt-2 space-y-1">
                          {HOTEL_RETURN_REASONS.map(reason => (
                            <label key={reason.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-2 text-sm text-[color:var(--text-2)] focus-within:shadow-[var(--focus-ring)]">
                              <input
                                type="radio"
                                name="hotel-return-reason"
                                value={reason.value}
                                checked={selectedReturnReason === reason.value}
                                onChange={() => setSelectedReturnReason(reason.value)}
                              />
                              <span>{reason.label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <button type="submit" disabled={!selectedReturnReason} className="btn-primary min-h-11 rounded-[var(--radius-control)] px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">Send feedback</button>
                        <button
                          type="button"
                          className={secondaryButtonCls}
                          onClick={() => {
                            setFeedbackOpen(false)
                            setSelectedReturnReason('')
                            window.setTimeout(() => feedbackTriggerRef.current?.focus(), 0)
                          }}
                        >Cancel</button>
                      </div>
                    </form>
                  )}
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="hotel-supporting-title" className={`${panelCls} p-4 sm:p-6`}>
        <h2 id="hotel-supporting-title" className="text-xl font-medium leading-tight text-[color:var(--text-1)] sm:text-2xl">Supporting evidence</h2>
        <div className="mt-5 space-y-5">
          <HotelRateRestrictionsSection
            eligibility={deriveRateEligibilityPresentation({
              offerId: hotelContext.offerId,
              supplier: hotelContext.provider,
              evidence: hotelContext.rateEligibility,
              capability: hotelContext.rateEligibilityCapability,
            })}
            providerName={providerDisplayName(hotelContext.provider)}
          />
          <HotelTransportSection
            hotelId={hotelContext.offerId}
            evidence={hotelContext.transportEvidence}
            bookingReview
          />
          <ParkingSection
            hotelId={hotelContext.offerId}
            evidence={parkingEvidence}
            conflictDimensions={parkingConflictDimensions}
            malformed={parkingEvidenceMalformed}
            hasSearchDates={hasSearchDates}
            bookingReview
          />
        <section
          aria-labelledby="hotel-traveler-readiness-title"
          className="mt-5 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 sm:px-4 sm:py-4"
        >
          <h3
            id="hotel-traveler-readiness-title"
            className="text-sm font-medium leading-5 text-[color:var(--text-1)]"
          >
            What you may need
          </h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            Have the lead guest’s full name, a confirmation email, and a reachable phone number ready. The booking partner will show what it needs to create the booking.
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            Booking for someone else? Use the name of the person checking in as the lead guest. This does not confirm whose ID or payment card the property will accept; review the ID and cardholder rules before paying.
          </p>
        </section>
        <HotelDocumentIntentControl checked={invoiceNeeded} onChange={handleInvoiceNeedChange} />
        {invoiceNeeded ? (
          <div ref={documentDisclosureRef}>
            <HotelDocumentReadinessDisclosure
              readiness={documentReadiness}
              checkState={documentCheckState === 'idle' ? 'ready' : documentCheckState}
              partner={partner}
              providerUrl={hotelContext.providerUrl}
              retryAvailable={documentCheckState === 'error'}
              retryPending={documentCheckState === 'loading'}
              onRetry={handleDocumentRetry}
              onVerificationClick={handleDocumentVerification}
              statusRegionRef={documentStatusRegionRef}
              statusRegionFocusable={documentCheckState === 'loading' && documentRetryFocusPendingRef.current}
            />
          </div>
        ) : null}
        <section
          ref={guidanceBlockRef}
          aria-labelledby="hotel-special-requests-title"
          className="mt-5 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3"
        >
          <h3 id="hotel-special-requests-title" className="text-sm font-medium leading-5 text-[color:var(--text-1)]">
            Special requests
          </h3>
          <p className="mt-2 text-sm font-medium leading-5 text-[color:var(--text-1)]">
            Need a quiet room, high floor, preferred bed setup, or early check-in?
          </p>
          <p className={`mt-2 text-sm leading-6 text-[color:var(--text-2)] ${partnerLabelWrapCls}`}>
            {partner.named
              ? `Add your request on ${partner.label} while booking. Nothing is selected or sent by expaify.`
              : 'Add your request on the booking partner’s site while booking. Nothing is selected or sent by expaify.'}
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            A request is a preference, not a change to your booked room or rate. Requests depend on availability and are not guaranteed. After booking, follow your confirmation’s instructions for contacting the property about fulfillment.
          </p>
          <details onToggle={handleHelpToggle} className="mt-3 border-t border-[color:var(--border)] pt-3">
            <summary className="min-h-11 cursor-pointer select-none py-2 text-sm font-medium leading-6 text-[color:var(--brand)]">
              How requests work
            </summary>
            <ul className="mt-2 space-y-2 pl-5 text-sm leading-6 text-[color:var(--text-2)]">
              <li><span className="font-medium text-[color:var(--text-1)]">Selected:</span> You have chosen a preference. expaify does not offer this step.</li>
              <li><span className="font-medium text-[color:var(--text-1)]">Sent:</span> The booking service says it submitted the request. Continuing from expaify does not send one.</li>
              <li><span className="font-medium text-[color:var(--text-1)]">Acknowledged:</span> The property has replied about the request.</li>
              <li><span className="font-medium text-[color:var(--text-1)]">Guaranteed:</span> The property explicitly confirms it for this stay. Until then, treat it as a preference.</li>
            </ul>
          </details>
        </section>
        <div className="mt-5">
          <HotelFundsPolicyPanel
            evidence={resolvedFundsPolicy}
            loadState={fundsPolicyLoadState}
            surface="book_handoff"
            partnerLabel={partner.named ? partner.label : undefined}
            confirmHref={hotelContext.providerUrl}
            hotelName={hotelContext.name}
            sourceLabel={providerDisplayName(hotelContext.provider)}
            variant="full"
            offerId={hotelContext.offerId}
            provider={hotelContext.provider}
            rootRef={fundsPolicyExposureRef}
          />
        </div>
        <HotelPaymentAcceptanceSection presentation={paymentAcceptancePresentation} />
        <HotelConnectingRoomsEvidence amenityEvidence={hotelContext.amenityEvidence} />
          <details className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-2">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-[color:var(--brand)]">Show offer details</summary>
            <dl className="border-t border-[color:var(--border)] py-3 text-xs">
              <dt className={factLabelCls}>expaify offer reference</dt>
              <dd className="mt-2 break-all font-mono leading-5 text-[color:var(--text-2)]">{hotelContext.offerId}</dd>
            </dl>
            <p className="pb-3 text-xs leading-5 text-[color:var(--text-3)]">Save this with your confirmation. It tells expaify support exactly which rate you were shown — it is not your reservation number.</p>
          </details>
        </div>
      </section>
    </ReviewShell>
  )
}

export default function BookingFlow({
  bookingEnabled,
  duffelSandbox,
  fareContext,
  hotelContext = null,
  invalidHotelSelection = false,
  recoveryOfferId,
  parkingEvidence,
  parkingConflictDimensions,
  parkingEvidenceMalformed = false,
  hasSearchDates = true,
  hotelFundsPolicy,
  hotelFundsPolicyLoadState = 'ready',
  hotelSmokingPolicy,
  returnTo,
  hotelWifiEvidence,
}: BookingFlowProps) {
  const [state, setState] = useState<BookingState>('idle')
  const [bookingRef, setBookingRef] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [title, setTitle] = useState<Title>('mr')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dob, setDob] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState<'m' | 'f'>('m')

  const maxDob = new Date()
  maxDob.setFullYear(maxDob.getFullYear() - 18)
  const maxDobStr = maxDob.toISOString().slice(0, 10)

  if (hotelContext) {
    return (
      <HotelHandoffReview
        hotelContext={hotelContext}
        duffelSandbox={duffelSandbox}
        parkingEvidence={parkingEvidence}
        parkingConflictDimensions={parkingConflictDimensions}
        parkingEvidenceMalformed={parkingEvidenceMalformed}
        hasSearchDates={hasSearchDates}
        fundsPolicy={hotelFundsPolicy}
        fundsPolicyLoadState={hotelFundsPolicyLoadState}
        hotelSmokingPolicy={hotelSmokingPolicy}
        hotelWifiEvidence={hotelWifiEvidence}
      />
    )
  }

  if (invalidHotelSelection) {
    return <HotelSelectionUnavailable duffelSandbox={duffelSandbox} recoveryOfferId={recoveryOfferId} />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!fareContext) { setErrorMsg('Selected fare context is missing. Return to search and choose a current fare.'); setState('error'); return }
    setState('loading')
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: fareContext.offerId,
          fareContext,
          passenger: { title, given_name: firstName, family_name: lastName, born_on: dob, email, phone_number: phone, gender },
        }),
      })
      const data = await res.json() as { ok: boolean; bookingReference?: string; reason?: string }
      if (data.ok && data.bookingReference) {
        setBookingRef(data.bookingReference)
        setState('success')
      } else {
        setErrorMsg(data.reason ?? 'Booking failed. Please try again.')
        setState('error')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <ReviewShell
        eyebrow="Confirmation"
        title="Booking confirmed"
        message="Duffel returned a booking reference for the selected fare."
        fareContext={fareContext}
        duffelSandbox={duffelSandbox}
        returnTo={returnTo}
        status={
          <StatusPanel
            title="Provider confirmed this fare"
            message="Duffel returned a booking reference for the selected fare."
            tone="green"
          />
        }
      >
        <div className={`${panelCls} p-4 sm:p-6`}>
          <div className={`mt-5 p-4 ${insetPanelCls}`}>
            <p className={factLabelCls}>Booking reference</p>
            <p className="mt-2 break-all font-mono text-xl font-medium text-[color:var(--brand)] sm:text-2xl">{bookingRef}</p>
          </div>
          <a href={getBookingBackHref(fareContext, returnTo)} className={`mt-5 ${secondaryButtonCls}`}>
            Search more flights
          </a>
        </div>
      </ReviewShell>
    )
  }

  if (!fareContext) {
    return <InvalidBookingState duffelSandbox={duffelSandbox} returnTo={returnTo} />
  }

  if (!bookingEnabled) {
    return (
      <RecoveryState
        title="In-app booking is paused"
        message="This fare is preserved for review only. expaify is not collecting traveler details or creating a provider order."
        statusTitle="Booking remains paused"
        fareContext={fareContext}
        duffelSandbox={duffelSandbox}
        returnTo={returnTo}
      />
    )
  }

  if (fareContext.passengerCount > BOOKING_FORM_PASSENGER_LIMIT) {
    return (
      <RecoveryState
        title="Multi-passenger review is paused"
        message={`This fare is priced for ${fareContext.passengerCount} adults, but booking review currently collects details for one passenger only. Return to search with one passenger; expaify will not create an order from incomplete traveler details.`}
        statusTitle="One passenger is supported"
        actionLabel="Search one passenger"
        fareContext={fareContext}
        duffelSandbox={duffelSandbox}
        returnTo={returnTo}
      />
    )
  }

  if (state === 'error') {
    const errorStatus = getErrorStatus(errorMsg)

    return (
      <ReviewShell
        title="Review selected fare"
        message="The selected fare is still visible, but the provider stopped the booking request before an order was created."
        fareContext={fareContext}
        duffelSandbox={duffelSandbox}
        returnTo={returnTo}
        status={
          <StatusPanel
            title={errorStatus.title}
            message={errorStatus.message}
            tone="red"
            live="assertive"
          />
        }
      >
        <div className={`${panelCls} p-4 sm:p-6`}>
          <div className={actionStackCls}>
            <button onClick={() => setState('idle')} className="btn-primary">
              Review details again
            </button>
            <a href={getBookingBackHref(fareContext, returnTo)} className={secondaryButtonCls}>
              Back to search
            </a>
          </div>
        </div>
      </ReviewShell>
    )
  }

  return (
    <ReviewShell
      title="Review selected fare"
      message="Confirm the itinerary and price basis before expaify sends traveler details to Duffel for provider verification."
      fareContext={fareContext}
      duffelSandbox={duffelSandbox}
      returnTo={returnTo}
      status={
        <StatusPanel
          title="Selected fare preserved from search"
          message={state === 'loading'
            ? 'Keeping the selected fare visible while Duffel checks price, currency, passenger count, and availability.'
            : 'This is the price and itinerary you chose in results. Duffel has not verified it again yet.'}
        />
      }
    >
      <form onSubmit={handleSubmit} aria-busy={state === 'loading'} className={`${panelCls} p-4 sm:p-6`}>
        <div className="mb-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--brand)]">Traveler details</p>
          <h2 className="mt-2 text-xl font-medium leading-tight text-[color:var(--text-1)]">Verify this fare for 1 adult traveler</h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            These details are required by Duffel for this booking request. They are not used to create an expaify profile.
          </p>
        </div>
        <div className="space-y-4">
          <TrustSummary />
          <FormStatusPanel loading={state === 'loading'} />
          <TravelerCountContext />

          <FieldGroup
            title="Traveler identity"
            description="Duffel requires the traveler name, title, date of birth, and gender to match the airline booking record."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="title" className={labelCls}>Title</label>
                <select id="title" value={title} onChange={e => setTitle(e.target.value as Title)} className={inputCls} required>
                  <option value="mr">Mr</option>
                  <option value="ms">Ms</option>
                  <option value="mrs">Mrs</option>
                  <option value="miss">Miss</option>
                  <option value="dr">Dr</option>
                </select>
              </div>
              <div>
                <label htmlFor="firstName" className={labelCls}>First name</label>
                <input id="firstName" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className={inputCls} placeholder="Jane" required />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="lastName" className={labelCls}>Last name</label>
                <input id="lastName" type="text" value={lastName} onChange={e => setLastName(e.target.value)} className={inputCls} placeholder="Smith" required />
              </div>
              <div>
                <label htmlFor="dob" className={labelCls}>Date of birth</label>
                <input id="dob" type="date" value={dob} onChange={e => setDob(e.target.value)} max={maxDobStr} className={inputCls} required />
              </div>
            </div>
            <div>
              <label htmlFor="gender" className={labelCls}>Gender</label>
              <select id="gender" value={gender} onChange={e => setGender(e.target.value as 'm' | 'f')} className={inputCls} required>
                <option value="m">Male</option>
                <option value="f">Female</option>
              </select>
            </div>
          </FieldGroup>

          <FieldGroup
            title="Provider contact"
            description="Duffel requires contact details for booking communication and provider follow-up for this order request."
          >
            <div>
              <label htmlFor="email" className={labelCls}>Email</label>
              <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="jane@example.com" required />
            </div>
            <div>
              <label htmlFor="phone" className={labelCls}>Phone with country code</label>
              <input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} placeholder="+1 212 555 1234" required />
            </div>
          </FieldGroup>

          <div className="sticky bottom-0 -mx-4 mt-2 border-t border-[color:var(--border)] bg-[color:var(--bg-overlay)] p-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            <button
              type="submit"
              disabled={state === 'loading'}
              aria-label={`Verify selected fare for 1 adult traveler from ${fareContext.origin} to ${fareContext.destination}. Selected fare ${formatMoney(fareContext.priceCents, fareContext.currency)}, ${getPriceBasisLabel(fareContext)}.`}
              className="btn-primary"
            >
              {state === 'loading'
                ? duffelSandbox ? 'Verifying sandbox fare...' : 'Verifying with Duffel...'
                : duffelSandbox ? 'Verify sandbox fare with Duffel' : 'Verify fare with Duffel'}
            </button>
            <p className="mt-3 text-center text-xs leading-5 text-[color:var(--text-3)]">
              {duffelSandbox
                ? 'Sandbox submission only. No live ticket is issued, and no payment details are collected here.'
                : 'expaify sends traveler details to Duffel after you choose verify. No payment details are collected here. No order is created if price, currency, or passenger count changed.'}
            </p>
          </div>
        </div>
      </form>
    </ReviewShell>
  )
}
