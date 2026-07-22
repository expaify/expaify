'use client'

import { useRef, useState } from 'react'
import {
  formatDateRange,
  formatDealCount,
  formatFilterValue,
  type HotelFilterKey,
  type HotelFilterState,
  type HotelRecoveryOption,
} from './hotelFilterRecovery'

const REVIEW_ORDER: HotelFilterKey[] = [
  'city',
  'minDiscount',
  'minStars',
  'maxPrice',
  'dateFrom',
  'dateTo',
]

const FILTER_NAMES: Record<HotelFilterKey, string> = {
  city: 'Destination',
  minDiscount: 'Minimum discount',
  minStars: 'Hotel class',
  maxPrice: 'Maximum nightly price',
  dateFrom: 'Earliest date',
  dateTo: 'Latest date',
}

function optionLabel(option: HotelRecoveryOption, filters: HotelFilterState): string {
  return `Remove ${formatFilterValue(option.filterKey, filters)} · See ${formatDealCount(option.resultingTotal)}`
}

function preservedContext(filters: HotelFilterState): string {
  const dateRange = formatDateRange(filters.dateFrom, filters.dateTo)
  if (filters.city && dateRange) return `Stays the same: ${filters.city} · ${dateRange}.`
  if (filters.city) return `Stays the same: ${filters.city}.`
  if (dateRange) return `Stays the same: ${dateRange}.`
  return 'Your other filters stay the same.'
}

function expandedRemoveLabel(
  key: HotelFilterKey,
  filters: HotelFilterState,
  option?: HotelRecoveryOption,
): string {
  const visibleValue = formatFilterValue(key, filters)
  const kept = preservedContext(filters).replace(/^Stays the same: /, '').replace(/\.$/, '')
  const readableValue = key === 'minStars' ? visibleValue.replace('★', ' stars') : visibleValue
  const result = option ? `; show ${formatDealCount(option.resultingTotal)}` : ''
  return `Remove ${readableValue}; keep ${kept}${result}`
}

export function HotelResultStatus({
  statusRef,
  message,
  undoLabel,
  undoPending,
  undoError,
  onUndo,
}: {
  statusRef: React.RefObject<HTMLDivElement | null>
  message: string
  undoLabel?: 'Undo filter change' | 'Undo filter reset'
  undoPending?: boolean
  undoError?: boolean
  onUndo?: () => void
}) {
  if (!message && !undoLabel && !undoError) return null
  return (
    <div className="mb-4">
      <div className="flex min-w-0 flex-col gap-2 text-[13px] leading-5 text-[color:var(--text-2)] sm:flex-row sm:items-center sm:justify-between">
        <div ref={statusRef} tabIndex={-1} role="status" aria-live="polite" aria-atomic="true" className="focus:outline-none">
          {message}
        </div>
        {undoLabel && onUndo ? (
          <button
            type="button"
            disabled={undoPending}
            onClick={onUndo}
            className="min-h-11 self-start px-1 font-medium text-[color:var(--brand)] underline-offset-4 hover:underline disabled:cursor-wait disabled:opacity-60 sm:self-auto"
          >
            {undoPending ? 'Restoring filters…' : undoLabel}
          </button>
        ) : null}
      </div>
      {undoError ? (
        <p role="alert" className="mt-2 text-[13px] font-medium leading-5 text-[color:var(--error)]">
          We couldn&apos;t restore your previous filters. Try again.
        </p>
      ) : null}
    </div>
  )
}

