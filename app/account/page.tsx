import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getSubscription, isPremium } from '@/lib/subscription'
import { AccountClient } from './AccountClient'

type PageProps = {
  searchParams: Promise<{ welcome?: string }>
}

function formatDate(d?: Date | null) {
  if (!d) return null
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default async function AccountPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const sub = await getSubscription(session.user.id).catch(() => null)
  const premium = sub ? isPremium(sub.status) : false
  const { welcome } = await searchParams
  const showWelcome = welcome === '1'

  return (
    <div className="min-h-screen bg-[color:var(--bg)]">
      <nav className="border-b border-[color:var(--line-ivory)] bg-[color:var(--bg)]">
        <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-5">
          <a href="/" className="flex items-center gap-0.5 font-display text-[20px] font-bold text-[color:var(--ink)] no-underline">
            expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" aria-hidden />
          </a>
          <a href="/deals" className="text-[14px] font-medium text-[color:var(--ink-soft)] no-underline hover:text-[color:var(--ink)]">Deals</a>
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

          {sub?.status === 'trialing' && sub.trialEndsAt && (
            <p className="text-[14px] text-[color:var(--ink-soft)]">
              Trial ends <strong>{formatDate(sub.trialEndsAt)}</strong>. You&apos;ll be charged ${sub.plan === 'annual' ? '8' : '12'}/month unless you cancel before then.
            </p>
          )}
          {sub?.status === 'active' && sub.currentPeriodEnd && (
            <p className="text-[14px] text-[color:var(--ink-soft)]">
              Next billing: <strong>{formatDate(sub.currentPeriodEnd)}</strong>
            </p>
          )}
          {sub?.status === 'canceled' && sub.currentPeriodEnd && (
            <p className="text-[14px] text-[color:var(--ink-soft)]">
              Premium access ends <strong>{formatDate(sub.currentPeriodEnd)}</strong>. Renew to keep getting alerts.
            </p>
          )}
          {!sub || sub.status === 'free' ? (
            <p className="text-[14px] text-[color:var(--ink-soft)]">
              You see 3 unlocked deals per week. Upgrade to get unlimited deals + email alerts.
            </p>
          ) : null}

          <div className="mt-4">
            {premium || sub?.status === 'canceled' ? (
              <AccountClient stripeCustomerId={sub?.stripeCustomerId} userId={session.user.id} />
            ) : (
              <a href="/join?plan=annual" className="btn btn-conversion self-start">
                Upgrade to Premium — 7-day free trial
              </a>
            )}
          </div>
        </section>

        {/* Profile */}
        <section className="mb-5 rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-6">
          <h2 className="mb-3 font-display text-[15px] font-bold text-[color:var(--ink)]">Profile</h2>
          <p className="text-[14px] text-[color:var(--ink-soft)] [overflow-wrap:anywhere]">{session.user.email}</p>
        </section>

        {/* Alerts + Watchlist (premium only) */}
        {premium && (
          <section className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-6">
            <h2 className="mb-1 font-display text-[15px] font-bold text-[color:var(--ink)]">Email alerts</h2>
            <p className="mb-5 text-[13px] text-[color:var(--ink-faint)]">
              Choose how often we email you when a deal appears.
            </p>
            <AccountClient
              stripeCustomerId={sub?.stripeCustomerId}
              userId={session.user.id}
              alertPreference={sub?.alertPreference}
              watchlist={sub?.watchlist}
              showAlerts
            />
          </section>
        )}
      </main>
    </div>
  )
}
