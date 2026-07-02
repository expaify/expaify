'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    await signIn('resend', { email, redirect: false })
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--bg)] px-5">
      <div className="w-full max-w-[400px]">
        <a
          href="/"
          className="mb-10 flex items-center gap-0.5 font-display text-[20px] font-bold text-[color:var(--ink)] no-underline"
        >
          expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" />
        </a>

        <h1 className="mb-2 font-display text-[28px] font-bold text-[color:var(--ink)]">Sign in</h1>
        <p className="mb-8 text-[15px] text-[color:var(--ink-soft)]">
          We&apos;ll email you a magic link — no password needed.
        </p>

        {sent ? (
          <div className="rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] p-6 text-center">
            <p className="font-display text-[17px] font-bold text-[color:var(--ink)]">Check your inbox</p>
            <p className="mt-2 text-[14px] text-[color:var(--ink-soft)]">
              We sent a sign-in link to <strong>{email}</strong>
            </p>
          </div>
        ) : (
          <form onSubmit={handleEmail} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
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
              className="btn btn-primary w-full justify-center"
            >
              {loading ? <span className="spinner" aria-hidden /> : null}
              {loading ? 'Sending…' : 'Continue with email'}
            </button>
          </form>
        )}

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-[color:var(--line-ivory)]" />
          <span className="text-[13px] text-[color:var(--ink-faint)]">or</span>
          <div className="h-px flex-1 bg-[color:var(--line-ivory)]" />
        </div>

        <button
          type="button"
          onClick={() => signIn('google', { callbackUrl: '/deals' })}
          className="btn btn-outline w-full justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
              fill="#34A853"
            />
            <path
              d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        <p className="mt-8 text-center text-[13px] text-[color:var(--ink-faint)]">
          No account?{' '}
          <a href="/join" className="text-[color:var(--primary)] no-underline hover:underline">
            Join free
          </a>
        </p>
      </div>
    </div>
  )
}
