'use client'

import { useState, FormEvent, ChangeEvent } from 'react'

interface Props {
  origin: string
  destination: string
}

type AlertResponse =
  | { ok: true; data: { message: string } }
  | { ok: false; reason: string }

function normalizeAlertMessage(reason: string): string {
  const normalized = reason.toLowerCase()

  if (normalized.includes('email')) {
    return 'Enter a valid email address so we can send price alert notifications.'
  }

  if (normalized.includes('origin')) {
    return 'Use a valid 3-letter origin airport code before setting a price alert.'
  }

  if (normalized.includes('destination')) {
    return 'Use a valid 3-letter destination airport code before setting a price alert.'
  }

  if (normalized.includes('thresholdcents') || normalized.includes('target')) {
    return 'Enter a target price between $50 and $5,000.'
  }

  if (normalized.includes('not configured') || normalized.includes('storage') || normalized.includes('unavailable')) {
    return reason
  }

  return reason || 'Price alert signup is unavailable right now. Please try again later.'
}

function normalizeSuccessMessage(message: string): string {
  return message
    .replace("We'll email you when", "We'll send best-effort email notifications when")
    .replace('Alert set!', 'Price alert request saved.')
}

export default function AlertSignup({ origin, destination }: Props) {
  const [email, setEmail] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const isLoading = state === 'loading'
  const isDone = state === 'done'
  const statusId = 'alert-signup-status'
  const statusRole = state === 'error' ? 'alert' : state === 'loading' || state === 'done' ? 'status' : undefined

  function resetCompletedState() {
    if (state === 'done' || state === 'error') {
      setState('idle')
      setMessage('')
    }
  }

  function handleEmailChange(e: ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value)
    resetCompletedState()
  }

  function handleTargetPriceChange(e: ChangeEvent<HTMLInputElement>) {
    setTargetPrice(e.target.value)
    resetCompletedState()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (isLoading) return

    const price = parseFloat(targetPrice)
    if (!email) {
      setMessage('Enter your email address to set a price alert.')
      setState('error')
      return
    }
    if (isNaN(price) || price < 50 || price > 5000) {
      setMessage('Enter a target price between $50 and $5,000.')
      setState('error')
      return
    }
    if (!origin || !destination) {
      setMessage('Choose a valid origin and destination before setting a price alert.')
      setState('error')
      return
    }
    setState('loading')
    setMessage('Setting your price alert notification...')
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, origin, destination, targetPrice: price }),
      })
      const data = await res.json() as AlertResponse
      if (res.ok && data.ok) {
        setMessage(normalizeSuccessMessage(data.data.message))
        setState('done')
      } else {
        setMessage(data.ok ? 'Price alert signup is unavailable right now. Please try again later.' : normalizeAlertMessage(data.reason))
        setState('error')
      }
    } catch {
      setMessage('Network error. Price alert signup was not completed. Please try again.')
      setState('error')
    }
  }

  return (
    <div className={`rounded-[var(--radius-card)] border bg-[color:var(--surface)] p-4 ${isDone ? 'border-[color:var(--primary)]' : 'border-[color:var(--line-ivory)]'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span aria-hidden="true">🔔</span>
        <h3 className="text-sm font-medium text-[color:var(--ink)]">Price alert</h3>
      </div>
      <p className="text-xs text-[color:var(--ink-faint)] mb-4">
        {origin && destination ? `${origin} → ${destination} - ` : ''}We&apos;ll send best-effort email notifications when prices drop below your target.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2" aria-describedby={statusId}>
        <input
          type="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="your@email.com"
          required
          disabled={isLoading}
          aria-invalid={state === 'error' && message.toLowerCase().includes('email')}
          className="field-input flex-1"
        />
        <input
          type="number"
          value={targetPrice}
          onChange={handleTargetPriceChange}
          placeholder="$250"
          min={50}
          max={5000}
          required
          disabled={isLoading}
          aria-invalid={state === 'error' && (message.toLowerCase().includes('price') || message.toLowerCase().includes('target'))}
          className="field-input w-full sm:w-32"
        />
        <button
          type="submit"
          disabled={isLoading || isDone}
          aria-disabled={isLoading || isDone}
          className="btn btn-primary whitespace-nowrap"
        >
          {isLoading ? 'Setting...' : isDone ? 'Alert set' : 'Set alert'}
        </button>
      </form>
      <p
        id={statusId}
        role={statusRole}
        aria-live={state === 'error' ? 'assertive' : 'polite'}
        className={`min-h-8 text-xs mt-2 ${state === 'error' ? 'font-medium text-[color:var(--ink)]' : isDone ? 'font-medium text-[color:var(--primary)]' : 'text-[color:var(--ink-faint)]'}`}
      >
        {message || 'Price alerts are notifications only; fares can change before booking.'}
      </p>
    </div>
  )
}
