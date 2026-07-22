'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics'

export function DealStaleTracker({ dealId, hoursSinceCheck }: { dealId: string; hoursSinceCheck: number }) {
  useEffect(() => {
    track('deal_stale_banner_viewed', { dealId, hoursSinceCheck: Math.floor(hoursSinceCheck) })
  }, [dealId, hoursSinceCheck])

  return null
}
