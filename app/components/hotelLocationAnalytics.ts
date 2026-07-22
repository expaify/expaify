import type { HotelLocationAnalytics } from './hotelLocationContext'

const INSPECTION_KEY_PREFIX = 'expaify:hotel-location-inspected:'

export type HotelLocationInspection = 'details' | 'pin'

export function markHotelLocationInspected(hotelId: string, inspection: HotelLocationInspection): void {
  try {
    window.sessionStorage.setItem(`${INSPECTION_KEY_PREFIX}${hotelId}`, inspection)
  } catch {
    // Analytics correlation is optional and must never affect hotel actions.
  }
}

export function wasHotelLocationInspected(hotelId: string): boolean {
  try {
    return window.sessionStorage.getItem(`${INSPECTION_KEY_PREFIX}${hotelId}`) !== null
  } catch {
    return false
  }
}

export function toTrackProps(properties: HotelLocationAnalytics): Record<string, string | number | boolean> {
  return { ...properties }
}
