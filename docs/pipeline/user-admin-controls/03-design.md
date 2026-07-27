---
id: UXDES-USER-ADMIN-CONTROLS-01
stage: UXDES
date: 2026-07-27
feature_slug: user-admin-controls
supersedes: UXDES-USER-ADMIN-CONTROLS-CLAUDE-01
upstream:
  - docs/pipeline/user-admin-controls/01-discovery.md
  - docs/pipeline/user-admin-controls/02-research.md
---

# UX Design: Role-Gated, Read-First Admin Console

## 0. What this document is

An implementation-ready interaction and copy spec for the first admin slice: `/admin/users` lookup and `/admin/users/[userId]` account detail, with four audited actions. Every visible string in this document is final copy. No placeholders.

This stage produces docs only. No schema, API route, or component code is written here.

**Hard rule carried from research R7:** nothing in this spec authorizes an admin write path that skips the audit log. If DEV cannot write an audit entry in the same transaction as a mutation, that mutation does not ship.

## 1. Verified source inputs

Read before writing this spec; field names below are taken from source, not assumed.

| Source | What was confirmed |
|---|---|
| `auth.ts:53-58` | Session callback attaches `session.user.id` only. No role. DB-session adapter (`PostgresAdapter`), so a server-side role read per request is cheap and correct. |
| `proxy.ts` | `PROTECTED_ROUTES = ['/account']`, `config.matcher = ['/account/:path*']`. `/admin` is unprotected today — the matcher must gain `/admin/:path*`. |
| `lib/db/schema.sql:160-176` | `users(id, name, email, "emailVerified", image)`. **No `created_at` column on `users`.** |
| `lib/db/schema.sql:169-182` | `accounts` holds `provider`, plus `refresh_token`/`access_token`/`id_token` — never renderable. |
| `lib/db/schema.sql:201-222` | `subscriptions(stripe_customer_id, stripe_subscription_id, status, plan, trial_ends_at, current_period_end, alert_preference, watchlist, alert_min_discount, alert_timezone, alert_unsubscribe_token, last_alerted_at, created_at, updated_at, onboarding_done)`. |
| `lib/db/schema.sql:44-56` | `price_alerts(email, origin, destination, target_cents, currency, hotel_id, active, created_at, last_checked_at, triggered_at)`. Money is minor units — display via the app's existing formatter, never raw cents. |
| `lib/db/schema.sql:259-266` | `deal_alert_deliveries(user_id, deal_id, delivery_type, delivered_at)`, `delivery_type` ∈ `instant | digest`. |
| `lib/subscription.ts:23` | `isPremium(status)` is `trialing || active`. This is the only entitlement gate in the product today. |
| `lib/email/sendDealAlert.ts:57` | `COALESCE(array_length(watchlist,1),0) = 0 OR city = ANY(watchlist)` — **an empty watchlist means "all destinations", not "none"**. The admin UI must say so. |
| `app/globals.css:29-56` | Semantic tokens exist and are the only allowed colour source. Note: `--shadow-card: none` (do not spec a card shadow), and `--warning` is `--gold-text` (a dark brown *text* colour) — for warning **borders** use `--gold`. |

## 2. Design goal

An authorized support admin can look up one customer, read a trustworthy dossier with data-integrity conflicts surfaced before anything else, and take the smallest audited action this slice supports — without direct SQL or Stripe Dashboard credentials for routine cases.

Read-first. Of the six detail sections, four are read-only. Only Subscription and Privacy Requests carry actions.

## 3. Scope

**In scope:** `/admin/users` lookup (all states), `/admin/users/[userId]` detail hierarchy and six sections, four mutation flows, access-control states, keyboard/focus behaviour, 375px and 1280px layouts.

**Out of scope — do not build from this document:**

- Admin writes to `alert_preference`, `alert_min_discount`, `alert_timezone`, `watchlist`, or `price_alerts` rows. Research R5 keeps these read-only in this slice.
- Immediate execution of export or deletion. This slice creates and tracks *request records* only (R6).
- Any in-app Stripe cancellation API call. No such endpoint exists, so cancellation is an explicit external handoff.
- Admin role assignment UI. A separate ticket.
- Consolidating `price_alerts` into `subscriptions.watchlist`. They stay side by side (R5).

