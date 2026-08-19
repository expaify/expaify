'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'

export function LandingNav({ homepageRedesign = false }: { homepageRedesign?: boolean }) {
  const [scrolled, setScrolled] = useState(false)
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const isHomepage = pathname === '/'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const initial = session?.user?.name?.[0] ?? session?.user?.email?.[0] ?? '?'

  return (
    <header
      className="sticky top-0 z-50 w-full bg-[color:var(--bg)] transition-shadow duration-150"
      style={{ boxShadow: scrolled ? 'var(--shadow-header)' : 'none' }}
    >
      <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-5">
        <a
          href="/"
          className="text-h3 flex items-center gap-0.5 leading-none text-[color:var(--ink)] no-underline"
          aria-label="expaify home"
        >
          expaify
          <span className="h-2 w-2 rounded-[var(--radius-pill)] bg-[color:var(--primary)]" aria-hidden />
        </a>

        <nav className="flex items-center gap-1" aria-label="Main navigation">
          {status === 'loading' ? null : status === 'authenticated' ? (
            <>
              <a
                href="/blog"
                className="rounded-[var(--radius-input)] px-3 py-2 text-body font-medium text-[color:var(--ink-soft)] no-underline transition-colors hover:text-[color:var(--ink)]"
              >
                Blog
              </a>
              <a
                href="/deals"
                className="rounded-[var(--radius-input)] px-3 py-2 text-body font-medium text-[color:var(--ink-soft)] no-underline transition-colors hover:text-[color:var(--ink)]"
              >
                Deals
              </a>
              <a
                href="/account"
                aria-label="Your account"
                title={session.user?.email ?? 'Account'}
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-[var(--radius-pill)] bg-[color:var(--primary)] text-small font-medium uppercase text-[color:var(--text-inverse)] no-underline transition-opacity hover:opacity-80"
              >
                {initial.toUpperCase()}
              </a>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="rounded-[var(--radius-input)] px-3 py-2 text-body font-medium text-[color:var(--ink-soft)] transition-colors hover:text-[color:var(--ink)]"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              {homepageRedesign ? (
                <>
                  <a href="/deals" className="hidden rounded-[var(--radius-input)] px-3 py-2 text-body font-medium text-[color:var(--ink-soft)] no-underline transition-colors hover:text-[color:var(--ink)] sm:block">Deals</a>
                  <a href="/destinations" className="hidden rounded-[var(--radius-input)] px-3 py-2 text-body font-medium text-[color:var(--ink-soft)] no-underline transition-colors hover:text-[color:var(--ink)] sm:block">Destinations</a>
                </>
              ) : null}
              {isHomepage && (
                <>
                  <a
                    href="#pricing"
                    className={homepageRedesign ? 'hidden rounded-[var(--radius-input)] px-3 py-2 text-body font-medium text-[color:var(--ink-soft)] no-underline transition-colors hover:text-[color:var(--ink)]' : 'hidden rounded-[var(--radius-input)] px-3 py-2 text-body font-medium text-[color:var(--ink-soft)] no-underline transition-colors hover:text-[color:var(--ink)] sm:block'}
                  >
                    Pricing
                  </a>
                  <a
                    href="#faq"
                    className={homepageRedesign ? 'hidden rounded-[var(--radius-input)] px-3 py-2 text-body font-medium text-[color:var(--ink-soft)] no-underline transition-colors hover:text-[color:var(--ink)]' : 'hidden rounded-[var(--radius-input)] px-3 py-2 text-body font-medium text-[color:var(--ink-soft)] no-underline transition-colors hover:text-[color:var(--ink)] sm:block'}
                  >
                    FAQ
                  </a>
                </>
              )}
              {!homepageRedesign ? <a
                href="/blog"
                className="rounded-[var(--radius-input)] px-3 py-2 text-body font-medium text-[color:var(--ink-soft)] no-underline transition-colors hover:text-[color:var(--ink)]"
              >
                Blog
              </a> : null}
              <a
                href="/login"
                className="rounded-[var(--radius-input)] px-3 py-2 text-body font-medium text-[color:var(--ink-soft)] no-underline transition-colors hover:text-[color:var(--ink)]"
              >
                Login
              </a>
              {homepageRedesign ? (
                <a href="/login?intent=free&utm_source=homepage&utm_medium=nav&utm_campaign=free_alerts" className="btn btn-conversion btn-sm ml-1">Get free alerts</a>
              ) : (
                <a href="/join" className="btn btn-conversion btn-sm ml-1">Join the club</a>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