export function HotelFilterRecoveryPanel({
  filters,
  defaultCity,
  options,
  promotedOption,
  pendingKey,
  onRemove,
  onReset,
}: {
  filters: HotelFilterState
  defaultCity?: string
  options: HotelRecoveryOption[]
  promotedOption: HotelRecoveryOption | null
  pendingKey: HotelFilterKey | 'reset' | null
  onRemove: (key: HotelFilterKey, source: 'promoted' | 'review_filters') => void
  onReset: () => void
}) {
  const [disclosure, setDisclosure] = useState<'review' | 'reset' | null>(null)
  const reviewButtonRef = useRef<HTMLButtonElement>(null)
  const resetButtonRef = useRef<HTMLButtonElement>(null)
  const optionByKey = new Map(options.map(option => [option.filterKey, option]))
  const activeKeys = REVIEW_ORDER.filter(key => {
    if (key === 'city') return !defaultCity && Boolean(filters.city)
    if (key === 'minDiscount') return filters.minDiscount !== 20
    if (key === 'minStars') return filters.minStars > 0
    if (key === 'maxPrice') return filters.maxPriceCents !== null
    if (key === 'dateFrom') return Boolean(filters.dateFrom)
    return Boolean(filters.dateTo)
  })

  function handleDisclosureEscape(event: React.KeyboardEvent, kind: 'review' | 'reset') {
    if (event.key !== 'Escape') return
    event.preventDefault()
    setDisclosure(null)
    window.setTimeout(() => (kind === 'review' ? reviewButtonRef.current : resetButtonRef.current)?.focus(), 0)
  }

  return (
    <section
      aria-labelledby="hotel-recovery-title"
      className="mx-auto w-full min-w-0 max-w-[640px] rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-5 py-8 text-left sm:px-8 sm:py-10"
    >
      <h3 id="hotel-recovery-title" className="text-h3 text-[color:var(--text-1)]">
        No current deals match these filters
      </h3>
      <p className="mt-2 text-[14px] leading-6 text-[color:var(--text-2)]">
        {promotedOption
          ? 'Try one filter change while keeping the rest of your search.'
          : 'Review one filter at a time. Your other filters will stay the same.'}
      </p>
      <p className="mt-3 text-[13px] font-medium leading-5 text-[color:var(--text-1)]">
        {preservedContext(filters)}
      </p>

      <div className="mt-6 flex flex-col items-stretch gap-3 sm:items-start">
        {promotedOption ? (
          <button
            type="button"
            disabled={pendingKey !== null}
            aria-label={expandedRemoveLabel(promotedOption.filterKey, filters, promotedOption)}
            onClick={() => onRemove(promotedOption.filterKey, 'promoted')}
            className="btn btn-primary min-h-11 w-full whitespace-normal break-words text-center sm:w-auto"
          >
            {pendingKey === promotedOption.filterKey ? 'Updating deals…' : optionLabel(promotedOption, filters)}
          </button>
        ) : null}
        <button
          ref={reviewButtonRef}
          type="button"
          aria-expanded={disclosure === 'review'}
          aria-controls="hotel-filter-review"
          onClick={() => setDisclosure(current => current === 'review' ? null : 'review')}
          className="btn btn-outline min-h-11 w-full sm:w-auto"
        >
          Review filters
        </button>
        {disclosure === 'review' ? (
          <div id="hotel-filter-review" onKeyDown={event => handleDisclosureEscape(event, 'review')} className="mt-2 w-full border-t border-[color:var(--border)] pt-5">
            <ul className="grid gap-3">
              {activeKeys.map(key => {
                const option = optionByKey.get(key)
                const value = formatFilterValue(key, filters)
                return (
                  <li key={key} className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-base)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium leading-5 text-[color:var(--text-1)]">
                        {FILTER_NAMES[key]}: <span className="break-words">{value}</span>
                      </p>
                      {option ? (
                        <p className="mt-0.5 text-[12px] leading-5 text-[color:var(--text-2)]">
                          See {formatDealCount(option.resultingTotal)}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={pendingKey !== null}
                      aria-label={expandedRemoveLabel(key, filters, option)}
                      onClick={() => onRemove(key, 'review_filters')}
                      className="btn btn-outline min-h-11 w-full whitespace-normal break-words sm:w-auto"
                    >
                      {pendingKey === key ? 'Updating deals…' : `Remove ${value}`}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
        <button
          ref={resetButtonRef}
          type="button"
          aria-expanded={disclosure === 'reset'}
          aria-controls="hotel-filter-reset-confirmation"
          onClick={() => setDisclosure(current => current === 'reset' ? null : 'reset')}
          className="min-h-11 self-start px-1 text-[13px] font-medium text-[color:var(--brand)] underline-offset-4 hover:underline"
        >
          Reset feed filters
        </button>
        {disclosure === 'reset' ? (
          <div
            id="hotel-filter-reset-confirmation"
            onKeyDown={event => handleDisclosureEscape(event, 'reset')}
            className="w-full rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-base)] px-4 py-4"
          >
            <p className="text-[13px] leading-5 text-[color:var(--text-1)]">
              {defaultCity
                ? `Reset to 20%+ off, any hotel class, any price, and any dates? ${defaultCity} will stay selected.`
                : 'Reset to all destinations, 20%+ off, any hotel class, any price, and any dates?'}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button type="button" disabled={pendingKey !== null} onClick={onReset} className="btn btn-primary min-h-11 w-full sm:w-auto">
                {pendingKey === 'reset' ? 'Updating deals…' : 'Reset filters'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDisclosure(null)
                  window.setTimeout(() => resetButtonRef.current?.focus(), 0)
                }}
                className="btn btn-outline min-h-11 w-full sm:w-auto"
              >
                Keep my filters
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function HotelShortListHelper({
  filters,
  option,
  pending,
  onRemove,
}: {
  filters: HotelFilterState
  option: HotelRecoveryOption
  pending: boolean
  onRemove: () => void
}) {
  return (
    <aside className="mb-6 flex min-w-0 flex-col gap-3 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0 text-[13px] leading-5 text-[color:var(--text-2)]">
        Want more choices? Change one filter and keep the rest of your search.
      </p>
      <button
        type="button"
        disabled={pending}
        aria-label={expandedRemoveLabel(option.filterKey, filters, option)}
        onClick={onRemove}
        className="btn btn-outline min-h-11 w-full whitespace-normal break-words sm:w-auto"
      >
        {pending ? 'Updating deals…' : optionLabel(option, filters)}
      </button>
    </aside>
  )
}
