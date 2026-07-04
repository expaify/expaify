import { DealScore } from '@/lib/types'
import { formatMoney, isValidMoney } from '@/lib/money'
import DealBadge from './DealBadge'

type Props = {
  score: DealScore | null
  loading: boolean
  scope: 'route' | 'hotel'
  priceNoun: 'fare' | 'nightly rate'
  unavailableCopy: string
}

const LOW_CONFIDENCE_RULE =
  'Fewer than 10 comparable prices are available, so this is not a confirmed deal rating.'

function scopeLabel(scope: Props['scope']) {
  return scope === 'route' ? 'Compared with route history' : 'Compared with hotel history'
}

function unavailableAriaLabel(scope: Props['scope']) {
  return scope === 'route'
    ? 'Deal Score unavailable for this fare right now.'
    : 'Deal Score unavailable for this hotel right now.'
}

function panelClasses(score: DealScore | null) {
  if (!score) return 'border-[color:var(--border)] bg-[color:var(--bg-raised)]'
  if (score.confidence === 'low') {
    return 'border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]'
  }
  if (score.verdict === 'Great') {
    return 'border-[color:var(--border-strong)] bg-[color:var(--success-soft)]'
  }
  if (score.verdict === 'Good') {
    return 'border-[color:var(--border-strong)] bg-[color:var(--brand-soft)]'
  }
  return 'border-[color:var(--border)] bg-[color:var(--bg-raised)]'
}

function formatOrdinal(value: number) {
  const rounded = Math.round(value)
  const mod100 = rounded % 100

  if (mod100 >= 11 && mod100 <= 13) return `${rounded}th`

  switch (rounded % 10) {
    case 1:
      return `${rounded}st`
    case 2:
      return `${rounded}nd`
    case 3:
      return `${rounded}rd`
    default:
      return `${rounded}th`
  }
}

function formatPctVsMedian(value: number) {
  if (!Number.isFinite(value)) return 'Unavailable'

  const rounded = Math.round(value)
  if (rounded === 0) return 'At usual price'

  return `${Math.abs(rounded)}% ${rounded < 0 ? 'below' : 'above'} usual`
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
        {label}
      </p>
      <p className="mt-0.5 [overflow-wrap:anywhere] font-medium leading-5 text-[color:var(--text-1)]">
        {value}
      </p>
    </div>
  )
}

function EvidenceGrid({ usual, vsUsual }: { usual: string; vsUsual: string }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs min-[420px]:grid-cols-3">
      <Fact label="Usual" value={usual} />
      <Fact label="Vs usual" value={vsUsual} />
      <Fact label="Window" value="Last 90 days" />
    </div>
  )
}

export default function DealScorePanel({
  score,
  loading,
  scope,
  priceNoun,
  unavailableCopy,
}: Props) {
  if (loading) {
    return (
      <div
        className="flex min-h-36 flex-col gap-3 rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3"
        role="status"
        aria-label="Loading Deal Score."
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
              Deal Score
            </p>
            <p className="mt-0.5 text-xs font-medium leading-5 text-[color:var(--text-2)]">
              Checking recent price history
            </p>
          </div>
          <div className="h-7 w-24 shrink-0 rounded-full shimmer" aria-hidden="true" />
        </div>
        <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3" aria-hidden="true">
          <div className="h-10 rounded-[var(--radius-control)] shimmer" />
          <div className="h-10 rounded-[var(--radius-control)] shimmer" />
          <div className="h-10 rounded-[var(--radius-control)] shimmer" />
        </div>
        <div className="h-4 w-4/5 rounded-[var(--radius-control)] shimmer" aria-hidden="true" />
      </div>
    )
  }

  if (!score) {
    return (
      <div
        className={`rounded-[var(--radius-card)] border px-3.5 py-3 ${panelClasses(null)}`}
        role="status"
        aria-label={unavailableAriaLabel(scope)}
      >
        <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
          Deal Score
        </p>
        <p className="mt-0.5 text-sm font-medium leading-5 text-[color:var(--text-1)]">
          Unavailable right now
        </p>
        <p className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-2)]">
          {unavailableCopy}
        </p>
      </div>
    )
  }

  const isLowConfidence = score.confidence === 'low'
  const usualMoney = { priceCents: score.medianCents, currency: score.currency }
  const usual = isValidMoney(usualMoney) ? formatMoney(usualMoney) : 'Usual unavailable'
  const percentile = isLowConfidence
    ? 'Not enough comparable prices for a confirmed rating'
    : `${formatOrdinal(score.percentile)} percentile`

  return (
    <section
      className={`flex flex-col gap-2 rounded-[var(--radius-card)] border px-3.5 py-3 ${panelClasses(score)}`}
      role="group"
      aria-label={`Deal Score for this ${priceNoun}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
            Deal Score
          </p>
        </div>
        <div className="shrink-0">
          <DealBadge verdict={score.verdict} confidence={score.confidence} />
        </div>
      </div>
      <div className="min-w-0">
        <p className="mt-0.5 text-xs font-medium leading-5 text-[color:var(--text-2)]">
          {scopeLabel(scope)}
        </p>
        <p className="text-xs font-medium leading-5 text-[color:var(--text-2)]">
          {percentile}
        </p>
      </div>
      <EvidenceGrid usual={usual} vsUsual={formatPctVsMedian(score.pctVsMedian)} />
      {isLowConfidence ? (
        <p className="text-xs font-medium leading-5 text-[color:var(--warning)]">
          {LOW_CONFIDENCE_RULE}
        </p>
      ) : null}
      <p className="text-xs font-medium leading-5 text-[color:var(--text-2)]">
        {score.explanation}
      </p>
    </section>
  )
}
