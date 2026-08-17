'use client'

import { useEffect } from 'react'
import { captureUtmAttribution } from '@/lib/attribution'
import { track } from '@/lib/analytics'

export function AttributionCapture() {
  useEffect(() => {
    captureUtmAttribution()
    const params = new URLSearchParams(window.location.search)
    if (params.get('ref') !== 'digest') return
    const key = `expaify.alert-click.${window.location.pathname}${window.location.search}`
    try {
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, '1')
    } catch {
      // Storage is optional; analytics remains best effort.
    }
    track('alert_click')
  }, [])

  return null
}
