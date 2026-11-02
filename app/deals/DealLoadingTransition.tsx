'use client'

import type { ReactNode } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useDealMotion } from './DealMotion'

function LoadingLayer({ children }: { children: ReactNode }) {
  const present = useIsPresent()
  const { transition } = useDealMotion()
  return (
    <motion.div
      aria-hidden={!present || undefined}
      inert={!present || undefined}
      className={present ? undefined : 'pointer-events-none absolute inset-0'}
      exit={{ opacity: 0 }}
      transition={transition}
    >
      {children}
    </motion.div>
  )
}

// Retain only the departing skeleton, never a previous destination's results.
export function DealLoadingTransition({ loading, skeleton, children }: {
  loading: boolean
  skeleton: ReactNode
  children: ReactNode
}) {
  const { enabled, transition } = useDealMotion()
  return (
    <div className="relative">
      {enabled ? (
        <AnimatePresence initial={false}>
          {loading ? <LoadingLayer key="skeleton">{skeleton}</LoadingLayer> : null}
        </AnimatePresence>
      ) : loading ? skeleton : null}
      <motion.div initial={false} animate={{ opacity: loading && enabled ? 0 : 1 }} transition={transition}>
        {children}
      </motion.div>
    </div>
  )
}
