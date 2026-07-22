'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CompareRow } from '@/app/components/ui/CompareRow'
import { TRACKED_MARKET_NAMES } from '@/lib/trackedMarkets'
import {
  buildHotelResultsUrl,
  createHotelCriteriaVersion,
  hotelCriteriaContextStatus,
  hotelCriteriaFromDraft,
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
  const criteria = context.criteria
  const status = criteria ? hotelCriteriaContextStatus(criteria, deal) : context.status

  async function apply(draft: HotelCriteriaDraft) {
    if (!criteria || submitting) return
    setSubmitting(true)
    setUpdateFailed(false)
    const next = hotelCriteriaFromDraft(draft, createHotelCriteriaVersion(), 'edit')
    const href = buildHotelResultsUrl(next)
    try {
      const response = await fetch(`/api/deals?${href.split('?')[1]}&limit=1`, { headers: { accept: 'application/json' } })
      if (!response.ok) throw new Error('request failed')
      const payload = await response.json() as { criteriaVersion?: string }
      if (payload.criteriaVersion !== next.criteriaVersion) throw new Error('criteria version mismatch')
      router.push(href)
    } catch {
      setSubmitting(false)
      setEditorOpen(false)
      setUpdateFailed(true)
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
          <button type="button" onClick={() => setEditorOpen(true)} className="btn btn-outline mt-3 min-h-11 px-4">Edit search</button>
        </div>
      ) : null}
      <HotelSearchCriteriaEditor
        open={editorOpen}
        criteria={criteria}
        cities={TRACKED_MARKET_NAMES}
        surface="detail"
        entryPoint={status === 'mismatch' ? 'mismatch' : 'summary'}
        submitting={submitting}
        onClose={() => setEditorOpen(false)}
        onSubmit={draft => void apply(draft)}
      />
    </>
  )
}

export function HotelDealCriteriaHandoff({ context, deal, links }: {
  context: ResolvedContext
  deal: { id: string; city: string; checkInDate?: string | null }
  links: Record<string, string>
}) {
  const criteria = context.criteria
  const status = criteria ? hotelCriteriaContextStatus(criteria, deal) : context.status
  if (status === 'mismatch' && criteria) {
    return (
      <div className="my-8">
        <HotelSearchCriteriaSummary criteria={criteria} surface="handoff" />
        <p className="mt-4 text-[13px] font-medium">Provider options are unavailable until you review the mismatch.</p>
      </div>
    )
  }

  const hasLinks = Object.values(links).some(Boolean)
  return (
    <div className="my-8">
      {criteria ? <HotelSearchCriteriaSummary criteria={criteria} surface="handoff" /> : <HotelCriteriaContextCard status={status === 'invalid' ? 'invalid' : 'missing'} handoff />}
      {hasLinks ? (
        <div className="mt-4">
          <CompareRow
            links={links}
            size="primary"
            handoffContext={{
              dealId: deal.id,
              contextStatus: status,
              criteriaVersion: criteria?.criteriaVersion,
              destinationPresent: criteria?.destination.state === 'selected',
              dateState: criteria?.dates.semantic ?? 'missing',
            }}
          />
          <p className="mt-2 text-caption leading-5 text-[color:var(--ink-faint)]">Opens the provider site. Prices and availability can change.</p>
        </div>
      ) : (
        <div className="mt-4 rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-4" role="status">
          <p className="text-[13px] font-bold text-[color:var(--ink)]">No provider options are available for this deal right now.</p>
          <p className="mt-1 text-[12px] leading-5 text-[color:var(--ink-soft)]">This saved deal can still be reviewed here.</p>
        </div>
      )}
    </div>
  )
}
