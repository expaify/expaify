'use client'

import { useEffect, useRef, useState } from 'react'
import type {
  HotelPoolEvidence,
  HotelPoolRecord,
  PoolDateInterval,
  PoolStayRelation,
  PoolType,
} from '@/app/components/research/hotelPoolFixtures'

const BOUNDARY = 'Provider-disclosed pool details can change. expaify does not confirm day-of-stay opening, maintenance, capacity, weather closures, hours, fees, or guest access. Confirm current conditions with the property or booking provider.'

const TYPE_COPY: Record<PoolType, string> = {
  indoor: 'Indoor',
  outdoor: 'Outdoor',
  indoor_and_outdoor: 'Indoor and outdoor',
  not_provided: 'Type not provided',
  conflicting: 'Provider pool type details conflict.',
}

const HEAT_COPY = {
  heated: 'Heated',
  not_heated: 'Not heated',
  not_provided: 'Heated status not provided',
  conflicting: 'Provider heated-status details conflict.',
} as const

function validDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) ? date : null
}

function shortDate(value: string, includeYear = false): string {
  const date = validDate(value)
  if (!date) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...(includeYear ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(date)
}

function formatRange(interval: PoolDateInterval): string {
  const start = validDate(interval.start)
  const end = validDate(interval.end)
  const includeYear = interval.recurrence === 'one_off' || start?.getUTCFullYear() !== end?.getUTCFullYear()
  return `${shortDate(interval.start, includeYear)}–${shortDate(interval.end, includeYear)}`
}

function formatStay(stay: HotelPoolEvidence['selectedStay']): string | null {
  if (!stay) return null
  const start = validDate(stay.checkIn)
  const end = validDate(stay.checkOut)
  if (!start || !end || end <= start) return null
  const includeYear = start.getUTCFullYear() !== new Date().getFullYear() || start.getUTCFullYear() !== end.getUTCFullYear()
  return `${shortDate(stay.checkIn, includeYear)}–${shortDate(stay.checkOut, includeYear)}`
}

function formatChecked(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}

function typeLabel(type: PoolType, lowercase = false): string {
  const value = type === 'not_provided' || type === 'conflicting' ? '' : TYPE_COPY[type]
  return lowercase ? value.toLowerCase() : value
}

function countSuffix(count: number): string {
  return count > 1 ? ` · ${count > 9 ? '9+' : count} pools disclosed` : ''
}

export function getHotelPoolCardSummary(evidence?: HotelPoolEvidence): { copy: string; warning: boolean } | null {
  if (!evidence || evidence.state === 'not_returned' || evidence.state === 'check_failed' || evidence.state === 'loading' || evidence.pools.length === 0) return null
  const suffix = countSuffix(evidence.pools.length)
  if (['conflicting', 'malformed', 'stale'].includes(evidence.state)) return { copy: `Pool details need confirmation${suffix}`, warning: true }
  if (evidence.pools.some(pool => pool.temporaryClosureIntervals.length > 0 || pool.conflictDimensions?.includes('closure'))) return { copy: `Pool details need confirmation${suffix}`, warning: true }
  const relations = evidence.pools.map(pool => pool.selectedStayRelation)
  if (relations.includes('partial_overlap') && !relations.includes('full_overlap')) return { copy: `Pool schedule covers part of your stay${suffix}`, warning: true }
  if (relations.includes('no_overlap') && !relations.includes('full_overlap') && !relations.includes('partial_overlap')) return { copy: `Pool schedule does not cover your full stay${suffix}`, warning: true }
  const full = evidence.pools.find(pool => pool.selectedStayRelation === 'full_overlap')
  if (full) return { copy: `${typeLabel(full.type) ? `${typeLabel(full.type)} ` : ''}pool schedule covers your stay${suffix}`, warning: false }
  const seasonal = evidence.pools.find(pool => pool.scheduleKind === 'seasonal' && pool.operatingIntervals.length === 0)
  if (seasonal) return { copy: `Seasonal${typeLabel(seasonal.type, true) ? ` ${typeLabel(seasonal.type, true)}` : ''} pool · dates not provided${suffix}`, warning: false }
  const missingSchedule = evidence.pools.find(pool => pool.presence === 'present' && pool.scheduleKind === 'not_provided')
  if (missingSchedule) return { copy: `${typeLabel(missingSchedule.type) ? `${typeLabel(missingSchedule.type)} ` : ''}pool listed · operating dates not provided${suffix}`, warning: false }
  const missingType = evidence.pools.find(pool => pool.presence === 'present' && pool.type === 'not_provided')
  if (missingType) return { copy: `Pool listed · operating details not provided${suffix}`, warning: false }
  return null
}

function relationBucket(pools: readonly HotelPoolRecord[]): PoolStayRelation | 'mixed' {
  const values = new Set(pools.map(pool => pool.selectedStayRelation))
  return values.size > 1 ? 'mixed' : pools[0]?.selectedStayRelation ?? 'indeterminate'
}

export function hotelPoolAnalyticsContext(evidence: HotelPoolEvidence) {
  if (evidence.state === 'loading') return null
  return {
    evidence_state: evidence.state,
    stay_relation: relationBucket(evidence.pools),
    pool_count_bucket: evidence.pools.length === 0 ? '0' : evidence.pools.length === 1 ? '1' : evidence.pools.length === 2 ? '2' : '3_plus',
    evidence_revision: evidence.revisionStatus ?? 'saved',
  } as const
}

export function hotelPoolDetailAnalyticsContext(evidence: HotelPoolEvidence, now = Date.now()) {
  const base = hotelPoolAnalyticsContext(evidence)
  if (!base) return null
  const validTimes = evidence.pools
    .map(pool => Date.parse(pool.source.fetchedAt))
    .filter(Number.isFinite)
  const newest = validTimes.length > 0 ? Math.max(...validTimes) : null
  const age = newest === null ? null : Math.max(0, now - newest)
  const source_freshness_bucket = age === null
    ? 'unavailable'
    : age < 86_400_000
      ? 'under_24h'
      : age <= 7 * 86_400_000
        ? '1_7d'
        : 'over_7d'
  return { ...base, source_freshness_bucket } as const
}

export function hotelPoolViewportGroup(width: number): 'mobile_375' | 'desktop_1280' | 'other' {
  return width <= 480 ? 'mobile_375' : width >= 1024 ? 'desktop_1280' : 'other'
}

function scheduleCopy(pool: HotelPoolRecord, evidence: HotelPoolEvidence): string {
  if (pool.scheduleKind === 'conflicting') return 'Provider schedule details conflict. Confirm before booking.'
  const stay = formatStay(evidence.selectedStay)
  if (!stay) return 'Add stay dates to compare with the disclosed season.'
  if (pool.scheduleKind === 'not_provided') return 'The provider did not provide operating dates for this pool.'
  if (pool.scheduleKind === 'seasonal' && pool.operatingIntervals.length === 0) return 'The provider lists this pool as seasonal but did not provide operating dates.'
  if (pool.selectedStayRelation === 'indeterminate') return 'The disclosed operating dates could not be compared with your stay.'
  if (pool.scheduleKind === 'year_round') return `The provider lists a year-round schedule that covers your ${stay} stay.`
  const season = pool.operatingIntervals.map(formatRange).join(', ')
  if (pool.selectedStayRelation === 'full_overlap') return `Your ${stay} stay is within the disclosed ${season} season.`
  if (pool.selectedStayRelation === 'partial_overlap') return `Your ${stay} stay is partly within the disclosed ${season} season.`
  return `Your ${stay} stay is outside the disclosed ${season} season.`
}

function stableNames(pools: readonly HotelPoolRecord[]): string[] {
  const counts = new Map<string, number>()
  pools.forEach(pool => { if (pool.displayName) counts.set(pool.displayName, (counts.get(pool.displayName) ?? 0) + 1) })
  return pools.map((pool, index) => {
    const safe = pool.displayName?.trim().slice(0, 80)
    if (!safe) return `Pool ${index + 1}`
    return (counts.get(pool.displayName ?? '') ?? 0) > 1 ? `${safe} · Pool ${index + 1}` : safe
  })
}

function EvidenceEntry({ pool, name, evidence }: { pool: HotelPoolRecord; name: string; evidence: HotelPoolEvidence }) {
  const stale = evidence.state === 'stale'
  const prefix = stale ? 'Last reported: ' : ''
  const warningRelation = pool.selectedStayRelation === 'partial_overlap' || pool.selectedStayRelation === 'no_overlap' || pool.scheduleKind === 'conflicting'
  return (
    <li className="min-w-0 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5">
      <h4 className="break-words text-sm font-medium leading-6 text-[color:var(--text-1)]">{name}</h4>
      <p className="mt-1 break-words text-sm leading-6 text-[color:var(--text-2)]">{prefix}{TYPE_COPY[pool.type]}</p>
      {pool.temporaryClosureIntervals.map((interval, index) => (
        <p key={`${interval.start}-${interval.end}-${index}`} className="mt-2 rounded-[var(--radius-control)] bg-[color:var(--warning-soft)] px-3 py-2.5 text-sm leading-6 text-[color:var(--warning)]">Provider reports this pool closed {formatRange(interval)}.</p>
      ))}
      <p className={`mt-1 break-words text-sm leading-6 ${warningRelation ? 'rounded-[var(--radius-control)] bg-[color:var(--warning-soft)] px-3 py-2.5 text-[color:var(--warning)]' : 'text-[color:var(--text-2)]'}`}>{prefix}{scheduleCopy(pool, evidence)}</p>
      <p className="mt-1 break-words text-sm leading-6 text-[color:var(--text-2)]">{prefix}{HEAT_COPY[pool.heated]}</p>
      <p title={pool.source.fetchedAt} className="mt-2 break-words text-caption leading-5 text-[color:var(--text-3)]">{stale ? 'Last reported' : 'Disclosed'} by {pool.source.sourceLabel} · checked {formatChecked(pool.source.fetchedAt)}</p>
    </li>
  )
}

function StateMessage({ evidence }: { evidence: HotelPoolEvidence }) {
  if (evidence.state === 'ready') return null
  const error = evidence.state === 'malformed' || evidence.state === 'conflicting' || evidence.state === 'check_failed'
  const copy = {
    not_returned: 'This provider did not return pool details for this hotel.',
    check_failed: 'Pool details could not be checked.',
    malformed: 'The provider returned pool details that expaify could not verify.',
    conflicting: 'Provider pool details conflict. Confirm before booking.',
    stale: 'These pool details are out of date. Confirm before booking.',
    loading: 'Checking provider-disclosed pool details…',
    ready: '',
  }[evidence.state]
  return <p className={`mt-3 rounded-[var(--radius-control)] px-3 py-2.5 text-sm leading-6 ${error ? 'bg-[color:var(--error-soft)] text-[color:var(--error-text)]' : evidence.state === 'stale' ? 'bg-[color:var(--warning-soft)] text-[color:var(--warning)]' : 'bg-[color:var(--bg-muted)] text-[color:var(--text-2)]'}`}>{copy}{evidence.state === 'check_failed' ? ' Confirm pool facilities and current conditions with the property or booking provider.' : ''}</p>
}

export function HotelPoolEvidenceLedger({ evidence }: { evidence: HotelPoolEvidence }) {
  const names = stableNames(evidence.pools)
  return (
    <section aria-labelledby="hotel-pool-title" aria-busy={evidence.state === 'loading' ? 'true' : undefined} className="mt-6 min-w-0 border-t border-[color:var(--border)] pt-5">
      <p className="text-caption font-medium uppercase tracking-wide text-[color:var(--warning)]">Research fixture</p>
      <h3 id="hotel-pool-title" className="mt-1 text-h3 text-[color:var(--text-1)]">Pool details</h3>
      {evidence.revisionStatus === 'updated' ? <p role="status" aria-live="polite" className="mt-2 text-sm text-[color:var(--text-2)]">Pool details were updated after you saved this deal.</p> : null}
      {evidence.revisionStatus === 'unavailable' ? <p className="mt-2 rounded-[var(--radius-control)] bg-[color:var(--error-soft)] px-3 py-2.5 text-sm leading-6 text-[color:var(--error-text)]">Saved pool details could not be restored. Confirm with the provider.</p> : null}
      <StateMessage evidence={evidence} />
      {evidence.state === 'loading' ? (
        <>
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">Checking provider-disclosed pool details…</p>
          <div aria-hidden="true" className="mt-4 grid gap-3 sm:grid-cols-2">
            {[0, 1].map(item => <div key={item} className="space-y-3 rounded-[var(--radius-control)] border border-[color:var(--border)] p-3.5"><div className="skeleton h-4 w-2/5 rounded-[var(--radius-control)]" /><div className="skeleton h-4 w-full rounded-[var(--radius-control)]" /><div className="skeleton h-4 w-4/5 rounded-[var(--radius-control)]" /></div>)}
          </div>
        </>
      ) : evidence.pools.length > 0 && evidence.state !== 'malformed' ? (
        <ul aria-label="Provider-disclosed pools" className="mt-4 grid list-none gap-3 p-0 sm:grid-cols-2">
          {evidence.pools.map((pool, index) => <EvidenceEntry key={pool.poolId} pool={pool} name={names[index]} evidence={evidence} />)}
        </ul>
      ) : null}
      <p className="mt-4 rounded-[var(--radius-control)] bg-[color:var(--bg-muted)] px-3 py-2.5 text-xs leading-5 text-[color:var(--text-2)]">{BOUNDARY}</p>
    </section>
  )
}

export const HOTEL_POOL_HANDOFF_REMINDER = 'Pool schedules are not live operating status. Confirm current pool conditions with the property or booking provider.'

type FeedbackReason = 'different_schedule' | 'different_type' | 'different_heating' | 'temporary_closure' | 'other'

export function HotelPoolReturnFeedback({ onComplete, submission = 'success' }: { onComplete?: (reason: FeedbackReason | 'no_difference') => void; submission?: 'success' | 'failure' }) {
  const [step, setStep] = useState<'question' | 'reasons' | 'success' | 'failure' | 'dismissed'>('question')
  const [reason, setReason] = useState<FeedbackReason | ''>('')
  const yesRef = useRef<HTMLButtonElement>(null)
  const groupRef = useRef<HTMLFieldSetElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (step === 'reasons') groupRef.current?.focus(); if (step === 'failure') errorRef.current?.focus() }, [step])
  if (step === 'dismissed') return null
  if (step === 'success') return <p role="status" aria-live="polite" className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">Thanks. We’ll use this report to evaluate the pool information.</p>
  if (step === 'failure') return <div ref={errorRef} tabIndex={-1} className="mt-3 rounded-[var(--radius-control)] bg-[color:var(--error-soft)] p-3 text-sm text-[color:var(--error-text)]"><p>We couldn’t save your feedback. Your hotel details are unchanged.</p><button type="button" className="btn btn-outline mt-3 min-h-11 w-full px-4 min-[480px]:w-auto" onClick={() => setStep('reasons')}>Try again</button></div>
  return (
    <div className="mt-3 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4">
      <p className="text-sm font-medium leading-6 text-[color:var(--text-1)]">Did the provider show different pool details?</p>
      {step === 'question' ? <div className="mt-3 flex flex-col gap-2 min-[480px]:flex-row"><button ref={yesRef} type="button" onClick={() => setStep('reasons')} className="btn btn-outline min-h-11 w-full px-4">Yes, details were different</button><button type="button" onClick={() => { onComplete?.('no_difference'); setStep('success') }} className="btn btn-outline min-h-11 w-full px-4">No difference</button><button type="button" onClick={() => setStep('dismissed')} className="btn btn-outline min-h-11 w-full px-4">Skip</button></div> : (
        <fieldset ref={groupRef} tabIndex={-1} className="mt-4 min-w-0"><legend className="text-sm font-medium text-[color:var(--text-1)]">What was different?</legend><div className="mt-3 grid gap-2">{([
          ['different_schedule', 'Operating schedule or dates'], ['different_type', 'Indoor or outdoor type'], ['different_heating', 'Heated status'], ['temporary_closure', 'Temporary closure'], ['other', 'Something else about the pool'],
        ] as const).map(([value, label]) => <label key={value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-[color:var(--border)] px-3 py-2.5 has-[:focus-visible]:border-[color:var(--border-focus)]"><input type="radio" name="pool-feedback-reason" value={value} checked={reason === value} onChange={() => setReason(value)} /><span className="text-sm leading-6 text-[color:var(--text-2)]">{label}</span></label>)}</div><p id="pool-feedback-help" className="mt-2 text-xs text-[color:var(--text-3)]">Choose one reason to continue.</p><div className="mt-3 flex flex-col gap-2 min-[480px]:flex-row"><button type="button" disabled={!reason} aria-describedby="pool-feedback-help" className="btn btn-primary min-h-11 w-full px-4 min-[480px]:w-auto" onClick={() => { if (!reason) return; if (submission === 'failure') setStep('failure'); else { onComplete?.(reason); setStep('success') } }}>Send feedback</button><button type="button" className="btn btn-outline min-h-11 w-full px-4 min-[480px]:w-auto" onClick={() => { setReason(''); setStep('question'); requestAnimationFrame(() => yesRef.current?.focus()) }}>Cancel</button></div></fieldset>
      )}
    </div>
  )
}
