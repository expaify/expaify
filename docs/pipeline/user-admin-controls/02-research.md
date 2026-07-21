---
id: UXR-USER-ADMIN-CONTROLS-01
stage: UXR
date: 2026-07-21
feature_slug: user-admin-controls
upstream: docs/pipeline/user-admin-controls/01-discovery.md
---

# UX Research: User Account and Admin Controls

## 1. Scope confirmation

This research brief covers account self-service and the minimum viable support/admin control plane for existing expaify account data: user lookup, subscription state, Stripe portal relationship, comp/cancel support flows, authenticated alert/watchlist inspection, public price-alert inspection, privacy export/delete request handling, audit logging, access control, and a support workflow that avoids direct SQL for routine cases.

This is repair work, not a new consumer feature. The first admin slice should be read-heavy, role-gated, and audited before it permits any account mutation.

## 2. Current implementation audit

| Surface | What current code does | Gap for support/admin |
|---|---|---|
| Auth and session | NextAuth uses Resend magic links and optional Google OAuth. The session callback only attaches `session.user.id` (`auth.ts:53-58`). | There is no role/permission concept in session, no server helper for admin checks, and no role-gated admin route. |
| Route protection | `proxy.ts` protects only `/account` and matches only `/account/:path*`. | Any future `/admin` route would need new server-side protection; hiding UI is not enough. |
| Account page | `/account` redirects unauthenticated users, fetches one subscription row, and renders plan/profile/alerts for the signed-in user (`app/account/page.tsx:20-35`, `app/account/page.tsx:73-188`). | It is self-service only. There is no support lookup, no status history, no Stripe/local conflict view, and no admin-safe explanation of how access was granted. |
| Billing portal | `POST /api/stripe/portal` requires the signed-in user and creates a Stripe billing portal session only when `stripe_customer_id` exists (`app/api/stripe/portal/route.ts:18-35`). | This is the right customer self-service pattern, but support cannot generate or inspect portal state for a user. If local Stripe ids are stale or missing, support gets no diagnostic path. |
| Stripe webhooks | Webhooks upsert local subscription rows from checkout, subscription updates, deletes, and payment failures (`app/api/stripe/webhook/route.ts:33-90`). | State changes have no provenance beyond current row values. No event id, actor/source, before/after snapshot, or support-visible history is stored. |
| Subscription schema | `subscriptions` stores Stripe ids, `status`, `plan`, dates, alert preferences, watchlist, unsubscribe token, and timestamps (`lib/db/schema.sql:196-212`). | There is no entitlement source, comp state, comp expiration, support note, subscription status history, or admin override record. |
| Account alert UI | The account client edits alert frequency, discount threshold, and watchlist locally, then saves via `PATCH /api/onboarding` (`app/account/AccountClient.tsx:69-90`, `app/account/AccountClient.tsx:124-213`). | Support cannot inspect or repair the values except in SQL. User-facing write paths are duplicated with the narrower account APIs. |
| Account alert APIs | `PATCH /api/account/alerts` and `PATCH /api/account/watchlist` are premium-gated partial update routes (`app/api/account/alerts/route.ts:10-48`, `app/api/account/watchlist/route.ts:14-38`). | They have no GET/read model, no admin mode, no audit trail, and the watchlist route silently filters invalid cities before slicing to 10. |
| Email unsubscribe | `GET /api/alerts/unsubscribe` mutates `subscriptions.alert_preference` to `off` by token (`app/api/alerts/unsubscribe/route.ts:43-60`). | Support cannot see unsubscribe events or confirm whether an off state came from token use, account UI, or direct database edits. The GET mutation is also scanner/prefetch sensitive. |
| Public price alerts | `/api/alerts` creates email-based `price_alerts` and deactivates by `email` plus `id` (`app/api/alerts/route.ts:29-150`). | These alerts are not linked to Auth.js users, not visible in `/account`, and not inspectable by support next to authenticated watchlists. |
| Privacy policy | The public privacy page tells users to email `questions@expaify.com` for export/delete requests and promises response/deletion within 30 days (`app/privacy/page.tsx`). | There is no app record for the request, identity verification, review state, completion, rejection, or audit trail. |
| Database | Current schema has users, OAuth accounts, sessions, subscriptions, public price alerts, deals, and alert deliveries. | No `admin_users` or roles, no `admin_audit_log`, no `account_export_requests`, no `account_deletion_requests`, and no support case/request table. |

