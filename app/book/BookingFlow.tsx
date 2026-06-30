'use client'

import { useState, type FormEvent, type ReactNode } from 'react'
import { BOOKING_FORM_PASSENGER_LIMIT, type BookingFareContext } from '@/lib/booking/config'

type BookingState = 'idle' | 'loading' | 'success' | 'error'
type Title = 'mr' | 'ms' | 'mrs' | 'miss' | 'dr'

const labelCls = 'block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5'
const inputCls = 'w-full rounded-xl bg-[#0a0f1e] border border-white/10 px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors'
const factLabelCls = 'text-[11px] font-semibold uppercase tracking-wider text-gray-500'
const factValueCls = 'mt-1 text-sm font-medium text-gray-100'

type BookingFlowProps = {
  bookingEnabled: boolean
  duffelSandbox: boolean
  fareContext: BookingFareContext | null
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
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
    ? `Party total for ${getPassengerLabel(fareContext.passengerCount)}`
    : 'Per person'
}

function FareFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/8 bg-black/10 px-4 py-3">
      <p className={factLabelCls}>{label}</p>
      <p className={`${factValueCls} break-words`}>{value}</p>
    </div>
  )
}

function FareSummary({ fareContext, duffelSandbox }: { fareContext: BookingFareContext; duffelSandbox: boolean }) {
  return (
    <section aria-labelledby="fare-review-title" className="rounded-2xl border border-white/10 bg-gray-900 p-5 shadow-2xl shadow-black/20 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">Fare review</p>
          <h2 id="fare-review-title" className="mt-2 text-2xl font-bold leading-tight text-white sm:text-3xl">
            {fareContext.origin} to {fareContext.destination}
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">
            {fareContext.carrier} flight, {getStopsLabel(fareContext.stops).toLowerCase()}, departing {formatDateTime(fareContext.depart)}
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200">Current fare</p>
          <p className="mt-1 text-2xl font-bold text-white">{formatMoney(fareContext.priceCents, fareContext.currency)}</p>
          <p className="mt-1 text-xs text-emerald-100/80">{getPriceBasisLabel(fareContext)}</p>
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
      <details className="mt-4 rounded-xl border border-white/8 bg-black/10 px-4 py-3 text-xs text-gray-500">
        <summary className="cursor-pointer font-semibold uppercase tracking-wider text-gray-400">Technical reference</summary>
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
    amber: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
    red: 'border-red-400/25 bg-red-400/10 text-red-100',
    green: 'border-green-400/25 bg-green-400/10 text-green-100',
  }

  return (
    <div role="status" aria-live="polite" className={`rounded-2xl border p-4 sm:p-5 ${toneClasses[tone]}`}>
      <div className="flex gap-3">
        <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-sm font-bold">!</span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-current/80">{message}</p>
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
      <a href="/" className="inline-flex min-h-10 items-center text-sm font-medium text-gray-400 transition-colors hover:text-white">
        ← Back to search
      </a>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="min-w-0 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-300">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-white sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">{message}</p>
          </div>
          {fareContext ? (
            <FareSummary fareContext={fareContext} duffelSandbox={duffelSandbox} />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-gray-900 p-6">
              <p className="text-sm leading-6 text-gray-400">No fare details were supplied with this booking review.</p>
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
      <div className="rounded-2xl border border-white/10 bg-gray-900 p-5 shadow-2xl shadow-black/20 sm:p-6">
        <StatusPanel title="Order creation is paused" message={message} />
        <div className="mt-5 rounded-xl border border-white/8 bg-black/10 p-4">
          <p className={factLabelCls}>What happens now</p>
          <p className="mt-2 text-sm leading-6 text-gray-300">
            This page is review-only. expaify is not collecting payment details, submitting traveler information, or creating an airline order from this fare.
          </p>
        </div>
        <a href="/" className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-semibold text-gray-200 transition-colors hover:border-white/20 hover:bg-white/5">
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
        message="Check your email for ticket details."
        fareContext={fareContext}
        duffelSandbox={duffelSandbox}
      >
        <div className="rounded-2xl border border-green-500/20 bg-gray-900 p-6 shadow-2xl shadow-black/20">
          <StatusPanel title="Order confirmed" message="The provider returned a booking reference for this fare." tone="green" />
          <div className="mt-5 rounded-xl border border-white/8 bg-black/10 p-4">
            <p className={factLabelCls}>Booking reference</p>
            <p className="mt-2 break-all font-mono text-2xl font-bold text-indigo-300">{bookingRef}</p>
          </div>
          <a href="/" className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-semibold text-gray-200 transition-colors hover:border-white/20 hover:bg-white/5">
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
        message="This fare is preserved for review, but expaify is not collecting passenger details or creating orders while booking review is being completed."
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
        message="The fare details are still available, but the provider could not continue the booking request."
        fareContext={fareContext}
        duffelSandbox={duffelSandbox}
      >
        <div className="rounded-2xl border border-red-500/20 bg-gray-900 p-6 shadow-2xl shadow-black/20">
          <StatusPanel title="Booking request stopped" message={errorMsg} tone="red" />
          <button onClick={() => setState('idle')} className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-semibold text-gray-200 transition-colors hover:border-white/20 hover:bg-white/5">
            Try again
          </button>
        </div>
      </ReviewShell>
    )
  }

  return (
    <ReviewShell
      title="Review selected fare"
      message="Confirm the fare details before expaify sends traveler information to the provider."
      fareContext={fareContext}
      duffelSandbox={duffelSandbox}
    >
      <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-gray-900 p-5 shadow-2xl shadow-black/20 sm:p-6">
        <div className="mb-5 rounded-xl border border-white/8 bg-black/10 p-4">
          <p className={factLabelCls}>Booking status</p>
          <p className="mt-2 text-sm leading-6 text-gray-300">
            {duffelSandbox ? 'Duffel sandbox mode is active. This does not create a live airline ticket.' : 'Review fare context before creating the order.'}
          </p>
        </div>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Title</label>
              <select value={title} onChange={e => setTitle(e.target.value as Title)} className={inputCls} required>
                <option value="mr">Mr</option>
                <option value="ms">Ms</option>
                <option value="mrs">Mrs</option>
                <option value="miss">Miss</option>
                <option value="dr">Dr</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Gender</label>
              <select value={gender} onChange={e => setGender(e.target.value as 'm' | 'f')} className={inputCls} required>
                <option value="m">Male</option>
                <option value="f">Female</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>First name</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className={inputCls} placeholder="Jane" required />
            </div>
            <div>
              <label className={labelCls}>Last name</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className={inputCls} placeholder="Smith" required />
            </div>
          </div>

          <div>
            <label className={labelCls}>Date of birth</label>
            <input type="date" value={dob} onChange={e => setDob(e.target.value)} max={maxDobStr} className={inputCls} required />
          </div>

          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="jane@example.com" required />
          </div>

          <div>
            <label className={labelCls}>Phone (with country code)</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} placeholder="+1 212 555 1234" required />
          </div>

          <button
            type="submit"
            disabled={state === 'loading'}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:from-indigo-400 hover:to-indigo-500 transition-all disabled:opacity-60"
          >
            {state === 'loading' ? 'Confirming…' : duffelSandbox ? 'Confirm sandbox booking →' : 'Confirm booking →'}
          </button>
        </div>
      </form>
    </ReviewShell>
  )
}
