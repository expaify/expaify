# UXDES: Onboarding — Design Spec

## Modified files
- `app/account/page.tsx` — add welcome banner, trial card, upgrade prompt
- `app/account/AccountClient.tsx` — add watchlist selector, move alert preference above fold
- `auth.ts` — add `events.createUser` to send welcome email
- `lib/email/templates/WelcomeEmail.tsx` — new template
- `app/api/account/watchlist/route.ts` — PATCH endpoint to save watchlist

## Welcome banner spec
Condition: `searchParams.welcome === '1'`
```
bg: #0E5A54, text: white, border-radius: 16px, padding: 16px 20px
dismiss: × button (top-right, no JS needed — link to /account without ?welcome)
copy: "You're in. Your first deal alert arrives by email — usually within 24 hours."
```

## Plan status card spec (replaces current plain text)

### Free user
```
border: 1.5px dashed #E8E2D8, radius: 16px, padding: 20px
tag: "Free plan" (small gray label)
body: "You see 3 unlocked deals per week. Upgrade for unlimited deals + email alerts."
CTA: "Upgrade to Premium — 7-day free trial" (coral btn, full width)
```

### Trialing
```
border: 2px solid #0E5A54, radius: 16px, padding: 20px
tag: "Premium trial" (teal label)
body: "Trial ends {date}. You'll be charged ${price} unless you cancel."
sub: "Deals are emailing to {email}."
link: "Manage billing →" (opens portal)
```

### Active
```
border: 2px solid #0E5A54, radius: 16px, padding: 20px
tag: "Premium" + green dot
body: "Next billing: {date}."
link: "Manage billing →"
```

### Canceled
```
border: 1.5px dashed #FF6B4A, radius: 16px, padding: 20px
tag: "Canceled" (muted red)
body: "Your premium access ends {date}. Renew to keep getting alerts."
CTA: "Renew Premium" (coral btn)
```

## Alert preference spec
Radio pills: Instant / Daily / Off
Active: bg teal, text white
Inactive: bg white, border ivory
On click → PATCH /api/account/alerts with { preference }
Show "Saved ✓" for 1.5s (client state, no page reload)

## Watchlist spec (premium only)
Label: "Cities I'm watching (up to 10)"
20 city pills, toggle on/off, bg teal when selected
On change → PATCH /api/account/watchlist with { watchlist: string[] }
Max 10 selected — disable unselected when 10 reached

## Welcome email template (WelcomeEmail.tsx)
Subject: "You're in — expaify"
Body:
```
expaify.
──────────────────────────
You're in the club.

We check hotel prices across 20 destinations every day.
When a hotel drops 30%+ below its usual price, you'll hear from us.

[  See today's deals  ]   → https://expaify.com/deals

──────────────────────────
Unsubscribe · expaify.com
```
Sent via: auth.ts events.createUser → sendWelcomeEmail(email)