## 3. Reference patterns

### Stripe Customer Portal and subscription management

Stripe's hosted customer portal is intended for customer self-service: billing information, payment methods, subscriptions, cancellations, and invoices. The portal can also be configured for cancellation handling, reasons, and retention offers. Current expaify usage matches the customer self-service pattern, but an admin console should not blur "open customer portal" with "support changed billing." Support actions must label whether they hand the user to Stripe, cancel in Stripe, or only change local expaify access.

Sources: Stripe customer management docs, https://docs.stripe.com/customer-management; Stripe portal configuration docs, https://docs.stripe.com/customer-management/configure-portal.

### Clerk/Supabase-style user management pattern

The relevant pattern is not visual style; it is operational hierarchy:

1. Search finds a user or no-match state.
2. The first result page is read-only identity, auth, billing, and activity context.
3. Dangerous actions are separated into explicit panels requiring a reason and confirmation.
4. Role-gated access is enforced server-side, not by client navigation.
5. Audit entries are visible next to the account so the next support agent sees what happened.

### Travel/subscription support pattern

For subscription products, support must distinguish financial cancellation from product entitlement removal. "Cancel Stripe subscription", "open Stripe portal", "grant comp access", and "remove local access" are four different actions. A support UI that collapses them into one "cancel" or "premium" toggle creates billing risk and trust loss.

## 4. Exact gaps and recommendations

### R1 - Add a minimal role-gated admin foundation before any admin UI

Current code has no role source (`auth.ts:53-58`) and no admin route protection (`proxy.ts`). The admin MVP needs a DB-backed role or allowlist table, plus one server helper used by every admin page and API.

Design directive:
- `/admin` and `/api/admin/*` must return forbidden states for signed-in non-admins and unauthenticated states for signed-out users.
- Admin status must be verified server-side from the database on each admin request or from a signed session value derived from database verification.
- Do not expose admin affordances based only on client `useSession()`.

Acceptance criteria:
- Non-admin authenticated user receives 403 for `/admin` and every `/api/admin/*` route.
- Signed-out user receives a login flow, then still receives 403 if not admin.
- Admin users can load the lookup shell.
- Tests cover unauthorized, non-admin, and admin access.

### R2 - Start with support lookup and a read-only account summary

Current support data is split across `users.email`, `subscriptions.user_id`, Stripe ids, `price_alerts.email`, and `deal_alert_deliveries.user_id`. The first useful admin experience is not mutation; it is a trustworthy account dossier.

Design directive:
- Lookup accepts email, Auth.js user id, Stripe customer id, Stripe subscription id, and public price-alert email.
- Results show a single canonical customer record when possible, plus "related public price alerts" when email matches but no Auth.js user exists.
- The summary is read-only and grouped as Identity, Subscription, Alerts/watchlist, Public price alerts, Recent deliveries, Privacy requests, and Audit activity.
- Sensitive tokens are masked. OAuth tokens and raw verification tokens are never displayed.

Acceptance criteria:
- Searching a known user email shows Auth.js user id, email, provider count, subscription row if present, and recent alert deliveries.
- Searching a Stripe customer/subscription id resolves through `subscriptions`.
- Searching an email with only `price_alerts` shows the public-alert-only state instead of "no user."
- No-match state names the accepted lookup keys and does not expose whether an arbitrary email is registered beyond the explicit searched value.

### R3 - Make subscription state explainable before making it mutable

