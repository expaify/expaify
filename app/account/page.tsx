import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getSubscription, isPremium } from '@/lib/subscription'
import { AccountClient } from './AccountClient'

export default async function AccountPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const sub = await getSubscription(session.user.id).catch(() => null)

  return (
    <div className="min-h-screen bg-[color:var(--bg)]">
      <nav className="border-b border-[color:var(--line-ivory)] bg-[color:var(--bg)]">
        <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-5">
          <a
            href="/"
            className="flex items-center gap-0.5 font-display text-[20px] font-bold text-[color:var(--ink)] no-underline"
          >
            expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" />
          </a>
          <a href="/deals" className="text-[14px] font-medium text-[color:var(--ink-soft)] no-underline hover:text-[color:var(--ink)]">
            Deals
          </a>
        </div>
      </nav>

      <main className="mx-auto max-w-[720px] px-5 py-12">
        <h1 className="mb-8 font-display text-[30px] font-bold text-[color:var(--ink)]">Account</h1>

        {/* Profile */}
        <section className="mb-6 rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-6">
          <h2 className="mb-4 font-display text-[17px] font-bold text-[color:var(--ink)]">Profile</h2>
          <p className="text-[15px] text-[color:var(--ink-soft)]">{session.user.email}</p>
        </section>

        {/* Subscription */}
        <section className="mb-6 rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-6">
          <h2 className="mb-4 font-display text-[17px] font-bold text-[color:var(--ink)]">Plan</h2>

          {sub && isPremium(sub.status) ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="rounded-[var(--radius-pill)] bg-[color:var(--primary-soft)] px-3 py-1 font-display text-[13px] font-bold text-[color:var(--primary)]">
                  {sub.status === 'trialing' ? 'Free trial' : 'Premium'}
                </span>
                {sub.plan && (
                  <span className="text-[13px] capitalize text-[color:var(--ink-faint)]">{sub.plan}</span>
                )}
              </div>
              {sub.status === 'trialing' && sub.trialEndsAt && (
                <p className="text-[14px] text-[color:var(--ink-soft)]">
                  Trial ends {sub.trialEndsAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
              {sub.status === 'active' && sub.currentPeriodEnd && (
                <p className="text-[14px] text-[color:var(--ink-soft)]">
                  Next billing date:{' '}
                  {sub.currentPeriodEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
              <AccountClient stripeCustomerId={sub.stripeCustomerId} />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-[15px] text-[color:var(--ink-soft)]">
                You&apos;re on the free plan — 3 deals per week.
              </p>
              <a href="/join?plan=annual" className="btn btn-conversion self-start">
                Upgrade to Premium
              </a>
            </div>
          )}
        </section>

        {/* Alert preferences (premium only) */}
        {sub && isPremium(sub.status) && (
          <section className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-6">
            <h2 className="mb-1 font-display text-[17px] font-bold text-[color:var(--ink)]">
              Email alerts
            </h2>
            <p className="mb-4 text-[13px] text-[color:var(--ink-faint)]">
              Choose how often you hear from us when a deal matches your watchlist.
            </p>
            <AccountClient
              stripeCustomerId={sub.stripeCustomerId}
              alertPreference={sub.alertPreference}
              watchlist={sub.watchlist}
              userId={session.user.id}
              showAlerts
            />
          </section>
        )}
      </main>
    </div>
  )
}
