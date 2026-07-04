import { notFound } from 'next/navigation'
import { getDealById, getPriceHistory } from '@/lib/pipeline/dealDetection'
import { query } from '@/lib/db/client'
import { formatMoney } from '@/lib/money'
import { DealChip } from '@/app/components/ui/DealChip'
import { TrustLine } from '@/app/components/ui/TrustLine'
import { PriceSparkline } from '@/app/components/ui/PriceSparkline'
import DealScorePanel from '@/app/components/DealScorePanel'

type PageProps = { params: Promise<{ dealId: string }> }

function starChars(n: number) {
  const s = Math.max(0, Math.min(5, Math.round(n)))
  return '★'.repeat(s) + '☆'.repeat(5 - s)
}

function fmtDate(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtShort(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function addNights(dateStr: string, nights: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + nights)
  return fmtShort(d.toISOString())
}

function Fact({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">{label}</p>
      <p className={`mt-0.5 text-[13px] font-medium leading-5 ${muted ? 'text-[color:var(--text-3)]' : 'text-[color:var(--text-1)]'}`}>
        {value}
      </p>
    </div>
  )
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

  const now = Date.now()
  const isExpired = deal.expires_at ? new Date(deal.expires_at).getTime() < now : false
  const isStale = !isExpired && deal.updated_at
    ? (now - new Date(deal.updated_at).getTime()) > 6 * 3600 * 1000
    : false

  // primary booking URL: prefer booking.com, then any ota_link
  const primaryBookingUrl = deal.ota_links?.booking ?? Object.values(deal.ota_links ?? {})[0] ?? null

  // check-in / check-out derived
  const checkInDisplay = deal.check_in_date ? fmtShort(deal.check_in_date) : null
  const checkOutDisplay = deal.check_in_date ? addNights(deal.check_in_date, deal.nights ?? 1) : null

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

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">

        {/* Stale deal banner */}
        {isStale && (
          <div className="mb-4 rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] px-4 py-3" role="status">
            <p className="text-[13px] font-bold text-[color:var(--ink)]">Price may be stale</p>
            <p className="mt-0.5 text-[12px] leading-5 text-[color:var(--ink-soft)]">
              This deal was last updated more than 6 hours ago. The provider confirms the current price and availability.
            </p>
          </div>
        )}

        {/* Two-column grid */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">

          {/* Left column: identity + continuity + score + sparkline */}
          <div className="flex min-w-0 flex-col gap-4">

            {/* Kind pills + identity */}
            <section>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-[color:var(--line-ivory)] bg-[color:var(--surface)] px-3 py-1 text-[11px] font-medium text-[color:var(--ink-soft)]">
                  Hotel deal
                </span>
                {deal.city && (
                  <span className="inline-flex items-center rounded-full border border-[color:var(--primary)] bg-[color:var(--primary-soft)] px-3 py-1 text-[11px] font-medium text-[color:var(--primary)]">
                    {deal.city}
                  </span>
                )}
                <span className="text-[11px] text-[color:var(--ink-faint)]">
                  Updated {fmtDate(deal.updated_at)}
                </span>
                {isExpired && deal.expires_at && (
                  <span className="text-[11px] font-medium text-[color:var(--error,#c00)]">
                    Expired {fmtDate(deal.expires_at)}
                  </span>
                )}
                {!isExpired && deal.expires_at && (
                  <span className="text-[11px] text-[color:var(--ink-faint)]">
                    Expires {fmtDate(deal.expires_at)}
                  </span>
                )}
              </div>

              {deal.headline && (
                <p className="mb-1 text-[13px] font-medium italic text-[color:var(--primary)]">{deal.headline}</p>
              )}
              <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-normal text-[color:var(--ink)] sm:text-[32px]">
                {deal.hotel_name}
              </h1>
              <p className="mt-1 text-[14px] font-medium leading-6 text-[color:var(--ink-soft)]">
                <span aria-label={`${deal.stars ?? 0} stars`}>{starChars(deal.stars ?? 0)}</span>
                {' · '}{deal.city}{' · '}{deal.check_in_window}
              </p>
              {deal.description && (
                <p className="mt-2 text-[14px] leading-6 text-[color:var(--ink-soft)]">{deal.description}</p>
              )}
            </section>

            {/* Price block */}
            <section className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
                Nightly rate before taxes and fees
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <span className="font-display text-[40px] font-extrabold leading-none text-[color:var(--primary)]">
                  {formatMoney({ priceCents: deal.deal_price_cents, currency: 'USD' })}
                </span>
                <span className="self-end pb-[2px] text-[12px] leading-none text-[color:var(--ink-faint)]">/ night</span>
                <span className="text-[16px] text-[color:var(--ink-faint)] line-through">
                  usually {formatMoney({ priceCents: deal.median_price_cents, currency: 'USD' })}
                </span>
              </div>
              {showSavings && (
                <p className="mt-1 text-[13px] font-medium text-[color:var(--primary)]">
                  Save {formatMoney({ priceCents: savings, currency: 'USD' })}/night vs the usual price
                </p>
              )}
              <p className="mt-2 text-[11px] font-medium leading-5 text-[color:var(--ink-soft)]">
                Taxes, fees, cancellation policy, and final total are confirmed by the provider.
              </p>
            </section>

            {/* Hotel continuity facts */}
            <section className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-4">
              <h2 className="mb-3 text-[13px] font-bold text-[color:var(--ink)]">Stay details</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Fact label="Hotel" value={deal.hotel_name} />
                <Fact label="Area" value={deal.city ?? 'Area unavailable'} muted={!deal.city} />
                <Fact label="Check-in" value={checkInDisplay ?? 'Check-in unavailable'} muted={!checkInDisplay} />
                <Fact label="Check-out" value={checkOutDisplay ?? 'Check-out unavailable'} muted={!checkOutDisplay} />
                <Fact label="Nights" value={deal.nights != null ? String(deal.nights) : 'Nights unavailable'} muted={deal.nights == null} />
                <Fact label="Guests" value="Guest count unavailable" muted />
                <Fact label="Room or rate" value="Room or rate unavailable" muted />
                <Fact label="Price basis" value="Provider confirms final price and availability." />
              </div>
            </section>

            {/* Deal Score */}
            <DealScorePanel
              score={null}
              loading={false}
              scope="hotel"
              priceNoun="nightly rate"
              unavailableCopy="We do not have enough hotel history to score this nightly rate right now."
            />

            {/* Price history sparkline */}
            {history.length >= 3 && (
              <section className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-5">
                <h2 className="mb-4 font-display text-[16px] font-bold text-[color:var(--ink)]">60-day price history</h2>
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

            {history.length < 2 && (
              <div className="px-1">
                <TrustLine snapshotCount={deal.snapshot_count} />
              </div>
            )}
          </div>

          {/* Right column: hero image + action panel */}
          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-5 lg:self-start">

            {/* Hero image */}
            <div className="relative h-[220px] overflow-hidden rounded-[var(--radius-card)] lg:h-[200px]">
              {deal.photo_url ? (
                <>
                  <img src={deal.photo_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(14,90,84,0.4)] to-transparent" aria-hidden />
                </>
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{ background: 'linear-gradient(150deg,var(--primary) 0%,var(--primary-deep) 100%)' }}
                  aria-hidden
                >
                  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="var(--primary-soft)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M9 22V12h6v10M3 9h18M9 3v6M15 3v6" />
                  </svg>
                </div>
              )}
              <div className="absolute left-3 top-3">
                <DealChip discountPct={deal.discount_pct} />
              </div>
            </div>

            {/* Provider action panel */}
            {isExpired ? (
              <div className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-4" role="status">
                <p className="text-[13px] font-bold text-[color:var(--ink)]">Deal expired</p>
                <p className="mt-1 text-[12px] leading-5 text-[color:var(--ink-soft)]">
                  This saved deal may no longer be available at the shown price. Search again to find current options.
                </p>
                <a href="/deals" className="btn btn-primary mt-3 block w-full text-center">
                  Search current deals
                </a>
              </div>
            ) : primaryBookingUrl ? (
              <div className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-4">
                <a
                  href={primaryBookingUrl}
                  target="_blank"
                  rel="nofollow sponsored noopener noreferrer"
                  className="btn btn-primary block w-full text-center"
                >
                  Check availability
                </a>
                <p className="mt-2 text-center text-[11px] font-medium leading-5 text-[color:var(--ink-soft)]">
                  Opens the provider site. Prices and availability can change.
                </p>
              </div>
            ) : (
              <div className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-4" role="status">
                <p className="text-[13px] font-bold text-[color:var(--ink)]">Provider link unavailable</p>
                <p className="mt-1 text-[12px] leading-5 text-[color:var(--ink-soft)]">
                  This saved deal can be reviewed here, but expaify does not have a current external booking link.
                </p>
                <button type="button" disabled className="btn btn-primary mt-3 w-full cursor-not-allowed opacity-50">
                  Unavailable
                </button>
              </div>
            )}

            {/* Compare row */}
            {!isExpired && Object.keys(deal.ota_links ?? {}).length > 0 && (
              <div className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-4">
                <p className="mb-2 text-[11px] text-[color:var(--ink-faint)]">Compare and book on:</p>
                <div className="grid grid-cols-4 gap-[6px]">
                  {(['booking', 'expedia', 'trip', 'kiwi'] as const).map((key) => {
                    const href = deal.ota_links?.[key]
                    const label = key === 'booking' ? 'Booking' : key === 'expedia' ? 'Expedia' : key === 'trip' ? 'Trip.com' : 'Kiwi'
                    if (href) {
                      return (
                        <a key={key} href={href} target="_blank" rel="noopener noreferrer sponsored"
                          className="block rounded-[10px] border-[0.5px] border-[color:var(--line-ivory)] py-2 text-center text-[11px] font-medium text-[color:var(--ink)] no-underline transition-colors duration-100 hover:border-[color:var(--primary)] hover:bg-[rgba(14,90,84,0.04)]">
                          {label}
                        </a>
                      )
                    }
                    return (
                      <span key={key} className="block rounded-[10px] border-[0.5px] border-[color:var(--line-ivory)] py-2 text-center text-[11px] font-medium text-[color:var(--ink-faint)] opacity-40">
                        {label}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  )
}
