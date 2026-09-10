'use client'

import type { MouseEvent } from 'react'

export function SkipToContent() {
  function skip(event: MouseEvent<HTMLAnchorElement>) {
    // Also supports existing booking landmarks without editing payment files.
    const main = document.querySelector<HTMLElement>('main')
    if (!main) return
    event.preventDefault()
    main.tabIndex = -1
    main.focus()
    main.scrollIntoView()
  }

  return (
    <a href="#main-content" onClick={skip} className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[color:var(--bg)] focus:px-4 focus:py-3 focus:text-[color:var(--ink)] focus:outline-2 focus:outline-offset-2 focus:outline-[color:var(--brand)]">
      Skip to main content
    </a>
  )
}
