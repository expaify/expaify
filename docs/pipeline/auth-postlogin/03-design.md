---
id: UXDES-AUTH-POSTLOGIN-001
stage: UXDES
---

# Design Spec: Auth Post-Login Redirect

## 1. NextAuth `redirect` callback
Intercepts every post-auth redirect server-side.
```
if url is relative ('/deals', '/account', etc.) → allow
if url starts with baseUrl → allow  
else → return baseUrl + '/deals'
```
Default landing = `/deals`. No cookie required.

## 2. `/login` page — authenticated redirect
State: user lands on `/login` already signed in.
- Use `useSession()` from next-auth/react
- If `status === 'authenticated'` → `router.replace('/deals')` immediately
- If `status === 'loading'` → show spinner (same as current loading state)
- If `status === 'unauthenticated'` → show form (current behaviour, unchanged)

## 3. `/login/verify` page — not a dead end
Current: blank "check your email" card.
New states:
- **Primary copy:** "Check your inbox" / "We sent a sign-in link to **{email}**"
- **CTA button (primary):** "Open Gmail" → `https://mail.google.com` (if @gmail) or generic "Open email app" → `mailto:` (all others). Opens in new tab.
- **Secondary link:** "← Back to sign in" → `/login`
- **Tertiary copy:** "Didn't get it? Check spam, or try again."
Token: `--primary` teal for button, `--ink-soft` for secondary link.

## 4. Custom `/auth/error` page — `app/auth/error/page.tsx`
Props: `searchParams.error` — one of: `Configuration`, `AccessDenied`, `Verification`, `Default`
States:
- **Heading:** "Sign-in failed"
- **Body:** human-readable message per error code (see copy below)
- **CTA 1 (primary):** "Try again" → `/login`
- **CTA 2 (secondary):** "Browse deals" → `/deals`
- Same card layout as `/login` page, max-w-[400px], centred.

### Error copy
| code | message |
|------|---------|
| `Configuration` | "There's a temporary problem with our sign-in service. Please try again in a moment." |
| `AccessDenied` | "Access was denied. If this is unexpected, try a different sign-in method." |
| `Verification` | "Your sign-in link has expired or already been used. Request a new one below." |
| `Default` | "Something went wrong during sign-in. Please try again." |

## 5. NextAuth `pages` config update
Add: `error: '/auth/error'`

## Interaction rules
- All redirects are `router.replace` (not push) — no back-stack pollution
- Error page "Try again" restores the email form pre-filled if available
- No full-page flash: authenticated check on `/login` runs before first paint (useSession is synchronous on re-render if session cache is warm)
