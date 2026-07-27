'use client'

import { useState } from 'react'

interface CopyButtonProps {
  value: string
  fieldLabel: string
}

export function CopyButton({ value, fieldLabel }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access denied or unavailable — nothing to recover here.
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${fieldLabel}`}
        className="rounded-[var(--radius-control)] border border-[var(--border)] px-2 py-0.5 text-xs font-medium text-[var(--text-2)] hover:border-[var(--border-strong)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
      >
        Copy
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Copied' : ''}
      </span>
    </span>
  )
}
