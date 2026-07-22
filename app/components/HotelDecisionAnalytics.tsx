'use client'

import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { track } from '@/lib/analytics'

export type HotelScoreState = 'confident' | 'low_confidence' | 'unavailable' | 'error' | 'loading'
export type HotelPriceFreshnessState = 'fresh' | 'aging' | 'stale' | 'unknown' | 'expired'

export type HotelDecisionAnalyticsContext = {
  hotelId: string
  entrySource: 'hotel_results' | 'saved_deals' | 'direct'
  hasDates: boolean
  hasVerifiedGuestRating: boolean
  scoreState: HotelScoreState
  priceFreshnessState: HotelPriceFreshnessState
}

type Props = HotelDecisionAnalyticsContext & { children: ReactNode }

function viewportGroup(): 'mobile' | 'desktop' {
  return typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop'
}

function emit(event: string, props: Record<string, string | number | boolean>): void {
  try {
    track(event, props)
  } catch {
    // Measurement must never change navigation or detail usability.
  }
}

export function priceFreshnessState(checkedAt?: string | null, expired = false, now = Date.now()): HotelPriceFreshnessState {
  if (expired) return 'expired'
  if (!checkedAt) return 'unknown'
  const checkedAtMs = Date.parse(checkedAt)
  if (!Number.isFinite(checkedAtMs)) return 'unknown'
  const ageHours = Math.max(0, now - checkedAtMs) / 3_600_000
  if (ageHours >= 48) return 'stale'
  if (ageHours >= 30) return 'aging'
  return 'fresh'
}

export function HotelDecisionAnalytics({ children, ...context }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const reachedRef = useRef(new Set<string>())
  const timersRef = useRef(new Map<Element, ReturnType<typeof setTimeout>>())

  const baseProps = () => ({
    hotel_id: context.hotelId,
    entry_source: context.entrySource,
    viewport_group: viewportGroup(),
    has_dates: context.hasDates,
    has_verified_guest_rating: context.hasVerifiedGuestRating,
    score_state: context.scoreState,
    price_freshness_state: context.priceFreshnessState,
  })

  useEffect(() => {
    emit('hotel_detail_viewed', baseProps())
    const root = rootRef.current
    if (!root || typeof root.querySelectorAll !== 'function' || typeof IntersectionObserver === 'undefined') return

    const timers = timersRef.current
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement
        const section = element.dataset.hotelDecisionSection
        const position = Number(element.dataset.hotelDecisionPosition)
        if (!section || !Number.isInteger(position) || reachedRef.current.has(section)) continue

        if (!entry.isIntersecting || entry.intersectionRatio < 0.5) {
          const timer = timers.get(element)
          if (timer) clearTimeout(timer)
          timers.delete(element)
          continue
        }
        if (timers.has(element)) continue

        timers.set(element, setTimeout(() => {
          timers.delete(element)
          if (reachedRef.current.has(section)) return
          reachedRef.current.add(section)
          emit('hotel_decision_section_reached', { ...baseProps(), section, position })
        }, 1_000))
      }
    }, { threshold: [0, 0.5] })

    root.querySelectorAll('[data-hotel-decision-section]').forEach((section) => observer.observe(section))
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
      observer.disconnect()
    }
  // The detail context is immutable for the lifetime of this mounted view.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as Element | null
    const providerLink = target?.closest<HTMLElement>('[data-hotel-provider]')
    if (providerLink) {
      emit('hotel_room_handoff_started', {
        ...baseProps(),
        provider: providerLink.dataset.hotelProvider || 'provider',
      })
      return
    }

    if (target?.closest('[data-hotel-back]')) {
      emit('hotel_detail_back_to_results', baseProps())
    }
  }

  return <div ref={rootRef} onClick={handleClick}>{children}</div>
}
