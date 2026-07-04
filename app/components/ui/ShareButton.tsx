'use client'

import { useEffect, useRef, useState } from 'react'

type ShareButtonProps = {
  ariaLabel?: string
}

export function ShareButton({ ariaLabel = 'Copy link to this deal' }: ShareButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setStatus('idle'), 2000)
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span role="status" className="text-caption font-medium text-[color:var(--ink-soft)]">
        {status === 'copied' ? 'Link copied' : status === 'failed' ? 'Couldn’t copy link' : ''}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={ariaLabel}
        className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] border-[1.5px] border-[color:var(--line-white)] bg-[color:var(--surface)] text-[color:var(--ink)] transition-colors duration-100 hover:border-[color:var(--primary)]"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </button>
    </div>
  )
}
