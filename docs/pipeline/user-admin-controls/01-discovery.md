---
id: UXD-USER-ADMIN-CONTROLS-001
stage: UXD
date: 2026-07-21
feature_slug: user-admin-controls
---

# Discovery: User Account and Admin Controls

## Problem Statement

When a customer has a billing, alert, watchlist, privacy, or access problem, expaify has partial user self-service but no admin control plane, so support cannot safely inspect, explain, comp, cancel, export, delete, or audit account state without direct database or Stripe access.

## Who Is Affected

Signed-in users are affected in `/account`, post-checkout, alert-email, and watchlist-management moments where they expect control over billing, alerts, saved destinations, and account data. Operators/admins are affected when resolving support requests for a specific user because the app has no role-gated admin surface or API for lookup, subscription visibility, manual entitlement changes, alert/watchlist inspection, export/deletion requests, or audited support actions.

## Current User Capabilities

Verified in source:

| Surface | What users can control today | Current limitation |
|---|---|---|
| Auth (`auth.ts`, `/login`) | Sign in with Resend magic link; Google OAuth is available when configured; session carries `user.id`. | No visible role concept in session; no account-security controls beyond sign-in/sign-out. |
| `/account` plan panel (`app/account/page.tsx:73`) | See free/trialing/active/canceled status, trial end, next billing date, and plan label when stored. | User cannot see Stripe subscription id, invoice/payment failure state, entitlement source, or support-safe status history. |
| Stripe checkout (`app/api/stripe/checkout/route.ts`) | Free/canceled users can start monthly or annual checkout with a 7-day trial. | Checkout failures surface generic configuration/error copy; no admin recovery path inside the product. |
| Stripe portal (`app/api/stripe/portal/route.ts`) | Premium/canceled users with a `stripe_customer_id` can open Stripe's billing portal. | Billing management is delegated entirely to Stripe; if the local subscription row is missing or stale, the app returns "No billing record found." |
| Alert preferences (`app/account/AccountClient.tsx:124`) | Premium users can choose `instant`, `daily`, or `off`, choose 30/40/50 percent minimum discount, and select up to 10 tracked cities. | Account UI saves through `/api/onboarding`, while narrower `/api/account/alerts` and `/api/account/watchlist` also exist; control paths are duplicated and not admin-visible. |
| Watchlist API (`app/api/account/watchlist/route.ts`) | Authenticated premium users can replace their own city watchlist after server filtering to tracked cities and max 10. | No GET endpoint for account inspection outside server-rendered account page; no admin inspection or correction path. |
| Alert unsubscribe (`app/api/alerts/unsubscribe/route.ts`) | Anyone with a valid subscription unsubscribe token can turn deal alerts off. | One-click unsubscribe mutates state on GET; there is no operator view of unsubscribe events, reason, source, or whether the customer intended a full stop versus fewer alerts. |
| Legacy/public price alerts (`app/api/alerts/route.ts`) | A visitor can create a route/hotel price alert by email and delete it with `email` + `id`. | These alerts are separate from authenticated subscription watchlists and are not visible in `/account`; no admin inspection or ownership linkage exists. |

## Current Admin Capabilities

There is no in-app admin capability today.

Evidence:

- `find app -path '*admin*' -o -path '*account*'` returns `/account` and account APIs only; no `/admin` route exists.
- `lib/db/schema.sql` defines `users`, `accounts`, `sessions`, `verification_token`, `subscriptions`, `price_alerts`, and `deal_alert_deliveries`, but no `roles`, `admin_users`, `admin_audit_log`, `account_export_requests`, or `account_deletion_requests` table.
- The NextAuth session callback only attaches `session.user.id`; it does not attach a role, admin flag, or permission set.
- Subscription mutations come from Stripe webhooks, user checkout, user onboarding/account preference saves, and unsubscribe tokens. None records the actor, reason, or before/after values for support review.

Today an operator's practical controls are out-of-band: Stripe Dashboard for billing, direct SQL for subscription/watchlist state, logs for webhook/debugging, and manual email/support notes. That is high risk for account trust, privacy, and billing correctness.

## Measurable Signals

