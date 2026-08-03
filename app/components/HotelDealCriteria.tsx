'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CompareRow,
  eligibleHotelProviderLinks,
  isAttributedHotelProviderUrl,
  type CompareLinks,
} from '@/app/components/ui/CompareRow'
import { track } from '@/lib/analytics'
import { TRACKED_MARKET_NAMES } from '@/lib/trackedMarkets'
import {
  buildHotelDestinationUrl,
  buildHotelResultsUrl,
  createHotelCriteriaVersion,
  hotelCriteriaContextStatus,
  hotelCriteriaFromDraft,
  hotelCriteriaToDraft,
  resolveHotelEditSubmitUrl,
  resultCountBucket,
  type HotelCriteriaContextStatus,
  type HotelCriteriaDraft,
  type HotelSearchCriteriaV1,
} from '@/lib/hotels/searchCriteria'
import {
  HotelCriteriaContextCard,
  HotelCriteriaMismatchAlert,
  HotelSearchCriteriaEditor,
  HotelSearchCriteriaSummary,
} from './HotelSearchCriteria'
import type { HotelDisruptionEvidence } from '@/lib/types'
import {
  hotelDisruptionAnalyticsContext,
  HotelDisruptionHandoffNotice,
  NO_HOTEL_DISRUPTION_EVIDENCE,
} from '@/app/components/ui/HotelDisruptionNotice'
import {
  HotelEvChargingHandoffNotice,
  PRODUCTION_EV_CHARGING_UNKNOWN,
  hotelEvChargingActionBoundary,
  trackHotelEvChargingHandoff,
} from '@/app/components/HotelEvCharging'

type ResolvedContext = {
  criteria?: HotelSearchCriteriaV1
  status: HotelCriteriaContextStatus
  backHref: string
}

type RoomHandoffSession = {
  id: string
  provider: keyof CompareLinks
  href: string
  state: 'armed' | 'away' | 'returned'
}

export function roomHandoffVisibilityTransition(
  state: RoomHandoffSession['state'],
  visibility: DocumentVisibilityState,
): RoomHandoffSession['state'] {
  if (visibility === 'hidden') return 'away'
  if (visibility === 'visible' && state === 'away') return 'returned'
  return state
}

const ROOM_HANDOFF_STORAGE_PREFIX = 'expaify.hotel-room-handoff.'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function readRoomHandoffSession(key: string): RoomHandoffSession | null {
  try {
    const value = window.sessionStorage.getItem(key)
    if (!value) return null
    const parsed = JSON.parse(value) as Partial<RoomHandoffSession>
    if (
      typeof parsed.id !== 'string' || !UUID.test(parsed.id) ||
      !['expedia', 'booking', 'kiwi', 'trip'].includes(parsed.provider ?? '') ||
      typeof parsed.href !== 'string' ||
      !['armed', 'away', 'returned'].includes(parsed.state ?? '') ||
      !isAttributedHotelProviderUrl(parsed.provider as keyof CompareLinks, parsed.href)
    ) return null
    return parsed as RoomHandoffSession
  } catch {
    return null
  }
}

function storeRoomHandoffSession(key: string, session: RoomHandoffSession): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(session))
  } catch {
    // Return detection remains mount-scoped when storage is unavailable.
  }
}

