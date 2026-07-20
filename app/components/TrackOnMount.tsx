'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics'

type TrackOnMountProps = {
  event: string
  props?: Record<string, string | number | boolean>
}

export function TrackOnMount({ event, props }: TrackOnMountProps) {
  useEffect(() => {
    track(event, props)
  }, [event, props])

  return null
}
