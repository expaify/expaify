---
id: UXD-AUTH-POSTLOGIN-001
stage: UXD
---

# Discovery: No User Control After Sign-in

## Problem Statement
After completing sign-in (magic link or Google OAuth), the user has no clear destination or navigation control — they either loop back to `/login` or land on `/api/auth/error` with no way forward. The auth flow is a dead end.

## Who is affected
Every new and returning user, at the moment they attempt to authenticate — the highest-stakes moment in the funnel.

## Measurable signals
- Google OAuth callback redirects to `/login` (callbackUrl cookie dropped by Azure proxy)
- `/api/auth/error` page has no navigation, no "go back", no CTA
- `/login` page does not detect an already-authenticated session and redirect away
- Magic link click lands the user at `/login/verify` with no onward link

## Constraints
1. Brand: post-auth destination must be the core value surface (`/deals`)
2. No cookie dependency: callbackUrl cannot rely on a cookie that the proxy drops
3. Accessibility: error and success states must have a visible, focusable action

## Success statement
This is solved when a first-time user can click "Continue with Google" or receive and click a magic link and land on `/deals` — without hitting an error page, a loop, or a dead end — on every attempt.
