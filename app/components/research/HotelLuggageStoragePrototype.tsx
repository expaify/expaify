'use client'

import { useRef, useState } from 'react'
import type {
  PrototypeLuggageStorageEvidence,
  StorageCharge,
  StoragePeriodState,
} from './hotelLuggageStorageFixtures'

type Props = {
  evidence: PrototypeLuggageStorageEvidence
  hotelId: string
  surface: 'detail' | 'handoff'
}

const PROPERTY_BOUNDARY = 'Property-reported information; it does not guarantee storage for your stay, arrival time, departure time, or bags.'
const VERIFY_BOUNDARY = 'Confirm current timing, conditions, and charges with the property or booking provider before booking.'
const RESEARCH_LABEL = 'Research prototype — luggage storage is not part of hotel ranking or Deal Score.'

function periodCopy(state: StoragePeriodState, notReturned: boolean): string {
  if (notReturned) return 'Not provided.'
  if (state === 'reported_available') return 'Reported available by the property.'
  if (state === 'explicitly_unavailable') return 'Reported unavailable by the property.'
  if (state === 'conflicting') return 'Conflicting information returned.'
  return 'Not specified by this provider.'
}

function formatCharge(charge: StorageCharge, serviceUnavailable: boolean, notReturned: boolean): string {
  if (serviceUnavailable) return 'Not applicable because the property reports no luggage storage.'
  if (notReturned) return 'Not provided.'
  if (charge.state === 'included') return 'No storage charge reported by the property.'
  if (charge.state === 'unknown') return 'Not specified by this provider.'

  const basis = charge.basis && ({
    per_bag: 'per bag', per_hour: 'per hour', per_day: 'per day', per_stay: 'per stay', other: 'under another basis',
  } as const)[charge.basis]
  const amount = charge.amount
  const currencySupported = amount
    ? Intl.supportedValuesOf('currency').includes(amount.currency)
    : false
  let validAmount: string | null = null
  if (amount && Number.isInteger(amount.priceCents) && amount.priceCents >= 0 && currencySupported) {
    try {
      validAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: amount.currency,
      }).format(amount.priceCents / 100)
    } catch {
      // Unsupported ISO-like currency codes remain paid evidence, but must not
      // be rendered as a trustworthy amount.
    }
  }
  if (validAmount && basis) return `A charge of ${validAmount} ${basis} is reported.`
  if (validAmount) return `A charge of ${validAmount} is reported; the basis was not provided.`
  if (basis) return `A storage charge ${basis} is reported; the amount was not provided.`
  return 'A storage charge is reported; the amount and basis were not provided.'
}

function getPresentation(evidence: PrototypeLuggageStorageEvidence) {
  if (evidence.state === 'error') return {
    tone: 'error', heading: 'Luggage-storage details could not be checked',
    body: 'We couldn’t retrieve property-reported storage information. This does not mean storage is unavailable.',
    guidance: VERIFY_BOUNDARY,
  }
  if (evidence.serviceState === 'conflicting' || evidence.beforeCheckin === 'conflicting' || evidence.afterCheckout === 'conflicting') return {
    tone: 'error', heading: 'Storage details conflict — verify before booking',
    body: 'The available property information does not agree. We are not choosing one statement as current.',
    guidance: 'Contact the property or check the booking provider before relying on storage.',
  }
  if (evidence.serviceState === 'not_returned') return {
    tone: 'empty', heading: 'Luggage-storage details were not provided',
    body: 'This provider did not return property information about luggage storage.',
    guidance: 'This does not mean storage is unavailable. Verify with the property or booking provider before relying on it.',
  }
  if (evidence.serviceState === 'explicitly_unavailable') return {
    tone: 'warning', heading: 'The property reports no luggage storage',
    body: 'The provider returned an explicit property statement that luggage storage is unavailable.',
    guidance: 'If storage is required, choose another hotel or verify that the policy has changed.',
  }
  if (evidence.beforeCheckin === 'explicitly_unavailable' || evidence.afterCheckout === 'explicitly_unavailable') return {
    tone: 'warning', heading: 'Storage is not reported for every timing period',
    body: 'The property reports different luggage-storage availability before check-in and after checkout.',
    guidance: 'If storage is required, choose another hotel or verify that the policy has changed.',
  }
  const partial = evidence.beforeCheckin === 'not_specified' || evidence.afterCheckout === 'not_specified' || evidence.charge.state === 'unknown'
  if (partial) return {
    tone: 'warning', heading: 'Some storage details are not specified',
    body: 'The property reports luggage storage, but the provider did not return every timing or charge detail.',
    guidance: 'Verify the missing details before relying on storage.',
  }
  return {
    tone: 'complete', heading: 'Storage is reported for both timing periods',
    body: 'The property reports luggage storage before check-in and after checkout.', guidance: '',
  }
}

