'use client'

import { useEffect, useRef } from 'react'
import { track } from '@/lib/analytics'
import { ADMISSION_FAMILY_ORDER } from '@/lib/hotels/admissionPolicy'
import type { HotelAdmissionPresentation } from '@/lib/types'

const KNOWN_SOURCES = new Set(['hotellook', 'duffel', 'kiwi', 'travelpayouts'])
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

function familyList(presentation: HotelAdmissionPresentation, rowState?: 'restricted'): string {
  if (presentation.state !== 'reported') return 'none'
  const families = rowState
    ? presentation.rows.filter(row => row.rowState === rowState)
    : presentation.rows
  if (families.length === 0) return 'none'
  return ADMISSION_FAMILY_ORDER.filter(family => families.some(row => row.family === family)).join(',')
}

function emit(event: string, props: Record<string, string>) {
  try {
    track(event, props)
  } catch {
    // Analytics is observational and must never block review or handoff.
  }
}

export function useHotelAdmissionPolicyViewed(input: {
  presentation: HotelAdmissionPresentation
  hotelId: string
  source: string
  surface: 'results' | 'handoff'
}) {
  const key = `${input.hotelId}:${input.surface}`
  const firedRef = useRef(false)

  useEffect(() => {
    if (!OPAQUE_VALUE.test(input.hotelId)) return
    if (firedRef.current || viewedKeys.has(key)) return
    firedRef.current = true
    viewedKeys.add(key)
    emit('hotel_admission_policy_viewed', {
      hotel_id: input.hotelId,
      surface: input.surface,
      source: normalizedSource(input.source),
      evidence_state: input.presentation.state,
      families_reported: familyList(input.presentation),
      viewport_group: viewportGroup(),
    })
    // Fires once per hotel per surface per mount; re-running on prop changes would double-count the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}

export function trackHotelHandoffWithAdmissionRestriction(input: {
  presentation: HotelAdmissionPresentation
  hotelId: string
  source: string
}) {
  if (!OPAQUE_VALUE.test(input.hotelId)) return
  const restrictedFamilies = familyList(input.presentation, 'restricted')
  if (restrictedFamilies === 'none') return
  emit('hotel_handoff_with_admission_restriction', {
    hotel_id: input.hotelId,
    surface: 'handoff',
    source: normalizedSource(input.source),
    restricted_families: restrictedFamilies,
  })
}

export function resetHotelAdmissionPolicyAnalyticsForTests() {
  viewedKeys.clear()
}
