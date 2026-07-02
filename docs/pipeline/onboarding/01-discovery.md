# UXD: Onboarding — Discovery

## Pain point
After a user clicks "Join for free" and authenticates, they land on a blank /join success state with no context, no next step, and no sense of what just happened. Free users don't know what they get. Premium users who just subscribed don't know when their first deal alert will arrive.

## Who is affected
Every new user immediately after sign-up or Stripe checkout completion.

## Measurable signal
- /join page has no post-auth confirmation state
- No welcome email is sent on account creation
- After Stripe checkout.session.completed, user is redirected to /account with no explanation
- Users have no idea the pipeline runs daily or that they need to set a watchlist

## Constraints
1. Onboarding must work without JS (server component base)
2. Must not add a new page route — use /account as the post-auth landing and extend it
3. No onboarding wizard — one-screen summary: what plan they have, what happens next, one action to take
4. Free users: show what's unlocked vs blurred, CTA to upgrade
5. Premium users: show trial end date, prompt to set alert preference and watchlist

## Success statement
Solved when a new premium user reads /account and knows: (1) they're on a trial, (2) deals arrive by email, (3) they can set which cities to watch — all without scrolling.
