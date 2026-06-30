'use client'

import { useState, FormEvent } from 'react'
import { BOOKING_FORM_PASSENGER_LIMIT, type BookingFareContext } from '@/lib/booking/config'

type BookingState = 'idle' | 'loading' | 'success' | 'error'
type Title = 'mr' | 'ms' | 'mrs' | 'miss' | 'dr'

const labelCls = 'block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5'
const inputCls = 'w-full rounded-xl bg-[#0a0f1e] border border-white/10 px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors'

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

function FareSummary({ fareContext, duffelSandbox }: { fareContext: BookingFareContext; duffelSandbox: boolean }) {
  const priceLabel = fareContext.priceScope === 'party_total'
    ? `total for ${fareContext.passengerCount} adult${fareContext.passengerCount === 1 ? '' : 's'}`
    : 'per person'

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Selected fare</p>
          <h2 className="mt-1 text-lg font-bold text-white">
            {fareContext.origin} to {fareContext.destination}
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            {fareContext.carrier} · {fareContext.stops === 0 ? 'Nonstop' : `${fareContext.stops} stop${fareContext.stops === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-white">{formatMoney(fareContext.priceCents, fareContext.currency)}</p>
          <p className="text-[11px] text-gray-500">{priceLabel}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Depart</p>
          <p className="mt-1 text-gray-200">{formatDateTime(fareContext.depart)}</p>
        </div>
        {fareContext.return && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Return</p>
            <p className="mt-1 text-gray-200">{formatDateTime(fareContext.return)}</p>
          </div>
        )}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Passengers</p>
          <p className="mt-1 text-gray-200">{fareContext.passengerCount} adult{fareContext.passengerCount === 1 ? '' : 's'}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Provider</p>
          <p className="mt-1 text-gray-200">
            {fareContext.provider === 'duffel' ? `Duffel${duffelSandbox ? ' sandbox' : ''}` : fareContext.provider}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Offer</p>
          <p className="mt-1 truncate font-mono text-xs text-gray-400">{fareContext.offerId}</p>
        </div>
      </div>
    </div>
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
    <div className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-12">
      <div className="w-full rounded-2xl border border-amber-500/20 bg-gray-900 p-6 sm:p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10">
          <span className="text-xl text-amber-300">!</span>
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">{title}</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-gray-400">{message}</p>
        </div>
        {fareContext && (
          <div className="mt-6">
            <FareSummary fareContext={fareContext} duffelSandbox={duffelSandbox} />
          </div>
        )}
        <div className="mt-6 text-center">
          <a href="/" className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-semibold text-gray-200 transition-colors hover:border-white/20 hover:bg-white/5">
            Back to search
          </a>
        </div>
      </div>
    </div>
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
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-gray-900 border border-green-500/20 rounded-2xl p-8">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-green-400 text-2xl">✓</span>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Booking confirmed!</h1>
          <p className="text-gray-400 text-sm mb-6">Check your email for ticket details.</p>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Booking reference</p>
          <p className="text-3xl font-mono font-bold text-indigo-400 mb-8">{bookingRef}</p>
          <a href="/" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            ← Search more flights
          </a>
        </div>
      </div>
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
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="bg-gray-900 border border-red-500/20 rounded-2xl p-8">
          <p className="text-red-400 mb-6">{errorMsg}</p>
          <button onClick={() => setState('idle')} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            ← Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="mb-8">
        <a href="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">← Back to search</a>
        <h1 className="text-2xl font-bold text-white mt-4">Review selected fare</h1>
        <p className="text-gray-500 text-sm mt-1">
          {duffelSandbox ? 'Duffel sandbox mode is active. This does not create a live airline ticket.' : 'Review fare context before creating the order.'}
        </p>
      </div>

      <div className="mb-4">
        <FareSummary fareContext={fareContext} duffelSandbox={duffelSandbox} />
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900 border border-white/8 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
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
      </form>
    </div>
  )
}
