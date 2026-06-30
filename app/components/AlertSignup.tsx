'use client'

import { useState, FormEvent } from 'react'

interface Props {
  origin: string
  destination: string
}

export default function AlertSignup({ origin, destination }: Props) {
  const [email, setEmail] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const price = parseFloat(targetPrice)
    if (!email || isNaN(price) || price < 50 || price > 5000) {
      setMessage('Enter a valid email and target price ($50–$5,000).')
      setState('error')
      return
    }
    setState('loading')
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, origin, destination, targetPrice: price }),
      })
      const data = await res.json() as { message?: string; error?: string }
      if (res.ok) {
        setMessage(data.message ?? 'Alert set!')
        setState('done')
      } else {
        setMessage(data.error ?? 'Failed to set alert.')
        setState('error')
      }
    } catch {
      setMessage('Network error. Try again.')
      setState('error')
    }
  }

  if (state === 'done') {
    return (
      <div className="bg-gray-900 border border-green-500/20 rounded-2xl p-5">
        <p className="text-green-400 text-sm">🔔 {message}</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-white/8 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <span>🔔</span>
        <h3 className="text-sm font-semibold text-gray-200">Price alert</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        {origin && destination ? `${origin} → ${destination} — ` : ''}We&apos;ll email you when the price drops below your target.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="flex-1 rounded-xl bg-[#0a0f1e] border border-white/10 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
        />
        <input
          type="number"
          value={targetPrice}
          onChange={e => setTargetPrice(e.target.value)}
          placeholder="$250"
          min={50}
          max={5000}
          required
          className="w-full sm:w-32 rounded-xl bg-[#0a0f1e] border border-white/10 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={state === 'loading'}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {state === 'loading' ? 'Setting…' : 'Set alert'}
        </button>
      </form>
      {state === 'error' && <p className="text-xs text-red-400 mt-2">{message}</p>}
    </div>
  )
}
