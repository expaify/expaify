'use client'

import { useEffect, useRef, useState } from 'react'
import type { Result } from '@/lib/types'

export type MutationFieldKind = 'reason' | 'source'

export interface AdminMutationDialogConfig {
  title: string
  body: React.ReactNode
  warning?: React.ReactNode
  fieldKind: MutationFieldKind
  fieldLabel: string
  fieldPlaceholder: string
  errorActionPhrase: string
  includeExpiry?: boolean
  beforeText: string
  afterText: string | ((expiresAt: string | null) => string)
  stripeImpact: string
  confirmLabel: string
  confirmingLabel: string
  failureMessage: string
  onConfirm: (values: { text: string; expiresAt: string | null }) => Promise<Result<unknown>>
}

interface AdminMutationDialogProps {
  config: AdminMutationDialogConfig
  onClose: () => void
  onSuccess: () => void
}

const MIN_LENGTH = 10

export function AdminMutationDialog({ config, onClose, onSuccess }: AdminMutationDialogProps) {
  const [text, setText] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const titleId = useRef(`admin-dialog-title-${Math.random().toString(36).slice(2)}`).current
  const errorId = useRef(`admin-dialog-error-${Math.random().toString(36).slice(2)}`).current

  const trimmed = text.trim()
  const valid = trimmed.length >= MIN_LENGTH
  const confirmDisabled = !valid || submitting

  useEffect(() => {
    window.requestAnimationFrame(() => fieldRef.current?.focus())
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), input:not([disabled])') ?? []
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  })

  async function handleConfirm() {
    setAttempted(true)
    if (!valid || submitting) {
      fieldRef.current?.focus()
      return
    }
    setSubmitting(true)
    setFailure(null)
    const result = await config.onConfirm({ text: trimmed, expiresAt: expiresAt || null })
    setSubmitting(false)
    if (result.ok) {
      onSuccess()
    } else {
      setFailure(config.failureMessage)
    }
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (!confirmDisabled) void handleConfirm()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-[color:color-mix(in_srgb,var(--text-1)_32%,transparent)] sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[100dvh] w-full flex-col overflow-y-auto rounded-t-[var(--radius-card)] bg-[var(--bg-surface)] p-5 sm:max-h-[min(720px,calc(100dvh-3rem))] sm:max-w-[560px] sm:rounded-[var(--radius-card)] sm:p-6"
      >
        <h2 id={titleId} className="text-h3 text-[var(--text-1)]">
          {config.title}
        </h2>
        <p className="mt-2 text-sm text-[var(--text-2)]">{config.body}</p>
        {config.warning && (
          <div className="mt-3 rounded-[var(--radius-control)] border border-[var(--gold)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--text-1)]">
            {config.warning}
          </div>
        )}

        <div className="mt-4">
          <label htmlFor={`${titleId}-field`} className="mb-1.5 block text-xs font-bold text-[var(--text-1)]">
            {config.fieldLabel}
          </label>
          <textarea
            ref={fieldRef}
            id={`${titleId}-field`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder={config.fieldPlaceholder}
            rows={3}
            aria-invalid={attempted && !valid ? true : undefined}
            aria-describedby={attempted && !valid ? errorId : undefined}
            className={`min-h-[88px] w-full rounded-[var(--radius-control)] border bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-1)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] ${
              attempted && !valid ? 'border-[var(--error)]' : 'border-[var(--border-strong)]'
            }`}
          />
          {attempted && !valid && (
            <p id={errorId} className="mt-1 text-xs text-[var(--error-text)]">
              Enter a reason (at least 10 characters) before {config.errorActionPhrase}.
            </p>
          )}
        </div>

        {config.includeExpiry && (
          <div className="mt-4">
            <label htmlFor={`${titleId}-expiry`} className="mb-1.5 block text-xs font-bold text-[var(--text-1)]">
              Access ends (optional)
            </label>
            <input
              id={`${titleId}-expiry`}
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-1)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            />
            <p className="mt-1 text-xs text-[var(--text-3)]">Leave blank for comp access that doesn&apos;t expire on its own.</p>
          </div>
        )}

        <div className="mt-4 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-3 text-sm text-[var(--text-2)]">
          <p>{config.beforeText}</p>
          <p className="mt-1">
            {typeof config.afterText === 'function' ? config.afterText(expiresAt || null) : config.afterText}
          </p>
        </div>

        <p className="mt-3 text-xs text-[var(--text-3)]">{config.stripeImpact}</p>

        {failure && (
          <p role="alert" className="mt-3 text-sm text-[var(--error-text)]">
            {failure}
          </p>
        )}

        <div className="sticky bottom-0 mt-5 flex flex-col gap-2 border-t border-[var(--border)] bg-[var(--bg-surface)] pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 text-sm font-bold text-[var(--text-1)] disabled:opacity-60 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={confirmDisabled}
            aria-disabled={confirmDisabled}
            className="min-h-11 rounded-[var(--radius-control)] bg-[var(--brand)] px-4 text-sm font-bold text-[var(--text-inverse)] disabled:opacity-60 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            {submitting ? config.confirmingLabel : config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

interface StripeHandoffDialogProps {
  email: string
  stripeCustomerId: string
  onClose: () => void
}

export function StripeHandoffDialog({ email, stripeCustomerId, onClose }: StripeHandoffDialogProps) {
  const buttonRef = useRef<HTMLAnchorElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useRef(`admin-stripe-dialog-${Math.random().toString(36).slice(2)}`).current

  useEffect(() => {
    window.requestAnimationFrame(() => buttonRef.current?.focus())
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button, a[href]') ?? [])
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-[color:color-mix(in_srgb,var(--text-1)_32%,transparent)] sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full rounded-t-[var(--radius-card)] bg-[var(--bg-surface)] p-5 sm:max-w-[560px] sm:rounded-[var(--radius-card)] sm:p-6"
      >
        <h2 id={titleId} className="text-h3 text-[var(--text-1)]">
          Cancel Stripe subscription
        </h2>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          expaify can&apos;t cancel Stripe subscriptions from this screen. Open Stripe Dashboard to cancel{' '}
          {email}&apos;s subscription there, where billing is the source of truth.
        </p>
        <p className="mt-3 text-xs text-[var(--text-3)]">
          Once you cancel in Stripe, this page updates when Stripe sends the cancellation event — usually
          within a minute. Refresh if it doesn&apos;t.
        </p>
        <div className="mt-5 flex flex-col gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 text-sm font-bold text-[var(--text-1)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            Cancel
          </button>
          <a
            ref={buttonRef}
            href={`https://dashboard.stripe.com/customers/${stripeCustomerId}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-[var(--brand)] px-4 text-sm font-bold text-[var(--text-inverse)] no-underline focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            Open in Stripe Dashboard ↗
          </a>
        </div>
      </div>
    </div>
  )
}
