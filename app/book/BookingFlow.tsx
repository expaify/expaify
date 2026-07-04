'use client'

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { BOOKING_FORM_PASSENGER_LIMIT, type BookingFareContext, type BookingHotelContext } from '@/lib/booking/config'
import { getHotelLocationDisplay } from '@/app/components/hotelLocationContext'

type BookingState = 'idle' | 'loading' | 'success' | 'error'
type Title = 'mr' | 'ms' | 'mrs' | 'miss' | 'dr'

const labelCls = 'mb-1.5 block text-xs font-medium uppercase tracking-wide text-[color:var(--text-2)]'
const inputCls = 'field-input !px-4'
const factLabelCls = 'text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-3)]'
const factValueCls = 'mt-1 text-sm font-medium leading-5 text-[color:var(--text-1)]'
const panelCls = 'rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-surface)] shadow-[var(--shadow-card)]'
const insetPanelCls = 'rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-raised)]'
const secondaryButtonCls = 'inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-4 text-sm font-medium text-[color:var(--text-1)] transition-colors hover:border-[color:var(--border-hover)] hover:bg-[color:var(--brand-soft)] focus-visible:border-[color:var(--border-focus)] focus-visible:shadow-[var(--focus-ring)]'
const actionStackCls = 'mt-5 flex flex-col gap-3'
const hotelTermsCopy = 'Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms.'
const trustClaims = [
  'Required by Duffel for this booking request',
  'Sent only when you choose verify',
  'No payment details are collected on this page',
]

type BookingFlowProps = {
  bookingEnabled: boolean
  duffelSandbox: boolean
  fareContext: BookingFareContext | null
  hotelContext?: BookingHotelContext | null
  invalidHotelSelection?: boolean
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

function getHotelPriceBasisLabel(priceBasis: BookingHotelContext['priceBasis']) {
  if (priceBasis === 'per_night_before_taxes_fees') return 'per night before taxes and fees'
  return 'price basis requires provider confirmation'
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
          <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--brand)]">Fare review</p>
          <h2 id="fare-review-title" className="mt-2 text-2xl font-bold leading-tight text-[color:var(--text-1)] sm:text-3xl">
            {fareContext.origin} to {fareContext.destination}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            {fareContext.carrier} flight, {getStopsLabel(fareContext.stops).toLowerCase()}, departing {formatDateTime(fareContext.depart)}
          </p>
        </div>
        <div className="min-w-0 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--bg-raised)] px-4 py-3 md:shrink-0 md:text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-3)]">Selected fare</p>
          <p className="mt-1 text-2xl font-bold leading-none text-[color:var(--text-1)]">{formatMoney(fareContext.priceCents, fareContext.currency)}</p>
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
      <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-3 text-xs">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-3)]">Offer reference</p>
        <p className="mt-2 break-all font-mono leading-5 text-[color:var(--text-2)]">{fareContext.offerId}</p>
      </div>
    </section>
  )
}

function HotelSummary({ hotelContext }: { hotelContext: BookingHotelContext }) {
  const location = getHotelLocationDisplay(hotelContext)

  return (
    <section aria-labelledby="hotel-review-title" className={`${panelCls} p-4 sm:p-6`}>
      <div className="flex flex-col gap-4 border-b border-[color:var(--border)] pb-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--brand)]">Hotel review</p>
          <h2 id="hotel-review-title" className="mt-2 text-2xl font-bold leading-tight text-[color:var(--text-1)] sm:text-3xl">
            {hotelContext.name}
          </h2>
          <p className="mt-2 break-words text-sm font-medium leading-6 text-[color:var(--text-2)]">
            {location.label}: {location.value}
          </p>
          <p className={`mt-1 text-xs leading-5 ${location.isWarning ? 'font-medium text-[color:var(--warning)]' : 'font-medium text-[color:var(--text-3)]'}`}>
            {location.note}
          </p>
        </div>
        <div className="min-w-0 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--bg-raised)] px-4 py-3 md:shrink-0 md:text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-3)]">Selected nightly rate</p>
          <p className="mt-1 text-2xl font-bold leading-none text-[color:var(--text-1)]">{formatMoney(hotelContext.priceCents, hotelContext.currency)}</p>
          <p className="mt-1 text-xs font-medium text-[color:var(--text-2)]">{getHotelPriceBasisLabel(hotelContext.priceBasis)}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <FareFact label="Hotel" value={hotelContext.name} />
        <FareFact label="Location" value={location.value} />
        <FareFact label="Location precision" value={location.label} />
        <FareFact label="Provider" value={getProviderLabel(hotelContext.provider, false)} />
        <FareFact label="Price basis" value={getHotelPriceBasisLabel(hotelContext.priceBasis)} />
        <FareFact label="Currency" value={hotelContext.currency} />
      </div>
      <div className="mt-4 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 py-3 text-xs">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--text-3)]">Offer reference</p>
        <p className="mt-2 break-all font-mono leading-5 text-[color:var(--text-2)]">{hotelContext.offerId}</p>
      </div>
    </section>
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
    red: 'border-[color:var(--border-strong)] bg-[color:var(--error-soft)] text-[color:var(--error)]',
    green: 'border-[color:var(--border-strong)] bg-[color:var(--success-soft)] text-[color:var(--success)]',
  }

  return (
    <div role={live === 'assertive' ? 'alert' : 'status'} aria-live={live} aria-atomic="true" className={`rounded-lg border p-4 sm:p-5 ${toneClasses[tone]}`}>
      <div className="flex gap-3">
        <span aria-hidden="true" className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-current" />
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[color:var(--text-1)]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">{message}</p>
        </div>
      </div>
    </div>
  )
}

