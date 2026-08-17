import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getSubscription, isPremium } from '@/lib/subscription'
import { reconcileCheckoutSession } from '@/lib/stripe/reconcileCheckout'
import { query } from '@/lib/db/client'
import { AccountClient } from './AccountClient'
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your account — expaify',
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ welcome?: string; checkout?: string; session_id?: string }>
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

  const [initialSub, params, activeDealCount, authProviderResult] = await Promise.all([
    getSubscription(session.user.id).catch(() => null),
    searchParams,
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM deals WHERE status = 'active' AND is_mock = false`
    ).then(r => parseInt(r.rows[0]?.count ?? '0', 10)).catch(() => 0),
    query<{ provider: string }>(
      `SELECT provider FROM accounts WHERE "userId" = $1 ORDER BY provider = 'google' DESC LIMIT 1`,
      [session.user.id]
    ).catch(() => ({ rows: [] })),
  ])

  // Backstop for the async Stripe webhook: a user landing here right after
  // checkout may beat the webhook that would otherwise mark them premium.
  // Only attempted when the DB doesn't already show premium, so the
  // overwhelmingly common already-reconciled case never makes an extra call.
  let sub = initialSub
  if (params.checkout === 'success' && params.session_id && !(sub && isPremium(sub.status))) {
    await reconcileCheckoutSession(params.session_id, session.user.id)
    sub = await getSubscription(session.user.id).catch(() => sub)
  }

  const premium = sub ? isPremium(sub.status) : false
  const showWelcome = params.welcome === '1' || params.checkout === 'success'
  const showCheckoutError = params.checkout === 'error'
  const daysLeft = sub?.status === 'trialing' && sub.trialEndsAt ? trialDaysLeft(sub.trialEndsAt) : null
  const signInMethod = authProviderResult.rows[0]?.provider === 'google'
    ? 'Signed in with Google'
    : 'Signed in via email link'

  return (
    <div className="min-h-screen bg-[color:var(--bg)]">
      <nav className="border-b border-[color:var(--line-ivory)] bg-[color:var(--bg)]">
        <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-5">
          <a href="/" className="flex items-center gap-0.5 font-display text-xl font-bold text-[color:var(--ink)] no-underline">
            expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" aria-hidden />
          </a>
          <a href="/deals" className="text-sm font-medium text-[color:var(--ink-soft)] no-underline hover:text-[color:var(--ink)]">
            Browse deals →
          </a>
        </div>
      </nav>

      <main className="mx-auto max-w-[680px] px-5 py-10">

        {/* Welcome banner */}
        {showWelcome && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-[var(--radius-card)] bg-[color:var(--primary)] px-5 py-4 text-white">
            <p className="text-sm leading-relaxed">
              <span className="font-display font-bold">You&apos;re in.</span>
              {' '}Your first deal alert arrives by email — usually within 24 hours.
            </p>
            <a href="/account" className="shrink-0 text-lg leading-none text-white opacity-70 hover:opacity-100 no-underline" aria-label="Dismiss">×</a>
          </div>
        )}

        {showCheckoutError && (
          <div className="mb-6 rounded-[var(--radius-card)] border border-[color:var(--error)] bg-white px-5 py-4">
            <p className="text-sm font-medium text-[color:var(--error-text)]">
              Checkout could not start. Try again in a moment or contact support and we will finish your upgrade.
            </p>
          </div>
        )}

        <h1 className="mb-6 font-display text-2xl font-bold text-[color:var(--ink)]">Account</h1>

        {/* Plan status */}
        <section
          className={`mb-5 rounded-[var(--radius-card)] p-6 ${
            premium
              ? 'border-2 border-[color:var(--primary)] bg-[color:var(--surface)]'
              : 'border-[1.5px] border-dashed border-[color:var(--line-ivory)] bg-[color:var(--surface)]'
          }`}
        >
          {/* Facts block (R2) */}
          <dl className="mb-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">
                Plan
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[color:var(--ink)]">
                {sub?.status === 'trialing'
                  ? 'Premium trial'
                  : premium
                  ? 'Premium'
                  : sub?.status === 'canceled'
                  ? 'Premium (canceled)'
                  : 'Free plan'}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">
                Price
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[color:var(--ink)]">
                {sub?.status === 'trialing'
                  ? sub?.plan === 'annual' ? '$8/mo' : '$12/mo'
                  : '—'}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">
                Renewal
              </dt>
              <dd className="mt-1 text-sm font-semibold text-[color:var(--ink)]">
                {sub?.status === 'trialing' && sub.trialEndsAt
                  ? `Trial ends ${formatDate(sub.trialEndsAt)}`
                  : sub?.status === 'active' && sub.currentPeriodEnd
                  ? `Renews ${formatDate(sub.currentPeriodEnd)}`
                  : sub?.status === 'canceled' && sub.currentPeriodEnd
                  ? `Access ends ${formatDate(sub.currentPeriodEnd)}`
                  : '—'}
              </dd>
            </div>
          </dl>

          {/* Callout slot (R2 + R3) */}
          <div className="mb-4">
            {sub?.status === 'trialing' && sub.trialEndsAt && daysLeft !== null && (
              <div className="flex items-center gap-4 rounded-[var(--radius-control)] border border-[color:var(--gold)] bg-[color:var(--warning-soft)] px-4 py-3">
                <div className="shrink-0 text-center">
                  <div className="text-h2 text-[color:var(--gold-text)]">{daysLeft}</div>
                  <div className="text-caption font-medium uppercase tracking-wide text-[color:var(--gold-text)]">
                    {daysLeft === 1 ? 'day' : 'days'} left
                  </div>
                </div>
                <p className="text-small text-[color:var(--gold-text)]">
                  Trial ends <strong>{formatDate(sub.trialEndsAt)}</strong>. You&apos;ll be charged{' '}
                  {sub.plan === 'annual' ? '$8/mo' : '$12/mo'} unless you cancel before then.
                </p>
              </div>
            )}

            {sub?.status === 'canceled' && sub.currentPeriodEnd && (
              <p className="text-sm text-[color:var(--ink-soft)]">
                Premium access ends <strong>{formatDate(sub.currentPeriodEnd)}</strong>. Renew to keep getting alerts.
              </p>
            )}

            {(!sub || sub.status === 'free') && (
              <div>
                {activeDealCount > 3 && (
                  <div className="mb-3 rounded-[var(--radius-control)] border border-[color:var(--primary-soft)] bg-[color:var(--primary-soft)] px-4 py-3">
                    <p className="text-sm text-[color:var(--primary)]">
                      <strong>{activeDealCount} hotel deals</strong> live right now — you can see 3.
                      Upgrade to unlock all of them.
                    </p>
                  </div>
                )}
                <p className="text-sm text-[color:var(--ink-soft)]">
                  Free plan gives you 3 unlocked deals. Upgrade for unlimited deals + email alerts.
                </p>
              </div>
            )}
          </div>

          {/* Actions slot */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {premium && (
              <a
                href="/deals"
                className="btn btn-outline self-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
              >
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

        {/* Alerts + Watchlist (premium only) */}
        {premium && (
          <section id="alerts" className="mb-5 scroll-mt-20 rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-6">
            <h2 className="mb-1 font-display text-base font-bold text-[color:var(--ink)]">Email alerts</h2>
            <p className="mb-5 text-sm text-[color:var(--ink-faint)]">
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

        {/* Profile */}
        <section className="mb-5 rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-6">
          <h2 className="mb-3 font-display text-base font-bold text-[color:var(--ink)]">Profile</h2>
          <p className="text-sm text-[color:var(--ink-soft)] [overflow-wrap:anywhere]">{session.user.email}</p>
          <p className="mt-1 text-sm text-[color:var(--ink-faint)]">{signInMethod}</p>
          <div className="mt-3 border-t border-[color:var(--line-ivory)] pt-3">
            <AccountClient userId={session.user.id} signOutOnly />
          </div>
        </section>

        {/* Privacy (all authenticated users) */}
        <section className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-6">
          <h2 className="mb-1 font-display text-base font-bold text-[color:var(--ink)]">Privacy</h2>
          <p className="mb-5 text-sm text-[color:var(--ink-faint)]">
            Request a copy of your account data or ask us to delete your account.
          </p>
          <AccountClient userId={session.user.id} showPrivacy />
        </section>
      </main>
    </div>
  )
}
