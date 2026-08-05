'use client'

import { useEffect, useRef } from 'react'
import { track } from '@/lib/analytics'
import type { HotelPaymentAcceptancePresentation } from '@/lib/types'

const KNOWN_SOURCES = new Set(['hotellook', 'duffel', 'amadeus', 'kiwi', 'travelpayouts'])
const OPAQUE_VALUE = /^[A-Za-z0-9_-]{1,100}$/
const viewedKeys = new Set<string>()

function normalizedSource(source: string): string {
  const value = source.trim().toLowerCase()
  return KNOWN_SOURCES.has(value) ? value : 'other'
}

function viewportGroup(): 'mobile_375' | 'desktop_1280' | 'other' {
  if (typeof window === 'undefined') return 'other'
  if (window.innerWidth <= 479) return 'mobile_375'
  if (window.innerWidth >= 1024) return 'desktop_1280'
  return 'other'
}

/**
 * Instruments discovery §4's "Per-gate evidence completeness" and "Conflation rate" baselines:
 * how many rows are confirmed vs. still not_confirmed vs. actively conflicting, per surface.
 */
function evidenceState(presentation: HotelPaymentAcceptancePresentation): 'loading' | 'error' | 'all_not_confirmed' | 'partial' | 'complete' | 'conflicting' {
  if (presentation.state !== 'ready') return presentation.state
  if (presentation.rows.some(row => row.tone === 'conflicting')) return 'conflicting'
  const confirmedCount = presentation.rows.filter(row => row.tone === 'confirmed_positive' || row.tone === 'confirmed_negative').length
  if (confirmedCount === 0) return 'all_not_confirmed'
  if (confirmedCount === presentation.rows.length) return 'complete'
  return 'partial'
}

function cardRequiredDimension(presentation: HotelPaymentAcceptancePresentation): 'required' | 'not_required' | 'not_confirmed' | 'conflicting' | 'unknown' {
  if (presentation.state !== 'ready') return 'unknown'
  const row = presentation.rows.find(candidate => candidate.id === 'card_required_at_property')
  if (!row) return 'unknown'
  if (row.tone === 'conflicting') return 'conflicting'
  if (row.tone === 'confirmed_positive') return 'required'
  if (row.tone === 'confirmed_negative') return 'not_required'
  return 'not_confirmed'
}

function emit(event: string, props: Record<string, string>) {
  try {
    track(event, props)
  } catch {
    // Analytics is observational and must never block review or handoff.
  }
}

export function useHotelPaymentAcceptanceViewed(input: {
  presentation: HotelPaymentAcceptancePresentation
  hotelId: string
  source: string
}) {
  const key = `${input.hotelId}:handoff`
  const firedRef = useRef(false)

  useEffect(() => {
    if (!OPAQUE_VALUE.test(input.hotelId)) return
    if (firedRef.current || viewedKeys.has(key)) return
    firedRef.current = true
    viewedKeys.add(key)
    emit('hotel_payment_acceptance_viewed', {
      hotel_id: input.hotelId,
      surface: 'handoff',
      source: normalizedSource(input.source),
      evidence_state: evidenceState(input.presentation),
      card_required: cardRequiredDimension(input.presentation),
      viewport_group: viewportGroup(),
    })
    // Fires once per hotel per mount; re-running on prop changes would double-count the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

/** Fires on the outbound booking-partner click when payment acceptance is not fully confirmed. */
export function trackHotelHandoffWithPaymentUnconfirmed(input: {
  presentation: HotelPaymentAcceptancePresentation
  hotelId: string
  source: string
}) {
  if (!OPAQUE_VALUE.test(input.hotelId)) return
  const state = evidenceState(input.presentation)
  if (state === 'complete') return
  emit('hotel_handoff_with_payment_unconfirmed', {
    hotel_id: input.hotelId,
    surface: 'handoff',
    source: normalizedSource(input.source),
    evidence_state: state,
    card_required: cardRequiredDimension(input.presentation),
  })
}

export function resetHotelPaymentAcceptanceAnalyticsForTests() {
  viewedKeys.clear()
}
