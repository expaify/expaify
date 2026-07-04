'use client'

import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useState, Suspense } from 'react'

function JoinForm() {
  const params = useSearchParams()
  const defaultPlan = params.get('plan') === 'monthly' ? 'monthly' : 'annual'
  const [plan, setPlan] = useState<'monthly' | 'annual'>(defaultPlan)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    // Sign in via magic link; after auth, redirect to Stripe checkout
    await signIn('resend', {
      email,
      redirect: false,
      callbackUrl: `/api/stripe/checkout?plan=${plan}&redirect=true`,
    })
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--bg)] px-5">
      <div className="w-full max-w-[440px]">
        <a
          href="/"
          className="mb-10 flex items-center gap-0.5 font-display text-[20px] font-bold text-[color:var(--ink)] no-underline"
        >
          expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" aria-hidden />
        </a>

        <h1 className="mb-2 font-display text-[28px] font-bold text-[color:var(--ink)]">
          Join the club
        </h1>
        <p className="mb-8 text-[15px] text-[color:var(--ink-soft)]">
          7-day free trial. Cancel before day 7 and you pay nothing.
        </p>

        {sent ? (
          <div className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-6 text-center">
            <p className="font-display text-[17px] font-bold text-[color:var(--ink)]">Check your inbox</p>
            <p className="mt-2 text-[14px] text-[color:var(--ink-soft)]">
              We sent a sign-in link to <strong>{email}</strong>. After you confirm, we&apos;ll take you to checkout.
            </p>
          </div>
        ) : (
          <>
            {/* Plan picker */}
            <div className="mb-6 flex gap-3">
              {(['annual', 'monthly'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlan(p)}
                  className={`btn-pill flex-1 justify-center ${plan === p ? 'active' : ''}`}
                >
                  {p === 'annual' ? (
                    <>
                      Annual
                      <span className="ml-1 rounded-[var(--radius-pill)] bg-[color:var(--gold)] px-1.5 py-0.5 font-display text-[10px] font-bold leading-none text-[color:var(--gold-text)]">
                        2 mo free
                      </span>
                    </>
                  ) : (
                    'Monthly'
                  )}
                </button>
              ))}
            </div>

            <div className="mb-6 rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-5">
              <div className="flex items-baseline gap-1">
                <span className="font-display text-[32px] font-bold text-[color:var(--ink)]">
                  {plan === 'annual' ? '$8' : '$12'}
                </span>
                <span className="text-[14px] text-[color:var(--ink-faint)]">
                  {plan === 'annual' ? '/ month, billed $96/year' : '/ month'}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-[color:var(--ink-faint)]">
                7-day free trial included
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="join-email" className="sr-only">Email address</label>
                <input
                  id="join-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-conversion w-full justify-center"
              >
                {loading ? <span className="spinner" aria-hidden /> : null}
                {loading ? 'Just a moment…' : 'Start free trial'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => signIn('google', { callbackUrl: `/api/stripe/checkout?plan=${plan}&redirect=true` })}
              className="btn btn-outline mt-3 w-full justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </>
        )}

        <p className="mt-6 text-center text-[13px] text-[color:var(--ink-faint)]">
          Already have an account?{' '}
          <a href="/login" className="text-[color:var(--primary)] no-underline hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  )
}
