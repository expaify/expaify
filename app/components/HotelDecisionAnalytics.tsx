'use client'

import { useEffect, useRef } from 'react'
import { track } from '@/lib/analytics'

export type HotelDecisionEntrySource = 'search' | 'saved' | 'direct'
export type HotelDecisionScoreState = 'confident' | 'low_confidence' | 'loading' | 'unavailable' | 'error'
export type HotelDecisionPriceFreshnessState = 'fresh' | 'aging' | 'stale' | 'unknown' | 'expired'

type HotelDecisionAnalyticsProps = {
  hotelId: string
  entrySource: HotelDecisionEntrySource
  hasDates: boolean
  hasVerifiedGuestRating: boolean
  scoreState: HotelDecisionScoreState
  priceFreshnessState: HotelDecisionPriceFreshnessState
  viewedProps?: Record<string, string | number | boolean>
}

const SECTION_VISIBLE_MS = 1000
const SECTION_VISIBILITY_THRESHOLDS = [0, 0.25, 0.5, 0.75, 1]

function viewportGroup(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop'
  if (window.innerWidth < 640) return 'mobile'
  if (window.innerWidth < 1024) return 'tablet'
  return 'desktop'
}

function meetsVisibilityBar(entry: IntersectionObserverEntry): boolean {
  if (entry.intersectionRatio >= 0.5) return true
  const viewportArea = window.innerWidth * window.innerHeight
  if (viewportArea <= 0) return false
  const visibleArea = entry.intersectionRect.width * entry.intersectionRect.height
  return visibleArea / viewportArea >= 0.5
}

export function HotelDecisionAnalytics({
  hotelId,
  entrySource,
  hasDates,
  hasVerifiedGuestRating,
  scoreState,
  priceFreshnessState,
  viewedProps,
}: HotelDecisionAnalyticsProps) {
  const reachedSections = useRef(new Set<string>())

  useEffect(() => {
    track('hotel_detail_viewed', {
      ...viewedProps,
      hotel_id: hotelId,
      entry_source: entrySource,
      viewport_group: viewportGroup(),
      has_dates: hasDates,
      has_verified_guest_rating: hasVerifiedGuestRating,
      score_state: scoreState,
      price_freshness_state: priceFreshnessState,
    })
    // Fires once per mounted detail view; re-running on prop changes would double-count the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-hotel-decision-section]'))
    if (sections.length === 0) return

    const timers = new Map<Element, ReturnType<typeof setTimeout>>()

    const clearTimer = (target: Element) => {
      const timer = timers.get(target)
      if (timer !== undefined) {
        clearTimeout(timer)
        timers.delete(target)
      }
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const section = entry.target.getAttribute('data-hotel-decision-section')
        if (!section) continue
        if (reachedSections.current.has(section)) {
          observer.unobserve(entry.target)
          continue
        }

        if (!meetsVisibilityBar(entry)) {
          clearTimer(entry.target)
          continue
        }

        if (timers.has(entry.target)) continue
        const position = entry.target.getAttribute('data-hotel-decision-position') ?? undefined
        const timer = setTimeout(() => {
          if (reachedSections.current.has(section)) return
          reachedSections.current.add(section)
          observer.unobserve(entry.target)
          track('hotel_decision_section_reached', {
            hotel_id: hotelId,
            entry_source: entrySource,
            section,
            ...(position !== undefined ? { position } : {}),
            viewport_group: viewportGroup(),
          })
        }, SECTION_VISIBLE_MS)
        timers.set(entry.target, timer)
      }
    }, { threshold: SECTION_VISIBILITY_THRESHOLDS })

    sections.forEach(section => observer.observe(section))

    return () => {
      observer.disconnect()
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [hotelId, entrySource])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as { closest?: (selector: string) => HTMLElement | null } | null
      if (!target || typeof target.closest !== 'function') return

      const backEl = target.closest('[data-hotel-back]')
      if (backEl) {
        track('hotel_detail_back_to_results', {
          hotel_id: hotelId,
          entry_source: entrySource,
        })
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [hotelId, entrySource])

  return null
}
