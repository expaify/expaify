'use client'

type Props = {
  verdict: 'Great' | 'Good' | 'Typical'
  confidence: 'high' | 'low'
}

export default function DealBadge({ verdict, confidence }: Props) {
  const isLowConfidence = confidence === 'low'

  let classes: string
  let label: string

  if (isLowConfidence) {
    classes = 'bg-[color:var(--warning-soft)] text-[color:var(--warning)] border border-[color:var(--border-strong)]'
    label = 'Limited history'
  } else if (verdict === 'Great') {
    classes = 'bg-[color:var(--success-soft)] text-[color:var(--success)] border border-[color:var(--border-strong)]'
    label = verdict
  } else if (verdict === 'Good') {
    classes = 'bg-[color:var(--brand-soft)] text-[color:var(--brand)] border border-[color:var(--border-strong)]'
    label = verdict
  } else {
    classes = 'bg-[color:var(--bg-muted)] text-[color:var(--text-2)] border border-[color:var(--border)]'
    label = verdict
  }

  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${classes}`}
    >
      {label}
    </span>
  )
}
