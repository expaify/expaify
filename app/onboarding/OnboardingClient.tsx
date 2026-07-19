'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Ref } from 'react'
import { TRACKED_MARKETS, TRACKED_MARKET_NAMES } from '@/lib/trackedMarkets'

type AlertPreference = 'instant' | 'daily' | 'off'
type MinDiscountPct = 30 | 40 | 50

const STEP_NAMES = ['Destinations', 'Deal size', 'Alerts'] as const

const DRAFT_KEY = 'expaify.onboarding.draft.v1'

const SAVE_ERROR = 'We couldn’t save your preferences — nothing was lost. Check your connection and try again.'

const PREMIUM_DISCLOSURE = 'Email alerts are included with Premium — your pick is saved for when you upgrade.'

const DISCOUNT_OPTIONS: Array<{ value: MinDiscountPct; label: string; detail: string }> = [
  { value: 50, label: '50%+', detail: 'Only the steepest drops' },
  { value: 40, label: '40%+', detail: 'Balanced and useful' },
  { value: 30, label: '30%+', detail: 'More chances to travel' },
]

const REACH_OPTIONS: Array<{ value: AlertPreference; label: string; detail: string; premiumGated: boolean }> = [
  { value: 'instant', label: 'Instant', detail: 'Email me as soon as a match appears.', premiumGated: true },
  { value: 'daily', label: 'Daily digest', detail: 'Send one clean roundup each day.', premiumGated: true },
  { value: 'off', label: 'Just the website', detail: 'Keep deals in my account only.', premiumGated: false },
]

type SavePayload = {
  watchlist: string[]
  minDiscountPct: MinDiscountPct
  alertPreference: AlertPreference
  everywhere: boolean
}

