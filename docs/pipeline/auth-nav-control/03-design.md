---
id: UXDES-AUTH-NAV-CONTROL-001
stage: UXDES
depends_on: UXR-AUTH-NAV-CONTROL-001
---

# Design Spec: Authenticated Nav Controls

## Component: `LandingNav`

Single file change: `app/components/LandingNav.tsx`

Add `useSession` and `usePathname`. Replace the static right-side nav with three conditional states.

---

## States

### Loading (`status === 'loading'`)
Right-side slot: **render nothing** (`null`).  
Zero layout shift. No Login flash for returning users.

### Unauthenticated (`status === 'unauthenticated'`)
Identical to current nav — no change:
```
[Pricing]  [FAQ]  Login  [Join the club]
```
`#pricing` and `#faq` only shown when `pathname === '/'`.

### Authenticated (`status === 'authenticated'`)
```
[Deals]  [initial]  Sign out
```

- `[Deals]` link → `/deals` — `text-[15px] font-medium text-[color:var(--ink-soft)]`, same style as existing nav links. Shown on all pages (replaces `#pricing`/`#faq` which are useless when authed).
- `[initial]` chip → `/account` — see spec below.
- `Sign out` → calls `signOut({ callbackUrl: '/' })`.

---

## Account chip spec

```
<a href="/account">
  <div class="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--primary)] text-[13px] font-bold text-white">
    {initial}
  </div>
</a>
```

- `initial` = first character of `session.user.name` if present, else first character of `session.user.email`, uppercased.
- `title` attribute = full email for screen readers.
- No tooltip or dropdown — click goes directly to `/account`.
- Size: `h-8 w-8` (32px circle).

---

## Sign-out link spec

```
<button
  type="button"
  onClick={() => signOut({ callbackUrl: '/' })}
  className="rounded-lg px-3 py-2 text-[15px] font-medium text-[color:var(--ink-soft)] transition-colors hover:text-[color:var(--ink)]"
>
  Sign out
</button>
```

No confirmation. Immediate sign-out + redirect to `/`.

---

## Pathname logic

```typescript
const pathname = usePathname()
const isHomepage = pathname === '/'
```

When unauthenticated and on homepage: show `#pricing`, `#faq`, Login, Join.  
When unauthenticated and NOT on homepage: show only Login, Join (drop anchor links).  
When authenticated: always show Deals link + chip + Sign out (no anchor links regardless of page).

---

## Final layout by state

| State | Left | Right |
|-------|------|-------|
| loading | logo | (nothing) |
| unauthed + homepage | logo | Pricing · FAQ · Login · Join |
| unauthed + other page | logo | Login · Join |
| authed | logo | Deals · [●] · Sign out |

---

## Copy
- Account chip aria-label: `"Your account"` 
- Sign-out button text: `Sign out`
- Deals link text: `Deals`

## Interaction rules
- `router.replace` not used here — sign-out uses `signOut()` from next-auth/react
- No animation on state transition — instant swap, avoid jank
- `href` on account chip, not a button — standard link semantics, opens in same tab
