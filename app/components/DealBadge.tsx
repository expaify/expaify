'use client'

type Props = {
  verdict: 'Great' | 'Good' | 'Typical'
  confidence: 'high' | 'low'
}

export default function DealBadge({ verdict, confidence }: Props) {
  const isLowConfidence = confidence === 'low'

  let classes: string
  let prefix: string

  if (verdict === 'Great') {
    classes =
      'bg-green-500/15 text-green-400 border border-green-500/25'
    prefix = '🔥 '
  } else if (verdict === 'Good') {
    classes =
      'bg-blue-500/15 text-blue-400 border border-blue-500/25'
    prefix = '✓ '
  } else {
    classes = 'bg-white/5 text-gray-400 border border-white/10'
    prefix = ''
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes}`}
    >
      {prefix}
      {verdict}
      {isLowConfidence && (
        <span className="font-normal italic">(est.)</span>
      )}
    </span>
  )
}