## 4. Data assumptions for DEV

These do not exist in the current schema. Building them is DEV's job; this spec only depends on their shape.

- **Role source** — `admin_users` table or `users.role`, verified server-side on every admin request. Never trusted from a client `useSession()`.
- **Entitlement fields on `subscriptions`** — `entitlement_source` (`stripe | comp | none`), `comp_reason`, `comp_granted_by`, `comp_granted_at`, `comp_expires_at`.
- **`admin_audit_log`** — append-only: `action`, `actor_user_id`, `actor_email`, `target_user_id`, `target_email`, `searched_identifier_type`, `reason`, `metadata`, `before`, `after`, `created_at`. No app path updates or deletes rows.
- **`account_export_requests` / `account_deletion_requests`** — `requested_email`, `user_id`, `status` (`requested | verifying | in_progress | completed | rejected`), `source`, `actor_user_id`, timestamps.

**Fallback contract:** if a table is absent when UI work starts, its section renders the *not available* fallback specified in §8, still visible, with its action buttons hidden. Sections are never silently omitted — an admin must be able to tell "not built yet" from "failed to load".

## 5. Route map

- `/admin/users` — lookup; also the admin console landing page.
- `/admin/users/[userId]` — dossier for one Auth.js user id.
- Mutations are dialogs on the detail page. No mutation routes.
- All data comes from `/api/admin/*`, and **every one of those routes re-checks the role server-side**. The UI never assumes an upstream check happened.

## 6. Access-control states

Applies to both pages and every `/api/admin/*` call.

### 6.1 Unauthenticated

- Server-side redirect to `/login?callbackUrl=/admin/users` (or the exact detail path) before any admin markup renders, via the same `proxy.ts` mechanism that protects `/account` — with `/admin` added to `PROTECTED_ROUTES` and `/admin/:path*` added to `config.matcher`.
- No admin shell, no skeleton, no data fetch. Client-side hiding after mount is not acceptable.
- After login, a non-admin lands on Forbidden — never on the admin UI.

### 6.2 Forbidden (authenticated, not an admin)

Every `/api/admin/*` route returns 403. The page renders this in place of the whole console:

- Heading: `You don't have access to this page`
- Body: `Admin tools are limited to expaify support and engineering staff. If you think you should have access, contact your engineering lead.`
- Link: `Back to your account` → `/account`
- No search input, no data fetch, no admin chrome.

A 403 is also written to the audit log as `admin_access_denied` with the attempted path. Failed access attempts are exactly the thing a support-data console needs recorded.

### 6.3 Authorized (admin)

Console renders. Opening a detail page writes an `account_viewed` audit entry (R7). This is a designed side effect and is disclosed in the UI — see §8.6.

### 6.4 Role check itself errors (DB unavailable)

- Heading: `Couldn't verify admin access`
- Body: `Something went wrong checking your permissions. No account data was loaded.`
- Button: `Try again`
- Renders as Forbidden does: no admin data while the check is unresolved. Fail closed.

## 7. Page: `/admin/users` (lookup)

### 7.1 Hierarchy

1. Page heading + accepted-identifiers helper line
2. Search input + submit
3. Result area (one state at a time)

Nothing else. No stat tiles, no recent-activity feed, no marketing surface.

### 7.2 States and copy

**Default (pre-search)**
- Heading: `User lookup`
- Helper: `Search by email, user ID, Stripe customer ID, Stripe subscription ID, or price-alert email to open one account.`
- Input placeholder: `Email, user ID, or Stripe ID`
- Submit: `Search`
- Result area: nothing rendered. No skeleton, no zero-state illustration.

**Loading**
- Submit disabled, label `Searching…`
- Result area shows three skeleton rows at real row height (`bg-[var(--bg-muted)]`, `animate-pulse`) so results arriving cause no layout shift.
- `aria-live="polite"` region announces `Searching…`

