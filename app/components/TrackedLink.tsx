'use client'

import type { ComponentProps, MouseEvent } from 'react'
import Link from 'next/link'
import { track } from '@/lib/analytics'

type TrackedLinkProps = ComponentProps<typeof Link> & {
  analyticsEvent: string
  analyticsProps: Record<string, string | number | boolean>
}

export function TrackedLink({ analyticsEvent, analyticsProps, onClick, ...props }: TrackedLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    track(analyticsEvent, analyticsProps)
    onClick?.(event)
  }

  return <Link {...props} onClick={handleClick} />
}

