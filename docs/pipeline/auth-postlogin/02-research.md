---
id: UXR-AUTH-POSTLOGIN-001
stage: UXR
---

# Research: Auth Post-Login Redirect

## Current implementation audit

**`auth.ts` redirect callback:** not configured — NextAuth falls back to callbackUrl cookie, which Azure proxy drops. Result: after OAuth, user lands on `pages.signIn = '/login'`.

**`/login` page:** client component, no session check, no redirect-if-authed logic. Shows sign-in form unconditionally regardless of session state.

**`/login/verify` page:** shown after magic link send. No link to `/deals` or `/account`. Dead end until email arrives.

**`/api/auth/error` page:** not customised — uses NextAuth default which has zero navigation.

## Reference pattern (Booking.com / Google)
- Post-auth redirect is always hardcoded to the intended destination, never cookie-dependent
- "Continue with Google" always lands on the last meaningful page or the home/dashboard
- Sign-in pages detect authenticated sessions and redirect immediately (`if session → push /`)
- Error pages always have a "Try again" button and a home link

## Design directives
1. **`redirect` callback in NextAuth** — always send to `/deals` as default; honour explicit same-origin callbackUrls only. Zero cookie dependency.
2. **`/login` page** — on mount, check `useSession()`. If `status === 'authenticated'` → `router.replace('/deals')`. Eliminates loop.
3. **`/login/verify` page** — add "Open your email app" CTA + "Back to sign in" link. Not a dead end.
4. **Custom `/auth/error` page** — branded error card with the error message, a "Try again" link to `/login`, and a "Go to deals" link. Never a blank page.
5. **Google callbackUrl** — pass `/deals` as explicit `callbackUrl` that gets validated server-side via the `redirect` callback, not via cookie.
