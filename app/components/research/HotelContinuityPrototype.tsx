'use client'

import { useEffect, useRef, useState } from 'react'
import { track } from '@/lib/analytics'
import type {
  ContinuityFixtureId,
  ContinuitySignal,
  EvidenceScope,
  PrototypeContinuityDisclosure,
  PrototypeContinuityFact,
  PrototypePropertyEvidenceState,
} from './hotelContinuityFixtures'

type Props = {
  dealId: string
  hotelName: string
  fixtureId: ContinuityFixtureId
  disclosure: PrototypeContinuityDisclosure | null
  initiallyExpanded: boolean
}

const DISCLAIMER = 'Research prototype — this information is not part of hotel ranking or Deal Score.'

const STATE_COPY: Record<PrototypePropertyEvidenceState, { heading: string; body: string }> = {
  loading: {
    heading: 'Checking hotel continuity details',
    body: 'We’re checking source, scope, and verification dates for this property.',
  },
  missing: {
    heading: 'Continuity details not documented by this provider',
    body: 'The provider did not return qualifying backup-power, connectivity-continuity, or essential-service details for this property.',
  },
  partial: {
    heading: 'Some continuity details are documented',
    body: 'The source documents part of the property’s continuity setup, but important scope or operating limits are not documented.',
  },
  confirmed: {
    heading: 'Continuity details documented',
    body: 'At least one source-attributed property fact meets the research inclusion rules.',
  },
  stale: {
    heading: 'Continuity information is out of date',
    body: '',
  },
  conflict: {
    heading: 'Sources disagree — confirm with the hotel',
    body: 'Applicable sources report different information about backup power. We are not choosing one as current.',
  },
  error: {
    heading: 'Continuity details could not be checked',
    body: 'We couldn’t retrieve qualifying hotel evidence. This does not mean the property lacks backup power or connectivity continuity.',
  },
}

const SIGNAL_LABELS: Record<ContinuitySignal, string> = {
  backup_power: 'backup power',
  connectivity_continuity: 'connectivity continuity',
  essential_service: 'essential service',
  current_operating_status: 'current operating status',
  selected_stay_confirmation: 'selected-stay confirmation',
}

const SCOPE_LABELS: Record<EvidenceScope, string> = {
  property: 'Property',
  room: 'Room',
  rate: 'Rate',
  selected_stay: 'Selected stay',
}

const SCOPE_LIMITATIONS: Record<EvidenceScope, string> = {
  property: 'Property-level information; it does not guarantee service for your room, dates, or the full outage.',
  room: 'Room-level information; it does not guarantee this room type, rate, or service through the full outage.',
  rate: 'Rate-level information; confirm that the selected room and stay dates are covered.',
  selected_stay: 'Confirmed for the selected stay dates; uninterrupted service during an outage is not guaranteed.',
}

function formatInstant(value?: string): string {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(value))
}

function stateClasses(state: PrototypePropertyEvidenceState): string {
  if (state === 'partial' || state === 'stale') return 'border-[color:var(--gold)] bg-[color:var(--warning-soft)]'
  if (state === 'conflict' || state === 'error') return 'border-[color:var(--error)] bg-[color:var(--error-soft)]'
  if (state === 'confirmed') return 'border-[color:var(--border-strong)] bg-[color:var(--bg-surface)]'
  return 'border-[color:var(--border)] bg-[color:var(--bg-surface)]'
}

function contextHeading(impactType: PrototypeContinuityDisclosure['context']['impactType'], exactArea: string): string {
  if (impactType === 'electricity') return `Current electricity disruption reported for ${exactArea}`
  if (impactType === 'connectivity') return `Current connectivity disruption reported for ${exactArea}`
  return `Current electricity and connectivity disruption reported for ${exactArea}`
}

function MetadataItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-bold text-[color:var(--text-1)]">{label}</dt>
      <dd className="break-words text-[color:var(--text-2)]">{children}</dd>
    </div>
  )
}

