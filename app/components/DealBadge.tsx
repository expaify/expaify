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
    classes = 'bg-amber-500/10 text-amber-300 border border-amber-500/25'
    label = 'Limited history'
  } else if (verdict === 'Great') {
    classes = 'bg-green-500/15 text-green-400 border border-green-500/25'
    label = verdict
  } else if (verdict === 'Good') {
    classes = 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
    label = verdict
  } else {
    classes = 'bg-white/5 text-gray-400 border border-white/10'
    label = verdict
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes}`}
    >
      {label}
    </span>
  )
}
