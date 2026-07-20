export function timeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null

  const timestamp = new Date(iso).getTime()
  if (!Number.isFinite(timestamp)) return null

  const diffMs = Date.now() - timestamp
  const minutes = Math.floor(diffMs / 60000)
  if (diffMs <= 0 || minutes < 2) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  if (hours < 48) return 'yesterday'

  return `${Math.floor(hours / 24)}d ago`
}
