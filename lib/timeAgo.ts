/** Relative time for freshness labels. Null/undefined in → null out: callers
    must render nothing rather than a fabricated "today". Future timestamps
    (clock skew) clamp to "just now". */
export function timeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  const diff = Date.now() - t
  if (diff < 2 * 60_000) return 'just now'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  if (hours < 48) return 'yesterday'
  return `${Math.floor(hours / 24)}d ago`
}