The local `subscriptions.status` drives premium access through `isPremium(status)`, while Stripe portal/customer ids drive billing self-service. Webhooks currently overwrite local status but do not store event history (`app/api/stripe/webhook/route.ts:33-90`).

Design directive:
- Subscription panel must show local status, premium access result, plan, trial end, current period end, Stripe customer id, Stripe subscription id, updated_at, alert state, and source/provenance when available.
- Add conflict banners for: premium status with no Stripe customer id, canceled status with future current period end, Stripe ids present but no active/trialing access, missing subscription row for an existing user, and public price alerts attached to the same email.
- Treat Stripe as the billing system of record for paid subscriptions. Treat local status as expaify entitlement state.

Acceptance criteria:
- Admin can tell whether a customer can currently access premium features without interpreting raw DB rows.
- Admin can tell whether billing management should be done in Stripe portal, Stripe Dashboard/API, or local entitlement tooling.
- Conflict states are visible and cannot be hidden by the primary action area.

### R4 - Split comp, local cancellation, and Stripe cancellation into separate flows

No comp model exists today. Adding a single premium toggle would be unsafe because local premium access and Stripe billing are financially different.

Design directive:
- "Grant comp access" creates an audited local entitlement override with reason, actor, target, start, optional expiry, and before/after snapshot. It must not create or modify a Stripe subscription.
- "Remove local access" removes only expaify entitlement/comp access and requires reason plus confirmation. It must not claim to cancel billing.
- "Cancel Stripe subscription" is either a Stripe-hosted/admin-API action or an explicit handoff to Stripe; the UI copy must say when the app cannot perform Stripe cancellation directly.
- Every mutation is blocked until an audit log write can be committed in the same server action/transaction.

Acceptance criteria:
- A comped user is labeled "Comp access" and is distinguishable from `trialing`/`active` Stripe access.
- Local access removal never changes Stripe ids silently.
- Stripe cancellation action is not available unless the code actually calls Stripe cancellation or creates an approved Stripe portal/admin handoff.
- Each mutation requires non-empty reason text and writes an audit entry before returning success.

### R5 - Inspect alerts and watchlists without creating another write path

Authenticated alert preferences currently have multiple write paths, and public price alerts are a separate system. Adjacent watchlist research already recommends consolidating user-facing writes in `docs/pipeline/watchlist-ux/02-research.md`. The admin surface should not add a third casual write path.

Design directive:
- Admin MVP shows read-only alert preference, discount threshold, timezone, watchlist count/list, empty-watchlist meaning ("all destinations"), unsubscribe token presence masked, last_alerted_at, and recent `deal_alert_deliveries`.
- Public `price_alerts` are shown separately with active flag, route/hotel id, target price, created, last checked, and triggered timestamps.
- Admin alert/watchlist mutation is out of the first UI slice unless it reuses the eventual consolidated account APIs and writes admin audit entries with reason.

Acceptance criteria:
- Admin can answer "why did this customer get or stop getting deal emails?" from one screen.
- Token-based unsubscribe state is visible as a source candidate, but the raw token is not displayed.
- Public price alerts are not merged into subscription watchlists without a deliberate migration plan.

### R6 - Add privacy export/delete request tracking before destructive work

The privacy page promises email-based export/delete handling, but the app has no request records. Immediate deletion tooling would be too risky without identity verification, scope preview, and audit.

Design directive:
- Add request records for export and deletion with requested email/user id, status, request source, verification status, assigned/admin actor, timestamps, reason/notes, and completion evidence.
- First UI slice creates and tracks requests. It does not immediately delete rows.
- The data inventory shown for deletion/export must include Auth.js `users`, `accounts`, `sessions`, `subscriptions`, `deal_alert_deliveries`, public `price_alerts`, and any future booking/contact rows if present.
- Delete preview must distinguish data to delete, data to anonymize, and data retained for legal/billing/audit reasons.

