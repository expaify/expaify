'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { track } from '@/lib/analytics'
import {
  formatHotelCriteriaDates,
  hotelCriteriaDestination,
  hotelCriteriaDraftChanged,
  hotelCriteriaToDraft,
  isValidHotelDate,
  type HotelCriteriaDraft,
  type HotelSearchCriteriaV1,
} from '@/lib/hotels/searchCriteria'

export type HotelCriteriaSurface = 'results' | 'detail' | 'handoff'
export type HotelCriteriaEntryPoint = 'summary' | 'empty_state' | 'mismatch'

type SummaryProps = {
  criteria: HotelSearchCriteriaV1
  surface: HotelCriteriaSurface
  status?: 'ready' | 'updating'
  onEdit?: () => void
  className?: string
}

export function HotelSearchCriteriaSummary({ criteria, surface, status = 'ready', onEdit, className = '' }: SummaryProps) {
  const headingId = useId()
  const viewedVersionsRef = useRef(new Set<string>())
  const destination = hotelCriteriaDestination(criteria)
  const dateDisplay = formatHotelCriteriaDates(criteria.dates)
  const accessibleSummary = `${destination}. ${dateDisplay}. Guests and rooms not captured.`

  useEffect(() => {
    const key = `${surface}:${criteria.criteriaVersion}`
    if (viewedVersionsRef.current.has(key)) return
    viewedVersionsRef.current.add(key)
    track('hotel_criteria_summary_viewed', {
      surface,
      criteria_version: criteria.criteriaVersion,
      destination_present: criteria.destination.state === 'selected',
      date_state: criteria.dates.semantic,
      occupancy_state: criteria.occupancy.state,
      room_state: criteria.occupancy.state,
      criteria_source: criteria.source,
    })
  }, [criteria, surface])

  const handoff = surface === 'handoff'
  return (
    <section
      aria-labelledby={headingId}
      className={`${handoff ? 'rounded-[var(--radius-control)] border border-[color:var(--gold)] bg-[color:var(--warning-soft)] p-4' : 'rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-5'} ${className}`}
    >
      <div className="flex flex-col items-start gap-3 min-[420px]:flex-row min-[420px]:justify-between">
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--text-3)]">
            {handoff ? 'Before you continue' : 'Your search'}
          </h2>
          <p className="sr-only">{accessibleSummary}</p>
          <p
            aria-hidden="true"
            className="mt-1 text-[15px] font-semibold leading-6 text-[color:var(--text-1)] sm:text-[16px]"
          >
            {destination} <span aria-hidden="true">·</span> {dateDisplay}
          </p>
          <p aria-hidden="true" className="mt-1 text-[13px] font-semibold leading-5 text-[color:var(--text-1)]">Guests &amp; rooms not captured</p>
          <p className="mt-1 text-[12px] leading-5 text-[color:var(--text-2)]">
            Confirm the price and room fit for your party with the provider.
          </p>
          {status === 'updating' ? (
            <p role="status" aria-live="polite" aria-atomic="true" className="mt-2 text-[12px] font-medium text-[color:var(--brand)]">Updating results…</p>
          ) : null}
        </div>
        {onEdit && !handoff ? (
          <button type="button" onClick={onEdit} disabled={status === 'updating'} aria-label="Edit hotel search" className="btn btn-outline min-h-11 shrink-0 px-4">
            Edit
          </button>
        ) : null}
      </div>
    </section>
  )
}

type EditorProps = {
  open: boolean
  criteria: HotelSearchCriteriaV1
  cities: readonly string[]
  surface: Exclude<HotelCriteriaSurface, 'handoff'>
  entryPoint?: HotelCriteriaEntryPoint
  submitting?: boolean
  initialDraft?: HotelCriteriaDraft
  onClose: () => void
  onSubmit: (draft: HotelCriteriaDraft) => void
}

