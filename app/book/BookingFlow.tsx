'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { BOOKING_FORM_PASSENGER_LIMIT, type BookingFareContext } from '@/lib/booking/config'

type BookingState = 'idle' | 'loading' | 'success' | 'error'
type Title = 'mr' | 'ms' | 'mrs' | 'miss' | 'dr'

const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[color:var(--text-2)]'
const inputCls = 'field-input px-4'
const factLabelCls = 'text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-3)]'
const factValueCls = 'mt-1 text-sm font-semibold text-[color:var(--text-1)]'
const panelCls = 'rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-surface)] shadow-[var(--shadow-card)]'
const insetPanelCls = 'rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-raised)]'
const secondaryButtonCls = 'inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-4 text-sm font-semibold text-[color:var(--text-1)] transition-colors hover:border-[color:var(--border-hover)] hover:bg-[color:var(--brand-soft)] focus-visible:shadow-[var(--focus-ring)]'

type BookingFlowProps = {
  bookingEnabled: boolean
  duffelSandbox: boolean
  fareContext: BookingFareContext | null
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

function FareFact({ label, value }: { label: string; value: string }) {
  return (
    <div className={`min-w-0 px-4 py-3 ${insetPanelCls}`}>
      <p className={factLabelCls}>{label}</p>
      <p className={`${factValueCls} break-words`}>{value}</p>
    </div>
  )
}

function FareSummary({ fareContext, duffelSandbox }: { fareContext: BookingFareContext; duffelSandbox: boolean }) {
  return (
    <section aria-labelledby="fare-review-title" className={`${panelCls} p-5 sm:p-6`}>
      <div className="flex flex-col gap-4 border-b border-[color:var(--border)] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--brand)]">Fare review</p>
          <h2 id="fare-review-title" className="mt-2 text-2xl font-bold leading-tight text-[color:var(--text-1)] sm:text-3xl">
            {fareContext.origin} to {fareContext.destination}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            {fareContext.carrier} flight, {getStopsLabel(fareContext.stops).toLowerCase()}, departing {formatDateTime(fareContext.depart)}
          </p>
        </div>
        <div className="shrink-0 rounded-lg border border-[color:var(--border-strong)] bg-[color:var(--success-soft)] px-4 py-3 sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--success)]">Current fare</p>
          <p className="mt-1 text-2xl font-bold text-[color:var(--text-1)]">{formatMoney(fareContext.priceCents, fareContext.currency)}</p>
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
      <details className={`mt-4 px-4 py-3 text-xs text-[color:var(--text-3)] ${insetPanelCls}`}>
        <summary className="cursor-pointer font-semibold uppercase tracking-wide text-[color:var(--text-2)]">Technical reference</summary>
        <p className="mt-3 break-all font-mono leading-5">{fareContext.offerId}</p>
      </details>
    </section>
  )
}

function StatusPanel({
  title,
  message,
  tone = 'amber',
}: {
  title: string
  message: string
  tone?: 'amber' | 'red' | 'green'
}) {
  const toneClasses = {
    amber: 'border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] text-[color:var(--warning)]',
    red: 'border-[color:var(--border-strong)] bg-[color:var(--error-soft)] text-[color:var(--error)]',
    green: 'border-[color:var(--border-strong)] bg-[color:var(--success-soft)] text-[color:var(--success)]',
  }

  return (
    <div role="status" aria-live="polite" className={`rounded-lg border p-4 sm:p-5 ${toneClasses[tone]}`}>
      <div className="flex gap-3">
        <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-sm font-bold">!</span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[color:var(--text-1)]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">{message}</p>
        </div>
      </div>
    </div>
  )
}

function ReviewShell({
  eyebrow = 'Checkout review',
  title,
  message,
  fareContext,
  duffelSandbox,
  children,
}: {
  eyebrow?: string
  title: string
  message: string
  fareContext: BookingFareContext | null
  duffelSandbox: boolean
  children: ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <a href="/" className="inline-flex min-h-10 items-center rounded-lg text-sm font-medium text-[color:var(--text-2)] transition-colors hover:text-[color:var(--brand)] focus-visible:shadow-[var(--focus-ring)]">
        ← Back to search
      </a>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="min-w-0 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--brand)]">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-[color:var(--text-1)] sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--text-2)]">{message}</p>
          </div>
          {fareContext ? (
            <FareSummary fareContext={fareContext} duffelSandbox={duffelSandbox} />
          ) : (
            <div className={`${panelCls} p-6`}>
              <p className="text-sm leading-6 text-[color:var(--text-2)]">No fare details were supplied with this booking review.</p>
            </div>
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
  fareContext,
  duffelSandbox,
}: {
  title: string
  message: string
  fareContext: BookingFareContext | null
  duffelSandbox: boolean
}) {
  return (
    <ReviewShell title={title} message={message} fareContext={fareContext} duffelSandbox={duffelSandbox}>
      <div className={`${panelCls} p-5 sm:p-6`}>
        <StatusPanel title="Booking remains review-only" message={message} />
        <div className={`mt-5 p-4 ${insetPanelCls}`}>
          <p className={factLabelCls}>What happens now</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            This page is review-only. expaify is not collecting payment details, submitting traveler information, or creating an airline order from this fare.
          </p>
        </div>
        <a href="/" className={`mt-5 ${secondaryButtonCls}`}>
          Back to search
        </a>
      </div>
    </ReviewShell>
  )
}

export default function BookingFlow({ bookingEnabled, duffelSandbox, fareContext }: BookingFlowProps) {
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
        message="The provider returned a reference for this sandbox-capable booking path. Review the fare details below before taking any follow-up action."
        fareContext={fareContext}
        duffelSandbox={duffelSandbox}
      >
        <div className={`${panelCls} p-5 sm:p-6`}>
          <StatusPanel title="Order confirmed" message="The provider returned a booking reference for this fare." tone="green" />
          <div className={`mt-5 p-4 ${insetPanelCls}`}>
            <p className={factLabelCls}>Booking reference</p>
            <p className="mt-2 break-all font-mono text-2xl font-bold text-[color:var(--brand)]">{bookingRef}</p>
          </div>
          <a href="/" className={`mt-5 ${secondaryButtonCls}`}>
            Search more flights
          </a>
        </div>
      </ReviewShell>
    )
  }

  if (!fareContext) {
    return (
      <RecoveryState
        title="We can't identify this fare"
        message="The booking page is missing the selected provider, route, or price. Return to search and choose a current flight result before reviewing booking options."
        fareContext={null}
        duffelSandbox={duffelSandbox}
      />
    )
  }

  if (!bookingEnabled) {
    return (
      <RecoveryState
        title="In-app booking is paused"
        message="This fare is preserved for review. expaify is intentionally not collecting passenger details, payment information, or creating provider orders while in-app booking is paused."
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
        fareContext={fareContext}
        duffelSandbox={duffelSandbox}
      />
    )
  }

  if (state === 'error') {
    return (
      <ReviewShell
        title="Review selected fare"
        message="The fare details are still available, but the provider stopped the booking request before an order was created."
        fareContext={fareContext}
        duffelSandbox={duffelSandbox}
      >
        <div className={`${panelCls} p-5 sm:p-6`}>
          <StatusPanel title="Booking request stopped" message={errorMsg} tone="red" />
          <button onClick={() => setState('idle')} className={`mt-5 ${secondaryButtonCls}`}>
            Try again
          </button>
        </div>
      </ReviewShell>
    )
  }

  return (
    <ReviewShell
      title="Review selected fare"
      message={duffelSandbox ? 'Review this fare in sandbox mode. Submitting will not create a live airline ticket.' : 'Confirm the fare details before expaify sends traveler information to the provider.'}
      fareContext={fareContext}
      duffelSandbox={duffelSandbox}
    >
      <form onSubmit={handleSubmit} className={`${panelCls} p-5 sm:p-6`}>
        <div className={`mb-5 p-4 ${insetPanelCls}`}>
          <p className={factLabelCls}>Booking status</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
            {duffelSandbox ? 'Duffel sandbox mode is active. This is a test provider path and does not create a live airline ticket.' : 'Review fare context before creating the order.'}
          </p>
        </div>
        <div className="space-y-4">
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
              <label htmlFor="gender" className={labelCls}>Gender</label>
              <select id="gender" value={gender} onChange={e => setGender(e.target.value as 'm' | 'f')} className={inputCls} required>
                <option value="m">Male</option>
                <option value="f">Female</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className={labelCls}>First name</label>
              <input id="firstName" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className={inputCls} placeholder="Jane" required />
            </div>
            <div>
              <label htmlFor="lastName" className={labelCls}>Last name</label>
              <input id="lastName" type="text" value={lastName} onChange={e => setLastName(e.target.value)} className={inputCls} placeholder="Smith" required />
            </div>
          </div>

          <div>
            <label htmlFor="dob" className={labelCls}>Date of birth</label>
            <input id="dob" type="date" value={dob} onChange={e => setDob(e.target.value)} max={maxDobStr} className={inputCls} required />
          </div>

          <div>
            <label htmlFor="email" className={labelCls}>Email</label>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="jane@example.com" required />
          </div>

          <div>
            <label htmlFor="phone" className={labelCls}>Phone (with country code)</label>
            <input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} placeholder="+1 212 555 1234" required />
          </div>

          <button
            type="submit"
            disabled={state === 'loading'}
            className="btn-primary"
          >
            {state === 'loading' ? 'Confirming...' : duffelSandbox ? 'Confirm sandbox booking' : 'Confirm booking'}
          </button>
        </div>
      </form>
    </ReviewShell>
  )
}