**No match**
- Heading: `No matching account or public alert`
- Body: `Nothing matched "{query}". Check the spelling, or try another identifier: email, user ID, Stripe customer ID, Stripe subscription ID, or price-alert email.`
- The searched value is echoed back and nothing else. Never suggest near-miss emails, and never imply whether some *other* address is registered (privacy risk, research §6).

**Single match — registered account**
- One result row. **No auto-navigation**, so the `account_viewed` entry always reflects a deliberate open.
- Row: name or `No name on file` · email · user ID truncated to first 8 chars with a `Copy` control · status badge (`Free`, `Premium trial`, `Premium`, `Comp access`, `Canceled`) · action `View account`.

**Multiple matches — more than one registered account**
Reachable when a Stripe customer id is reused across rows, or when a lookup key resolves ambiguously after a data-integrity problem.
- Heading: `{n} accounts matched "{query}"`
- Body: `More than one account matched this identifier. That usually means duplicate records — check both before taking action.`
- Tone: `warning`. Multiple registered accounts for one identifier is itself a conflict, not a neutral list.
- One result row per account, in the standard row format above, ordered by most recent `subscriptions.updated_at` first, then by email.

**Multiple matches — account plus public alerts**
- Heading: `Multiple matches for "{query}"`
- Body: `This search matched more than one kind of record. Choose which to view.`
- Two cards:
  - `Registered account` → `View account` (navigates to `/admin/users/[userId]`)
  - `Public price alerts ({n})` → `View alerts` (expands the inline list below, in place — no navigation, because public alerts have no user id and therefore no dossier)

**Public-alert-only (email has `price_alerts` rows but no Auth.js user)**
- Heading: `No registered account — public price alerts found`
- Body: `"{query}" isn't linked to a signed-in account, but it has public price alerts. These are created by email without an account.`
- Inline list per row: `{origin} → {destination}` or `Hotel {hotel_id}` · target price formatted from `target_cents`/`currency` · `Active`/`Inactive` badge · created date.
- No actions. Read-only in this slice.

**Search error (role check passed, query failed)**
- Heading: `Search failed`
- Body: `Something went wrong running that search. Try again in a moment. If it keeps failing, check the admin API logs.`
- Button: `Try again` (re-runs the same query)
- The typed query stays in the input.

### 7.3 Keyboard and focus — lookup

- Search input autofocuses on load.
- `Enter` in the input submits. One primary action, so no extra shortcuts.
- After results render, focus moves to the result-area heading (`tabindex="-1"`), so screen reader users land on the outcome instead of re-tabbing the page. On the single-match state, focus moves to the row's heading text.
- Result rows are focusable in DOM order; `Enter`/`Space` activates `View account` / `View alerts`.
- `Escape` in the input clears the query but leaves rendered results intact — clearing a typo should not destroy the result an admin is reading.

### 7.4 Tailwind patterns — lookup

- Shell: `mx-auto max-w-[860px] px-5 py-10` (375px: `px-4 py-6`)
- Search bar: `flex gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] p-2`
- Input: `min-h-11 flex-1 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-1)] focus-visible:border-[var(--border-focus)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]`
- Submit: `min-h-11 rounded-[var(--radius-control)] bg-[var(--brand)] px-4 text-sm font-bold text-[var(--text-inverse)] disabled:opacity-60`
- Result row: `flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3`
- Empty/error panel: `rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-muted)] px-5 py-6 text-center`

## 8. Page: `/admin/users/[userId]` (account detail)

### 8.1 Fixed hierarchy

1. Back link: `← Back to user lookup`
2. Success banner slot (after a mutation)
3. **Conflict and status banners**
4. Identity
5. Subscription
6. Alerts & Watchlist (read-only)
7. Public Price Alerts (read-only)
8. Privacy Requests
9. Audit Log

Order is fixed. Conflict banners sit above *every* section including Identity: an admin must see a data-integrity problem before reading a single field, and must not be able to scroll past it to an action without passing it.