function toneClasses(tone: string): string {
  if (tone === 'warning') return 'border-[color:var(--gold)] bg-[color:var(--warning-soft)]'
  if (tone === 'error') return 'border-[color:var(--error)] bg-[color:var(--error-soft)]'
  if (tone === 'empty') return 'border-[color:var(--border)] bg-[color:var(--bg-muted)]'
  return 'border-[color:var(--border-strong)] bg-[color:var(--bg-surface)]'
}

export function HotelLuggageStoragePrototype({ evidence, hotelId, surface }: Props) {
  const [retrying, setRetrying] = useState(false)
  const [retryFailed, setRetryFailed] = useState(false)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const titleId = `${hotelId}-${surface}-luggage-storage`
  const Heading = surface === 'handoff' ? 'h3' : 'h4'
  const loading = evidence.state === 'loading' || retrying
  const presentation = getPresentation(evidence)
  const notReturned = evidence.serviceState === 'not_returned'
  const serviceUnavailable = evidence.serviceState === 'explicitly_unavailable'
  const conflicting = evidence.serviceState === 'conflicting'
    || evidence.beforeCheckin === 'conflicting'
    || evidence.afterCheckout === 'conflicting'
  const partial = evidence.state === 'ready'
    && !conflicting
    && !notReturned
    && !serviceUnavailable
    && evidence.beforeCheckin !== 'explicitly_unavailable'
    && evidence.afterCheckout !== 'explicitly_unavailable'
    && (evidence.beforeCheckin === 'not_specified'
      || evidence.afterCheckout === 'not_specified'
      || evidence.charge.state === 'unknown')
  const showMissingSupplemental = evidence.state === 'ready' && (partial || conflicting || notReturned)

  const retry = () => {
    setRetryFailed(false)
    setRetrying(true)
    window.setTimeout(() => {
      setRetrying(false)
      setRetryFailed(true)
      window.requestAnimationFrame(() => statusRef.current?.focus())
    }, 500)
  }

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={loading || undefined}
      className={`min-w-0 rounded-[var(--radius-control)] border px-3.5 py-3 sm:px-4 sm:py-4 ${loading ? 'border-[color:var(--border)] bg-[color:var(--bg-surface)]' : toneClasses(presentation.tone)}`}
    >
      <Heading id={titleId} className="text-sm font-medium leading-5 text-[color:var(--text-1)]">Luggage storage</Heading>
      {surface === 'handoff' ? <p className="mt-2 text-caption leading-5 text-[color:var(--text-3)]">Same property-reported information shown in hotel details.</p> : null}

      {loading ? (
        <div role="status" aria-live="polite" aria-atomic="true">
          <p className="mt-2 text-sm font-medium leading-5 text-[color:var(--text-1)]">Checking luggage-storage details</p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">We’re checking property-reported timing and charge information.</p>
          <span className="sr-only">Checking luggage-storage details.</span>
          <div aria-hidden="true" className="mt-3 space-y-2">
            <div className="skeleton h-3 w-full rounded-[var(--radius-pill)]" />
            <div className="skeleton h-3 w-4/5 rounded-[var(--radius-pill)]" />
            <div className="skeleton h-3 w-2/3 rounded-[var(--radius-pill)]" />
          </div>
          {retrying ? <button type="button" className="btn btn-outline btn-sm mt-3 w-full sm:w-auto" disabled aria-disabled="true">Checking storage…</button> : null}
        </div>
      ) : (
        <>
          <p
            ref={evidence.state === 'error' ? statusRef : undefined}
            tabIndex={evidence.state === 'error' ? -1 : undefined}
            role={evidence.state === 'error' ? (retryFailed ? 'alert' : 'status') : undefined}
            className="mt-2 text-sm font-medium leading-5 text-[color:var(--text-1)]"
          >
            {retryFailed ? 'Storage details still could not be checked.' : presentation.heading}
          </p>
          <p className={`mt-1 text-sm leading-6 ${presentation.tone === 'error' ? 'text-[color:var(--error-text)]' : 'text-[color:var(--text-2)]'}`}>{presentation.body}</p>

          {evidence.state !== 'error' ? (
            <dl className="mt-3 grid grid-cols-1 gap-3 text-sm leading-6 sm:grid-cols-2 sm:gap-x-6">
              <div className="min-w-0"><dt className="font-medium text-[color:var(--text-1)]">Before check-in</dt><dd className="break-words text-[color:var(--text-2)]">{periodCopy(evidence.beforeCheckin, notReturned)}</dd></div>
              <div className="min-w-0"><dt className="font-medium text-[color:var(--text-1)]">After checkout</dt><dd className="break-words text-[color:var(--text-2)]">{periodCopy(evidence.afterCheckout, notReturned)}</dd></div>
              <div className="min-w-0 sm:col-span-2"><dt className="font-medium text-[color:var(--text-1)]">Charge</dt><dd className="break-words text-[color:var(--text-2)]">{formatCharge(evidence.charge, serviceUnavailable, notReturned)}</dd></div>
            </dl>
          ) : null}

          {evidence.schedule ? <p className="mt-3 break-words border-t border-[color:var(--border)] pt-3 text-sm leading-6 text-[color:var(--text-2)]"><span className="font-medium text-[color:var(--text-1)]">Reported hours: </span>{evidence.schedule.providerWording}</p> : showMissingSupplemental ? <p className="mt-3 break-words border-t border-[color:var(--border)] pt-3 text-sm leading-6 text-[color:var(--text-2)]"><span className="font-medium text-[color:var(--text-1)]">Reported hours: </span>Not specified by this provider.</p> : null}
          {evidence.conditions.length ? <div className="mt-3"><p className="text-sm font-medium text-[color:var(--text-1)]">Reported conditions</p><ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-[color:var(--text-2)]">{evidence.conditions.slice(0, 3).map(condition => <li key={condition.id} className="break-words">{condition.providerWording}</li>)}</ul>{evidence.conditions.length > 3 ? <p className="mt-1 text-sm text-[color:var(--text-2)]">Additional conditions may apply; verify before booking.</p> : null}</div> : showMissingSupplemental ? <p className="mt-3 text-sm leading-6 text-[color:var(--text-2)]"><span className="font-medium text-[color:var(--text-1)]">Reported conditions: </span>Not specified by this provider.</p> : null}
          {evidence.conflicts?.length ? <div className="mt-3"><p className="text-sm font-medium text-[color:var(--text-1)]">Conflicting statements</p><ul className="mt-1 space-y-2 text-sm leading-6 text-[color:var(--text-2)]">{evidence.conflicts.map(item => <li key={item.sourceLabel} className="break-words"><span className="font-medium">{item.sourceLabel}:</span> “{item.statement}”</li>)}</ul></div> : null}
          {presentation.guidance ? <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--text-2)]">{presentation.guidance}</p> : null}
          {evidence.state === 'error' ? <button type="button" className="btn btn-outline btn-sm mt-3 w-full sm:w-auto" onClick={retry}>Try storage check again</button> : null}
        </>
      )}

      <div className="mt-3 border-t border-[color:var(--border)] pt-3 text-caption leading-5 text-[color:var(--text-3)]">
        {evidence.state === 'ready' ? <p className="break-words">Source: {evidence.source.label}. {evidence.source.observedAt ? `Observed ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(evidence.source.observedAt))}.` : 'Observation date not provided.'}</p> : null}
        <p className="mt-1">{PROPERTY_BOUNDARY}</p>
        <p className="mt-1">{VERIFY_BOUNDARY}</p>
        <p className="mt-2 font-medium">{RESEARCH_LABEL}</p>
        <p className="mt-1">Evidence revision: {evidence.evidenceRevision}</p>
      </div>
    </section>
  )
}