export function HotelDealCriteriaSummary({ context, deal }: {
  context: ResolvedContext
  deal: { city: string; checkInDate?: string | null }
}) {
  const router = useRouter()
  const [editorOpen, setEditorOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [updateFailed, setUpdateFailed] = useState(false)
  const [failedDraft, setFailedDraft] = useState<HotelCriteriaDraft | null>(null)
  const failedVersionRef = useRef<string | null>(null)
  const retryRef = useRef<HTMLButtonElement>(null)
  const criteria = context.criteria
  const status = criteria ? hotelCriteriaContextStatus(criteria, deal) : context.status

  async function apply(draft: HotelCriteriaDraft, retryVersion?: string) {
    if (!criteria || submitting) return
    setSubmitting(true)
    setUpdateFailed(false)
    const next = hotelCriteriaFromDraft(draft, retryVersion ?? createHotelCriteriaVersion(), 'edit')
    const href = context.backHref.startsWith('/destinations/')
      ? buildHotelDestinationUrl(next)
      : buildHotelResultsUrl(next)
    try {
      const response = await fetch(`/api/deals?${href.split('?')[1]}&limit=1`, { headers: { accept: 'application/json' } })
      if (!response.ok) throw new Error('request failed')
      const payload = await response.json() as { criteriaVersion?: string; deals?: unknown[]; total?: number }
      if (payload.criteriaVersion !== next.criteriaVersion) throw new Error('criteria version mismatch')
      const previousDraft = hotelCriteriaToDraft(criteria)
      const changedFields = [
        previousDraft.city !== draft.city ? 'destination' : null,
        previousDraft.dateFrom !== draft.dateFrom ? 'date_from' : null,
        previousDraft.dateTo !== draft.dateTo ? 'date_to' : null,
      ].filter((field): field is string => field !== null).sort().join(',')
      track('hotel_criteria_edit_applied', {
        changed_fields: changedFields,
        previous_version: criteria.criteriaVersion,
        criteria_version: next.criteriaVersion,
        result_count_bucket: resultCountBucket(payload.total ?? payload.deals?.length ?? 0),
      })
      setFailedDraft(null)
      failedVersionRef.current = null
      router.push(resolveHotelEditSubmitUrl(context.backHref, next))
    } catch {
      setSubmitting(false)
      setEditorOpen(false)
      setFailedDraft(draft)
      failedVersionRef.current = next.criteriaVersion
      setUpdateFailed(true)
      window.requestAnimationFrame(() => retryRef.current?.focus())
    }
  }

  if (!criteria) return <HotelCriteriaContextCard status={context.status === 'invalid' ? 'invalid' : 'missing'} />

  return (
    <>
      <HotelSearchCriteriaSummary criteria={criteria} surface="detail" onEdit={() => setEditorOpen(true)} />
      {status === 'mismatch' ? (
        <div className="mt-4">
          <HotelCriteriaMismatchAlert onEdit={() => setEditorOpen(true)} backHref={context.backHref} />
        </div>
      ) : null}
      {updateFailed ? (
        <div role="alert" className="mt-4 rounded-[var(--radius-control)] border border-[color:var(--error)] bg-[color:var(--error-soft)] p-4">
          <p className="text-sm font-medium">We couldn&apos;t update these results.</p>
          <p className="mt-1 text-sm">This deal and your previous search are still showing.</p>
          <div className="mt-3 flex flex-col gap-2 min-[420px]:flex-row">
            <button ref={retryRef} type="button" onClick={() => failedDraft && void apply(failedDraft, failedVersionRef.current ?? undefined)} className="btn btn-primary min-h-11 px-4">Retry update</button>
            <button type="button" onClick={() => setEditorOpen(true)} className="btn btn-outline min-h-11 px-4">Edit search</button>
          </div>
        </div>
      ) : null}
      <HotelSearchCriteriaEditor
        open={editorOpen}
        criteria={criteria}
        cities={TRACKED_MARKET_NAMES}
        surface="detail"
        entryPoint={status === 'mismatch' ? 'mismatch' : 'summary'}
        submitting={submitting}
        initialDraft={updateFailed ? failedDraft ?? undefined : undefined}
        onClose={() => setEditorOpen(false)}
        onSubmit={draft => void apply(draft)}
      />
    </>
  )
}

export function HotelDealCriteriaHandoff({ context, deal, links, hotelName, datesIncomplete, disruptionEvidence = NO_HOTEL_DISRUPTION_EVIDENCE, disruptionFixture = false }: {
  context: ResolvedContext
  deal: {
    id: string
    city: string
    checkInDate?: string | null
    checkInDisplay?: string | null
    checkOutDisplay?: string | null
    nights?: number | null
  }
  links: Record<string, string>
  hotelName?: string
  datesIncomplete?: boolean
  disruptionEvidence?: HotelDisruptionEvidence
  disruptionFixture?: boolean
}) {
  const criteria = context.criteria
  const status = criteria ? hotelCriteriaContextStatus(criteria, deal) : context.status
  const [handoffReached, setHandoffReached] = useState(false)
  const [showReturnPrompt, setShowReturnPrompt] = useState(false)
  const [showRoomRecovery, setShowRoomRecovery] = useState(false)
  const [providerLinkUnavailable, setProviderLinkUnavailable] = useState(false)
  const [mismatchReported, setMismatchReported] = useState(false)
  const activeRoomHandoff = useRef<RoomHandoffSession | null>(null)
  const feedbackKey = `expaify.disruption.feedback.${deal.id}.${disruptionEvidence.evidenceRevision}`
  const roomHandoffKey = `${ROOM_HANDOFF_STORAGE_PREFIX}${deal.id}.${criteria?.criteriaVersion ?? status}`

  function beginRoomHandoff(provider: keyof CompareLinks, href: string): void {
    if (!isAttributedHotelProviderUrl(provider, href)) {
      setProviderLinkUnavailable(true)
      return
    }
    const current = activeRoomHandoff.current
    if (current?.state === 'armed' && current.provider === provider && current.href === href) return
    const session: RoomHandoffSession = {
      id: crypto.randomUUID(),
      provider,
      href,
      state: 'armed',
    }
    activeRoomHandoff.current = session
    setShowRoomRecovery(false)
    storeRoomHandoffSession(roomHandoffKey, session)
  }

  useEffect(() => {
    const restored = readRoomHandoffSession(roomHandoffKey)
    if (restored) {
      if (restored.state === 'away' && document.visibilityState === 'visible') {
        const returned = { ...restored, state: 'returned' as const }
        activeRoomHandoff.current = returned
        storeRoomHandoffSession(roomHandoffKey, returned)
        setShowRoomRecovery(true)
      } else {
        activeRoomHandoff.current = restored
        if (restored.state === 'returned') setShowRoomRecovery(true)
      }
    }

    const onVisibility = () => {
      const active = activeRoomHandoff.current
      if (!active) return
      const nextState = roomHandoffVisibilityTransition(active.state, document.visibilityState)
      if (nextState === active.state) return
      const updated = { ...active, state: nextState }
      activeRoomHandoff.current = updated
      storeRoomHandoffSession(roomHandoffKey, updated)
      if (nextState !== 'returned') return
      setShowRoomRecovery(true)
      try {
        if (window.sessionStorage.getItem(feedbackKey)) return
      } catch {
        // Storage is optional; the one-time prompt remains scoped to this mount.
      }
      setShowReturnPrompt(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [feedbackKey, roomHandoffKey])

  function finishFeedback(answer: 'yes' | 'no') {
    try {
      window.sessionStorage.setItem(feedbackKey, answer)
    } catch {
      // Feedback remains usable when session storage is disabled.
    }
    setShowReturnPrompt(false)
    if (answer === 'yes') {
      const analytics = hotelDisruptionAnalyticsContext(disruptionEvidence)
      track('hotel_disruption_return_reason', {
        reason: 'renovation_or_closure_details_mismatch',
        evidence_state: analytics.evidence_state,
        relation: analytics.relation,
        revision_bucket: analytics.revision_bucket,
        viewport_band: window.innerWidth <= 480 ? 'mobile_375' : window.innerWidth >= 1024 ? 'desktop_1280' : 'other',
      })
      setMismatchReported(true)
    }
  }

  const disruptionNotice = (
    <>
      <HotelDisruptionHandoffNotice
        evidence={disruptionEvidence}
        analyticsKey={deal.id}
        fixture={disruptionFixture}
        onReached={() => setHandoffReached(true)}
      />
      {showReturnPrompt ? (
        <div className="mt-3 rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4">
          <p className="text-sm font-medium leading-6 text-[color:var(--text-1)]">Did the provider show different renovation or closure details?</p>
          <div className="mt-3 flex flex-col gap-2 min-[480px]:flex-row">
            <button type="button" onClick={() => finishFeedback('yes')} className="btn btn-outline min-h-11 w-full px-4">Yes, details were different</button>
            <button type="button" onClick={() => finishFeedback('no')} className="btn btn-outline min-h-11 w-full px-4">No</button>
          </div>
        </div>
      ) : null}
      {mismatchReported ? <p role="status" aria-live="polite" className="mt-3 text-sm leading-6 text-[color:var(--text-2)]">Thanks. We’ll record that the provider details did not match this notice.</p> : null}
    </>
  )

  if (status === 'mismatch' && criteria) {
    return (
      <div className="mt-4">
        <RoomInventoryTruth
          hotelName={hotelName}
          city={deal.city}
          datesIncomplete={datesIncomplete}
          checkInDisplay={deal.checkInDisplay}
          checkOutDisplay={deal.checkOutDisplay}
          nights={deal.nights}
        />
        {disruptionNotice}
        <div className="mt-4" role="status">
          <p className="text-sm font-medium text-[color:var(--text-1)]">Provider link unavailable</p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">Review the search mismatch before checking rooms.</p>
        </div>
      </div>
    )
  }

  const eligibleLinks = eligibleHotelProviderLinks(links)
  const hasLinks = !providerLinkUnavailable && Object.values(eligibleLinks).some(Boolean)
  const restorable = status === 'matched' && Boolean(criteria)
  const resultsHref = restorable ? context.backHref : '/deals'
  const resultsLabel = restorable ? 'Back to matching hotels' : 'Search current hotel deals'
  const unrestorableContextNotice = !restorable ? (
    <p className="mt-4 text-sm leading-6 text-[color:var(--text-2)]">
      Your previous hotel search could not be restored. This hotel and any known dates are still shown above.
    </p>
  ) : null
  return (
    <div className="mt-4">
      <RoomInventoryTruth
        hotelName={hotelName}
        city={deal.city}
        datesIncomplete={datesIncomplete}
        checkInDisplay={deal.checkInDisplay}
        checkOutDisplay={deal.checkOutDisplay}
        nights={deal.nights}
      />
      {unrestorableContextNotice}
      {hasLinks ? (
        <>
          {disruptionNotice}
          <div className="mt-4">
            <HotelEvChargingHandoffNotice evidence={PRODUCTION_EV_CHARGING_UNKNOWN} offerId={deal.id} />
          </div>
          <div className="mt-4">
            <CompareRow
              links={eligibleLinks}
              size="primary"
              hotelName={hotelName}
              actionBoundary={hotelEvChargingActionBoundary(PRODUCTION_EV_CHARGING_UNKNOWN)}
              handoffContext={{
                dealId: deal.id,
                contextStatus: status,
                criteriaVersion: criteria?.criteriaVersion,
                destinationPresent: criteria?.destination.state === 'selected',
                dateState: criteria?.dates.semantic ?? 'missing',
              }}
              onProviderOpen={(provider) => {
                const href = eligibleLinks[provider]
                if (href) beginRoomHandoff(provider, href)
                trackHotelEvChargingHandoff(deal.id, PRODUCTION_EV_CHARGING_UNKNOWN, provider)
                if (!handoffReached) return
                const analytics = hotelDisruptionAnalyticsContext(disruptionEvidence)
                track('hotel_disruption_handoff_clicked', {
                  surface: 'handoff',
                  ...analytics,
                  viewport_band: window.innerWidth <= 480 ? 'mobile_375' : window.innerWidth >= 1024 ? 'desktop_1280' : 'other',
                  provider,
                })
              }}
            />
          </div>
          {showRoomRecovery && activeRoomHandoff.current ? (
            <div className="mt-5 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-base)] p-4 sm:p-5">
              <div role="status" aria-live="polite" aria-atomic="true">
                <h3 className="text-sm font-medium leading-6 text-[color:var(--text-1)]">Couldn&apos;t find a room that worked?</h3>
                <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">
                  {restorable
                    ? 'expaify did not check what happened on the provider site. You can check this hotel again or return to hotels matching your saved stay.'
                    : 'expaify did not check what happened on the provider site. You can check this hotel again or start a current hotel search.'}
                </p>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href={activeRoomHandoff.current.href}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  aria-label={`Check rooms again. Opens in a new tab. Room availability has not been checked by expaify.`}
                  onClick={(event) => {
                    const active = activeRoomHandoff.current
                    if (!active || !isAttributedHotelProviderUrl(active.provider, active.href)) {
                      event.preventDefault()
                      setProviderLinkUnavailable(true)
                      return
                    }
                    beginRoomHandoff(active.provider, active.href)
                  }}
                  className="btn btn-primary inline-flex min-h-11 w-full items-center justify-center text-center sm:w-auto"
                >
                  Check rooms again
                </a>
                <a href={resultsHref} className="btn btn-outline inline-flex min-h-11 w-full items-center justify-center text-center sm:w-auto">{resultsLabel}</a>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div>
          {disruptionNotice}
          <div className="mt-4" role="status">
            <p className="text-sm font-medium text-[color:var(--text-1)]">Provider link unavailable</p>
            <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">You can review this hotel here, but expaify does not have a valid provider link for checking rooms.</p>
            <a href={resultsHref} className="btn btn-outline mt-4 inline-flex min-h-11 w-full items-center justify-center text-center sm:w-auto">{resultsLabel}</a>
          </div>
        </div>
      )}
    </div>
  )
}

function RoomInventoryTruth({ hotelName, city, datesIncomplete, checkInDisplay, checkOutDisplay, nights }: {
  hotelName?: string
  city: string
  datesIncomplete?: boolean
  checkInDisplay?: string | null
  checkOutDisplay?: string | null
  nights?: number | null
}) {
  const completeDates = !datesIncomplete && checkInDisplay && checkOutDisplay && nights != null && nights > 0
  return (
    <>
      <div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4">
        <p className="text-sm font-medium leading-6 text-[color:var(--text-1)]">Room availability not checked by expaify</p>
        <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">
          {completeDates
            ? 'The provider will show current rooms and prices for your stay.'
            : 'The provider will ask you to choose or confirm dates, guests, and rooms before showing current options.'}
        </p>
      </div>
      <div className="mt-4 border-t border-[color:var(--border)] pt-4">
        <p className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Your stay</p>
        <p className="mt-1 break-words text-sm font-medium leading-6 text-[color:var(--text-1)]">{hotelName ?? 'This hotel'} · {city}</p>
        <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">
          {completeDates ? `${checkInDisplay} – ${checkOutDisplay} · ${nights} ${nights === 1 ? 'night' : 'nights'}` : 'Stay dates: confirm with provider'}
        </p>
        <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--text-1)]">Guests and rooms: choose with provider</p>
      </div>
    </>
  )
}