- **Route absence:** no `/admin` UI/API route and no role-gated server helper exists in source.
- **Schema absence:** no role, audit log, deletion request, or export request tables in `lib/db/schema.sql`.
- **Support lookup gap:** user identity is split across `users.email`, `subscriptions.stripe_customer_id`, `subscriptions.stripe_subscription_id`, `price_alerts.email`, and alert tokens with no single lookup surface.
- **Entitlement opacity:** `/account` reads one subscription row and displays a status badge, but there is no status history, webhook provenance, comp source, or admin override source.
- **Deletion/export gap:** there is no customer-facing or admin-facing path to request/export/delete account data across Auth.js, subscriptions, alert deliveries, and public price alerts.
- **Audit gap:** support-sensitive actions would currently require direct DB/Stripe writes with no app-level actor, timestamp, reason, before state, or after state.

## Constraints

1. **Data integrity and money safety:** Admin controls must not bypass Stripe billing state silently. Comp/cancel actions need explicit source and effect: local entitlement override, Stripe portal/session handoff, or Stripe API-backed change. No hidden paid-access changes without an audit record.
2. **Privacy and least privilege:** User lookup must be role-gated and scoped to operational support data. Export/deletion flows must show what will be affected before action and avoid exposing tokens or OAuth secrets.
3. **Repair-mode scope:** This roadmap should make existing account, subscription, alert, watchlist, and privacy operations controllable and inspectable. It should not introduce new consumer product features, new provider calls, or award-travel behavior.

## Smallest Safe Admin-Control Roadmap

1. **Role-gated admin access**
   - Add a minimal role source for `admin` versus normal users.
   - Attach role to the server session only after DB verification.
   - Protect all admin pages and APIs server-side; client hiding is not sufficient.

2. **User lookup**
   - Search by email, user id, Stripe customer id, Stripe subscription id, and public price-alert email.
   - Show a single read-only account summary first: Auth.js user, subscription row, alert preferences, watchlist, public price alerts, and recent alert deliveries.

3. **Subscription status visibility**
   - Display local status, plan, trial end, current period end, Stripe customer id, Stripe subscription id, updated time, and whether premium access is from Stripe or an admin comp.
   - Flag conflicts such as local premium with no Stripe customer, canceled status with future access, or Stripe ids not present locally.

4. **Comp/cancel access**
   - Start with explicit, audited local comps and local access cancellation only if Stripe-backed cancellation is not implemented in the same slice.
   - Every mutation requires reason text, actor id, target user id, before/after values, and timestamp.
   - UI copy must distinguish "cancel Stripe subscription" from "remove expaify access" because those are financially different.

5. **Alert/watchlist inspection**
   - Read-only first: current cadence, threshold, timezone, watchlist cities, last alerted time, unsubscribe token presence (masked), and recent deliveries.
   - Later mutation can reuse existing account APIs after consolidation, but admin writes need the same audit trail and reason requirement.

6. **Account deletion/export requests**
   - Add request records rather than immediate destructive actions as the first safe step.
   - Cover Auth.js user/account/session rows, subscriptions, alert deliveries, public `price_alerts`, and any future booking/contact records.
   - Show request status: requested, verified, in progress, completed, rejected, with timestamps and actor.

7. **Audit logging**
   - Create an append-only admin audit log before any admin mutation ships.
   - Log admin lookup views separately from mutations because account lookup exposes private data.
   - Include action, actor, target user/email, reason, metadata, created_at, and immutable before/after snapshots for mutations.

## Success Statement

This is solved when a support admin can look up one customer, understand their auth, subscription, alert, watchlist, and privacy-request state, and take the smallest approved billing/access action without direct SQL or Stripe Dashboard access and without any unaudited account mutation.

## Handoff Notes for UXR

- Audit `/account`, auth/session callbacks, Stripe routes, alert/watchlist APIs, unsubscribe behavior, and schema against support-console patterns from Stripe Dashboard, Clerk/Supabase user management, and travel subscription products.
- Treat public `price_alerts` and authenticated `subscriptions.watchlist` as separate systems unless research recommends consolidation.
- Downstream design must specify empty, no-match, forbidden, audit-required, conflict, success, and failure states before UI or DEV work begins.

**Next stage:** `UXR-USER-ADMIN-CONTROLS-01`.