**Global display rules for this page**
- Dates render in the admin's local timezone with an explicit label, e.g. `Jul 18, 2026, 3:04 PM`. Where the customer's `alert_timezone` matters (alert scheduling), show it beside the value rather than converting silently.
- Money renders from `{cents, currency}` through the app's existing formatter. Raw cents are never displayed.
- Masking: `alert_unsubscribe_token` renders as `Token active (hidden)`. OAuth `access_token`, `refresh_token`, `id_token` and `verification_token` values are never fetched into this page's payload at all — masking at render time is not sufficient.
- Section loading: each section renders its own skeleton independently, so one slow query does not blank the page. Section fetch failure renders inline: `Couldn't load {section name}.` + `Retry`, leaving the rest of the dossier usable.

### 8.2 Conflict and status banners

Rules are independent. Render every rule currently true, most severe first (`error`, then `warning`, then `info`). Never render a rule whose condition is not actually met, and never duplicate a rule.

| Tone | Condition | Copy |
|---|---|---|
| `error` | `stripe_customer_id` or `stripe_subscription_id` present **and** `status = 'free'` | `Stripe IDs are on file, but local status is "free". A webhook update may have failed to apply — check Stripe before taking any action here.` |
| `error` | More than one `subscriptions` row resolves to this user | `This account has more than one subscription record. Entitlement may be inconsistent — escalate to engineering before changing access.` |
| `warning` | `isPremium(status)` **and** `entitlement_source ≠ 'comp'` **and** `stripe_customer_id` is null | `Premium access with no Stripe customer on file. If this wasn't granted as comp access, billing is misconfigured.` |
| `warning` | `status = 'canceled'` **and** `current_period_end` is in the future | `Status is canceled, but the current period runs until {date}. Access may continue until then.` |
| `warning` | `entitlement_source = 'comp'` **and** `comp_expires_at` is in the past **and** `isPremium(status)` | `Comp access expired on {date} but this account still shows premium. Remove local access or grant a new comp period.` |
| `warning` | `alert_preference = 'off'` **and** `isPremium(status)` | `This customer pays for premium but has deal alerts turned off. If they're asking why alerts stopped, this is why.` |
| `info` | No `subscriptions` row | `No subscription record exists yet. This account has never started checkout or been granted comp access.` |
| `info` | `price_alerts` rows exist for this email | `This email also has {n} public price alert(s) that aren't linked to this account. See Public Price Alerts below.` |

Tailwind by tone:
- `error`: `rounded-[var(--radius-control)] border border-[var(--error)] bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--text-1)]`
- `warning`: `rounded-[var(--radius-control)] border border-[var(--gold)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--text-1)]`
- `info`: `rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-3 text-sm text-[var(--text-2)]`

Banners are **not dismissible**. They are computed live from state, not messages to acknowledge; when the condition clears, the banner disappears on its own. Each banner container is `role="status"`; `error`-tone banners use `role="alert"`.

### 8.3 Section: Identity (read-only)

| Row | Value / fallback |
|---|---|
| Name | `users.name` or `No name on file` |
| Email | value, with `Copy` control |
| User ID | value, with `Copy` control |
| Auth providers | `Email link`, `Google`, or both, derived from `accounts.provider` (+ `Email link` when a magic-link session exists with no OAuth row) |
| Email verified | `Verified {date}` from `"emailVerified"`, or `Not verified` |
| Account created | `Not tracked` — `users` has no `created_at` column |

`Not tracked` is rendered as a real row, not omitted, so an admin learns this is a schema gap and not a failed load.

### 8.4 Section: Subscription

Every field always renders, with `Not set` for null:

- Status badge: `Free` / `Premium trial` (`trialing`) / `Premium` (`active`) / `Comp access` (`entitlement_source = 'comp'`) / `Canceled`
- Premium access right now: `Yes` or `No`, derived from `isPremium(status)`, with helper `This is what the app checks when gating premium features.` — the point of the section is that an admin never has to interpret raw rows.
- Entitlement source: `Stripe` / `Comp` / `None`
- Plan: `Monthly` / `Annual` / `Not set`
- Trial ends: `trial_ends_at` or `Not set`
- Current period end: `current_period_end` or `Not set`
- Stripe customer ID: copyable, or `Not set`
- Stripe subscription ID: copyable, or `Not set`
- Comp reason / Granted by / Expires: rendered only when `entitlement_source = 'comp'`
- Last updated: `updated_at` with time

