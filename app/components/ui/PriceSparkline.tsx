'use client'

type Point = { date: string; price_cents: number }

type Props = {
  history: Point[]
  dealPriceCents: number
  medianPriceCents: number
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

function formatShortDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Ratios that decide how the trend is described. Tuned so a near-flat line
// reads as "steady" rather than a misleading up/down claim, and so a single
// outlier point (relative to the rest of the series) reads as a spike/dip
// rather than getting averaged away.
const FLAT_RANGE_RATIO = 0.05
const OUTLIER_RATIO = 0.12
const ENDPOINTS_CLOSE_RATIO = 0.06

// Builds a prose description of the price trend directly from the real
// history data -- no canned copy, every figure traces back to a prop.
function describeTrend(history: Point[], dealPriceCents: number, medianPriceCents: number): string {
  const prices = history.map(p => p.price_cents)
  const n = prices.length
  const avg = prices.reduce((sum, p) => sum + p, 0) / n
  const first = prices[0]
  const last = prices[n - 1]

  let maxIdx = 0
  let minIdx = 0
  prices.forEach((p, i) => {
    if (p > prices[maxIdx]) maxIdx = i
    if (p < prices[minIdx]) minIdx = i
  })
  const max = prices[maxIdx]
  const min = prices[minIdx]
  const range = max - min

  const startDate = formatShortDate(history[0].date)
  const endDate = formatShortDate(history[n - 1].date)

  let trendSentence: string
  if (avg <= 0 || range / avg < FLAT_RANGE_RATIO) {
    trendSentence = `held steady around ${formatCents(avg)} with no significant swings`
  } else {
    const maxIsInterior = maxIdx > 0 && maxIdx < n - 1
    const minIsInterior = minIdx > 0 && minIdx < n - 1
    const endpointsClose = Math.abs(first - last) / avg < ENDPOINTS_CLOSE_RATIO

    if (endpointsClose && maxIsInterior && (max - avg) / avg > OUTLIER_RATIO && max - avg >= avg - min) {
      trendSentence = `spiked to ${formatCents(max)} around ${formatShortDate(history[maxIdx].date)} before returning to around ${formatCents(last)}`
    } else if (endpointsClose && minIsInterior && (avg - min) / avg > OUTLIER_RATIO && avg - min > max - avg) {
      trendSentence = `dipped to ${formatCents(min)} around ${formatShortDate(history[minIdx].date)} before returning to around ${formatCents(last)}`
    } else if (last < first) {
      const pctDown = Math.round(((first - last) / first) * 100)
      trendSentence = `trended down from ${formatCents(first)} to ${formatCents(last)}, a drop of about ${pctDown}%`
    } else if (last > first) {
      const pctUp = Math.round(((last - first) / first) * 100)
      trendSentence = `trended up from ${formatCents(first)} to ${formatCents(last)}, a rise of about ${pctUp}%`
    } else {
      trendSentence = `fluctuated between ${formatCents(min)} and ${formatCents(max)} but ended back around ${formatCents(last)}`
    }
  }

  return `Price history from ${startDate} to ${endDate}: ${trendSentence}. The deal price shown is ${formatCents(dealPriceCents)}; the usual price is ${formatCents(medianPriceCents)}.`
}

export function PriceSparkline({ history, dealPriceCents, medianPriceCents }: Props) {
  if (history.length < 2) {
    return (
      <div className="flex h-[80px] items-center justify-center rounded-[var(--radius-input)] bg-[color:var(--surface)] text-small text-[color:var(--ink-faint)]">
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
  const trendDescription = describeTrend(history, dealPriceCents, medianPriceCents)

  return (
    <div>
      {/* The SVG is purely decorative -- the real data is exposed to assistive
          tech via the sr-only paragraph below, computed from the same props. */}
      <p className="sr-only">{trendDescription}</p>
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
          stroke="var(--gold-deep)" strokeWidth="1" strokeDasharray="4 3"
        />

        {/* Price line */}
        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Deal price dot */}
        <circle cx={dotX} cy={dotY} r="5" fill="var(--gold-deep)" stroke="var(--surface)" strokeWidth="2" />
      </svg>

      <div className="mt-1 flex flex-wrap justify-between gap-x-3 text-caption text-[color:var(--ink-faint)]">
        <span>{startDate}</span>
        <span className="font-medium text-[color:var(--ink-soft)]">
          <span aria-hidden className="text-[color:var(--gold-deep)]">●</span> deal price
        </span>
        <span className="text-[color:var(--ink-soft)]">
          <span aria-hidden className="text-[color:var(--gold-deep)]">– –</span> usual price
        </span>
        <span>{endDate}</span>
      </div>
    </div>
  )
}
