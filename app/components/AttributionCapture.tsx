'use client'

import { useEffect } from 'react'
import { captureUtmAttribution } from '@/lib/attribution'

export function AttributionCapture() {
  useEffect(() => {
    captureUtmAttribution()
  }, [])

  return null
}