**Actions row**
- `Grant comp access` — shown when `entitlement_source ≠ 'comp'`
- `Remove local access` — shown when the account currently has premium access from any source
- `Cancel in Stripe` — shown when `stripe_subscription_id` is present; disabled when `stripe_customer_id` is missing, with helper text (not a hover-only tooltip) `No Stripe customer ID on file, so there's nothing to open in Stripe.`

**No subscription row:** the section body reads `This account has no subscription record. Granting comp access creates one with premium access and no Stripe billing.` and only `Grant comp access` is offered.

### 8.5 Section: Alerts & Watchlist (read-only)

No mutation controls in this slice (R5). Subhead: `Read-only. Alert settings are changed by the customer in their account, or by a future admin tool with the same audit rules.`

- Alert preference: `Instant` / `Daily` / `Off`
- Minimum discount: `{alert_min_discount}%`
- Timezone: `alert_timezone`
- Watchlist: comma-separated city list, or — when the array is empty — `All destinations` with helper `An empty watchlist means every destination, not none.` (verified against `lib/email/sendDealAlert.ts:57`)
- Unsubscribe token: `Token active (hidden)`
- Last alerted: `last_alerted_at` or `Never`
- Recent deliveries: 10 most recent `deal_alert_deliveries` — deal id (first 8 chars, copyable), type (`Instant` / `Digest` from `delivery_type`), delivered at. Empty: `No deal alerts delivered yet.`

This section answers the single most common support question: *why did this customer stop getting emails?*

### 8.6 Section: Public Price Alerts (read-only)

- Subhead: `Public price alerts are created by email without an account. They are a separate system from this customer's watchlist.`
- All `price_alerts` rows matching this email: route (`{origin} → {destination}`) or `Hotel {hotel_id}` · target price (formatted) · `Active`/`Inactive` · created · last checked or `Never checked` · triggered or `Not triggered`
- Empty: `No public price alerts for this email.`
- No actions in this slice.

### 8.7 Section: Privacy Requests

Two lists — **Export requests** and **Deletion requests** — each with its own create button.

- Row: status badge (`Requested`, `Verifying`, `In progress`, `Completed`, `Rejected`) · requested date · actor email · source/notes
- Empty (export): `No export requests for this account.`
- Empty (deletion): `No deletion requests for this account.`
- Table missing (fallback): `Privacy request tracking isn't available yet.` — section stays visible, create buttons hidden.

### 8.8 Section: Audit Log

- `admin_audit_log` rows for this target user, newest first, 25 per page with `Show older` pagination.
- Row: `{timestamp} · {actor email} · {action label} · {reason or "—"}`
- Action labels:
  - `account_viewed` → `Viewed account`
  - `account_searched` → `Searched`
  - `admin_access_denied` → `Access denied`
  - `comp_granted` → `Granted comp access`
  - `local_access_removed` → `Removed local access`
  - `stripe_handoff_opened` → `Opened Stripe Dashboard handoff`
  - `export_request_created` → `Created export request`
  - `deletion_request_created` → `Created deletion request`
- Mutation rows get a `View details` disclosure revealing a before/after key-value diff in monospace, changed keys marked. Non-mutation rows show `No data change — read-only view.` instead of a toggle.
- Empty: `No admin activity recorded for this account yet.`
- Caption under the heading: `Opening this page added a "Viewed account" entry below. Account views are logged.` — disclosed up front rather than discovered on refresh.
- The log is append-only. There is no edit or delete affordance anywhere in this spec, and audit rows survive account deletion (R6).

## 9. Mutation flows

Every dialog: focus-trapped, `Escape` closes and returns focus to its trigger, and obeys the shared contract in §10.

### 9.1 Grant comp access