function TrustSummary() {
  return (
    <section aria-labelledby="traveler-trust-title" className={`p-4 ${insetPanelCls}`}>
      <h3 id="traveler-trust-title" className="text-sm font-bold text-[color:var(--text-1)]">
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
      <legend className="text-sm font-bold text-[color:var(--text-1)]">{title}</legend>
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
  duffelSandbox,
  status,
  children,
}: {
  eyebrow?: string
  title: string
  message: string
  fareContext: BookingFareContext | null
  hotelContext?: BookingHotelContext | null
  duffelSandbox: boolean
  status?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-10 lg:px-8">
      <a href="/" className="inline-flex min-h-10 items-center rounded-lg px-1 text-sm font-medium text-[color:var(--text-2)] transition-colors hover:text-[color:var(--brand)] focus-visible:shadow-[var(--focus-ring)]">
        ← Back to search
      </a>
      <div className="mt-4 grid gap-5 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="min-w-0 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--brand)]">{eyebrow}</p>
            <h1 className="mt-2 text-2xl font-bold leading-tight text-[color:var(--text-1)] sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--text-2)]">{message}</p>
          </div>
          {status}
          {fareContext && (
            <FareSummary fareContext={fareContext} duffelSandbox={duffelSandbox} />
          )}
          {hotelContext && (
            <HotelSummary hotelContext={hotelContext} />
          )}
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
}: {
  title: string
  message: string
  statusTitle?: string
  actionLabel?: string
  fareContext: BookingFareContext | null
  duffelSandbox: boolean
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
    >
      <div className={`${panelCls} p-4 sm:p-6`}>
        <div className={`mt-5 p-4 ${insetPanelCls}`}>
          <p className={factLabelCls}>What happens now</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            This page is review-only. expaify is not collecting payment details, submitting traveler information, or creating an airline order from this fare.
          </p>
        </div>
        <div className={actionStackCls}>
          <a href="/" className="btn-primary">
            {actionLabel}
          </a>
        </div>
      </div>
    </ReviewShell>
  )
}

function InvalidBookingState({ duffelSandbox }: { duffelSandbox: boolean }) {
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
          <a href="/" className="btn-primary">
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

function HotelHandoffReview({ hotelContext, duffelSandbox }: { hotelContext: BookingHotelContext; duffelSandbox: boolean }) {
  return (
    <ReviewShell
      eyebrow="Hotel handoff"
      title="Review selected hotel"
      message="The selected hotel offer is preserved for provider handoff. Confirm the location, taxes, fees, cancellation policy, room details, and live availability with the provider before payment."
      fareContext={null}
      hotelContext={hotelContext}
      duffelSandbox={duffelSandbox}
      status={
        <StatusPanel
          title="Provider confirmation required"
          message={hotelTermsCopy}
        />
      }
    >
      <div className={`${panelCls} p-4 sm:p-6`}>
        <div className={`mt-5 p-4 ${insetPanelCls}`}>
          <p className={factLabelCls}>Before you continue</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            Compare the hotel name, location, provider, selected rate, currency, and price basis on the provider page before entering payment details.
          </p>
        </div>
        <p className="mt-4 text-sm leading-6 text-[color:var(--text-2)]">{hotelTermsCopy}</p>
        <div className={actionStackCls}>
          <a
            href={hotelContext.providerUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            aria-label={`Continue to provider for ${hotelContext.name}. Selected nightly rate ${formatMoney(hotelContext.priceCents, hotelContext.currency)}, ${getHotelPriceBasisLabel(hotelContext.priceBasis)}. Opens provider site in a new tab. ${hotelTermsCopy}`}
            className="btn-primary"
          >
            Continue to provider
          </a>
          <a href="/" className={secondaryButtonCls}>
            Back to search
          </a>
        </div>
      </div>
    </ReviewShell>
  )
}

export default function BookingFlow({ bookingEnabled, duffelSandbox, fareContext, hotelContext = null, invalidHotelSelection = false }: BookingFlowProps) {
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
    return <HotelHandoffReview hotelContext={hotelContext} duffelSandbox={duffelSandbox} />
  }

  if (invalidHotelSelection) {
    return <InvalidHotelState duffelSandbox={duffelSandbox} />
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
            <p className="mt-2 break-all font-mono text-xl font-bold text-[color:var(--brand)] sm:text-2xl">{bookingRef}</p>
          </div>
          <a href="/" className={`mt-5 ${secondaryButtonCls}`}>
            Search more flights
          </a>
        </div>
      </ReviewShell>
    )
  }

  if (!fareContext) {
    return <InvalidBookingState duffelSandbox={duffelSandbox} />
  }

  if (!bookingEnabled) {
    return (
      <RecoveryState
        title="In-app booking is paused"
        message="This fare is preserved for review only. expaify is not collecting traveler details or creating a provider order."
        statusTitle="Booking remains paused"
        fareContext={fareContext}
        duffelSandbox={duffelSandbox}
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
            <a href="/" className={secondaryButtonCls}>
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
          <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--brand)]">Traveler details</p>
          <h2 className="mt-2 text-xl font-bold leading-tight text-[color:var(--text-1)]">Verify this fare for 1 adult traveler</h2>
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
