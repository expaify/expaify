'use client'

import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  {
    href: '/deals',
    label: 'Deals',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: '/destinations',
    label: 'Destinations',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2 2 7l10 5 10-5-10-5Z" />
        <path d="m2 17 10 5 10-5" />
        <path d="m2 12 10 5 10-5" />
      </svg>
    ),
  },
  {
    href: '/alerts',
    label: 'Alerts',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    ),
  },
  {
    href: '/account',
    label: 'Account',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      </svg>
    ),
  },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const initial = session?.user?.name?.[0] ?? session?.user?.email?.[0] ?? '?'

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className="flex shrink-0 items-center gap-1 overflow-x-auto px-2 py-2 lg:sticky lg:top-0 lg:h-screen lg:w-[232px] lg:flex-col lg:items-stretch lg:gap-0.5 lg:overflow-visible lg:px-3.5 lg:py-5"
        style={{ backgroundColor: '#12211F' }}
      >
        <a
          href="/"
          aria-label="expaify home"
          className="hidden items-center gap-2 px-2.5 pb-5 pt-1.5 text-[17px] font-bold leading-none tracking-[-0.02em] text-white no-underline lg:flex"
        >
          expaify
          <span className="h-[7px] w-[7px] rounded-[var(--radius-pill)] bg-[color:var(--accent)]" aria-hidden />
        </a>

        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium no-underline transition-colors duration-150 motion-reduce:transition-none lg:gap-[11px] lg:px-3 ${
                active ? 'text-white' : 'text-[#8FA6A2] hover:text-white'
              }`}
              style={active ? { backgroundColor: '#1A322F' } : undefined}
              aria-current={active ? 'page' : undefined}
            >
              {item.icon}
              <span className="hidden lg:inline">{item.label}</span>
            </a>
          )
        })}

        <div className="ml-auto lg:ml-0 lg:mt-auto lg:pt-3">
          {status === 'authenticated' ? (
            <div className="hidden rounded-[12px] px-3.5 py-3 text-[12px] text-[#8FA6A2] lg:block" style={{ backgroundColor: '#1A322F' }}>
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-[color:var(--primary)] text-[12px] font-medium uppercase text-white">
                  {initial.toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-white">{session?.user?.name ?? session?.user?.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="mt-2.5 w-full rounded-[8px] border border-white/10 px-2.5 py-1.5 text-left text-[11.5px] font-medium text-[#8FA6A2] transition-colors duration-150 hover:text-white motion-reduce:transition-none"
              >
                Sign out
              </button>
            </div>
          ) : status === 'loading' ? null : (
            <a
              href="/login"
              className="hidden rounded-[12px] px-3.5 py-3 text-[12px] text-[#8FA6A2] no-underline lg:block"
              style={{ backgroundColor: '#1A322F' }}
            >
              <strong className="block text-[13px] font-semibold text-white">Free plan</strong>
              Sign in to track unlocks
            </a>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
