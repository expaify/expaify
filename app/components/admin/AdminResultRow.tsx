'use client'

import { useRouter } from 'next/navigation'
import { CopyButton } from './CopyButton'
import { statusBadgeLabel } from '@/lib/admin/uiPresentation'
import type { AdminAccountSummary } from '@/lib/admin/lookup'

interface AdminResultRowProps {
  account: AdminAccountSummary
  headingRef?: React.Ref<HTMLSpanElement>
}

export function AdminResultRow({ account, headingRef }: AdminResultRowProps) {
  const router = useRouter()
  const name = account.name || 'No name on file'
  const email = account.email || 'No email on file'
  const shortId = account.userId.slice(0, 8)
  const badge = statusBadgeLabel(account.status, account.entitlementSource)

  function open() {
    router.push(`/admin/users/${account.userId}`)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View account for ${email}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open()
        }
      }}
      className="flex flex-col items-start justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 cursor-pointer sm:flex-row sm:items-center focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
    >
      <div className="min-w-0">
        <span ref={headingRef} tabIndex={-1} className="block text-sm font-medium text-[var(--text-1)] focus-visible:outline-none">
          {name}
        </span>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-2)]">
          <span className="break-all">{email}</span>
          <span className="inline-flex items-center gap-1">
            <span className="break-all">{shortId}…</span>
            <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <CopyButton value={account.userId} fieldLabel="user ID" />
            </span>
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--bg-muted)] px-2.5 py-1 text-xs font-medium text-[var(--text-1)]">
          {badge}
        </span>
        <span className="text-sm font-medium text-[var(--brand)]">View account</span>
      </div>
    </div>
  )
}
