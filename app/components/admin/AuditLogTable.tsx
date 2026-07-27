'use client'

import { useState } from 'react'
import { auditActionLabel, formatAdminDate, isMutationAction } from '@/lib/admin/uiPresentation'
import type { AdminAuditLogRow } from '@/lib/admin/dossier'

function diffKeys(before: unknown, after: unknown): string[] {
  const b = (before && typeof before === 'object' ? (before as Record<string, unknown>) : {}) ?? {}
  const a = (after && typeof after === 'object' ? (after as Record<string, unknown>) : {}) ?? {}
  const keys = new Set([...Object.keys(b), ...Object.keys(a)])
  return [...keys].filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
}

function Row({ row }: { row: AdminAuditLogRow }) {
  const [open, setOpen] = useState(false)
  const mutation = isMutationAction(row.action)
  const changed = mutation ? diffKeys(row.before, row.after) : []

  return (
    <>
      <div className="grid grid-cols-1 gap-1 border-b border-[var(--border)] py-3 text-sm last:border-b-0 md:hidden">
        <span className="text-xs text-[var(--text-3)]">{formatAdminDate(row.createdAt)}</span>
        <span className="text-[var(--text-1)]">{row.actorEmail}</span>
        <span className="font-medium text-[var(--text-1)]">{auditActionLabel(row.action)}</span>
        <span className="text-[var(--text-2)]">{row.reason || '—'}</span>
        {mutation ? (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="mt-1 w-fit text-xs font-bold text-[var(--brand)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            {open ? 'Hide details' : 'View details'}
          </button>
        ) : (
          <span className="mt-1 text-xs text-[var(--text-3)]">No data change — read-only view.</span>
        )}
        {open && <DiffBlock before={row.before} after={row.after} changed={changed} />}
      </div>

      <tr className="hidden border-b border-[var(--border)] text-sm last:border-b-0 md:table-row">
        <td className="py-3 pr-4 align-top text-[var(--text-2)]">{formatAdminDate(row.createdAt)}</td>
        <td className="py-3 pr-4 align-top text-[var(--text-1)]">{row.actorEmail}</td>
        <td className="py-3 pr-4 align-top font-medium text-[var(--text-1)]">{auditActionLabel(row.action)}</td>
        <td className="py-3 pr-4 align-top text-[var(--text-2)]">{row.reason || '—'}</td>
        <td className="py-3 align-top">
          {mutation ? (
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              className="text-xs font-bold text-[var(--brand)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              {open ? 'Hide details' : 'View details'}
            </button>
          ) : (
            <span className="text-xs text-[var(--text-3)]">No data change — read-only view.</span>
          )}
        </td>
      </tr>
      {mutation && open && (
        <tr className="hidden md:table-row">
          <td colSpan={5} className="pb-3">
            <DiffBlock before={row.before} after={row.after} changed={changed} />
          </td>
        </tr>
      )}
    </>
  )
}

function DiffBlock({ before, after, changed }: { before: unknown; after: unknown; changed: string[] }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-muted)] p-3 font-mono text-xs text-[var(--text-1)]">
      <p className="mb-1 font-sans text-xs font-bold text-[var(--text-2)]">Changed: {changed.length ? changed.join(', ') : 'none'}</p>
      <pre className="whitespace-pre-wrap break-all">Before: {JSON.stringify(before ?? {}, null, 2)}</pre>
      <pre className="whitespace-pre-wrap break-all">After: {JSON.stringify(after ?? {}, null, 2)}</pre>
    </div>
  )
}

export function AuditLogTable({ rows }: { rows: AdminAuditLogRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--text-2)]">No admin activity recorded for this account yet.</p>
  }

  return (
    <div>
      <div className="md:hidden">
        {rows.map((row) => (
          <Row key={row.id} row={row} />
        ))}
      </div>
      <table className="hidden w-full text-left md:table">
        <thead>
          <tr className="border-b border-[var(--border-strong)] text-xs text-[var(--text-3)]">
            <th scope="col" className="py-2 pr-4 font-medium">Time</th>
            <th scope="col" className="py-2 pr-4 font-medium">Actor</th>
            <th scope="col" className="py-2 pr-4 font-medium">Action</th>
            <th scope="col" className="py-2 pr-4 font-medium">Reason</th>
            <th scope="col" className="py-2 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