- Trigger: `Grant comp access`
- Title: `Grant comp access`
- Body: `This gives {email} expaify premium access without a Stripe subscription. It does not create a Stripe subscription and does not charge anyone.`
- **Reason** (required, textarea): label `Reason for comp access` · placeholder `e.g. Support ticket #4821 — refunded customer, restoring access as goodwill`
- **Expiry** (optional, date): label `Access ends (optional)` · helper `Leave blank for comp access that doesn't expire on its own.`
- Before / After:
  - `Before: {current status label}, entitlement source {current source}`
  - `After: Comp access, entitlement source Comp, granted by {admin email}, {expiry date or "no expiry"}`
- Stripe impact: `No Stripe billing impact. This does not create, modify, or cancel any Stripe subscription.`
- Buttons: `Cancel` / `Grant comp access`
- Success banner: `Comp access granted for {email}.`
- Failure (inline, dialog stays open, inputs preserved): `Couldn't grant comp access. Nothing changed — try again.`

### 9.2 Remove local access

- Trigger: `Remove local access`
- Title: `Remove local access`
- Body: `This ends {email}'s premium access in expaify. It does not cancel or change anything in Stripe.`
- Conditional warning, shown only when `entitlement_source = 'stripe'`: `This customer's premium access comes from an active Stripe subscription. Removing local access will not stop Stripe from billing them — cancel the Stripe subscription separately.`
- **Reason** (required, textarea): label `Reason for removing access` · placeholder `e.g. Support ticket #4821 — customer requested downgrade`
- Before / After:
  - `Before: {current status label} ({current entitlement source})`
  - `After: Free — local access removed`
- Stripe impact: `No Stripe billing impact. If a Stripe subscription is still active, it keeps billing until it's canceled in Stripe.`
- Buttons: `Cancel` / `Remove local access`
- Success: `Local access removed for {email}.`
- Failure: `Couldn't remove local access. Nothing changed — try again.`

### 9.3 Cancel Stripe subscription (handoff)

No admin-side Stripe cancellation API exists. The copy must never imply the app performs the cancellation.

- Trigger: `Cancel in Stripe`
- Title: `Cancel Stripe subscription`
- Body: `expaify can't cancel Stripe subscriptions from this screen. Open Stripe Dashboard to cancel {email}'s subscription there, where billing is the source of truth.`
- Note: `Once you cancel in Stripe, this page updates when Stripe sends the cancellation event — usually within a minute. Refresh if it doesn't.`
- No reason field: this dialog performs no local write, only a navigation. It still writes a `stripe_handoff_opened` audit entry (reason `—`) so the account history shows cancellation was initiated (R7).
- Buttons: `Cancel` / `Open in Stripe Dashboard ↗` → opens `https://dashboard.stripe.com/customers/{stripe_customer_id}` in a new tab (`rel="noopener noreferrer"`), then closes the dialog.
- No success/failure copy — no local state changes. If the audit write fails, log server-side but do not block the navigation. **This is the only exception to §10 rule 5, and it exists precisely because there is no local mutation to roll back.**

### 9.4 Create privacy export request

- Trigger: `Create export request`
- Title: `Create data export request`
- Body: `This creates a tracked request to export {email}'s account data. It does not send the export — it queues the request for review.`
- Informational list (not editable): `Included in the export: account and sign-in details, subscription and billing status, deal alert history, and public price alerts matching this email.`
- **Source** (required, textarea): label `Request source` · placeholder `e.g. Support ticket #4821, or "customer emailed questions@expaify.com on Jul 18"`
- Before / After:
  - `Before: No open export request.` or `Before: {n} existing export request(s).`
  - `After: New export request — status Requested.`
- Stripe impact: `No Stripe billing impact.`
- Buttons: `Cancel` / `Create export request`
- Success: `Export request created for {email}. Status: Requested.`
- Failure: `Couldn't create the export request. Nothing changed — try again.`

### 9.5 Create privacy deletion request

