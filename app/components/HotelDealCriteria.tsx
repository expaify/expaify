'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CompareRow, eligibleHotelProviderLinks } from '@/app/components/ui/CompareRow'
import { track } from '@/lib/analytics'
import { TRACKED_MARKET_NAMES } from '@/lib/trackedMarkets'
import {
  buildHotelResultsUrl,
  createHotelCriteriaVersion,
  hotelCriteriaContextStatus,
  hotelCriteriaFromDraft,
  hotelCriteriaToDraft,
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

type ResolvedContext = {
  criteria?: HotelSearchCriteriaV1
  status: HotelCriteriaContextStatus
  backHref: string
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
    const href = buildHotelResultsUrl(next)
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
      router.push(href)
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
          <p className="text-sm font-bold">We couldn&apos;t update these results.</p>
          <p className="mt-1 text-[13px]">This deal and your previous search are still showing.</p>
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

export function HotelDealCriteriaHandoff({ context, deal, links, hotelName }: {
  context: ResolvedContext
  deal: { id: string; city: string; checkInDate?: string | null }
  links: Record<string, string>
  hotelName?: string
}) {
  const criteria = context.criteria
  const status = criteria ? hotelCriteriaContextStatus(criteria, deal) : context.status
  if (status === 'mismatch' && criteria) {
    return (
      <div className="mt-4" role="status">
        <p className="text-sm font-bold text-[color:var(--text-1)]">Provider link unavailable</p>
        <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">Review the search mismatch below before inspecting room options.</p>
      </div>
    )
  }

  const eligibleLinks = eligibleHotelProviderLinks(links)
  const hasLinks = Object.values(eligibleLinks).some(Boolean)
  return (
    <div className="mt-4">
      {hasLinks ? (
        <>
          <p className="text-sm leading-6 text-[color:var(--text-2)]">
            The provider confirms room details, live availability, final total, taxes and fees, cancellation policy, and terms.
            {criteria ? null : ' Choose or confirm your dates there before comparing room options.'}
          </p>
          <div className="mt-4">
          <CompareRow
            links={eligibleLinks}
            size="primary"
            hotelName={hotelName}
            handoffContext={{
              dealId: deal.id,
              contextStatus: status,
              criteriaVersion: criteria?.criteriaVersion,
              destinationPresent: criteria?.destination.state === 'selected',
              dateState: criteria?.dates.semantic ?? 'missing',
            }}
          />
          </div>
        </>
      ) : (
        <div role="status">
          <p className="text-sm font-bold text-[color:var(--text-1)]">Provider link unavailable</p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">You can review this hotel here, but expaify does not have a valid provider link for room inspection.</p>
          <a href="/deals" className="btn btn-outline mt-4 inline-flex min-h-11 w-full items-center justify-center text-center">Search current deals</a>
        </div>
      )}
    </div>
  )
}
