'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { HousekeepingFixture, HousekeepingPresentation } from './hotelHousekeepingFixtures'
import { createHousekeepingFixture, resolveHousekeepingPresentation } from './hotelHousekeepingFixtures'

export type HousekeepingSurface = 'saved_detail' | 'saved_handoff' | 'offer_detail' | 'review_handoff'
export type HousekeepingVariant = 'summary_first' | 'wording_first'

function formattedDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(value))
}

function ProviderWording({ presentation, regionId, onEscape }: { presentation: HousekeepingPresentation; regionId: string; onEscape: () => void }) {
  return (
    <div id={regionId} onKeyDown={event => { if (event.key === 'Escape') onEscape() }} className="mt-2 border-t border-[color:var(--border)] pt-3 text-xs leading-5 text-[color:var(--text-2)]">
      <h4 className="font-medium text-[color:var(--text-1)]">{presentation.state === 'conflicting' ? 'Provider statements' : 'Provider wording'}</h4>
      <div className="mt-2 space-y-3">
        {presentation.statements.map(item => (
          <div key={item.id} className="break-words [overflow-wrap:anywhere]">
            {item.label ? <p className="font-medium text-[color:var(--text-1)]">{item.label}</p> : null}
            <p>Provider statement: “{item.sourceText}”</p>
            <p>{item.sourceLabel} · {formattedDate(item.fetchedAt)}</p>
            {item.id === 'f9-property' ? <p className="mt-1">The room policy is more specific to this selection. Verify both statements with the provider.</p> : null}
          </div>
        ))}
      </div>
      {presentation.state === 'conflicting' ? <p className="mt-3">We did not choose one statement over the other.</p> : null}
    </div>
  )
}

function DimensionRows({ presentation, compact }: { presentation: HousekeepingPresentation; compact: boolean }) {
  return (
    <dl className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      {(['towels', 'bedLinen'] as const).map(key => (
        <div key={key} className={compact ? 'min-w-0' : 'min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-3'}>
          <dt className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">{key === 'towels' ? 'Towels' : 'Bed linen'}</dt>
          <dd className="mt-1 break-words text-sm font-medium leading-6 text-[color:var(--text-1)]">{presentation[key]}</dd>
        </div>
      ))}
    </dl>
  )
}

export function HotelHousekeepingPolicyPanel({ fixture, surface, variant, retryOutcome = 'success' }: {
  fixture: HousekeepingFixture
  surface: HousekeepingSurface
  variant: HousekeepingVariant
  retryOutcome?: 'success' | 'failure'
}) {
  const [current, setCurrent] = useState(fixture)
  const [open, setOpen] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [retryMessage, setRetryMessage] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const stableId = useId().replaceAll(':', '')
  const compact = surface === 'saved_handoff' || surface === 'review_handoff'
  const presentation = resolveHousekeepingPresentation(current)
  const titleId = `housekeeping-${stableId}-title`
  const regionId = `housekeeping-${stableId}-wording`

  useEffect(() => { setCurrent(fixture); setOpen(false); setRetrying(false); setRetryMessage('') }, [fixture])

  const isLoading = presentation.state === 'loading' || retrying
  const wording = open ? <ProviderWording presentation={presentation} regionId={regionId} onEscape={() => { setOpen(false); triggerRef.current?.focus() }} /> : null
  const tone = isLoading ? 'border-[color:var(--border)] bg-[color:var(--bg-raised)]' : presentation.state === 'error' ? 'border-[color:var(--border-strong)] bg-[color:var(--error-soft)]' : ['ambiguous', 'conflicting'].includes(presentation.state) ? 'border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]' : 'border-[color:var(--border)] bg-[color:var(--bg-raised)]'

  return (
    <section aria-labelledby={titleId} aria-busy={isLoading || undefined} data-evidence-revision={presentation.evidenceRevision} data-surface={surface} className={`min-w-0 rounded-[var(--radius-control)] border p-4 ${compact ? '' : 'sm:p-5'} ${tone}`}>
      <h3 id={titleId} className="text-sm font-medium leading-6 text-[color:var(--text-1)]">Room cleaning during your stay</h3>
      {variant === 'wording_first' && wording}
      <div role={isLoading || retryMessage ? 'status' : undefined} aria-live={isLoading || retryMessage ? 'polite' : undefined} aria-atomic={isLoading || retryMessage ? 'true' : undefined}>
        <p className={`mt-2 text-sm font-medium leading-6 ${presentation.state === 'error' ? 'text-[color:var(--error-text)]' : 'text-[color:var(--text-1)]'}`}>{isLoading ? 'Checking room-cleaning policy' : presentation.primary}</p>
        <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">{isLoading ? 'We’re checking the provider for the cleaning, towel, and bed-linen schedules.' : presentation.supporting}</p>
        {retryMessage ? <p className="mt-1 text-sm leading-6 text-[color:var(--error-text)]">{retryMessage}</p> : null}
      </div>
      {isLoading ? (
        <div aria-hidden="true" className="mt-4 space-y-2">
          <div className="h-4 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] motion-safe:animate-pulse" />
          <div className="h-4 w-5/6 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] motion-safe:animate-pulse" />
          <div className="h-4 w-2/3 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] motion-safe:animate-pulse" />
        </div>
      ) : (
        <>
          {presentation.action ? <p className="mt-1 break-words text-sm leading-6 text-[color:var(--text-2)] [overflow-wrap:anywhere]">{presentation.action}</p> : null}
          <DimensionRows presentation={presentation} compact={compact} />
          {presentation.evidence ? <p className="mt-3 break-words text-xs leading-5 text-[color:var(--text-2)] [overflow-wrap:anywhere]">{presentation.evidence}</p> : null}
          <p className="mt-3 text-xs leading-5 text-[color:var(--text-2)]">{presentation.verification}</p>
          {presentation.canDisclose ? (
            <button ref={triggerRef} type="button" aria-expanded={open} aria-controls={regionId} onClick={() => setOpen(value => !value)} className="mt-2 inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-1 text-sm font-medium text-[color:var(--brand)]">
              {open ? 'Hide provider wording' : 'Show provider wording'}
            </button>
          ) : null}
          {variant === 'summary_first' ? wording : null}
        </>
      )}
      {presentation.state === 'error' ? (
        <button type="button" disabled={retrying} aria-busy={retrying || undefined} onClick={() => {
          if (retrying) return
          setRetrying(true); setRetryMessage('')
          window.setTimeout(() => {
            if (retryOutcome === 'success') setCurrent(createHousekeepingFixture('F1'))
            else setRetryMessage('We still could not check the housekeeping schedule.')
            setRetrying(false)
          }, 500)
        }} className="btn btn-outline mt-3 w-full sm:w-auto">{retrying ? 'Checking again…' : 'Try again'}</button>
      ) : null}
    </section>
  )
}
