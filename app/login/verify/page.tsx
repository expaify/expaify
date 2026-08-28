import type { Metadata } from 'next';
import { Reveal } from '@/app/components/ui/Reveal';

export const metadata: Metadata = {
  title: 'Check your inbox — expaify',
  robots: { index: false, follow: false },
};

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--bg)] px-5">
      <div className="w-full max-w-[400px] text-center">
        <Reveal delayMs={0}>
          <a
            href="/"
            className="mb-10 inline-flex items-center gap-0.5 font-display text-xl font-bold text-[color:var(--ink)] no-underline"
          >
            expaify<span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" aria-hidden />
          </a>
        </Reveal>
        <Reveal delayMs={80} className="join-success-enter rounded-[var(--radius-card)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] bg-[radial-gradient(ellipse_at_top_right,var(--primary-soft),transparent_60%)] p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--primary-soft)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"
                stroke="var(--primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="font-display text-xl font-bold text-[color:var(--ink)]">Check your inbox</h1>
          <p className="mt-3 text-base leading-relaxed text-[color:var(--ink-soft)]">
            A sign-in link is on its way. Click it to access your account — the link expires in 24 hours.
          </p>

          <a
            href="mailto:"
            className="btn btn-primary mt-6 w-full justify-center transition-transform duration-150 active:scale-[0.98]"
          >
            Open email app
          </a>

          <p className="mt-5 text-sm text-[color:var(--ink-faint)]">
            Didn&apos;t get it? Check spam, or{' '}
            <a href="/login" className="text-[color:var(--primary)] no-underline hover:underline">
              try again
            </a>
            .
          </p>
        </Reveal>
      </div>
    </div>
  )
}

