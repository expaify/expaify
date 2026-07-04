'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { TRACKED_MARKETS } from '@/lib/trackedMarkets'

type AlertPreference = 'instant' | 'daily' | 'off'
type MinDiscountPct = 30 | 40 | 50

const DISCOUNT_OPTIONS: Array<{ value: MinDiscountPct; label: string; detail: string }> = [
  { value: 50, label: '50%+', detail: 'Only the steepest drops' },
  { value: 40, label: '40%+', detail: 'Balanced and useful' },
  { value: 30, label: '30%+', detail: 'More chances to travel' },
]

const REACH_OPTIONS: Array<{ value: AlertPreference; label: string; detail: string }> = [
  { value: 'instant', label: 'Instant', detail: 'Email me as soon as a match appears.' },
  { value: 'daily', label: 'Daily digest', detail: 'Send one clean roundup each day.' },
  { value: 'off', label: 'Just the website', detail: 'Keep deals in my account only.' },
]

export function OnboardingClient() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [minDiscountPct, setMinDiscountPct] = useState<MinDiscountPct>(40)
  const [alertPreference, setAlertPreference] = useState<AlertPreference>('daily')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedLabel = useMemo(() => {
    if (watchlist.length === 0) return 'Everywhere'
    return `${watchlist.length}/10 selected`
  }, [watchlist.length])

  function toggleCity(city: string) {
    setWatchlist((prev) => {
      if (prev.includes(city)) return prev.filter((item) => item !== city)
      if (prev.length >= 10) return prev
      return [...prev, city]
    })
  }

  async function complete(overrides?: { useDefaults?: boolean }) {
    setSaving(true)
    setError(null)

    const useDefaults = overrides?.useDefaults === true

    const res = await fetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        watchlist: useDefaults ? [] : watchlist,
        minDiscountPct: useDefaults ? 40 : minDiscountPct,
        alertPreference: useDefaults ? 'daily' : alertPreference,
        everywhere: useDefaults || watchlist.length === 0,
      }),
    })

    if (!res.ok) {
      setSaving(false)
      setError('We could not save your preferences. Try again.')
      return
    }

    router.replace('/deals')
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1120px] flex-col px-5 py-6 sm:py-8">
      <header className="flex items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-0.5 font-display text-[20px] font-bold text-[color:var(--ink)] no-underline">
          expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" aria-hidden />
        </a>
        <button
          type="button"
          onClick={() => complete({ useDefaults: true })}
          disabled={saving}
          className="rounded-[var(--radius-pill)] px-4 py-2 text-[14px] font-medium text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] disabled:opacity-60"
        >
          Skip
        </button>
      </header>

      <section className="flex flex-1 flex-col justify-center py-8">
        <div className="mb-7 flex items-center gap-2" aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((item) => (
            <span
              key={item}
              className={`h-2 flex-1 rounded-[var(--radius-pill)] ${item <= step ? 'bg-[color:var(--primary)]' : 'bg-[color:var(--line-ivory)]'}`}
            />
          ))}
        </div>

        {step === 0 ? (
          <div>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-2 text-[13px] font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">Step 1 of 3</p>
                <h1 className="font-display text-[32px] font-bold leading-tight text-[color:var(--ink)] sm:text-[44px]">
                  Where do you dream of going?
                </h1>
                <p className="mt-3 max-w-[620px] text-[15px] text-[color:var(--ink-soft)]">
                  Pick up to 10 destinations. Leaving this open watches every expaify market.
                </p>
              </div>
              <p className="text-[14px] font-medium text-[color:var(--primary)]">{selectedLabel}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {TRACKED_MARKETS.map((market) => {
                const selected = watchlist.includes(market.city)
                const disabled = !selected && watchlist.length >= 10
                return (
                  <button
                    key={`${market.city}-${market.iata}`}
                    type="button"
                    onClick={() => toggleCity(market.city)}
                    disabled={disabled}
                    aria-pressed={selected}
                    className={`group relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] border text-left transition duration-150 disabled:opacity-45 ${
                      selected ? 'border-[color:var(--primary)] ring-2 ring-[color:var(--primary)]' : 'border-[color:var(--line-ivory)] hover:border-[color:var(--primary-soft)]'
                    }`}
                  >
                    <img src={market.photoUrl} alt={market.photoAlt} className="absolute inset-0 h-full w-full object-cover" />
                    <span className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--ink)_4%,transparent)_0%,color-mix(in_srgb,var(--ink)_68%,transparent)_100%)]" aria-hidden />
                    <span className="absolute inset-x-0 bottom-0 p-3 text-white">
                      <span className="block font-display text-[17px] font-bold leading-tight">{market.city}</span>
                      <span className="text-[12px] font-medium opacity-85">{market.iata} · {market.country}</span>
                    </span>
                    {selected ? (
                      <span className="absolute right-3 top-3 rounded-[var(--radius-pill)] bg-[color:var(--surface)] px-2.5 py-1 text-[12px] font-bold text-[color:var(--primary)]">
                        Selected
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <ChoiceStep
            eyebrow="Step 2 of 3"
            title="How big should a deal be before we bug you?"
            options={DISCOUNT_OPTIONS}
            value={minDiscountPct}
            onChange={setMinDiscountPct}
          />
        ) : null}

        {step === 2 ? (
          <ChoiceStep
            eyebrow="Step 3 of 3"
            title="How should we reach you?"
            options={REACH_OPTIONS}
            value={alertPreference}
            onChange={setAlertPreference}
          />
        ) : null}

        {error ? (
          <p className="mt-5 rounded-[var(--radius-input)] border border-[color:var(--error)] bg-[color:var(--error-soft)] px-4 py-3 text-[14px] font-medium text-[color:var(--ink)]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0 || saving}
            className="btn btn-outline justify-center disabled:opacity-0"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => (step === 2 ? complete() : setStep((current) => current + 1))}
            disabled={saving}
            className="btn btn-conversion justify-center px-6"
          >
            {saving ? 'Saving...' : step === 2 ? 'Take me to deals' : 'Continue'}
          </button>
        </div>
      </section>
    </div>
  )
}

function ChoiceStep<T extends string | number>({
  eyebrow,
  title,
  options,
  value,
  onChange,
}: {
  eyebrow: string
  title: string
  options: Array<{ value: T; label: string; detail: string }>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="mx-auto w-full max-w-[760px]">
      <p className="mb-2 text-[13px] font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">{eyebrow}</p>
      <h1 className="font-display text-[32px] font-bold leading-tight text-[color:var(--ink)] sm:text-[44px]">
        {title}
      </h1>
      <div className="mt-7 grid gap-3">
        {options.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={`rounded-[var(--radius-card)] border p-5 text-left transition-colors duration-150 ${
                selected
                  ? 'border-[color:var(--primary)] bg-[color:var(--primary)] text-white'
                  : 'border-[color:var(--line-ivory)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:border-[color:var(--primary-soft)]'
              }`}
            >
              <span className="block font-display text-[22px] font-bold leading-tight">{option.label}</span>
              <span className={`mt-1 block text-[14px] ${selected ? 'text-white/85' : 'text-[color:var(--ink-soft)]'}`}>
                {option.detail}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