function SourceLink({ fact, conflict = false, label }: { fact: PrototypeContinuityFact; conflict?: boolean; label?: string }) {
  const signalLabel = SIGNAL_LABELS[fact.signal]
  const visibleLabel = label ?? (conflict ? `View source from ${fact.sourceName}` : 'View evidence source')
  return (
    <a
      href={fact.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={conflict ? `View source from ${fact.sourceName} (opens in a new tab)` : `View ${signalLabel} evidence from ${fact.sourceName} (opens in a new tab)`}
      className="inline-flex min-h-11 items-center font-semibold text-[color:var(--brand)] underline underline-offset-4"
      onClick={() => track('resilience_source_opened', { signalType: fact.signal, sourceClass: fact.sourceClass })}
    >
      {visibleLabel}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

function AtomicFact({ fact }: { fact: PrototypeContinuityFact }) {
  const titleId = `continuity-fact-${fact.id}`
  return (
    <section className="mt-3 border-t border-[color:var(--border)] pt-3" aria-labelledby={titleId}>
      <h4 id={titleId} className="text-[13px] font-bold leading-5 text-[color:var(--text-1)]">{fact.title}</h4>
      <p className="mt-1 text-[13px] leading-5 text-[color:var(--text-2)]">{fact.documentedClaim}</p>
      <dl className="mt-3 grid gap-2 text-caption leading-5 min-[680px]:grid-cols-2">
        <MetadataItem label="Scope">{SCOPE_LABELS[fact.scope]}</MetadataItem>
        <MetadataItem label="Documented services">
          {fact.supportedServices.length ? fact.supportedServices.join(', ') : 'Not documented by this source.'}
        </MetadataItem>
        <MetadataItem label="Not covered or not documented">
          {fact.unsupportedOrUndocumentedServices.length ? fact.unsupportedOrUndocumentedServices.join(', ') : 'Not documented by this source.'}
        </MetadataItem>
        <MetadataItem label="Runtime or capacity">{fact.runtimeOrCapacity ?? 'Not documented by this source.'}</MetadataItem>
        {fact.signal === 'connectivity_continuity' ? (
          <MetadataItem label="Power dependency">{fact.powerDependency ?? 'Not documented by this source.'}</MetadataItem>
        ) : null}
        <MetadataItem label="Verification">{fact.verificationMethod} · {formatInstant(fact.verifiedAt)}</MetadataItem>
        <MetadataItem label="Source">
          <span>{fact.sourceName}</span><br />
          <SourceLink fact={fact} />
        </MetadataItem>
      </dl>
      <p className="mt-3 text-caption font-medium leading-5 text-[color:var(--text-2)]">{SCOPE_LIMITATIONS[fact.scope]}</p>
    </section>
  )
}

function LoadingLines() {
  return (
    <div aria-hidden="true" className="mt-3 space-y-2">
      <div className="skeleton h-3 w-full rounded" />
      <div className="skeleton h-3 w-4/5 rounded" />
      <div className="skeleton h-3 w-2/3 rounded" />
    </div>
  )
}

export function HotelContinuityPrototype({ dealId, hotelName, fixtureId, disclosure, initiallyExpanded }: Props) {
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const [retrying, setRetrying] = useState(false)
  const [retryFailed, setRetryFailed] = useState(false)
  const errorHeadingRef = useRef<HTMLParagraphElement>(null)
  const detailsId = `continuity-details-${dealId}`
  const titleId = `continuity-title-${dealId}`

  useEffect(() => {
    if (!disclosure || disclosure.context.state === 'ineligible') return
    track('resilience_context_impression', {
      condition: fixtureId,
      eventId: disclosure.context.eventId ?? 'pending',
      sourceClass: disclosure.context.authorityName ? 'authority' : 'unverified',
      viewport: window.innerWidth < 680 ? '375' : '1280',
    })
    if (disclosure.context.state === 'eligible') {
      track('resilience_summary_impression', {
        dealId,
        evidenceState: disclosure.propertyState,
        signalTypes: disclosure.facts.map((fact) => fact.signal).join(',') || 'none',
        scope: disclosure.facts.map((fact) => fact.scope).join(',') || 'none',
      })
    }
  }, [dealId, disclosure, fixtureId])

  if (!disclosure || disclosure.context.state === 'ineligible') return null

  const retry = () => {
    if (retrying) return
    setRetryFailed(false)
    setRetrying(true)
    window.setTimeout(() => {
      setRetrying(false)
      setRetryFailed(true)
      window.requestAnimationFrame(() => errorHeadingRef.current?.focus())
    }, 600)
  }

  if (disclosure.context.state === 'loading') {
    return (
      <section aria-labelledby={titleId} className="card mt-4 p-4 min-[680px]:p-5">
        <h3 id={titleId} className="text-h3 text-[color:var(--text-1)]">Power and connectivity continuity</h3>
        <div className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-3.5" role="status" aria-label="Checking current electricity or connectivity disruption information.">
          <p className="text-[13px] font-bold leading-5 text-[color:var(--text-1)]">Checking current disruption information</p>
          <p className="mt-1 text-[13px] leading-5 text-[color:var(--text-2)]">We’re checking an authority source for your area and stay dates.</p>
          <LoadingLines />
        </div>
        <p className="mt-4 text-caption leading-5 text-[color:var(--text-3)]">{DISCLAIMER}</p>
      </section>
    )
  }

  if (disclosure.context.state === 'error') {
    return (
      <section aria-labelledby={titleId} className="card mt-4 p-4 min-[680px]:p-5">
        <h3 id={titleId} className="text-h3 text-[color:var(--text-1)]">Power and connectivity continuity</h3>
        <div className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--error)] bg-[color:var(--error-soft)] p-3.5" role={retrying ? 'status' : retryFailed ? 'alert' : undefined}>
          <p ref={errorHeadingRef} tabIndex={-1} className="text-[13px] font-bold leading-5 text-[color:var(--text-1)]">
            {retrying ? 'Checking current disruption information' : 'Current disruption information could not be checked'}
          </p>
          <p className="mt-1 text-[13px] leading-5 text-[color:var(--text-2)]">
            {retrying ? 'We’re checking an authority source for your area and stay dates.' : 'We couldn’t verify a current authority source for this area and stay. No hotel continuity claim is shown.'}
          </p>
          {retrying ? <LoadingLines /> : (
            <button type="button" className="btn btn-outline mt-3 w-full min-[680px]:w-auto" onClick={retry} disabled={retrying}>Try context check again</button>
          )}
        </div>
        <p className="mt-4 text-caption leading-5 text-[color:var(--text-3)]">{DISCLAIMER}</p>
      </section>
    )
  }

  const { context, facts } = disclosure
  const state = disclosure.propertyState
  const copy = STATE_COPY[state]
  const firstFact = facts[0]
  const staleBody = state === 'stale' && firstFact
    ? `The latest source was verified on ${formatInstant(firstFact.verifiedAt)}, outside the research inclusion window for ${SIGNAL_LABELS[firstFact.signal]}.`
    : copy.body
  const stateRole = state === 'loading' || retrying ? 'status' : retryFailed ? 'alert' : undefined

  return (
    <section aria-labelledby={titleId} className="card mt-4 p-4 min-[680px]:p-5">
      <h3 id={titleId} className="text-h3 text-[color:var(--text-1)]">Power and connectivity continuity</h3>
      <div className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-base)] p-3.5">
        <p className="text-[13px] font-bold leading-5 text-[color:var(--text-1)]">{contextHeading(context.impactType, context.exactArea ?? '')}</p>
        <p className="mt-1 text-caption font-medium leading-5 text-[color:var(--text-2)]">Source: {context.authorityName} · Applies through {formatInstant(context.expiresAt)}</p>
        <a
          href={context.authorityUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View disruption source from ${context.authorityName} (opens in a new tab)`}
          className="mt-2 inline-flex min-h-11 items-center text-[13px] font-semibold text-[color:var(--brand)] underline underline-offset-4"
          onClick={() => track('resilience_source_opened', { signalType: 'destination_context', sourceClass: 'authority' })}
        >
          View disruption source<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <p className="mt-2 text-caption leading-5 text-[color:var(--text-2)]">This destination report does not confirm that {hotelName} is affected.</p>
      </div>

      <div
        className={`mt-4 rounded-[var(--radius-control)] border p-3.5 ${stateClasses(state)}`}
        role={stateRole}
        aria-label={state === 'loading' ? `Checking power and connectivity continuity details for ${hotelName}.` : undefined}
      >
        <p ref={state === 'error' ? errorHeadingRef : undefined} tabIndex={state === 'error' ? -1 : undefined} className="text-[13px] font-bold leading-5 text-[color:var(--text-1)]">
          {retrying ? 'Checking hotel continuity details' : copy.heading}
        </p>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailsId}
          className="btn btn-outline mt-3 w-full min-[680px]:w-auto"
          onClick={() => {
            const next = !expanded
            setExpanded(next)
            if (next) track('resilience_disclosure_opened', { dealId, evidenceState: state, entrySurface: 'hotel_detail' })
          }}
        >
          {expanded ? 'Hide continuity details' : 'Show continuity details'}
        </button>

        {expanded ? (
          <div id={detailsId}>
            <p className="mt-3 text-[13px] leading-5 text-[color:var(--text-2)]">{retrying ? STATE_COPY.loading.body : staleBody}</p>
            {state === 'loading' || retrying ? <LoadingLines /> : null}
            {state === 'missing' ? (
              <p className="mt-2 text-caption font-medium leading-5 text-[color:var(--text-2)]">Not documented does not mean the hotel lacks these capabilities.</p>
            ) : null}
            {state === 'partial' ? facts.map((fact) => <AtomicFact key={fact.id} fact={fact} />) : null}
            {state === 'confirmed' ? facts.map((fact) => <AtomicFact key={fact.id} fact={fact} />) : null}
            {state === 'stale' && firstFact ? (
              <>
                <p className="mt-2 text-caption font-medium leading-5 text-[color:var(--text-2)]">We are not presenting it as a current hotel capability.</p>
                <SourceLink fact={firstFact} label="View older source" />
              </>
            ) : null}
            {state === 'conflict' ? (
              <div className="mt-3 border-t border-[color:var(--border)] pt-3">
                <p className="text-caption font-bold leading-5 text-[color:var(--text-1)]">Sources reviewed</p>
                <ul className="mt-2 space-y-3">
                  {facts.map((fact) => (
                    <li key={fact.id} className="text-caption leading-5 text-[color:var(--text-2)]">
                      <p>{fact.sourceName} · {formatInstant(fact.verifiedAt)} · {fact.documentedClaim}</p>
                      <SourceLink fact={fact} conflict />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {state === 'error' && !retrying ? (
              <button type="button" className="btn btn-outline mt-3 w-full min-[680px]:w-auto" onClick={retry} disabled={retrying}>Try hotel details again</button>
            ) : null}

            {!retrying && state !== 'loading' ? (
              disclosure.hotelContactHref ? (
                <a href={disclosure.hotelContactHref} className="mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-[color:var(--brand)] underline underline-offset-4">
                  {state === 'partial' ? 'Confirm missing details with the hotel' : state === 'stale' ? 'Confirm current details with the hotel' : 'Confirm with the hotel'}
                </a>
              ) : (
                <p className="mt-3 text-[13px] font-medium leading-5 text-[color:var(--text-2)]">Contact the hotel through the booking provider to confirm current details.</p>
              )
            ) : null}

            {!retrying && state === 'missing' ? <p className="mt-2 text-caption leading-5 text-[color:var(--text-2)]">The destination report does not confirm that this hotel is affected.</p> : null}
            {!retrying && state === 'partial' ? <p className="mt-2 text-caption leading-5 text-[color:var(--text-2)]">Property-level information; it does not guarantee service for your room, dates, or the full outage.</p> : null}
            {!retrying && state === 'stale' ? <p className="mt-2 text-caption leading-5 text-[color:var(--text-2)]">Older property information does not confirm service for your room, dates, or an outage.</p> : null}
            {!retrying && state === 'conflict' ? <p className="mt-2 text-caption leading-5 text-[color:var(--text-2)]">Conflicting sources cannot confirm service for your room, dates, or an outage.</p> : null}
            {!retrying && state === 'error' ? <p className="mt-2 text-caption leading-5 text-[color:var(--text-2)]">The destination report does not confirm that this hotel is affected.</p> : null}
          </div>
        ) : null}
      </div>
      <p className="mt-4 text-caption leading-5 text-[color:var(--text-3)]">{DISCLAIMER}</p>
    </section>
  )
}