export function OnboardingClient({ premium }: { premium: boolean }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [minDiscountPct, setMinDiscountPct] = useState<MinDiscountPct>(40)
  const [alertPreference, setAlertPreference] = useState<AlertPreference>('daily')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const lastAttemptRef = useRef<SavePayload | null>(null)

  const selectedLabel = useMemo(() => {
    if (watchlist.length === 0) return 'Everywhere'
    return `${watchlist.length}/10 selected`
  }, [watchlist.length])

  // Restore draft. Declared before the persist effect so the stored draft is
  // read before the first write. Runs in an effect, not a state initializer —
  // the component server-renders and a storage read during render would
  // mismatch hydration. Invalid fields fall back to defaults individually.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (!raw) return
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        sessionStorage.removeItem(DRAFT_KEY)
        return
      }
      if (typeof parsed !== 'object' || parsed === null) {
        sessionStorage.removeItem(DRAFT_KEY)
        return
      }
      const draft = parsed as Record<string, unknown>
      if (typeof draft.step === 'number' && Number.isInteger(draft.step)) {
        setStep(Math.min(2, Math.max(0, draft.step)))
      }
      if (Array.isArray(draft.watchlist)) {
        const cities = draft.watchlist.filter(
          (city): city is string => typeof city === 'string' && TRACKED_MARKET_NAMES.includes(city)
        )
        setWatchlist([...new Set(cities)].slice(0, 10))
      }
      if (draft.minDiscountPct === 30 || draft.minDiscountPct === 40 || draft.minDiscountPct === 50) {
        setMinDiscountPct(draft.minDiscountPct)
      }
      if (draft.alertPreference === 'instant' || draft.alertPreference === 'daily' || draft.alertPreference === 'off') {
        setAlertPreference(draft.alertPreference)
      }
    } catch {
      // Storage unavailable (private mode, quota) — the flow works without drafts.
    }
  }, [])

  // Persist draft on every answer or step change.
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ step, watchlist, minDiscountPct, alertPreference }))
    } catch {
      // Storage unavailable — ignore.
    }
  }, [step, watchlist, minDiscountPct, alertPreference])

  // Focus the step heading on every step change (including a restored
  // mid-flow step, but not a fresh step-0 mount) so screen readers announce
  // the new step and keyboard tab position resets to the top of it.
  const stepEffectRanRef = useRef(false)
  useEffect(() => {
    if (!stepEffectRanRef.current) {
      stepEffectRanRef.current = true
      return
    }
    headingRef.current?.focus()
  }, [step])

  function toggleCity(city: string) {
    setWatchlist((prev) => {
      if (prev.includes(city)) return prev.filter((item) => item !== city)
      if (prev.length >= 10) return prev
      return [...prev, city]
    })
  }

  function clearDraft() {
    try {
      sessionStorage.removeItem(DRAFT_KEY)
    } catch {
      // Storage unavailable — ignore.
    }
  }

  async function save(payload: SavePayload) {
    lastAttemptRef.current = payload
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        setError(SAVE_ERROR)
        return
      }
      clearDraft()
      router.replace('/deals')
    } catch {
      setError(SAVE_ERROR)
    } finally {
      // Invariant: no code path leaves saving === true after settling.
      setSaving(false)
    }
  }

  // Skip and the final CTA both save the actual current selections — Skip
  // never overwrites a partial answer with defaults.
  function complete() {
    void save({
      watchlist,
      minDiscountPct,
      alertPreference,
      everywhere: watchlist.length === 0,
    })
  }

  function retry() {
    if (lastAttemptRef.current) void save(lastAttemptRef.current)
  }

  const reachOptions = useMemo(
    () =>
      REACH_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        detail: option.detail,
        chip: !premium && option.premiumGated ? 'Premium' : undefined,
        disclosure: !premium && option.premiumGated ? PREMIUM_DISCLOSURE : undefined,
      })),
    [premium]
  )

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1120px] flex-col px-5 py-6 sm:py-8">
      <header className="flex items-center justify-between gap-4">
        <a href="/" className="flex items-center gap-0.5 font-display text-[20px] font-bold text-[color:var(--ink)] no-underline">
          expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" aria-hidden />
        </a>
        <button
          type="button"
          onClick={complete}
          disabled={saving}
          className="rounded-[var(--radius-pill)] px-4 py-2 text-[14px] font-medium text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] disabled:opacity-60"
        >
          Skip
        </button>
      </header>

      <section className="flex flex-1 flex-col justify-center py-8">
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={3}
          aria-valuenow={step + 1}
          aria-valuetext={`Step ${step + 1} of 3: ${STEP_NAMES[step]}`}
          className="mb-7 flex items-center gap-2"
        >
          {[0, 1, 2].map((item) => (
            <span
              key={item}
              aria-hidden
              className={`h-2 flex-1 rounded-[var(--radius-pill)] ${item <= step ? 'bg-[color:var(--primary)]' : 'bg-[color:var(--line-ivory)]'}`}
            />
          ))}
        </div>

        {step === 0 ? (
          <div>
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-2 text-[13px] font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">Step 1 of 3</p>
                <h1 ref={headingRef} tabIndex={-1} className="font-display text-[32px] font-bold leading-tight text-[color:var(--ink)] sm:text-[44px]">
                  Where do you dream of going?
                </h1>
                <p className="mt-3 max-w-[620px] text-[15px] text-[color:var(--ink-soft)]">
                  Pick up to 10 destinations. Leaving this open watches every expaify market.
                </p>
              </div>
              <p className="hidden text-[14px] font-medium text-[color:var(--primary)] sm:block">{selectedLabel}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {TRACKED_MARKETS.map((market, index) => {
                const selected = watchlist.includes(market.city)
                const disabled = !selected && watchlist.length >= 10
                return (
                  <button
                    key={`${market.city}-${market.iata}`}
                    type="button"
                    onClick={() => toggleCity(market.city)}
                    disabled={disabled}
                    aria-pressed={selected}
                    className={`group relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] border bg-[color:var(--primary-deep)] text-left transition duration-150 disabled:opacity-45 ${
                      selected ? 'border-[color:var(--primary)] ring-2 ring-[color:var(--primary)]' : 'border-[color:var(--line-ivory)] hover:border-[color:var(--primary-soft)]'
                    }`}
                  >
                    <img
                      src={market.photoUrl}
                      alt={market.photoAlt}
                      width={640}
                      height={480}
                      loading={index < 4 ? 'eager' : 'lazy'}
                      decoding="async"
                      onError={(event) => {
                        // Failed image: the --primary-deep card fill + gradient
                        // keep the white city text legible.
                        event.currentTarget.style.display = 'none'
                      }}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
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
            headingRef={headingRef}
          />
        ) : null}

        {step === 2 ? (
          <ChoiceStep
            eyebrow="Step 3 of 3"
            title="How should we reach you?"
            options={reachOptions}
            value={alertPreference}
            onChange={setAlertPreference}
            headingRef={headingRef}
          />
        ) : null}

        {error ? (
          <div className="mt-5 rounded-[var(--radius-input)] border border-[color:var(--error)] bg-[color:var(--error-soft)] px-4 py-3 text-[14px] font-medium text-[color:var(--ink)]" role="alert">
            <p>{error}</p>
            <button type="button" onClick={retry} disabled={saving} className="btn btn-outline mt-3">
              Try again
            </button>
          </div>
        ) : null}
      </section>

      <div className="sticky bottom-0 z-20 -mx-5 mt-8 border-t border-[color:var(--line-ivory)] bg-[color:var(--bg)] px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <p className="mb-2 text-center text-[12px] text-[color:var(--ink-faint)]">
          You can change any of this later in{' '}
          <a href="/account" className="font-medium text-[color:var(--primary)] no-underline hover:underline">
            Account
          </a>
          .
        </p>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            disabled={step === 0 || saving}
            className={`btn btn-outline justify-center px-4 ${step === 0 ? 'invisible' : ''}`}
          >
            Back
          </button>
          <div aria-live="polite" className="text-center">
            <p className="text-[12px] font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">Step {step + 1} of 3</p>
            {step === 0 ? (
              <p className="text-[14px] font-medium text-[color:var(--primary)]">{selectedLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => (step === 2 ? complete() : setStep((current) => current + 1))}
            disabled={saving}
            className="btn btn-conversion justify-center px-6"
          >
            {saving ? 'Saving...' : step === 2 ? 'Take me to deals' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ChoiceStep<T extends string | number>({
  eyebrow,
  title,
  options,
  value,
  onChange,
  headingRef,
}: {
  eyebrow: string
  title: string
  options: Array<{ value: T; label: string; detail: string; chip?: string; disclosure?: string }>
  value: T
  onChange: (value: T) => void
  headingRef?: Ref<HTMLHeadingElement>
}) {
  return (
    <div className="mx-auto w-full max-w-[760px]">
      <p className="mb-2 text-[13px] font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">{eyebrow}</p>
      <h1 ref={headingRef} tabIndex={-1} className="font-display text-[32px] font-bold leading-tight text-[color:var(--ink)] sm:text-[44px]">
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
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-display text-[22px] font-bold leading-tight">{option.label}</span>
                {option.chip ? (
                  <span className="rounded-[var(--radius-pill)] bg-[color:var(--gold)] px-2 py-0.5 font-display text-[12px] font-bold leading-none text-[color:var(--gold-text)]">
                    {option.chip}
                  </span>
                ) : null}
              </span>
              <span className={`mt-1 block text-[14px] ${selected ? 'text-white/85' : 'text-[color:var(--ink-soft)]'}`}>
                {option.detail}
              </span>
              {option.disclosure ? (
                <span className={`mt-2 block text-[13px] ${selected ? 'text-white/85' : 'text-[color:var(--ink-soft)]'}`}>
                  {option.disclosure}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
