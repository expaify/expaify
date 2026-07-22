'use client'

import { useEffect, useRef } from 'react'
import { track } from '@/lib/analytics'
import { getHotelFundsAnalyticsDimensions } from '@/lib/hotels/fundsPolicy'
import type { HotelFundsPolicyLoadState } from '@/lib/types'

const viewedKeys = new Set<string>()
const openedKeys = new Set<string>()

function emit(event: string, props: Record<string, string | boolean>) {
  try {
    track(event, props)
  } catch {
    // Analytics is observational and must never block policy review or handoff.
  }
}

function eventKey(offerId: string | undefined, provider: string, surface: string): string {
  return `${provider.trim().toLowerCase()}:${offerId?.trim() || 'unknown'}:${surface}`
}

export function useHotelFundsPolicyExposure(input: {
  evidence: unknown
  loadState: HotelFundsPolicyLoadState
  offerId: string
  provider: string
  surface: 'hotel_card' | 'book_handoff'
}) {
  const rootRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = rootRef.current
    if (!element || input.loadState === 'loading' || typeof IntersectionObserver === 'undefined') return
    const key = eventKey(input.offerId, input.provider, input.surface)
    if (viewedKeys.has(key)) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const clearTimer = () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
    }
    const observer = new IntersectionObserver((entries) => {
      const exposed = entries.some(entry => entry.target === element && entry.isIntersecting && entry.intersectionRatio >= 0.5)
      if (!exposed) return clearTimer()
      if (viewedKeys.has(key) || timer !== undefined) return
      timer = setTimeout(() => {
        timer = undefined
        if (viewedKeys.has(key)) return
        viewedKeys.add(key)
        emit('hotel_funds_policy_summary_viewed', getHotelFundsAnalyticsDimensions(input))
      }, 1_000)
    }, { threshold: 0.5 })
    observer.observe(element)
    return () => {
      clearTimer()
      observer.disconnect()
    }
  }, [input.evidence, input.loadState, input.offerId, input.provider, input.surface])

  return rootRef
}

export function trackHotelFundsPolicyDetailsOpened(input: {
  evidence: unknown
  loadState: HotelFundsPolicyLoadState
  offerId: string
  provider: string
}) {
  const key = eventKey(input.offerId, input.provider, 'hotel_card')
  if (openedKeys.has(key)) return
  openedKeys.add(key)
  emit('hotel_funds_policy_details_opened', getHotelFundsAnalyticsDimensions({ ...input, surface: 'hotel_card' }))
}

export function trackHotelFundsPolicyConfirmation(input: {
  evidence: unknown
  loadState: HotelFundsPolicyLoadState
  offerId?: string
  provider: string
  partnerNamed: boolean
}) {
  emit('hotel_funds_policy_confirm_clicked', {
    ...getHotelFundsAnalyticsDimensions({ ...input, surface: 'book_handoff' }),
    partnerNamed: input.partnerNamed,
  })
}

export function resetHotelFundsPolicyAnalyticsForTests() {
  viewedKeys.clear()
  openedKeys.clear()
}
