import type { LocationQuality } from '@/lib/providers/locationQuality'

type LocationQualityBadgeProps = {
  data: LocationQuality
}

export function LocationQualityBadge({ data }: LocationQualityBadgeProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-raised)] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--text-3)]">Neighborhood</p>
      <span className="mt-1 inline-flex min-h-7 items-center gap-1 rounded-full bg-[var(--bg-muted)] px-3 py-1 text-xs font-medium text-[color:var(--text-1)]">
        {data.vibeTag}
      </span>
      <p className="mt-2 text-sm text-[color:var(--text-2)]">{data.summary}</p>
    </div>
  )
}
