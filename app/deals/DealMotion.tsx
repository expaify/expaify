'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'

// Match the shared CSS token before hydration, then read its active theme value.
const DEFAULT_EASE = [0.16, 1, 0.3, 1] as const

export function useDealMotion() {
  const reducedMotion = useReducedMotion()
  const [ease, setEase] = useState<readonly [number, number, number, number]>(DEFAULT_EASE)
  useEffect(() => {
    const value = window.getComputedStyle?.(document.documentElement)
      .getPropertyValue('--ease-out-expo').trim()
    const values = value?.match(/^cubic-bezier\(([^)]+)\)$/)?.[1].split(',').map(Number)
    if (values?.length === 4 && values.every(Number.isFinite)) {
      setEase(values as [number, number, number, number])
    }
  }, [])
  // Unknown preference (SSR) is deliberately static as well.
  const enabled = reducedMotion === false
  return { enabled, transition: { duration: enabled ? 0.3 : 0, ease } }
}
