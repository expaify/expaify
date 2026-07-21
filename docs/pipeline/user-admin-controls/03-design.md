---
id: UXDES-USER-ADMIN-CONTROLS-CLAUDE-01
stage: UXDES
date: 2026-07-21
feature_slug: user-admin-controls
upstream:
  - docs/pipeline/user-admin-controls/01-discovery.md
  - docs/pipeline/user-admin-controls/02-research.md
---

# UXDES-USER-ADMIN-CONTROLS-CLAUDE-01: Role-Gated, Read-First Admin Console

## Source Inputs

- Discovery: `docs/pipeline/user-admin-controls/01-discovery.md`
- Research: `docs/pipeline/user-admin-controls/02-research.md`
- Current surfaces referenced: `auth.ts`, `proxy.ts`, `app/account/page.tsx`, `app/account/AccountClient.tsx`, `app/api/stripe/portal/route.ts`, `app/api/stripe/webhook/route.ts`, `app/api/account/alerts/route.ts`, `app/api/account/watchlist/route.ts`, `app/api/alerts/route.ts`, `app/api/alerts/unsubscribe/route.ts`, `app/privacy/page.tsx`, `lib/db/schema.sql`
- Design tokens: `app/globals.css` (`--bg-base`, `--bg-surface`, `--bg-raised`, `--bg-muted`, `--border`, `--border-strong`, `--border-focus`, `--brand`, `--brand-soft`, `--success`, `--success-soft`, `--warning`, `--warning-soft`, `--error`, `--error-soft`, `--text-1`, `--text-2`, `--text-3`, `--radius-card`, `--radius-control`, `--shadow-card`, `--shadow-lift`, `--focus-ring`)

## Problem Statement

Support cannot safely inspect, explain, comp, cancel, export, delete, or audit a customer's account today because expaify has no role-gated admin surface — only direct database and Stripe Dashboard access, with no actor, reason, or audit trail attached to any change.

## Design Goal

Specify a role-gated, read-first admin console at `/admin/users` that lets an authorized support admin look up one customer, see a trustworthy read-only dossier with conflicts surfaced first, and take the smallest audited actions this slice supports: grant comp access, remove local access, hand off to Stripe for cancellation, and open privacy export/deletion requests. Every mutation requires a reason and writes an audit entry before it can report success. Nothing in this document authorizes an admin write path that skips the audit log.

This is a UX/UI specification only. No schema, API route, or component code is produced in this stage.

## Scope and Non-Goals

In scope for this spec:
- `/admin/users` lookup states and `/admin/users/[userId]` account detail hierarchy.
- Read-only Identity, Subscription, Alerts/Watchlist, Public Price Alerts, Privacy Requests, and Audit Log sections.
- Four mutation flows: grant comp access, remove local access, Stripe cancellation handoff, and privacy export/deletion request creation.
- Access-control states, keyboard/focus behavior, and 375px/1280px layouts.

Explicitly out of scope — do not build these from this document:
- Any admin write to `alert_preference`, `alert_min_discount`, `watchlist`, or public `price_alerts` rows. Research R5 keeps these read-only in this slice; a later ticket may reuse the consolidated account APIs with the same audit contract.
- Immediate execution of account deletion or data export. This slice only creates and tracks request records (research R6).
- Any in-app Stripe subscription cancellation API call. No admin-side Stripe cancellation endpoint exists yet, so cancellation is an explicit external handoff, not a button that claims to cancel.
- Admin role management (granting/revoking who is an admin). DEV needs a role source before any of this ships; assigning that role is a separate, smaller ticket this spec does not cover.

## Data Assumptions for DEV (not designed here)

The states below assume these fields/tables exist. Confirming and building them is DEV's job, not this stage's:
- A role source (e.g. `admin_users` table or a `role` column) verified server-side, never trusted from the client session alone.
- `subscriptions.entitlement_source` (`stripe` | `comp` | `none`), `comp_reason`, `comp_granted_by`, `comp_granted_at`, `comp_expires_at`.
- An append-only `admin_audit_log` table: action, actor user id/email, target user id/email, searched identifier type, reason, metadata, before/after snapshot, created_at.
- `account_export_requests` and `account_deletion_requests` tables: requested email/user id, status (`requested` | `verifying` | `in_progress` | `completed` | `rejected`), source/notes, actor, timestamps.

