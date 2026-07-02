import { notFound } from 'next/navigation'
import { getDealById, getPriceHistory } from '@/lib/pipeline/dealDetection'
import { query } from '@/lib/db/client'
import { formatMoney } from '@/lib/money'
import { DealChip } from '@/app/components/ui/DealChip'
import { CompareRow } from '@/app/components/ui/CompareRow'
import { TrustLine } from '@/app/components/ui/TrustLine'
import { PriceSparkline } from '@/app/components/ui/PriceSparkline'

type PageProps = { params: Promise<{ dealId: string }> }

function starChars(n: number) {
  const s = Math.max(0, Math.min(5, Math.round(n)))
  return '★'.repeat(s) + '☆'.repeat(5 - s)
}

function timeAgo(iso?: string): string {
  if (!iso) return 'today'
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? 'yesterday' : `${d}d ago`
}

export default async function DealDetailPage({ params }: PageProps) {
  const { dealId } = await params

  const deal = await getDealById(dealId).catch(() => null)
  if (!deal) notFound()

  const mktRes = await query<{ id: number }>(
    'SELECT id FROM tracked_markets WHERE city = $1 LIMIT 1',
    [deal.city]
  ).catch(() => ({ rows: [] as { id: number }[] }))
  const marketId = mktRes.rows[0]?.id

  const history = await getPriceHistory(deal.hotel_id, marketId).catch(() => [])

  const savings = deal.median_price_cents - deal.deal_price_cents
  const showSavings = savings >= 2000

  return (
    <div className="min-h-screen bg-[color:var(--bg)]">

      {/* Nav */}
      <nav className="border-b border-[color:var(--line-ivory)] bg-[color:var(--bg)]">
        <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-5">
          <a href="/" className="flex items-center gap-0.5 font-display text-[20px] font-bold text-[color:var(--ink)] no-underline">
            expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" />
          </a>
          <a href="/deals" className="text-[14px] font-medium text-[color:var(--ink-soft)] no-underline hover:text-[color:var(--ink)]">
            ← Back to deals
          </a>
        </div>
      </nav>

      <main className="mx-auto max-w-[760px] px-5 py-10">

        {/* Hero image */}
        <div className="relative mb-6 h-[320px] overflow-hidden rounded-[24px]">
          {deal.photo_url ? (
            <>
              <img src={deal.photo_url} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(14,90,84,0.4)] to-transparent" />
            </>
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ background: 'linear-gradient(150deg,#0E5A54 0%,#0A4440 100%)' }}
            >
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#9FE1CB" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 22V12h6v10M3 9h18M9 3v6M15 3v6" />
              </svg>
            </div>
          )}

          {/* Chips overlay */}
          <div className="absolute left-4 top-4">
            <DealChip discountPct={deal.discount_pct} />
          </div>
          <span className="absolute right-4 top-4 rounded-[999px] bg-[rgba(20,18,16,0.78)] px-[10px] py-[4px] text-[11px] font-medium text-[#FAF7F2]">
            found {timeAgo(deal.first_seen)}
          </span>
        </div>

        {/* Title block */}
        <div className="mb-6">
          {deal.headline && (
            <p className="mb-1 text-[13px] font-medium italic text-[color:var(--primary)]">{deal.headline}</p>
          )}
          <h1 className="font-display text-[30px] font-bold leading-tight text-[color:var(--ink)]">
            {deal.hotel_name}
          </h1>
          <p className="mt-1 text-[14px] text-[color:var(--ink-soft)]">
            <span aria-label={`${deal.stars ?? 0} stars`}>{starChars(deal.stars ?? 0)}</span>
            {' · '}{deal.city}{' · '}{deal.check_in_window}
          </p>
        </div>

        {/* Price block */}
        <div className="mb-6 rounded-[16px] bg-[color:var(--surface)] p-6 shadow-[0_2px_12px_rgba(20,18,16,0.06)]">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-[44px] font-bold leading-none text-[color:var(--primary)]">
              {formatMoney({ priceCents: deal.deal_price_cents, currency: 'USD' })}
            </span>
            <span className="text-[14px] text-[color:var(--ink-faint)]">/ night</span>
            <span className="text-[16px] text-[color:var(--ink-faint)] line-through">
              usually {formatMoney({ priceCents: deal.median_price_cents, currency: 'USD' })}
            </span>
          </div>
          {showSavings && (
            <p className="mt-1 text-[14px] font-medium text-[color:var(--primary)]">
              Save {formatMoney({ priceCents: savings, currency: 'USD' })}/night vs the usual price
            </p>
          )}
        </div>

        {/* Compare row */}
        <div className="mb-8">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">Compare and book on</p>
          <CompareRow links={deal.ota_links} />
        </div>

        {/* Why this is a deal */}
        <section className="mb-8 rounded-[16px] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-6">
          <h2 className="mb-4 font-display text-[18px] font-bold text-[color:var(--ink)]">Why this is a deal</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">Usual price</p>
              <p className="mt-1 font-display text-[22px] font-bold text-[color:var(--ink-soft)] line-through">
                {formatMoney({ priceCents: deal.median_price_cents, currency: 'USD' })}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">Today's price</p>
              <p className="mt-1 font-display text-[22px] font-bold text-[color:var(--primary)]">
                {formatMoney({ priceCents: deal.deal_price_cents, currency: 'USD' })}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">Price checks</p>
              <p className="mt-1 font-display text-[22px] font-bold text-[color:var(--ink)]">
                {deal.snapshot_count}
              </p>
            </div>
          </div>
        </section>

        {/* Price history sparkline */}
        {history.length >= 3 && (
          <section className="mb-8 rounded-[16px] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-6">
            <h2 className="mb-4 font-display text-[18px] font-bold text-[color:var(--ink)]">60-day price history</h2>
            <PriceSparkline
              history={history}
              dealPriceCents={deal.deal_price_cents}
              medianPriceCents={deal.median_price_cents}
            />
            <div className="mt-4">
              <TrustLine snapshotCount={deal.snapshot_count} />
            </div>
          </section>
        )}

        {/* Trust line if no chart */}
        {history.length < 2 && (
          <div className="mb-8">
            <TrustLine snapshotCount={deal.snapshot_count} />
          </div>
        )}

      </main>
    </div>
  )
}