- Trigger: `Create deletion request`
- Title: `Create account deletion request`
- Body: `This creates a tracked request to delete {email}'s account data. Nothing is deleted now — deletion happens in a separate reviewed step.`
- Data preview, three explicit lists (R6 requires distinguishing delete / anonymize / retain):
  - `Will be deleted: sign-in credentials and sessions, profile name and image, city watchlist, alert preferences.`
  - `Will be anonymized: deal alert delivery history, kept for aggregate deal performance and stripped of identity.`
  - `Will be retained: billing and subscription records required for financial and legal recordkeeping, and this account's admin audit log.`
- **Source** (required, textarea): label `Request source` · placeholder `e.g. Support ticket #4821, or "customer emailed questions@expaify.com on Jul 18"`
- Before / After:
  - `Before: No open deletion request.` or `Before: {n} existing deletion request(s).`
  - `After: New deletion request — status Requested.`
- Stripe impact: `No Stripe billing impact. If a Stripe subscription is still active, cancel it in Stripe separately — deleting local data does not stop Stripe billing.`
- Buttons: `Cancel` / `Create deletion request`
- Success: `Deletion request created for {email}. Status: Requested.`
- Failure: `Couldn't create the deletion request. Nothing changed — try again.`

## 10. Mutation confirmation rules (shared contract)

Applies to every flow in §9 except the Stripe handoff (§9.3), which performs no local write.

1. **Reason required.** Non-empty, at least 10 trimmed characters. Confirming with an invalid reason moves focus to the field and shows inline error text: `Enter a reason (at least 10 characters) before {action phrase}.` — `granting access`, `removing access`, `creating this request`. The error is `aria-describedby`-linked to the field.
2. **No accidental submit.** Reason is a textarea; `Enter` inserts a newline and never submits. Only the confirm button submits. `Cmd/Ctrl+Enter` in the textarea triggers the confirm button, respecting its disabled state.
3. **Before/after always visible.** Rendered above the action buttons, never behind a toggle or accordion, never truncated.
4. **Stripe impact always stated.** Every dialog shows its fixed Stripe-impact sentence from §9. Never omitted, never freeform per instance. The rule exists because local entitlement and Stripe billing are financially different (R4) and an admin must never guess which one they just changed.
5. **Audit before success.** The audit write happens in the same server operation/transaction as the mutation. If the audit write fails, the entire mutation fails and rolls back, and the generic failure copy is shown. An admin write must never succeed with its audit entry missing.
6. **Confirm button state.** Disabled and `aria-disabled="true"` until the reason is valid; never disabled for any other reason once the dialog has loaded. While in flight, label swaps to the progressive form (`Granting…`, `Removing…`, `Creating…`) and the button stays disabled to prevent double submits.
7. **Success handling.** Dialog closes; focus returns to the section heading that owned the trigger; a dismissible success banner renders in the slot at the top of the detail page. It does **not** auto-dismiss — support may need to reference or screenshot it. The affected section and the audit log re-fetch so the admin sees the new state and its audit entry without a manual refresh.
8. **Failure handling.** Dialog stays open, typed values preserved exactly, inline error above the buttons. Failure copy always asserts `Nothing changed` — if DEV cannot guarantee that, the copy must change, not the guarantee.
9. **One action at a time.** While a dialog is open, other action buttons on the page are inert. Two entitlement mutations must not race.

## 11. Keyboard and focus (consolidated)

- **Search:** autofocus on load; `Enter` submits; focus moves to the result-area heading when results render; `Escape` clears the input without clearing results.
- **Result rows:** focusable in DOM order; `Enter`/`Space` activates the primary action.
- **Detail sections:** Identity → Audit Log are always-visible stacked sections, **not tabs**, so tab order matches reading order and nothing is hidden from assistive tech by default. Each heading is an `h2` so heading navigation works section to section.
- **Copy controls:** each `Copy` button has an accessible name including its field (`Copy user ID`), and announces `Copied` via a polite live region rather than only a visual tick.
- **Dialogs:** focus moves to the first field on open (or to `Open in Stripe Dashboard ↗` for the handoff, which has no field); focus is trapped; `Escape` closes and restores focus to the trigger; `Tab`/`Shift+Tab` cycle within the dialog only; background is `aria-hidden` and not scrollable.
- **Higher-consequence dialogs** (Remove local access, Create deletion request): the confirm button is never the initially focused element. Initial focus stays on the reason field so a reflexive `Enter`/`Space` on open cannot confirm.
- **Focus ring:** never suppress `:focus-visible`. Every interactive element in this spec uses `--focus-ring` — search input, result rows, copy controls, action buttons, dialog fields, audit disclosures, pagination.
- **Banners:** conflict banners are static text, not focus targets. The success banner's `×` dismiss is focusable and labelled `Dismiss message`.