If any of these do not exist by the time UI/DEV work starts, the corresponding section in this spec renders its **not available** fallback (specified per section below) rather than being skipped.

## Route Map

- `/admin/users` — search and lookup. Also the default landing page for the admin console.
- `/admin/users/[userId]` — read-only account dossier plus mutation entry points, for an Auth.js user id.
- All mutations are dialogs on the detail page. No separate mutation routes.
- All API calls the UI depends on live under `/api/admin/*` and must independently re-check the admin role server-side (research R1) — the UI never assumes a role check already happened upstream.

## Access Control States

These apply to `/admin/users`, `/admin/users/[userId]`, and every `/api/admin/*` call the pages make.

### Unauthenticated

- Server-side redirect before any admin markup renders, same pattern as `proxy.ts`'s existing `/account` protection: `/login?callbackUrl=/admin/users` (or the specific detail path).
- No admin shell, no flash of admin UI, no partial data fetch. This must not depend on the client only hiding a component after mount.
- After successful login, if the user is not an admin, land on the **Forbidden** state below — never on the admin UI.

### Forbidden (authenticated, not an admin)

- HTTP 403 from every `/api/admin/*` route; the page renders a forbidden view instead of the search shell.
- Heading: `You don't have access to this page`
- Body: `Admin tools are limited to expaify support and engineering staff. If you believe you should have access, contact your manager or engineering lead.`
- Secondary link: `Back to your account` → `/account`
- No search input, no data fetch, no residual admin chrome is rendered in this state.

### Authorized (admin)

- The search shell and, when navigated directly to a detail URL, the account dossier render normally.
- Opening `/admin/users/[userId]` as an admin always writes an `account_viewed` audit entry (research R7) before or alongside the page responding — this is a designed side effect, not a bug, and is called out in the Audit Log section below so admins aren't surprised to see their own view logged.

### Error (role check itself fails, e.g. DB unavailable)

- Heading: `Couldn't verify admin access`
- Body: `Something went wrong checking your permissions. Try again in a moment.`
- Retry button: `Try again`
- Treat this the same as Forbidden for rendering purposes: no admin data is shown while the role check is unresolved.

## Page: `/admin/users` (Lookup)

### Hierarchy

1. Page heading and one-line accepted-identifiers helper text.
2. Search input + submit.
3. Result area (state-dependent: empty prompt, loading, no-match, single result, multiple-match, public-alert-only, or error).

### Copy and States

**Default (pre-search)**
- Heading: `User lookup`
- Helper text under heading: `Search by email, user ID, Stripe customer ID, Stripe subscription ID, or price-alert email to view one account.`
- Input placeholder: `Email, user ID, or Stripe ID`
- Submit button: `Search`
- No result list, no table, no skeleton — just the empty prompt copy.

**Loading**
- Submit button becomes disabled with label `Searching…`
- Result area shows 3 skeleton rows (shimmer blocks, same `--bg-muted` treatment used elsewhere in the app) at the height of a real result row, to avoid layout shift when results arrive.
- Accessible live region text: `Searching…`

**No-match**
- Heading: `No matching account or public alert`
- Body: `We didn't find a registered account, Stripe record, or public price alert for “{query}”. Check the spelling or try a different identifier: email, user ID, Stripe customer ID, Stripe subscription ID, or price-alert email.`
- No result rows rendered.

**Single match (registered account)**
- One result row, not an automatic navigation — the admin must click to open, so the resulting `account_viewed` audit entry reflects a deliberate view.
- Row content: name or `No name on file`, email, truncated user id (with copy-to-clipboard), status badge (`Free`, `Premium trial`, `Premium`, `Comp access`, or `Canceled`), action link `View account`.

**Public-alert-only (email matches only public `price_alerts`, no Auth.js user)**
- Heading: `No registered account — public price alerts found`
- Body: `“{query}” isn't linked to a signed-in account, but it has public price alerts. These are anonymous alerts created without an account.`
- Inline list (not a separate route, since there is no user id to open a dossier for): each row shows `{origin} → {destination}` or `Hotel {hotelId}`, target price, `Active` / `Inactive` badge, created date.

