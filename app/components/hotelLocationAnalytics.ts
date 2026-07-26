'use client'

import { track } from '@/lib/analytics'
import type { HotelLocationAnalytics } from './hotelLocationContext'

const INSPECTED_KEY = 'expaify.hotel-location.inspected.v1'
const impressionKeys = new Set<string>()

function emit(event: string, props: Record<string, string | number | boolean>) {
  try {
    track(event, props)
  } catch {
    // Location analytics must never block review, map navigation, or provider handoff.
  }
}

export function trackHotelLocationImpression(props: HotelLocationAnalytics): void {
  const key = `${props.hotelId}:${props.evidenceState}:${props.anchorId}`
  if (impressionKeys.has(key)) return
  impressionKeys.add(key)
  emit('hotel_location_impression', props)
}

export function markHotelLocationInspected(hotelId: string): void {
  try {
    const inspected = JSON.parse(window.sessionStorage.getItem(INSPECTED_KEY) ?? '[]') as unknown
    const hotelIds = Array.isArray(inspected)
      ? inspected.filter((value): value is string => typeof value === 'string')
      : []
    if (!hotelIds.includes(hotelId)) hotelIds.push(hotelId)
    window.sessionStorage.setItem(INSPECTED_KEY, JSON.stringify(hotelIds))
  } catch {
    // Correlation is optional; storage failure must not alter the experience.
  }
}

export function wasHotelLocationInspected(hotelId: string): boolean {
  try {
    const inspected = JSON.parse(window.sessionStorage.getItem(INSPECTED_KEY) ?? '[]') as unknown
    return Array.isArray(inspected) && inspected.includes(hotelId)
  } catch {
    return false
  }
}

export function trackHotelLocationDetailsOpened(props: HotelLocationAnalytics): void {
  markHotelLocationInspected(props.hotelId)
  emit('hotel_location_details_opened', props)
}

export function trackHotelLocationPinOpened(props: HotelLocationAnalytics): void {
  markHotelLocationInspected(props.hotelId)
  emit('hotel_location_pin_opened', {
    ...props,
    mapTarget: 'external_coordinate_map',
  })
}

export function trackHotelReviewOpenedAfterLocation(props: HotelLocationAnalytics): void {
  if (!wasHotelLocationInspected(props.hotelId)) return
  emit('hotel_review_opened_after_location', { ...props, sameProperty: true })
}

export function trackHotelProviderHandoffAfterLocation(props: HotelLocationAnalytics): void {
  if (!wasHotelLocationInspected(props.hotelId)) return
  emit('hotel_provider_handoff_after_location', { ...props, sameProperty: true })
}
