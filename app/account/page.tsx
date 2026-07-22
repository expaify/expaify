import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getSubscription, isPremium } from '@/lib/subscription'
import { query } from '@/lib/db/client'
import { AccountClient } from './AccountClient'

type PageProps = {
  searchParams: Promise<{ welcome?: string; checkout?: string }>
}

function formatDate(d?: Date | null) {
  if (!d) return null
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function trialDaysLeft(trialEndsAt: Date): number {
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000))
}

export default async function AccountPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [sub, params, activeDealCount] = await Promise.all([
    getSubscription(session.user.id).catch(() => null),
    searchParams,
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM deals WHERE status = 'active' AND is_mock = false`
    ).then(r => parseInt(r.rows[0]?.count ?? '0', 10)).catch(() => 0),
  ])

  const premium = sub ? isPremium(sub.status) : false
  const showWelcome = params.welcome === '1' || params.checkout === 'success'
  const showCheckoutError = params.checkout === 'error'
  const daysLeft = sub?.status === 'trialing' && sub.trialEndsAt ? trialDaysLeft(sub.trialEndsAt) : null

  return (
    <div className="min-h-screen bg-[color:var(--bg)]">
      <nav className="border-b border-[color:var(--line-ivory)] bg-[color:var(--bg)]">
        <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-5">
          <a href="/" className="flex items-center gap-0.5 font-display text-[20px] font-bold text-[color:var(--ink)] no-underline">
            expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" aria-hidden />
          </a>
          <a href="/deals" className="text-[14px] font-medium text-[color:var(--ink-soft)] no-underline hover:text-[color:var(--ink)]">
            Browse deals →
          </a>
        </div>
      </nav>

      <main className="mx-auto max-w-[680px] px-5 py-10">

        {/* Welcome banner */}
        {showWelcome && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-[var(--radius-card)] bg-[color:var(--primary)] px-5 py-4 text-white">
            <p className="text-[14px] leading-relaxed">
              <span className="font-display font-bold">You&apos;re in.</span>
              {' '}Your first deal alert arrives by email — usually within 24 hours.
            </p>
            <a href="/account" className="shrink-0 text-[18px] leading-none text-white opacity-70 hover:opacity-100 no-underline" aria-label="Dismiss">×</a>
          </div>
        )}

        {showCheckoutError && (
          <div className="mb-6 rounded-[var(--radius-card)] border border-[color:var(--error)] bg-white px-5 py-4">
            <p className="text-[14px] font-medium text-[color:var(--error)]">
              Checkout could not start. Try again in a moment or contact support and we will finish your upgrade.
            </p>
          </div>
        )}

        <h1 className="mb-6 font-display text-[28px] font-bold text-[color:var(--ink)]">Account</h1>

        {/* Plan status */}
        <section className={`mb-5 rounded-[var(--radius-card)] p-6 ${
          premium
            ? 'border-2 border-[color:var(--primary)] bg-[color:var(--surface)]'
            : 'border-[1.5px] border-dashed border-[color:var(--line-ivory)] bg-[color:var(--surface)]'
        }`}>
          <div className="mb-3 flex items-center gap-2">
            {premium ? (
              <>
                <span className="rounded-[var(--radius-pill)] bg-[color:var(--primary-soft)] px-3 py-1 font-display text-[12px] font-bold text-[color:var(--primary)]">
                  {sub?.status === 'trialing' ? 'Premium trial' : 'Premium'}
                </span>
                {sub?.status === 'active' && (
                  <span className="h-2 w-2 rounded-full bg-[color:var(--primary)]" aria-hidden />
                )}
                {sub?.plan && (
                  <span className="text-[12px] capitalize text-[color:var(--ink-faint)]">{sub.plan}</span>
                )}
              </>
            ) : sub?.status === 'canceled' ? (
              <span className="rounded-[var(--radius-pill)] bg-[color:var(--line-ivory)] px-3 py-1 font-display text-[12px] font-bold text-[color:var(--ink-soft)]">
                Canceled
              </span>
            ) : (
              <span className="rounded-[var(--radius-pill)] bg-[color:var(--line-ivory)] px-3 py-1 font-display text-[12px] font-bold text-[color:var(--ink-faint)]">
                Free plan
              </span>
            )}
          </div>

          {/* Trial countdown — prominent */}
          {sub?.status === 'trialing' && sub.trialEndsAt && daysLeft !== null && (
            <div className="mb-4 flex items-center gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="shrink-0 text-center">
                <div className="font-display text-[28px] font-bold leading-none text-amber-700">{daysLeft}</div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-amber-600">
                  {daysLeft === 1 ? 'day' : 'days'} left
                </div>
              </div>
              <p className="text-[13px] text-amber-800">
                Trial ends <strong>{formatDate(sub.trialEndsAt)}</strong>.
                {' '}You&apos;ll be charged ${sub.plan === 'annual' ? '8' : '12'}/mo unless you cancel before then.
              </p>
            </div>
          )}

          {sub?.status === 'active' && sub.currentPeriodEnd && (
            <p className="mb-3 text-[14px] text-[color:var(--ink-soft)]">
              Next billing: <strong>{formatDate(sub.currentPeriodEnd)}</strong>
            </p>
          )}
          {sub?.status === 'canceled' && sub.currentPeriodEnd && (
            <p className="mb-3 text-[14px] text-[color:var(--ink-soft)]">
              Premium access ends <strong>{formatDate(sub.currentPeriodEnd)}</strong>. Renew to keep getting alerts.
            </p>
          )}

          {/* Free user — show deals they're missing */}
          {(!sub || sub.status === 'free') && (
            <div className="mb-4">
              {activeDealCount > 3 && (
                <div className="mb-3 rounded-lg border border-[color:var(--primary-soft)] bg-[color:var(--primary-soft)] px-4 py-3">
                  <p className="text-[13px] text-[color:var(--primary)]">
                    <strong>{activeDealCount} hotel deals</strong> live right now — you can see 3.
                    Upgrade to unlock all of them.
                  </p>
                </div>
              )}
              <p className="text-[14px] text-[color:var(--ink-soft)]">
                Free plan gives you 3 unlocked deals. Upgrade for unlimited deals + email alerts.
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {premium && (
              <a href="/deals" className="btn btn-outline self-start">
                Browse live deals
              </a>
            )}
            {premium || sub?.status === 'canceled' ? (
              <AccountClient stripeCustomerId={sub?.stripeCustomerId} userId={session.user.id} />
            ) : (
              <AccountClient userId={session.user.id} upgradePlan="annual" />
            )}
          </div>
        </section>

        {/* Profile */}
        <section className="mb-5 rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-[color:var(--ink)]">Profile</h2>
          <p className="text-[14px] text-[color:var(--ink-soft)] [overflow-wrap:anywhere]">{session.user.email}</p>
          {!premium && (
            <div className="mt-3 border-t border-[color:var(--line-ivory)] pt-3">
              <AccountClient userId={session.user.id} signOutOnly />
            </div>
          )}
        </section>

        {/* Alerts + Watchlist (premium only) */}
        {premium && (
          <section id="alerts" className="scroll-mt-20 rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-6">
            <h2 className="mb-1 font-display text-[15px] font-bold text-[color:var(--ink)]">Email alerts</h2>
            <p className="mb-5 text-[13px] text-[color:var(--ink-faint)]">
              Choose how often we email you when a deal appears. Changes save instantly.
            </p>
            <AccountClient
              stripeCustomerId={sub?.stripeCustomerId}
              userId={session.user.id}
              alertPreference={sub?.alertPreference}
              watchlist={sub?.watchlist}
              minDiscountPct={sub?.minDiscountPct as 30 | 40 | 50 | undefined}
              showAlerts
            />
          </section>
        )}
      </main>
    </div>
  )
}