Acceptance criteria:
- Admin can log an export/delete request from a support email and mark verification/completion states.
- Request status values are visible: requested, verifying, in_progress, completed, rejected.
- No destructive delete button exists without a preview and explicit confirmation.
- Audit log retains admin action records even after account deletion.

### R7 - Audit account views as well as mutations

Admin lookup exposes private account and billing state. View access itself is sensitive even when no mutation occurs.

Design directive:
- Append-only audit log captures: action, actor user id/email, target user id/email when known, searched identifier type, reason or support case id when required, metadata, IP/user agent if available, before/after snapshots for mutations, and created_at.
- Log lookup/detail views separately from changes.
- The account summary shows recent audit entries so a support agent sees previous handling.

Acceptance criteria:
- Opening a user detail page writes an `account_viewed` audit entry.
- Every mutation writes before/after snapshots.
- Audit rows are append-only through app APIs; no admin UI supports editing/deleting them.

## 5. Minimum viable support workflow

1. Admin opens `/admin/users`.
2. Admin searches by email, user id, Stripe customer id, Stripe subscription id, or public price-alert email.
3. If no result, UI shows "No matching account or public alert" and accepted search types.
4. If found, UI lands on read-only account summary with conflict banners first, then detail sections.
5. Admin copies a support-safe explanation or opens Stripe portal handoff if the issue is billing self-service.
6. If an approved local action is needed, admin chooses a specific action: grant comp, end comp/local access, create privacy export request, create deletion request, or deactivate a public price alert if that later becomes approved.
7. Mutation modal requires reason/support case id, shows before/after, confirms Stripe impact or lack of Stripe impact, writes audit, then returns to the account summary.

This workflow is sufficient for first-line support without introducing a broad back office.

## 6. Risks

- Billing risk: local comp/cancel controls can create paid access without payment or remove product access while Stripe still bills. Mitigation: separate action labels, source fields, expiry, and audit.
- Privacy risk: lookup by email exposes whether a person has an account. Mitigation: admin-only access, view audit, no public lookup, limited result surfaces.
- Deletion risk: cascading deletes through Auth.js tables can erase evidence needed for billing/privacy audits. Mitigation: request workflow and preview before destructive tasks.
- Operational risk: support may rely on stale local Stripe state. Mitigation: conflict banners and optional Stripe fetch/reconcile only from server-side provider/helpers.
- Data model risk: public `price_alerts` and authenticated `subscriptions.watchlist` represent different concepts. Mitigation: inspect side by side; do not silently merge.
- Security risk: audit logs containing before/after snapshots may store sensitive fields. Mitigation: mask tokens and never snapshot OAuth access/refresh/id tokens.

## 7. UXDES handoff

Next stage should produce `docs/pipeline/user-admin-controls/03-design.md` covering:

- `/admin/users` lookup default, loading, no-match, multiple-match, forbidden, unauthenticated, and error states.
- User detail hierarchy: conflict/status banners first; then identity, subscription, alerts/watchlist, public price alerts, privacy requests, audit log.
- Mobile 375px and desktop 1280px layouts. Admin tools should be dense and scannable, not marketing-style.
- Exact copy for comp, local access removal, Stripe handoff/cancellation, privacy export request, privacy deletion request, and audit-required reason prompts.
- Keyboard/focus behavior for search, result rows, tabs/sections, mutation dialogs, and destructive confirmations.
- Access-control states for non-admin and signed-out users.
- Mutation confirmation rules: reason required, before/after visible, Stripe impact stated, success/failure copy specified.

UXDES should not specify admin writes that bypass audit logging. DEV should implement role/audit/data foundations before or in the same slice as any mutation UI.

## 8. Research outcome

Recommendation: proceed to UXDES for a role-gated, read-first admin console with explicit support workflows. The first implementation should ship lookup, read-only account summary, conflict detection, privacy request tracking, and audit logging. Comp/cancel mutations should wait until entitlement source fields and append-only audit logging exist.
