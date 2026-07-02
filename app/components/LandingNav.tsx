'use client'

import { useEffect, useState } from 'react'

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className="sticky top-0 z-50 w-full bg-[color:var(--bg)] transition-shadow duration-150"
      style={{ boxShadow: scrolled ? '0 1px 0 var(--line-ivory)' : 'none' }}
    >
      <div className="mx-auto flex h-16 max-w-[1140px] items-center justify-between px-5">
        <a
          href="/"
          className="flex items-center gap-0.5 font-display text-[20px] font-bold leading-none tracking-tight text-[color:var(--ink)] no-underline"
          aria-label="expaify home"
        >
          expaify
          <span className="h-[7px] w-[7px] rounded-full bg-[color:var(--accent)]" aria-hidden />
        </a>

        <nav className="flex items-center gap-1" aria-label="Main navigation">
          <a
            href="#pricing"
            className="hidden rounded-lg px-3 py-2 text-[15px] font-medium text-[color:var(--ink-soft)] no-underline transition-colors hover:text-[color:var(--ink)] sm:block"
          >
            Pricing
          </a>
          <a
            href="#faq"
            className="hidden rounded-lg px-3 py-2 text-[15px] font-medium text-[color:var(--ink-soft)] no-underline transition-colors hover:text-[color:var(--ink)] sm:block"
          >
            FAQ
          </a>
          <a
            href="/login"
            className="rounded-lg px-3 py-2 text-[15px] font-medium text-[color:var(--ink-soft)] no-underline transition-colors hover:text-[color:var(--ink)]"
          >
            Login
          </a>
          <a
            href="/join"
            className="btn btn-conversion ml-1 min-h-9 px-4 text-[14px]"
          >
            Join the club
          </a>
        </nav>
      </div>
    </header>
  )
}