export function HotelSearchCriteriaEditor({ open, criteria, cities, surface, entryPoint = 'summary', submitting = false, initialDraft, onClose, onSubmit }: EditorProps) {
  const titleId = useId()
  const descriptionId = useId()
  const destinationErrorId = useId()
  const fromErrorId = useId()
  const throughErrorId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const destinationRef = useRef<HTMLSelectElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const [draft, setDraft] = useState(() => initialDraft ?? hotelCriteriaToDraft(criteria))
  const [attempted, setAttempted] = useState(false)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!open) {
      startedRef.current = false
      return
    }
    if (!startedRef.current) {
      startedRef.current = true
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      track('hotel_criteria_edit_started', {
        surface,
        criteria_version: criteria.criteriaVersion,
        entry_point: entryPoint,
      })
    }
    window.requestAnimationFrame(() => destinationRef.current?.focus())
  }, [criteria.criteriaVersion, entryPoint, open, surface])

  const validation = useMemo(() => {
    const destinationInvalid = draft.city !== '' && !cities.includes(draft.city)
    const fromInvalid = !isValidHotelDate(draft.dateFrom)
    const throughInvalid = !isValidHotelDate(draft.dateTo)
    const orderInvalid = !fromInvalid && !throughInvalid && Boolean(draft.dateFrom && draft.dateTo && draft.dateTo < draft.dateFrom)
    return { destinationInvalid, fromInvalid, throughInvalid, orderInvalid }
  }, [cities, draft])
  const changed = hotelCriteriaDraftChanged(criteria, draft)
  const valid = !Object.values(validation).some(Boolean)

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) {
        event.preventDefault()
        closeEditor()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled])') ?? [])
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  })

  function closeEditor() {
    if (submitting) return
    track('hotel_criteria_edit_cancelled', {
      surface,
      criteria_version: criteria.criteriaVersion,
      entry_point: entryPoint,
      draft_changed: changed,
    })
    onClose()
    window.requestAnimationFrame(() => returnFocusRef.current?.focus())
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setAttempted(true)
    if (!valid || !changed || submitting) return
    onSubmit(draft)
  }

  if (!open) return null
  const orderMessage = validation.orderInvalid ? 'The end of the check-in window must be on or after the start.' : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-[color:color-mix(in_srgb,var(--text-1)_32%,transparent)] sm:items-center sm:p-6"
      onMouseDown={event => {
        if (event.target === event.currentTarget) closeEditor()
      }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-[var(--radius-card)] bg-[color:var(--bg-surface)] p-5 shadow-[var(--shadow-lift)] sm:max-h-[min(720px,calc(100dvh-3rem))] sm:max-w-[560px] sm:rounded-[var(--radius-card)] sm:p-6">
        <h2 id={titleId} className="text-h3 text-[color:var(--text-1)]">Edit hotel search</h2>
        <p id={descriptionId} className="mt-1 text-[13px] leading-5 text-[color:var(--text-2)]">Update the destination and check-in window used to find deals.</p>

        <form className="mt-5" onSubmit={submit} noValidate>
          <label htmlFor={`${titleId}-destination`} className="mb-1.5 block text-[12px] font-bold text-[color:var(--text-1)]">Destination</label>
          <select
            ref={destinationRef}
            id={`${titleId}-destination`}
            value={draft.city}
            onChange={event => setDraft(current => ({ ...current, city: event.target.value }))}
            aria-invalid={attempted && validation.destinationInvalid ? true : undefined}
            aria-describedby={attempted && validation.destinationInvalid ? destinationErrorId : undefined}
            className={`field-input ${attempted && validation.destinationInvalid ? 'border-[color:var(--error)]' : ''}`}
          >
            <option value="">All destinations</option>
            {cities.map(city => <option key={city} value={city}>{city}</option>)}
          </select>
          {attempted && validation.destinationInvalid ? <p id={destinationErrorId} role="alert" className="mt-1 text-[12px] font-medium text-[color:var(--error)]">Choose a supported destination or All destinations.</p> : null}

          <fieldset className="mt-5">
            <legend className="mb-2 text-[12px] font-bold text-[color:var(--text-1)]">Check-in window</legend>
            <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
              <div>
                <label htmlFor={`${titleId}-from`} className="mb-1.5 block text-[12px] font-bold text-[color:var(--text-1)]">From</label>
                <input id={`${titleId}-from`} type="date" value={draft.dateFrom} onChange={event => setDraft(current => ({ ...current, dateFrom: event.target.value }))} aria-invalid={attempted && (validation.fromInvalid || validation.orderInvalid) ? true : undefined} aria-describedby={attempted && (validation.fromInvalid || validation.orderInvalid) ? fromErrorId : undefined} className={`field-input ${attempted && (validation.fromInvalid || validation.orderInvalid) ? 'border-[color:var(--error)]' : ''}`} />
                {attempted && validation.fromInvalid ? <p id={fromErrorId} role="alert" className="mt-1 text-[12px] font-medium text-[color:var(--error)]">Enter a valid start for the check-in window.</p> : attempted && orderMessage ? <p id={fromErrorId} role="alert" className="mt-1 text-[12px] font-medium text-[color:var(--error)]">{orderMessage}</p> : null}
              </div>
              <div>
                <label htmlFor={`${titleId}-through`} className="mb-1.5 block text-[12px] font-bold text-[color:var(--text-1)]">Through</label>
                <input id={`${titleId}-through`} type="date" value={draft.dateTo} onChange={event => setDraft(current => ({ ...current, dateTo: event.target.value }))} aria-invalid={attempted && (validation.throughInvalid || validation.orderInvalid) ? true : undefined} aria-describedby={attempted && (validation.throughInvalid || validation.orderInvalid) ? throughErrorId : undefined} className={`field-input ${attempted && (validation.throughInvalid || validation.orderInvalid) ? 'border-[color:var(--error)]' : ''}`} />
                {attempted && validation.throughInvalid ? <p id={throughErrorId} role="alert" className="mt-1 text-[12px] font-medium text-[color:var(--error)]">Enter a valid end for the check-in window.</p> : attempted && orderMessage ? <p id={throughErrorId} role="alert" className="mt-1 text-[12px] font-medium text-[color:var(--error)]">{orderMessage}</p> : null}
              </div>
            </div>
            <p className="mt-1 text-[12px] leading-5 text-[color:var(--text-2)]">Deals may have different check-out dates and stay lengths.</p>
          </fieldset>

          <div className="mt-5 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-muted)] p-4">
            <p className="text-[12px] font-bold text-[color:var(--text-1)]">Guests &amp; rooms</p>
            <p className="mt-1 text-[14px] font-semibold text-[color:var(--text-1)]">Not captured</p>
            <p className="mt-1 text-[12px] leading-5 text-[color:var(--text-2)]">This version of expaify can&apos;t filter hotel deals by party size yet. Confirm the price and room fit with the provider.</p>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeEditor} disabled={submitting} className="btn btn-outline min-h-11 px-5">Cancel</button>
            <button type="submit" disabled={!valid || !changed || submitting} className="btn btn-primary min-h-11 px-5">{submitting ? 'Updating results…' : 'Update results'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function HotelCriteriaContextCard({ status, handoff = false }: { status: 'missing' | 'invalid'; handoff?: boolean }) {
  const invalid = status === 'invalid'
  return (
    <section className={`${handoff ? 'rounded-[var(--radius-control)] border border-[color:var(--gold)] bg-[color:var(--warning-soft)] p-4' : 'rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-5'}`}>
      <h2 className="text-[13px] font-bold text-[color:var(--text-1)]">{invalid ? 'Search criteria couldn\'t be restored' : 'Search criteria unavailable'}</h2>
      <p className="mt-1 text-[12px] leading-5 text-[color:var(--text-2)]">
        {invalid ? 'This search link is incomplete or no longer valid. Review this deal\'s dates before continuing.' : 'We can\'t verify which search opened this deal. Review the deal dates and confirm the price and room fit with the provider.'}
      </p>
      {!handoff ? <Link href="/deals" className="btn btn-outline mt-3 min-h-11 px-4">{invalid ? 'Start a new search' : 'Search hotel deals'}</Link> : null}
    </section>
  )
}

export function HotelCriteriaMismatchAlert({ onEdit, backHref }: { onEdit: () => void; backHref: string }) {
  return (
    <section role="alert" className="rounded-[var(--radius-control)] border border-[color:var(--error)] bg-[color:var(--error-soft)] p-4 text-[color:var(--text-1)]">
      <h2 className="text-[14px] font-bold">This deal doesn&apos;t match your search.</h2>
      <p className="mt-1 text-[13px] leading-5">Its destination or check-in date falls outside the criteria shown above.</p>
      <div className="mt-3 flex flex-col gap-2 min-[420px]:flex-row">
        <button type="button" onClick={onEdit} className="btn btn-primary min-h-11 px-5">Edit search</button>
        <Link href={backHref} className="btn btn-outline min-h-11 px-5">Back to matching results</Link>
      </div>
      <p className="mt-3 text-[12px] font-medium leading-5">Provider options are unavailable until you review the mismatch.</p>
    </section>
  )
}

export function HotelCriteriaSummarySkeleton() {
  return (
    <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-5" role="status">
      <span className="sr-only">Restoring your search…</span>
      <div aria-hidden="true" className="space-y-3">
        <div className="skeleton h-3 w-24 rounded-full" />
        <div className="skeleton h-5 w-3/4 rounded" />
        <div className="skeleton h-4 w-1/2 rounded" />
      </div>
    </section>
  )
}
