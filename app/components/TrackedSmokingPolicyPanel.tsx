'use client'

import { useEffect, useRef } from 'react'
import type { HotelSmokingPolicy } from '@/lib/types'
import { track } from '@/lib/analytics'
import SmokingPolicyPanel from './SmokingPolicyPanel'

const exposedPolicyPanels = new Set<string>()

function scopeForAnalytics(scope: string | undefined): string {
  return scope ?? 'not_applicable'
}

export default function TrackedSmokingPolicyPanel({
  offerId,
  provider,
  policy,
  surface,
}: {
  offerId: string
  provider: string
  policy: HotelSmokingPolicy
  surface: 'result_detail' | 'review'
}) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = rootRef.current
    const dedupeKey = `${surface}:${offerId}`
    if (!element || exposedPolicyPanels.has(dedupeKey) || typeof IntersectionObserver === 'undefined') return

    let timer: ReturnType<typeof setTimeout> | undefined
    const clearTimer = () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
    }
    const observer = new IntersectionObserver(entries => {
      const exposed = entries.some(entry => entry.target === element && entry.isIntersecting && entry.intersectionRatio >= 0.5)
      if (!exposed) {
        clearTimer()
        return
      }
      if (timer !== undefined || exposedPolicyPanels.has(dedupeKey)) return
      timer = setTimeout(() => {
        timer = undefined
        if (exposedPolicyPanels.has(dedupeKey)) return
        exposedPolicyPanels.add(dedupeKey)
        track(surface === 'review' ? 'hotel_smoking_policy_review_viewed' : 'hotel_smoking_policy_detail_viewed', {
          offerId,
          provider,
          roomEvidenceState: policy.room.state,
          roomScope: scopeForAnalytics(policy.room.scope),
          propertyEvidenceState: policy.property.state,
          propertyScope: scopeForAnalytics(policy.property.scope),
        })
        observer.disconnect()
      }, 1_000)
    }, { threshold: 0.5 })
    observer.observe(element)
    return () => {
      clearTimer()
      observer.disconnect()
    }
  }, [offerId, policy, provider, surface])

  return (
    <div ref={rootRef} className="contents">
      <SmokingPolicyPanel offerId={offerId} policy={policy} surface={surface} />
    </div>
  )
}
