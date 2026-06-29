'use client'

type Props = {
  verdict: 'Great' | 'Good' | 'Typical'
  confidence: 'high' | 'low'
}

export default function DealBadge({ verdict, confidence }: Props) {
  const colorClass =
    verdict === 'Great'
      ? 'bg-green-100 text-green-800'
      : verdict === 'Good'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-gray-100 text-gray-700'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorClass} ${
        confidence === 'low' ? 'opacity-70' : ''
      }`}
    >
      {verdict}
      {confidence === 'low' && (
        <span className="font-normal">(limited data)</span>
      )}
    </span>
  )
}