## 12. Layouts

### 12.1 Lookup — 1280px

Centered column, `max-w-[860px]`. Search bar full width at top; results a vertical list of full-width rows. No sidebar — this page has one job.

### 12.2 Lookup — 375px

Same vertical structure, `px-4`. Search bar and rows stack full width. Status badges wrap onto their own line below the name/email rather than truncating the email — the email is the identifier an admin is verifying.

### 12.3 Detail — 1280px

- Single centered column, `max-w-[960px]`. Dense and scannable, not marketing-styled.
- Sections are stacked full-width cards: `rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] p-6`. No card shadow (`--shadow-card` is `none`).
- **Stacked, not sidebar/tabs**, so conflict banners at the top are unmissable before any action is reachable.
- Identity and Subscription fields render as label/value grids: `grid grid-cols-[180px_1fr] gap-y-2 text-sm`.
- Deliveries, public price alerts, and audit log render as real `<table>` elements with visible `<th>` headers and `scope` attributes.
- Subscription actions render as an inline row: `flex flex-wrap gap-2`.

### 12.4 Detail — 375px

- Same section order, `px-4`, `max-w-full`.
- Label/value grids collapse to stacked pairs: `grid grid-cols-1 gap-1`, label as `text-xs text-[var(--text-3)]` above the value. No truncated IDs, no horizontal scroll.
- Tables become one bordered card per row with `label: value` lines, matching the mobile card pattern used elsewhere in the app. No horizontally scrolling tables.
- Dialogs become full-height sheets (`fixed inset-0`) rather than centered modals, so the reason textarea has room and the on-screen keyboard cannot cover the confirm button. Before/after and the Stripe impact line stay above the buttons in scroll order; the button row is pinned to the bottom of the sheet with `border-t border-[var(--border)] bg-[var(--bg-surface)]`.
- Subscription actions stack full width (`flex flex-col gap-2`), each at least 44px tall.
- Long IDs use `break-all` so nothing overflows the 375px viewport.

## 13. Component notes for the UI stage

Non-binding names for continuity; the UI stage owns implementation.

- `AdminUserSearch` — input plus every result state in §7.2
- `AdminResultRow` — account or alert-group row
- `ConflictBanner` — one instance per true rule in §8.2
- `AdminAccountDossier` — the six stacked sections
- `AdminMutationDialog` — shared shell implementing §10, parameterized per flow
- `AuditLogTable` — rows with per-row before/after disclosure

## 14. Explicit exclusions (recap)

- No mutation UI for alert preferences, watchlist, or public price alerts.
- No immediate deletion or export execution — request records only.
- No in-app Stripe cancellation call — handoff only.
- No admin role-assignment UI.
- No audit-log editing or deletion affordance anywhere.
- No schema, API, or component code from this stage.

## 15. Handoff

This slice depends on primitives that do not exist in the current schema: role source, entitlement/comp fields, `admin_audit_log`, and the export/deletion request tables (§4). It also requires `/admin` to be added to `PROTECTED_ROUTES` and `/admin/:path*` to `config.matcher` in `proxy.ts`.

**Next stage: `DEV-USER-ADMIN-CONTROLS-01`** — build the role check, audit log, entitlement fields, request tables, and `/api/admin/*` routes under the `Result<T>` contract with audit-write-before-success. A `UI-USER-ADMIN-CONTROLS-01` ticket implements the pages and dialogs in this document, in the same slice or after. UI work must not begin against a role check that lives only in the client: every state here assumes server-verified access control.
