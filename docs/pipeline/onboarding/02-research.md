# UXR: Onboarding — Research

## Current /account state
- `app/account/page.tsx` — server component, shows plan status, upgrade CTA for free users
- `app/account/AccountClient.tsx` — billing portal button, signout, alert preference selector
- No trial countdown, no watchlist UI, no "what happens next" copy, no welcome state

## Reference patterns
**Notion**: after signup, shows a 3-step checklist inline in the app (no separate page). Each step is a clickable item that expands. Checks off automatically.

**Airbnb**: post-booking confirmation screen = summary card + "What's next" timeline with dates. Same approach works for a subscription: "Your trial ends on {date}. We'll email you if a deal drops before then."

**Linear**: no wizard, just a "you're all set" banner that dismisses after one click.

## Design directives
1. **Welcome banner** — shown only on first visit after sign-up (use `?welcome=1` query param set by Stripe redirect). Teal bg, dismissible. Copy: "Welcome to expaify. Your first deal alert will arrive by email — usually within 24 hours."
2. **Trial card** — for trialing users: trial end date prominently, "upgrade before {date} to keep alerts." For active: "Premium active — billing on {date}."
3. **Alert preference inline** — show current setting (instant/daily/off) with radio pills, save on click without a form submit. Already exists in AccountClient — surface it above the fold.
4. **City watchlist** — multi-select of the 20 tracked cities. Save to `subscriptions.watchlist`. Only for premium users.
5. **Free upgrade prompt** — for free users: "You're on the free plan. Upgrade to get unlimited deals + email alerts." with coral CTA.
6. **Welcome email** — sent once when a new user account is created (NextAuth `events.createUser` callback). Simple: "You're in. Deals arrive by email." No marketing copy.
