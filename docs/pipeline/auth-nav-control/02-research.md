---
id: UXR-AUTH-NAV-CONTROL-001
stage: UXR
depends_on: UXD-AUTH-NAV-CONTROL-001
---

# Research: Authenticated Nav Controls

## Current implementation audit

**`app/components/LandingNav.tsx`**
- `'use client'` component
- Uses only `useState` + `useEffect` for scroll shadow — no session awareness
- Right side of nav: always renders `<a href="/login">Login</a>` + `<a href="/join" class="btn btn-conversion">Join the club</a>`
- Left side: logo + `#pricing` + `#faq` links (homepage anchor links — dead on `/deals`)
- No account link, no sign-out, no conditional rendering by auth state

**Used on:** homepage (`/`), deals feed (`/deals`), privacy, terms  
**Not used on:** deal detail page (has its own inline nav), account page (has its own inline nav), login/verify/error pages (have their own layouts)

**`app/account/page.tsx`**
- Protected server component — requires session
- Has a minimal inline nav with logo + "Deals" link, but no sign-out button
- `AccountClient.tsx` contains the account UI — check for sign-out

**Session hook available:** `useSession()` from `next-auth/react` — now works because `SessionProvider` is in the root layout (added in fix commit `e23d308`).

**`signOut` from `next-auth/react`** — client callable. Calling `signOut({ callbackUrl: '/' })` signs out and redirects to homepage.

## Reference patterns

**Booking.com:** Nav shows avatar + first name when logged in. "Sign in" disappears. Account dropdown: My account, Saved, Sign out.

**Google Flights / Travel:** Account avatar top-right, clicking opens Google account menu. No separate sign-in link when authed.

**Airbnb:** "Sign up / Log in" replaced by avatar chip with name initial. Clicking opens: Account, Help, Sign out.

**Common pattern:** The unauthenticated CTA (Login / Join) swaps for a minimal identity chip (initials or email truncated) + account link. Never show "Login" to a signed-in user.

## Gap analysis

| State | Current | Expected |
|-------|---------|----------|
| Loading session | "Login" + "Join" (wrong) | Neutral / nothing until resolved |
| Unauthenticated | "Login" + "Join" | Unchanged |
| Authenticated (free) | "Login" + "Join" (wrong) | Account chip + "Sign out" |
| Authenticated (premium) | "Login" + "Join" (wrong) | Account chip (premium badge) + "Sign out" |

## Design directives

1. **Replace right-side nav with session-aware controls.** Three states: loading (show nothing/spinner), unauthenticated (current Login + Join), authenticated (account chip + sign-out link).

2. **Account chip:** user's first initial in a teal circle, or email truncated to 16 chars. Links to `/account`. No dropdown needed — one click is enough.

3. **Sign-out control:** Plain text link "Sign out" next to account chip. Calls `signOut({ callbackUrl: '/' })`. No confirmation dialog.

4. **`#pricing` and `#faq` links:** Hide on pages that are not the homepage. These are anchor links that 404-scroll on `/deals`. Use `pathname` to suppress them when not on `/`.

5. **Loading state:** While `status === 'loading'`, render nothing in the right-side slot (zero-width, no layout shift). Avoids the Login flash for signed-in users.
