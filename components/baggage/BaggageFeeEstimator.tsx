'use client'

import { useEffect, useMemo, useState } from 'react'
import type { BaggageCabinClass, BaggageFeeEstimate } from '@/lib/baggage/types'

export type BaggageFeeEstimatorProps = {
  carrierCode: string
  originCountry: string
  destinationCountry: string
  cabinClass: BaggageCabinClass
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

function confidenceCopy(confidence: BaggageFeeEstimate['confidence']): string {
  if (confidence === 'high') return 'High confidence for this carrier and route.'
  if (confidence === 'medium') return 'Medium confidence for this international route.'
  return 'Low confidence fallback estimate.'
}

function CountControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1 block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600">
        {label}
      </label>
      <div className="flex h-10 items-center gap-2 rounded-[0.875rem] border border-white/8 bg-white/[0.03] px-2">
        <button
          type="button"
          className="btn-pill !h-7 !w-7 !justify-center !p-0"
          aria-label={`Decrease ${label}`}
          disabled={value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          -
        </button>
        <span className="min-w-5 flex-1 text-center font-display text-sm font-extrabold tabular-nums text-gray-100">
          {value}
        </span>
        <button
          type="button"
          className="btn-pill !h-7 !w-7 !justify-center !p-0"
          aria-label={`Increase ${label}`}
          disabled={value >= 4}
          onClick={() => onChange(Math.min(4, value + 1))}
        >
          +
        </button>
      </div>
    </div>
  )
}

export function BaggageFeeEstimator(props: BaggageFeeEstimatorProps): JSX.Element {
  const [carryOnBags, setCarryOnBags] = useState(1)
  const [checkedBags, setCheckedBags] = useState(0)
  const [estimate, setEstimate] = useState<BaggageFeeEstimate | null>(null)
  const [loading, setLoading] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  const query = useMemo(() => {
    const params = new URLSearchParams({
      carrierCode: props.carrierCode,
      originCountry: props.originCountry,
      destinationCountry: props.destinationCountry,
      cabinClass: props.cabinClass,
      checkedBags: String(checkedBags),
      carryOnBags: String(carryOnBags),
    })

    return params.toString()
  }, [carryOnBags, checkedBags, props])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setUnavailable(false)

    fetch(`/api/baggage?${query}`, { signal: controller.signal })
      .then(response => response.ok ? response.json() as Promise<BaggageFeeEstimate> : Promise.reject())
      .then(data => setEstimate(data))
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setEstimate(null)
        setUnavailable(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [query])

  return (
    <section className="card mb-4 overflow-hidden rounded-2xl p-4 animate-fade-in" aria-label="Baggage fee estimator">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="font-display truncate text-sm font-extrabold text-gray-100">
              Baggage estimate
            </p>
            {loading && (
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-indigo-300">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 dot-pulse" />
                Updating
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-gray-600">
            {props.carrierCode.toUpperCase()} · {props.cabinClass.replace('_', ' ').toLowerCase()}
          </p>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:w-64">
          <CountControl label="Carry-on" value={carryOnBags} onChange={setCarryOnBags} />
          <CountControl label="Checked" value={checkedBags} onChange={setCheckedBags} />
        </div>
      </div>

      {unavailable ? (
        <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
          <p className="text-xs font-semibold text-gray-400">Baggage estimate unavailable right now.</p>
        </div>
      ) : loading && !estimate ? (
        <div className="mt-3 space-y-2">
          <div className="h-4 w-3/4 rounded shimmer" />
          <div className="h-4 w-1/2 rounded shimmer" />
        </div>
      ) : estimate ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold text-gray-400">
                Included: {estimate.includedCarryOnBags} carry-on, {estimate.includedCheckedBags} checked
              </p>
              <p className="text-[11px] text-gray-600">
                {confidenceCopy(estimate.confidence)}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600">Paid baggage</p>
              <p className="font-display text-2xl font-extrabold text-white tabular-nums" data-testid="baggage-total">
                {usd.format(estimate.estimatedTotalUsd)}
              </p>
            </div>
          </div>

          {estimate.lines.length > 0 && (
            <div className="grid gap-1.5">
              {estimate.lines.map((line, index) => (
                <div
                  key={`${line.kind}-${line.label}-${index}`}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-white/[0.025] px-2.5 py-1.5"
                >
                  <span className="min-w-0 truncate text-[11px] font-medium text-gray-400">
                    {line.label}
                  </span>
                  <span className="shrink-0 text-[11px] font-bold text-gray-300">
                    {line.included ? 'Included' : usd.format(line.totalUsd)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] leading-4 text-gray-700">{estimate.disclaimer}</p>
        </div>
      ) : null}
    </section>
  )
}
