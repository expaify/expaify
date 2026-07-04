'use client'

type Point = { date: string; price_cents: number }

type Props = {
  history: Point[]
  dealPriceCents: number
  medianPriceCents: number
}

export function PriceSparkline({ history, dealPriceCents, medianPriceCents }: Props) {
  if (history.length < 2) {
    return (
      <div className="flex h-[80px] items-center justify-center rounded-[12px] bg-[color:var(--surface)] text-[12px] text-[color:var(--ink-faint)]">
        Not enough history to show chart
      </div>
    )
  }

  const W = 560
  const H = 80
  const PAD = { top: 10, right: 12, bottom: 10, left: 12 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const prices = history.map(p => p.price_cents)
  const minP = Math.min(...prices, dealPriceCents)
  const maxP = Math.max(...prices, medianPriceCents)
  const range = maxP - minP || 1

  const xScale = (i: number) => PAD.left + (i / (history.length - 1)) * innerW
  const yScale = (p: number) => PAD.top + innerH - ((p - minP) / range) * innerH

  const linePath = history
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(p.price_cents).toFixed(1)}`)
    .join(' ')

  const areaPath = `${linePath} L${xScale(history.length - 1).toFixed(1)},${H} L${xScale(0).toFixed(1)},${H} Z`

  // Find the point closest to deal price
  const dealIdx = history.reduce((best, p, i) =>
    Math.abs(p.price_cents - dealPriceCents) < Math.abs(history[best].price_cents - dealPriceCents) ? i : best, 0)
  const dotX = xScale(dealIdx)
  const dotY = yScale(history[dealIdx].price_cents)

  // Median line Y
  const medianY = yScale(medianPriceCents)

  const startDate = new Date(history[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endDate = new Date(history[history.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible"
        aria-hidden
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaPath} fill="url(#sparkGrad)" />

        {/* Median dashed line */}
        <line
          x1={PAD.left} y1={medianY}
          x2={W - PAD.right} y2={medianY}
          stroke="var(--gold)" strokeWidth="1" strokeDasharray="4 3" opacity="0.7"
        />

        {/* Price line */}
        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Deal price dot */}
        <circle cx={dotX} cy={dotY} r="5" fill="var(--gold)" stroke="var(--surface)" strokeWidth="2" />
      </svg>

      <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-[11px] text-[color:var(--ink-faint)]">
        <span>{startDate}</span>
        <span className="font-medium text-[color:var(--ink-soft)]">
          <span aria-hidden className="text-[color:var(--gold)]">●</span> deal price
        </span>
        <span className="text-[color:var(--ink-soft)]">
          <span aria-hidden className="text-[color:var(--gold)]">– –</span> usual price
        </span>
        <span>{endDate}</span>
      </div>
    </div>
  )
}