**Multiple-match (a registered account and public price alerts both match the same query)**
- Heading: `Multiple matches for “{query}”`
- Body: `This search matched more than one record. Choose the account or alert group to view.`
- Two result cards:
  - `Registered account` card → `View account` (goes to `/admin/users/[userId]`)
  - `Public price alerts ({n})` card → `View alerts` (expands the same inline list used in the public-alert-only state, in place, no navigation)

**Forbidden / Unauthenticated / Error**
- As specified in Access Control States above; these fully replace the lookup shell rather than appearing inside the result area.

**Search error (role check passed, but the search query itself fails)**
- Heading: `Search failed`
- Body: `Something went wrong while searching. Try again in a moment. If this keeps happening, check the admin API logs.`
- Retry button: `Try again`
- The previously entered query remains in the input.

### Keyboard and Focus — Lookup

- The search input receives focus automatically on page load.
- `Enter` in the search input submits the search; no separate keyboard shortcut is needed since there is one primary action.
- After results render, focus moves to the result-area heading (no-match / multiple-match / public-alert-only heading, or the first result row's heading text) so screen reader users land on the outcome without re-tabbing through the whole page.
- Result rows are focusable, in DOM order, each fully reachable by `Tab`; `Enter` or `Space` on a focused row activates its `View account` / `View alerts` action.
- `Escape` while focus is in the search input clears the input; it does not clear existing results.

### Tailwind Pattern — Lookup Shell

- Page shell: `mx-auto max-w-[860px] px-5 py-10`
- Search bar: `flex gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] p-2 shadow-[var(--shadow-card)]`
- Input: `min-h-11 flex-1 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-base)] px-3 text-sm text-[var(--text-1)] focus:border-[var(--border-focus)] focus:outline-none focus:shadow-[var(--focus-ring)]`
- Submit button: `min-h-11 rounded-[var(--radius-control)] bg-[var(--brand)] px-4 text-sm font-bold text-[var(--text-inverse)] disabled:opacity-60`
- Result row: `flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3`
- No-match / error panel: `rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-muted)] px-5 py-6 text-center`

## Page: `/admin/users/[userId]` (Account Detail)

### Hierarchy (top to bottom, fixed order)

1. Breadcrumb / back link: `← Back to user lookup`
2. Conflict and status banners (if any apply — see below)
3. Identity
4. Subscription
5. Alerts & Watchlist (read-only)
6. Public Price Alerts (read-only)
7. Privacy Requests
8. Audit Log

Conflict banners render above every section, including Identity, because a support admin must see a data-integrity problem before reading anything else on the page (discovery/research requirement).

### Conflict and Status Banners

Each rule below is independent; render every rule that is currently true, most severe first (`error` tone before `warning` before `info`). Never fabricate a banner — only render a rule when its condition is actually met, and never show more than one instance of the same rule.

| Tone | Condition | Copy |
|---|---|---|
| `error` | Stripe customer/subscription IDs on file but local `status` is `free` | `Stripe customer/subscription IDs are on file, but local status is "{status}". This can mean a webhook update failed to apply — check Stripe directly before taking action.` |
| `warning` | `status` is `trialing` or `active` and `entitlement_source` is not `comp` and `stripe_customer_id` is null | `Premium access with no Stripe customer on file. If this wasn't granted as comp access, billing may be misconfigured.` |
| `warning` | `status` is `canceled` and `current_period_end` is in the future | `Status is canceled, but current period end ({date}) is still in the future. This customer may still have access until then, depending on how canceled access is handled.` |
| `warning` | `entitlement_source` is `comp` and `comp_expires_at` is in the past | `Comp access expired on {date} but status still shows premium. Remove local access or grant a new comp period.` |
| `info` | No `subscriptions` row exists for this user | `No subscription record exists for this account yet. This user has never started checkout or been granted comp access.` |
| `info` | Public `price_alerts` rows exist for this user's email | `This email also has {n} public price alert(s) not linked to this account. See Public Price Alerts below.` |

Tailwind by tone:
- `error`: `rounded-[var(--radius-control)] border border-[var(--error)] bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--text-1)]`
- `warning`: `rounded-[var(--radius-control)] border border-[var(--warning)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-[var(--text-1)]`
- `info`: `rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-3 text-sm text-[var(--text-2)]`

Banners are not dismissible. They reflect live computed state, not a message an admin can clear — if the condition stops being true, the banner disappears on its own.

### Section: Identity

Fields:
- Name: value or `No name on file`
- Email (copy-to-clipboard control)
- User ID (copy-to-clipboard control)
- Auth providers: `Email link`, `Google`, or both, from `accounts.provider`
- Email verified: `Verified {date}` or `Not verified`
- Account created: not tracked in current `users` schema — render `Not tracked` rather than omitting the row, so admins learn this is a real gap and not a loading failure.

### Section: Subscription

Fields (always shown, each with a `Not set` fallback if null):
- Status badge: `Free`, `Premium trial`, `Premium`, `Comp access`, `Canceled`
- Entitlement source: `Stripe`, `Comp`, or `None`
- Plan: `Monthly`, `Annual`, or `Not set`
- Trial ends: formatted date or `Not set`
- Current period end: formatted date or `Not set`
- Stripe customer ID (copyable) or `Not set`
- Stripe subscription ID (copyable) or `Not set`
- Comp reason / granted by / expires — only rendered when `entitlement_source` is `comp`
- Last updated: `updated_at`, formatted with time

Actions row (buttons open the mutation dialogs specified below):
- `Grant comp access` — shown when `entitlement_source` is not `comp`
- `Remove local access` — shown when the account currently has premium access (any source)
- `Cancel in Stripe` — shown when `stripe_subscription_id` is present; disabled with tooltip `No Stripe customer ID on file for this account.` when `stripe_customer_id` is missing

No subscription row exists: render the whole section as `This user has no subscription record. Grant comp access to give premium access without Stripe billing.` with only the `Grant comp access` action available.

### Section: Alerts & Watchlist (read-only)

This section has no mutation controls in this slice (research R5). Fields:
- Alert preference: `Instant`, `Daily`, or `Off`
- Minimum discount: `{n}%`
- Timezone: `alert_timezone` value
- Watchlist: comma-separated city list, or `All destinations` when the array is empty (matching the product's existing empty-watchlist meaning)
- Unsubscribe token: `Token active (hidden)` — the raw token value is never rendered
- Last alerted: formatted date/time or `Never`
- Recent deliveries: table of the 10 most recent `deal_alert_deliveries` rows — deal id (truncated), delivery type (`Instant` / `Digest`), delivered at. Empty state: `No deal alerts delivered yet.`

### Section: Public Price Alerts (read-only)

- Explicitly labeled as a separate system: subhead `Public price alerts are created by email without an account and are not linked to this user's watchlist.`
- Table of all `price_alerts` rows matching this user's email: route or `Hotel {hotelId}`, target price, `Active` / `Inactive`, created, last checked, triggered (or `Not triggered`).
- Empty state: `No public price alerts for this email.`
- No mutation controls in this slice.

### Section: Privacy Requests

Two lists: **Export requests** and **Deletion requests**, each with its own `Create …` button (dialogs specified below).

- Each list row: status (`Requested`, `Verifying`, `In progress`, `Completed`, `Rejected`), requested date, actor, source/notes.
- Empty state, export: `No export requests for this account.`
- Empty state, deletion: `No deletion requests for this account.`
- If the `account_export_requests` / `account_deletion_requests` tables do not exist yet: render `Privacy request tracking isn't available yet.` in place of the list, but still keep the section visible (not hidden) so admins know the capability is planned, and hide the `Create …` buttons in that fallback.

### Section: Audit Log

- Table of `admin_audit_log` rows for this target user, most recent first, 25 per page.
- Row format: `{timestamp} · {actor email} · {action label} · {reason or "—"}`
- Action label mapping:
  - `account_viewed` → `Viewed account`
  - `comp_granted` → `Granted comp access`
  - `local_access_removed` → `Removed local access`
  - `stripe_handoff_opened` → `Opened Stripe Dashboard handoff`
  - `export_request_created` → `Created export request`
  - `deletion_request_created` → `Created deletion request`
- Each mutation row (not `account_viewed`) has a `View details` toggle that reveals a before/after key-value diff in monospace type.
- `account_viewed` rows show `No data change — read-only view.` instead of a diff toggle.
- Empty state: `No admin activity recorded for this account yet.`
- Caption under the table heading: `Opening this page just now added a "Viewed account" entry below.` — this sets the admin's expectation up front instead of surprising them after a refresh.

## Mutation Flows

Every dialog in this section is a modal that traps focus, closes on `Escape` (returning focus to the trigger button), and shares the confirmation rules in **Mutation Confirmation Rules** below.

### Grant Comp Access

- Trigger: `Grant comp access`
- Dialog title: `Grant comp access`
- Body: `This gives {email} expaify premium access without a Stripe subscription. It does not create or charge a Stripe subscription.`
- Field — Reason (required, textarea): label `Reason for comp access`, placeholder `e.g. Support ticket #4821 — refunded customer, restoring access as goodwill`
- Field — Expiry (optional, date): label `Access ends (optional)`, helper `Leave blank for comp access that doesn't expire automatically.`
- Before/After:
  - `Before: {current status label}, entitlement source: {current source}`
  - `After: Comp access, entitlement source: Comp, granted by {admin email}, {expiry date or "No expiry set"}`
- Stripe impact line: `No Stripe billing impact. This does not create, modify, or cancel any Stripe subscription.`
- Buttons: `Cancel` / `Grant comp access` (disabled until reason is valid)
- Success: page-level banner `Comp access granted for {email}.`
- Failure: inline dialog error `Couldn't grant comp access. Nothing changed — try again.` — dialog stays open, entered reason and expiry are preserved.

### Remove Local Access

- Trigger: `Remove local access`
- Dialog title: `Remove local access`
- Body: `This ends {email}'s expaify premium access in this app. It does not cancel or change anything in Stripe.`
- Conditional warning (shown only when `entitlement_source` is `stripe`): `This customer's premium access currently comes from an active Stripe subscription. Removing local access will not stop Stripe from billing them. To stop billing, cancel the Stripe subscription separately.`
- Field — Reason (required, textarea): label `Reason for removing access`, placeholder `e.g. Support ticket #4821 — customer requested downgrade`
- Before/After:
  - `Before: {current status label} ({current entitlement source})`
  - `After: Free plan (local access removed)`
- Stripe impact line: `No Stripe billing impact. If a Stripe subscription is still active, it will keep billing until canceled in Stripe.`
- Buttons: `Cancel` / `Remove local access`
- Success: `Local access removed for {email}.`
- Failure: `Couldn't remove local access. Nothing changed — try again.`

### Cancel Stripe Subscription (Stripe Handoff)

No admin-side Stripe cancellation API exists yet, so this is an explicit external handoff — the copy must never imply the app itself performs the cancellation.

- Trigger: `Cancel in Stripe` (disabled with tooltip `No Stripe customer ID on file for this account.` when there is no `stripe_customer_id`)
- Dialog title: `Cancel Stripe subscription`
- Body: `expaify doesn't cancel Stripe subscriptions from this screen. Opening Stripe Dashboard lets you cancel {email}'s subscription directly with Stripe as the source of truth.`
- Secondary note: `After you cancel in Stripe, this page updates automatically once Stripe sends the cancellation event — usually within a minute. Refresh if it doesn't update.`
- No reason field — this dialog performs no local mutation, only a navigation. It still logs a `stripe_handoff_opened` audit entry (with no reason) so the account's history shows that cancellation was initiated, per research R7's requirement to log sensitive views/actions even without a data mutation.
- Buttons: `Cancel` / `Open in Stripe Dashboard ↗` — opens `https://dashboard.stripe.com/customers/{stripeCustomerId}` in a new tab and closes the dialog.
- No success/failure copy is needed since no local state changes; if the audit write fails, log it server-side but do not block the navigation (this is the one flow where the mutation itself is external, so "block on audit failure" from the shared rules below does not apply — there is no local mutation to roll back).

### Create Privacy Export Request

- Trigger: `Create export request`
- Dialog title: `Create data export request`
- Body: `This creates a tracked request to export {email}'s account data. It does not send the export automatically — it queues the request for review.`
- Data included (informational list, not editable): `Account & sign-in details, subscription & billing status, deal alert history, public price alerts matching this email.`
- Field — Source (required, textarea): label `Request source`, placeholder `e.g. Support ticket #4821, or "customer emailed questions@expaify.com on Jul 18"`
- Before/After:
  - `Before: No open export request.` or `Before: {n} existing export request(s).`
  - `After: New export request — status: Requested.`
- Stripe impact line: `No Stripe billing impact.`
- Buttons: `Cancel` / `Create export request`
- Success: `Export request created for {email}. Status: Requested.`
- Failure: `Couldn't create the export request. Nothing changed — try again.`

### Create Privacy Deletion Request

- Trigger: `Create deletion request`
- Dialog title: `Create account deletion request`
- Body: `This creates a tracked request to delete {email}'s account data. It does not delete anything immediately — deletion happens in a separate, reviewed step after this request.`
- Data preview, three lists:
  - `Will be deleted: sign-in credentials and sessions, profile name and image, city watchlist, alert preferences.`
  - `Will be anonymized: deal alert delivery history (kept for aggregate deal-performance stats, stripped of identity).`
  - `Will be retained: billing and subscription records required for financial and legal recordkeeping, and this audit log.`
- Field — Source (required, textarea): label `Request source`, placeholder `e.g. Support ticket #4821, or "customer emailed questions@expaify.com on Jul 18"`
- Before/After:
  - `Before: No open deletion request.` or `Before: {n} existing deletion request(s).`
  - `After: New deletion request — status: Requested.`
- Stripe impact line: `No Stripe billing impact. If a Stripe subscription is still active, cancel it in Stripe separately — deletion of local data does not stop Stripe billing.`
- Buttons: `Cancel` / `Create deletion request`
- Success: `Deletion request created for {email}. Status: Requested.`
- Failure: `Couldn't create the deletion request. Nothing changed — try again.`

## Mutation Confirmation Rules (shared contract)

These rules apply to every mutation dialog above except the Stripe handoff, which performs no local write:

1. **Reason required.** The reason/source field must be a non-empty string of at least 10 trimmed characters. Attempting to confirm with an invalid reason moves focus to the field and shows inline error text: `Enter a reason (at least 10 characters) before {action label, lowercase}.` (e.g. `before granting access`, `before removing access`, `before creating it`).
2. **No accidental submit.** The reason field is a multi-line textarea; `Enter` inserts a newline and never submits the dialog. Only the confirm button submits. `Cmd/Ctrl+Enter` while focus is in the textarea is a shortcut for the confirm button, respecting its disabled state.
3. **Before/After always visible.** The before/after block renders above the action buttons, never behind a toggle or accordion.
4. **Stripe impact always stated.** Every mutation dialog (Stripe handoff excluded) shows a Stripe impact sentence, using one of the fixed sentences specified per flow above — never omitted, never freeform per instance.
5. **Audit-before-success.** The audit log write happens in the same server operation as the mutation. If the audit write fails, the whole mutation is treated as failed and the generic failure copy is shown — an admin write must never succeed while its audit entry is missing.
6. **Confirm button state.** Disabled (and `aria-disabled="true"`) until the reason is valid; never disabled for any other reason once the dialog has finished loading.
7. **Success handling.** On success, the dialog closes, focus returns to the section heading that held the trigger button, and a dismissible page-level success banner renders at the top of the detail page (same visual pattern as the existing `/account` welcome banner: colored surface, message, `×` dismiss control). The banner does not auto-dismiss — support may need to reference or screenshot it.
8. **Failure handling.** On failure, the dialog stays open, the entered reason/expiry/source values are preserved exactly as typed, and an inline error renders inside the dialog above the buttons.

## Keyboard and Focus Behavior (consolidated)

- **Search:** input autofocuses on page load; `Enter` submits; focus moves to the result-area heading after results render.
- **Result rows:** each row is a focusable element in DOM order; `Enter`/`Space` activates its primary action; `Escape` in the search input clears the query without clearing results.
- **Section navigation on the detail page:** Identity through Audit Log are always-visible stacked sections (not tabs) so `Tab` order matches reading order and nothing is hidden from assistive tech by default. Each section heading is an `h2` landmark so screen reader users can jump section-to-section with heading navigation.
- **Mutation dialogs:** open with focus moved to the dialog's first focusable field (the reason/source textarea, or the `Open in Stripe Dashboard ↗` button for the handoff dialog); focus is trapped inside the dialog while open; `Escape` closes the dialog and returns focus to the trigger button; `Tab`/`Shift+Tab` cycle only within the dialog.
- **Destructive/irreversible-adjacent confirmations** (Remove local access, Create deletion request): the confirm button is never the initially focused element — initial focus stays on the reason field so an admin cannot confirm by reflexively pressing Enter/Space on dialog open.
- **Focus ring:** never suppress `:focus-visible`; use the existing `--focus-ring` token on every interactive element introduced by this spec (search input, result rows, action buttons, dialog fields, audit log `View details` toggles).

## Mobile 375px / Desktop 1280px Layout

### Lookup — 1280px

- Centered column, `max-w-[860px]`, search bar full width at top, results as a vertical list of full-width rows below.

### Lookup — 375px

- Same vertical structure, no side-by-side layout changes needed; search bar and result rows stack full width with `px-4` page padding. Status badges wrap below the name/email line if needed rather than truncating the email.

### Detail — 1280px

- Single centered column, `max-w-[960px]`, matching the account page's information-dense, non-marketing treatment. Sections are stacked full-width cards (`rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] p-6`), not a sidebar/tab layout, so conflict banners at the top are unmissable before scrolling.
- Subscription and Identity fields render as two-column label/value grids (`grid grid-cols-[160px_1fr] gap-y-2`) since desktop width comfortably fits label + value without wrapping.
- Tables (deliveries, public price alerts, audit log) render as real `<table>` elements with visible column headers.

### Detail — 375px

- Same section order, `px-4` page padding, `max-w-full`.
- Label/value grids collapse to stacked pairs (`grid grid-cols-1 gap-1` with the label as a small `text-[var(--text-3)]` caption above the value) instead of a two-column grid, to avoid truncated values.
- Tables convert to a stacked card-per-row layout: each row becomes a bordered block with `label: value` lines, matching the existing mobile card pattern used elsewhere in the app (e.g. `FlightCard`) rather than a horizontally scrolling table.
- Mutation dialogs become full-height sheets (`inset-0` on mobile) rather than centered modals, so the reason textarea has room without the keyboard covering the confirm button; the Stripe impact line and before/after block remain above the fold before the buttons.
- Action buttons in the Subscription section actions row stack full-width (`flex flex-col gap-2`) instead of the desktop's inline row, so touch targets stay at least 44px tall.

## Component Notes for UI Stage

Non-binding naming to keep continuity into the UI ticket; UI stage owns final implementation:
- `AdminUserSearch` — search input + result states
- `AdminResultRow` — single-account or alert-group result row
- `ConflictBanner` — one banner per rule in the Conflict and Status Banners table
- `AdminAccountDossier` — the six stacked sections on the detail page
- `AdminMutationDialog` — shared dialog shell implementing the Mutation Confirmation Rules contract, parameterized per flow
- `AuditLogTable` — audit rows with per-row before/after disclosure

## Non-Goals / Explicit Exclusions (recap)

- No mutation UI for alert preferences, watchlist, or public price alerts in this slice.
- No immediate/destructive deletion execution — request records only.
- No in-app Stripe cancellation call — handoff only.
- No admin role-assignment UI.
- No schema, API route, or React component code — those belong to DEV and UI stages respectively.

## Handoff Notes

This slice depends on data and access-control primitives that do not exist in the current schema (role source, entitlement/comp fields, audit log, export/deletion request tables — see **Data Assumptions for DEV**). The next stage should be a DEV ticket that builds those primitives and the underlying `/api/admin/*` routes with the `Result<T>` contract and audit-write-before-success behavior specified above, before or in the same slice as a UI ticket that implements the pages and dialogs in this document. UI implementation must not begin against a role check that only lives in the client — every state in this document assumes server-verified access control.
