# UX Design: Hotel Saved-Search Price Alerts

**Ticket:** UXDES-HOTEL-PRICE-ALERT-01 · **Stage:** UXDES · **Date:** 2026-07-31  
**Inputs:** `01-discovery.md`, `02-research.md`  
**Delivery status:** **SPECIFICATION ONLY — IMPLEMENTATION BLOCKED**

This document specifies the intended experience but does not authorize UI or development work. The feature is new and is not marked **APPROVED FEATURE**. In addition, the current snapshot pipeline cannot monitor arbitrary saved criteria and calls vendors outside `lib/providers`. No save control may be exposed, no pending save may be created, and no implementation ticket may begin until all release gates in [Implementation gate](#implementation-gate) are cleared.

## Experience decision

The product promise is:

> **Save this search. We’ll check it daily and email you when a matching hotel gets substantially cheaper.**

“Substantially cheaper” has one fixed MVP meaning: the same comparable hotel price is at least **10% and $20 per night lower** than its reference price. The reference is the price stored when the search was saved or the price used in the most recent alert for that match. The result must still meet every saved eligibility filter and the account’s global minimum-deal setting.

This is an observed price-change alert. It is not a prediction, a cheapest-hotel alert, or a Deal Score alert. Never use “book now,” “best time to book,” “stop waiting,” “real time,” “instant,” or “the moment.”

## Scope

### In scope after approval and data readiness

- Save one complete, server-effective hotel search from resolved hotel results.
- Email verification for signed-out shoppers; immediate activation for signed-in shoppers.
- One active saved search on Free; up to ten on Premium.
- Daily evaluation, material-change email, restored search, and attributed provider handoff.
- Account management: view, pause, resume, delete, expiry, downgrade handling, and global alert consent.
- Release-wide correction of misleading cadence copy.

### Out of scope

- Per-hotel watch buttons, hearts, bells, or a hotel shortlist.
- Flight alerts, award travel, SMS, push, or in-app notifications.
- Per-search cadence or threshold controls.
- Price forecasts, buy/wait advice, or alerts based only on Deal Score movement.
- Tracking a new cheapest property, newly available inventory, or price increases.
- Quietly broadening a search when criteria are not monitorable.
- Repairing the provider pipeline in this UXDES ticket.

## Information architecture and hierarchy

```text
Hotel results (/deals or destination results)
└── Your search (primary context)
    ├── Destination + check-in window
    ├── Guests & rooms limitation
    ├── Edit (primary search action)
    └── Save this search / Saved (secondary action)
        └── Save review dialog
            ├── Exact effective criteria
            ├── Daily trigger and global threshold
            ├── Email identity when signed out
            └── Cap usage and confirmation

Account (/account)
└── Hotel alerts
    ├── Delivery and minimum-deal settings (global)
    └── Saved hotel searches
        └── One row/card per saved search: status, criteria, pause/resume, delete

Email
└── Material price drop
    ├── Change summary
    ├── Up to three comparable matches
    ├── Restore this search
    └── Manage / unsubscribe
```

On results, hierarchy is fixed:

1. **Primary:** the current search criteria and current result set.
2. **Secondary:** `Save this search` or its saved status.
3. **Tertiary:** daily cadence, material-change threshold, cap, and settings explanation.

The save action never appears on a hotel card and never visually outranks `Edit`.

## Authoritative contracts

### Saved criteria identity

The server persists the normalized **effective** eligibility criteria, never the attempted URL state:

```ts
type SavedHotelSearchCriteriaV1 = {
  schemaVersion: 1
  destination: { state: 'selected'; city: string }
  dates: { semantic: 'checkin_window'; dateFrom: string; dateTo: string }
  occupancy:
    | { state: 'not_captured' }
    | { state: 'applied'; adults: number; children: number; childAges: number[]; rooms: number }
  filters: {
    minDiscount: number
    maxNightlyPrice: { priceCents: number; currency: string } | null
    minStars: number
  }
}
```

- Exclude `criteriaVersion`, `source`, and sort from identity.
- Use a server-generated saved-search id and a canonical fingerprint of normalized criteria plus owner id.
- The same effective search saved from another sort order resolves to the existing record.
- A Free user’s saved filters reflect the server-applied Free view, not tampered Premium query parameters.
- Every monetary value is `{ priceCents: integer, currency: string }`; UI formatting never becomes stored truth.
- `criteriaVersion` remains a transient response/concurrency token and is never treated as saved-search identity.

### Server-authored monitorability contract

The client must not infer coverage from dates, destination, existing cards, or plan. Before rendering an enabled save action, it receives an authoritative server decision for the exact effective criteria:

```ts
type HotelSearchMonitorability =
  | {
      status: 'monitorable'
      criteriaFingerprint: string
      criteriaSchemaVersion: 1
      cadence: 'daily'
      comparableBasis: {
        currency: string
        nights: number
        adults: number
        children: number
        childAges: number[]
        rooms: number
        rateBasis: string
        taxesIncluded: boolean
      }
      coverageThrough: string
    }
  | {
      status: 'not_monitorable'
      reason:
        | 'incomplete_criteria'
        | 'unsupported_destination'
        | 'unsupported_dates'
        | 'occupancy_not_captured'
        | 'stay_basis_unknown'
        | 'rate_basis_unknown'
        | 'currency_basis_unknown'
        | 'mock_results'
        | 'provider_unavailable'
    }

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string }
```

Activation revalidates this decision server-side; a stale client response cannot activate an unsupported search. `coverageThrough` must include the saved Through date. Provider I/O that establishes coverage must live behind `lib/providers` and return `Result<T>`.

Current `occupancy.state = 'not_captured'`, unknown rate/tax comparability, two rotating check-in anchors, and fixed two-night/two-adult/one-room snapshots mean the present implementation cannot return `monitorable` for the proposed experience.

### Lifecycle states

```text
draft → pending_verification → active → paused → active
   └──────── failure ───────────┘       ├──────→ deleted
active / paused ────────────────────────└──────→ expired

global alerts off: active records are retained but send-suppressed
Premium downgrade: newest remains active; older excess records become paused_plan_limit
```

- `pending_verification` does not consume an active-search cap and never receives a price alert.
- `paused_user` and `paused_plan_limit` retain the exact criteria and price references.
- `expired` is terminal when the saved Through date has passed; it does not consume the active cap.
- Delete is explicit and recoverable only through the short undo window defined below.
- Global `alert_preference='off'` suppresses every send. It does not silently delete saved searches.

## Results-surface specification

### Placement and responsive layout

Extend the existing `HotelSearchCriteriaSummary` rather than add another card.

At 375px:

- Summary remains full width with `p-4`.
- Criteria content comes first.
- Actions form a two-column row only when both fit; otherwise each is full width and at least 44px high.
- Order: `Edit`, then `Save this search`. Saved status appears as text plus `Manage`, not a disabled button.
- Threshold help is not repeated in the summary; it belongs in the review dialog.

At 1280px:

- Summary stays in the existing content column.
- Criteria content occupies the flexible left side.
- `Edit` and `Save this search` sit in one right-aligned action row; `Edit` remains first in DOM and visual order.
- Do not position the action sticky or overlay it on results.

Base container pattern:

```text
rounded-[var(--radius-card)] border border-[color:var(--border)]
bg-[color:var(--bg-surface)] p-4 sm:p-5
```

Action group:

```text
mt-4 grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2
sm:mt-0 sm:w-auto sm:flex sm:shrink-0
```

`Edit`: `btn btn-outline`; `Save this search`: `btn btn-primary`. Use existing `--brand`, `--text-1`, `--text-2`, `--border`, and `--bg-surface` tokens only.

### Default: eligible and monitorable

- Render only after real results and monitorability have resolved.
- Button: **Save this search**.
- Accessible name: **Save this hotel search**.
- Selecting opens the review dialog; it does not activate immediately.

### Eligibility/monitorability loading

- Reserve the action area so the summary does not shift.
- Disabled control copy: **Checking price tracking…**
- Set the action container `aria-busy="true"` and expose one polite status: **Checking whether daily price tracking is available for this search.**
- Use a static skeleton if results are also loading; do not pulse when `prefers-reduced-motion: reduce`.
- A monitorability request failure is not treated as unsupported criteria; show the error state below.

### Search/results loading or criteria update pending

- Do not run activation against the previous criteria while new criteria are pending.
- Disabled copy: **Updating search…**
- When the new result and monitorability responses both resolve, replace with the applicable state.

### Incomplete criteria

If destination is `all`, either date bound is missing, or dates are invalid:

- Keep a secondary action labeled **Complete search to save**.
- Selecting opens the existing criteria editor, not the save dialog.
- Status at the top of the editor: **Choose one destination and a complete check-in window before saving this search.**
- Focus moves to the first incomplete field.

### Confirmed empty/no-results

Do not offer activation. The validated trigger requires an observed reference price for a comparable match; this ticket does not authorize inventory-availability alerts.

- Show the normal empty-results state as primary.
- Tertiary line beneath the criteria summary: **This search can’t be saved because there isn’t a matching price to track yet.**
- Action: **Edit search**.

### Mock/sample results

- Never show an enabled save action.
- Tertiary line: **Price tracking isn’t available for sample results.**
- No review dialog and no pending record may be created.

### Criteria not monitorable

- No active-looking or disabled bell icon.
- Tertiary line: **Daily price tracking isn’t available for these dates yet.**
- Action: **Edit search**.
- Do not expose internal reason codes or imply that changing party size will help while occupancy is not captured.

### Monitorability check error

- Inline alert below the summary, preserving the current results:
  - Heading: **We couldn’t check price tracking.**
  - Body: **Your results are still available. Try checking again before you save this search.**
  - Primary action: **Try again**
  - Secondary action: **Edit search**
- Pattern: `role="alert" rounded-[var(--radius-control)] border border-[color:var(--error)] bg-[color:var(--error-soft)] p-4`; error text uses `--error-text`, never `--error`.

### Already saved / duplicate

If the canonical fingerprint already belongs to the user:

- Summary status: **Saved · Checked daily**
- Link/button: **Manage**
- Selecting `Save this search` from stale UI returns idempotent success and changes to this state; it never consumes a second slot.
- Announce: **This search was already saved.**
- `Manage` navigates to `/account#saved-hotel-searches` and focuses the matching record.

## Save review dialog

### Container and structure

Use the established bottom-sheet-to-centered-dialog behavior:

```text
overlay: fixed inset-0 z-50 flex items-end
         bg-[color:color-mix(in_srgb,var(--text-1)_32%,transparent)]
         sm:items-center sm:p-6
dialog:  max-h-[calc(100dvh-1rem)] w-full overflow-y-auto
         rounded-t-[var(--radius-card)] bg-[color:var(--bg-surface)] p-5
         shadow-[var(--shadow-lift)]
         sm:max-h-[min(760px,calc(100dvh-3rem))] sm:max-w-[600px]
         sm:rounded-[var(--radius-card)] sm:p-6
```

Use `role="dialog"`, `aria-modal="true"`, labelled title, and described-by intro. At 375px it is a bottom sheet; at 1280px it is centered and no wider than 600px.

### Content hierarchy and final copy

1. Title: **Save this hotel search**
2. Intro: **We’ll check daily and email you when a matching hotel gets substantially cheaper.**
3. Read-only criteria group, heading **Search to save**:
   - **Destination** — `{City}`
   - **Check-in window** — `{formatted From–Through}`
   - **Guests & rooms** — `Not captured`
   - Helper: **Prices and room fit must still be confirmed with the booking provider.**
   - **Filters** — semicolon-separated effective values, in this order: `{n}%+ off`; `Up to {money}/night` or `Any nightly price`; `{n}+ stars` or `Any star rating`.
4. Trigger panel:
   - Heading: **When we’ll email**
   - Body: **We check once a day. We’ll email only when a matching hotel is at least 10% and $20/night cheaper than when you saved it or we last alerted you, and it meets your {n}% minimum-deal setting.**
   - Link: **Manage hotel alert settings**
   - Supporting copy: **That minimum-deal setting applies to all hotel alerts.**
5. Capacity: **Saved searches: {active}/{limit} active**
6. Signed-out identity field only:
   - Label: **Email address**
   - Helper: **We’ll email a verification link. This search is not active until you verify it.**
7. Footer actions:
   - Secondary: **Cancel**
   - Primary signed in: **Save search**
   - Primary signed out: **Email verification link**

The dialog contains no plan upsell unless the user is at cap. It contains no frequency switch and no editable criteria; `Cancel` then `Edit` is the safe route back to search changes.

### Input validation

- Empty email: **Enter your email address.**
- Structurally invalid email: **Enter a valid email address.**
- Do not announce whether an account exists for that address.
- Preserve typed email and every visible criterion after a recoverable error.

### Submit loading

- Disable close, backdrop dismissal, Escape, and both footer actions only while the server is committing the request.
- Primary copy signed in: **Saving search…**
- Primary copy signed out: **Sending verification link…**
- `aria-busy="true"`; polite status repeats the matching copy without adding a second visible spinner label.
- If storage succeeds but email delivery fails, transition to the email-error state; do not create a second pending record on retry.

### Signed-in success

Close the dialog after success, update the summary in place, and focus the summary status.

- Visible/live status: **Search saved. We’ll check daily and email {email} after a matching price drops at least 10% and $20 per night.**
- Secondary link: **Manage saved searches**
- Do not use a transient toast as the only confirmation.

### Verification sent

Keep the dialog open and replace the form body with:

- Title: **Check your email**
- Body: **We sent a verification link to {email}. Open it to activate this saved search.**
- Note: **This search is not active yet. The link expires in {duration}.**
- Primary action: **Resend link**
- Secondary action: **Use a different email**
- Tertiary action: **Close**
- Resend uses the same pending saved-search id and is rate-limited. During cooldown, disabled copy is **Resend available in {time}**.

Closing preserves the server-side pending record. Returning to the same effective search shows **Verification needed** with action **Resend verification**; it never shows `Saved`.

### Storage error

- `role="alert"`, focus the error heading.
- Heading: **We couldn’t save this search.**
- Body: **Nothing was activated. Check your connection and try again.**
- Primary: **Try again**
- Secondary: **Cancel**

### Email delivery error after pending storage

- Heading: **Your search is pending, but the email didn’t send.**
- Body: **No price alerts are active. Try sending the verification link again.**
- Primary: **Try sending again**
- Secondary: **Close**
- Retry targets the same pending record. Never claim the search was discarded unless deletion is confirmed.

### Global alerts off

Do not silently change global consent.

- Heading: **Hotel email alerts are off**
- Body: **Turn them on in alert settings before saving this search. Your search has not been saved.**
- Primary: **Go to alert settings**
- Secondary: **Cancel**
- Return URL restores the same results and reopens the review dialog only after the user explicitly turns alerts on.

### Free cap

When one active saved search already exists:

- Heading: **You’ve used your free saved search**
- Body: **Free includes 1 active saved search. Pause or delete your current search, or upgrade for up to 10.**
- Primary: **Manage saved searches**
- Conversion action: **See Premium**
- Secondary: **Cancel**
- Never replace, pause, or delete the existing search automatically.

### Premium cap

- Heading: **You’ve reached 10 active saved searches**
- Body: **Pause or delete a saved search before adding another.**
- Primary: **Manage saved searches**
- Secondary: **Cancel**

## Verification-link destination

The single-use link verifies ownership, signs in or attaches to the matching existing account without disclosing account existence, revalidates cap and monitorability, and then restores the exact results URL.

### Activating

- Page heading: **Activating your saved search…**
- Body: **We’re restoring the hotel search you chose.**
- Use a static skeleton and `role="status"`; do not expose the token in visible copy, analytics, or subsequent URLs.

### Activated

- Banner heading: **Your search is saved**
- Body: **We’ll check daily and email {email} after a matching price drops at least 10% and $20 per night.**
- Primary: **View restored results** if automatic restoration is paused or fails.
- The restored results must show exact effective criteria and the `Saved · Checked daily` state.

### Expired link

- Heading: **This verification link has expired**
- Body: **Send a new link to activate the same hotel search.**
- Primary: **Send a new link**
- Secondary: **Return to hotel deals**
- If the underlying criteria are no longer monitorable or the Through date has passed, replace the primary action with **Start a new search** and say: **This search can no longer be tracked. Choose new dates to continue.**

### Already-used link / idempotent replay

If the pending save already activated:

- Heading: **This search is already saved**
- Body: **Daily price tracking is active for this hotel search.**
- Primary: **View saved search**

If the token is used but cannot be associated with an active save, use the expired-link state. Do not expose token internals.

### Cap reached between request and verification

- Heading: **Your saved-search limit was reached**
- Body Free: **This search is verified but not active. Free includes 1 active saved search.**
- Body Premium: **This search is verified but not active. Premium includes up to 10 active saved searches.**
- Primary: **Manage saved searches**
- Secondary: **View this search**
- Preserve as `paused_plan_limit`; do not discard criteria or silently replace another search.

### Monitoring became unavailable

- Heading: **Price tracking isn’t available for this search**
- Body: **The search was verified, but we can’t monitor the same dates and stay details reliably. No alert was activated.**
- Primary: **Edit search**
- Secondary: **View current results**

## Account: Hotel alerts

The account surface must be available to every owner of a saved hotel search, including Free users. Do not keep the read/manage path Premium-only.

### Global settings

Rename misleading `Instant` presentation without changing meaning silently:

- Section heading: **Hotel alerts**
- Delivery label: **Delivery**
- Options:
  - **After each daily price check** — underlying `instant`
  - **Daily digest** — underlying `daily`
  - **Off** — underlying `off`
- Helper: **Both email options are based on daily price checks. This setting applies to all hotel alerts.**
- Threshold label: **Minimum deal size**
- Helper: **This setting applies to all saved hotel searches. A matching price must also drop at least 10% and $20 per night before we email.**
- Existing save/error feedback remains inline and polite.

### Saved-search list: default

- Heading with anchor id: **Saved hotel searches**
- Capacity: **{active} of {limit} active**
- Sort: active newest first, then paused, then expired; users do not control sort.
- Each record shows:
  - `{City}` as heading.
  - `{formatted check-in window}`.
  - Effective filters in the same order used by the review dialog.
  - `Guests & rooms not captured` when applicable.
  - Status: **Active · Checked daily**, **Paused**, **Paused · Plan limit**, or **Expired**.
  - Last check: **Last checked {date}** or **Not checked yet**.
  - Link: **View results**.
  - Active actions: **Pause**, **Delete**.
  - Paused actions: **Resume**, **Delete**.
  - Expired actions: **Search these dates again**, **Delete**.

Card pattern:

```text
rounded-[var(--radius-control)] border border-[color:var(--border)]
bg-[color:var(--bg-surface)] p-4 sm:p-5
```

At 375px, actions wrap into full-width 44px controls. At 1280px, metadata remains left and actions align right without reducing the criteria column below 360px.

### List loading

- Heading remains visible.
- Three non-interactive skeleton rows, `aria-hidden="true"`.
- One status: **Loading saved hotel searches…**
- On reduced motion, skeleton opacity is static.

### Empty

- Heading: **No saved hotel searches yet**
- Body: **Build a hotel search with a destination and complete check-in window, then save it to track matching price drops.**
- Primary: **Search hotel deals**

### List error

- Heading: **We couldn’t load your saved searches.**
- Body: **Your alert settings were not changed. Try again.**
- Primary: **Try again**

### Pause

- Pause is immediate and retains criteria/reference prices.
- Announce/focus inline status: **{City} price tracking paused.**
- Provide a 10-second inline action: **Undo**.
- While pending: action copy **Pausing…**; other actions on that record are disabled, not the whole page.
- On failure: **We couldn’t pause this search. It is still active.** with **Try again**.

### Resume

- Revalidate cap, dates, and monitorability before activation.
- While pending: **Resuming…**
- Success: **{City} price tracking resumed.**
- Cap failure: use the applicable cap copy and keep the record paused.
- Coverage failure: **This search can’t resume because the same dates and stay details are no longer monitorable.** Actions: **Edit search**, **Keep paused**.
- Expired dates never resume.

### Delete

Selecting Delete opens a confirmation dialog:

- Title: **Delete this saved search?**
- Body: **You’ll stop tracking {City} for {date window}. This won’t change your other hotel alerts.**
- Destructive action: **Delete saved search**
- Secondary: **Cancel**

After success, remove the record, focus the list heading, announce **Saved search deleted.**, and offer a 10-second **Undo**. The server must support recovery during that window; do not show Undo if recovery is not implemented. On failure: **We couldn’t delete this search. It is still {active|paused}.**

### Premium downgrade

- Keep the most recently created search active.
- Set all older active searches beyond the Free cap to `paused_plan_limit` without changing criteria.
- Account banner:
  - Heading: **Some saved searches were paused**
  - Body: **Free includes 1 active saved search. We kept your newest search active and paused {n} older {search|searches}.**
  - Primary: **See paused searches**
  - Secondary: **See Premium**
- Each affected record: **Paused · Plan limit** and helper **Upgrade or pause your active search to resume this one.**
- Never strip Premium filters to make a paused search appear Free-compatible.

### Global alerts off

- Persistent section status: **Hotel email alerts are off. Your saved searches are retained, but we won’t send price alerts.**
- Saved-search cards remain visible and retain lifecycle status.
- Do not label a retained record `Active · Checked daily` while sends are globally off; show **Alerts off** as the effective status and preserve the underlying state for resumption.

### Expired search

- At 00:00 in the user’s alert timezone after the Through date, mark expired and stop checking.
- Status: **Expired · Check-in window ended {date}**
- Action **Search these dates again** opens the criteria editor with destination and filters preserved but dates empty; never silently shift dates forward.
- Expired searches do not consume the active cap.

## Daily evaluation behavior

There is no visible “nothing happened” notification. After the nightly snapshot completes, the service evaluates saved searches at most once per user per local day.

A match qualifies only when all are true:

```text
reference = price at save, or price used in the most recent alert
dropCents = reference.priceCents - current.priceCents
dropPct   = floor(dropCents * 100 / reference.priceCents)

dropCents >= 2_000
AND dropPct >= 10
AND currencies match
AND hotel, market, check-in, nights, occupancy, room/rate basis,
    and tax-inclusion basis are comparable
AND current result matches every saved effective filter
AND current result meets subscriptions.alert_min_discount
AND subscriptions.alert_preference != 'off'
AND saved search is active and unexpired
```

- `$19 at 20%`, `$25 at 9%`, a rise, currency change, basis change, filter mismatch, global alerts off, or a second run on the same snapshot sends nothing.
- `$25 at 12%` sends once if every other condition passes.
- After a successful send, advance only each alerted match’s reference price.
- A later rise does not send or reset the reference.
- Bundle all qualifying matches for one saved search into one daily email; bundle or queue across saved searches so a user receives no more than one saved-search email per local day.
- Displayed prices come from the exact snapshot that qualified the alert.
- Job retries and verification replays are idempotent.

## Qualifying email

### Envelope and header

- Subject: **{City} hotel prices dropped — from {money}/night**
- Preheader: **Matching prices are down at least 10% and $20/night since your last reference price.**
- Eyebrow: **Daily hotel price alert**
- H1: **Prices dropped for your {City} search**
- Intro: **We found {count} matching {price|prices} that dropped substantially since {referenceDate}.**

Never put “Great” in the subject. Deal Score is secondary and may appear only when based on at least 10 comparable same-currency points.

### Result content

Show at most three matches, ordered by absolute nightly savings. Each contains:

- Hotel name and star evidence when available.
- Check-in date and comparable stay basis.
- **Now {money}/night — down {money} ({pct}%) since {date}.**
- Deal Score line only when confidence is high: **Deal Score: {verdict}. {explanation}**
- One provider action with an attributed, provider-built link: **Check current price**
- Disclaimer: **Price and availability can change. Confirm taxes, room fit, and terms with the booking provider.**

If more than three qualify: **+{n} more matching price {drop|drops}**. Do not include more provider links; use the restored-search CTA.

### Footer and restored search

- Primary CTA: **View updated search**
- Supporting criteria: **{City} · {date window} · {effective filter summary}**
- Link: **Manage saved searches**
- Link: **Turn off hotel alerts**
- Legal/consent line: **You’re receiving this because you saved a hotel search on expaify.**

`View updated search` restores the canonical criteria and records the saved-search id server-side for cross-session attribution. It must not put email, raw affiliate URLs, or tokens into analytics. Every direct booking action reuses an attributed link built through the approved provider/OTA-link path; email markup never constructs a raw vendor URL.

## Unsubscribe experience

The one-click email action turns global hotel alerts off; it does not delete saved searches.

### Success

- Heading: **Hotel alerts are off**
- Body: **We won’t send more hotel price emails. Your saved searches are still available in your account.**
- Primary: **Manage saved searches**
- Secondary action: **Turn alerts back on**

### Already unsubscribed

- Heading: **Hotel alerts are already off**
- Body: **No hotel price emails will be sent.**
- Primary: **Manage saved searches**

### Invalid/expired unsubscribe token

- Heading: **We couldn’t update your email settings**
- Body: **Sign in to manage hotel alerts securely.**
- Primary: **Sign in**

The response never discloses account existence. Re-enabling is an explicit action with confirmation: **Hotel alerts are back on.**

## Interaction, focus, and keyboard rules

- All controls use semantic `button`, `a`, `input`, and `form` elements; no clickable `div`.
- Every target is at least 44×44px. Do not rely on color alone for Active, Paused, Alerts off, errors, or caps.
- On dialog open, store the invoker and focus the dialog title for status-only states or email field for signed-out entry; for signed-in review, focus the title.
- Trap Tab/Shift+Tab within the dialog. Escape and backdrop click close only when no commit is in flight. Closing returns focus to the invoker.
- Enter submits only from the review form when valid. It never activates from a read-only account row without confirmation where confirmation is specified.
- After an inline error, focus the error heading once and retain user input. Do not refocus on every render.
- Success, pending, pause/resume, and delete changes use `aria-live="polite"` and `aria-atomic="true"`. Blocking errors use `role="alert"`.
- Loading regions expose `aria-busy`; skeletons are `aria-hidden` and have one text alternative.
- `Manage` focus uses the saved-search id, not list position, so sorting does not send focus to the wrong record.
- External provider links announce the provider/new-tab behavior in the accessible name where applicable.
- Error text uses `--error-text`; focus uses the global `--focus-outline`/`--focus-ring` behavior in `app/globals.css`.

## Motion and reduced motion

- Use only existing 160ms color, opacity, and shadow transitions for controls and status changes.
- Do not animate dialog position as a requirement; if implemented, opacity/translate duration is at most 160ms.
- Under `@media (prefers-reduced-motion: reduce)`, remove dialog translation, scrolling animation, skeleton pulse, and nonessential transitions. State changes remain immediate and are announced textually.
- No confetti, countdown animation, pulsing bell, or attention loop.

## Edge cases and copy rules

| Case | Required behavior and copy |
|---|---|
| Sort changes after save | Saved identity is unchanged; continue to show **Saved · Checked daily**. |
| Filter changes after save | New fingerprint; show **Save this search** only after new results and monitorability resolve. Existing saved search remains unchanged. |
| Same search in two tabs | First activation wins; second returns **This search was already saved.** |
| Free URL contains locked Premium filters | Review shows only server-effective Free criteria. Never echo attempted filters as saved. |
| Email already has an account | Send the same neutral verification response; link attaches after verification. |
| Verification opened on another device | Activate the server-held canonical criteria and restore results after identity verification. |
| Through date passes while pending | Do not activate; show **This search can no longer be tracked. Choose new dates to continue.** |
| Provider price has different currency | Do not compare, convert, or send. Wait for a same-currency comparable observation. |
| Tax/room/rate basis changes | Treat as non-comparable; do not send. |
| Deal Score has fewer than 10 points | Omit Deal Score from email; never elevate to Great. |
| No qualifying daily change | Silent. No “still watching” email. Update last-check status only after a successful comparable evaluation. |
| Pipeline/provider failure | Do not send or advance reference. Account may show **Last check delayed** only after an agreed operational SLA; never claim a check occurred. |
| Affiliate id unavailable | Do not synthesize or send an unattributed vendor deeplink. Restored-search CTA may remain if it leads to expaify and current provider links are safely resolved there. |
| Alert preference off | Send nothing and show effective status **Alerts off** in account. |
| Search contains zero reference matches | Do not activate under this trigger model. |
| User changes timezone | Apply the new timezone on the next evaluation; never evaluate twice in one resulting local day. |

## Release copy reconciliation

The alert experience must ship atomically with these copy corrections. Partial release leaves the trust problem intact.

| Surface | Final copy before saved-search launch | Final copy after full launch |
|---|---|---|
| Home metadata/hero | **We check 20 destinations daily and surface hotel deals 30%+ below their recent median. Premium members can choose email alerts.** | **Save one hotel search free. We check prices daily and email you when a matching hotel gets substantially cheaper.** |
| Free plan | **Daily hotel deal browsing** | **1 saved hotel search with email alerts** |
| Premium plan | **Daily hotel email alerts** | **Up to 10 saved hotel searches with email alerts** |
| Account delivery option | Replace **Instant** with **After each daily price check** | Same |
| Welcome/onboarding email | **Hotel deals are checked daily.** | **Saved hotel searches are checked daily.** |

Search metadata, visible hero, pricing, account, welcome email, and alert templates must be audited in the same release. No surface may retain `Instant + daily email alerts` or `the moment`.

## Analytics and measurement

Events:

- `hotel_saved_search_started`
- `hotel_saved_search_verification_sent`
- `hotel_saved_search_activated`
- `hotel_saved_search_material_change_qualified`
- `hotel_saved_search_email_sent`
- `hotel_saved_search_email_opened` only if the privacy policy permits
- `hotel_saved_search_restored`
- `hotel_saved_search_provider_clicked`
- `hotel_saved_search_paused`
- `hotel_saved_search_deleted`
- `hotel_saved_search_expired`
- `hotel_saved_search_unsubscribed`

Attach saved-search id, criteria schema version, plan, lifecycle state, result count bucket, and reason enums. Never attach raw email, verification/unsubscribe token, raw criteria URL, provider URL, hotel affiliate marker, or free-form provider errors.

Primary metric: **saved-search email → restored matching search → attributed provider click within 7 days**.

Supporting metrics: eligible-search save rate, verification completion, material-change incidence, and 14-day return. Guardrails: duplicate sends, send failures, provider price mismatch below 1%, unsubscribe within 7 days below 2%, and Premium downgrade pauses.

## Acceptance scenarios

1. A signed-in Free user with no saved search, complete criteria, real results, alerts on, and a server-confirmed monitorable basis reviews exact effective criteria and activates one search.
2. A signed-out user submits email, closes the tab, opens the link on another device, and activates/restores the same canonical criteria without re-entry.
3. An unverified pending search sends no alerts and consumes no active cap.
4. Saving the same criteria from `newest` and `price` sort yields one record.
5. Incomplete, mock, empty-reference, stale, failed, or non-monitorable searches cannot activate.
6. Free at 1/1 and Premium at 10/10 retain all existing records and block a new activation with the exact cap copy.
7. Global alerts off blocks activation from results and suppresses sends for retained account records without changing consent silently.
8. `$19/20%`, `$25/9%`, a rise, currency/basis mismatch, filter mismatch, and duplicate job execution send zero emails.
9. `$25/12%` on the same comparable match sends once; a second qualifying match is bundled; the sent snapshot is the displayed price.
10. A later rise does not reset the reference; a later qualifying fall is measured from the last alerted price.
11. Downgrade keeps the newest search active, pauses excess searches without broadening criteria, and explains recovery.
12. Expiry, pause, resume, delete/undo, invalid token, email failure, storage failure, and coverage loss each preserve truthful status and predictable focus.
13. At 375px no copy or actions overlap, the sheet fits within `100dvh`, and actions remain at least 44px. At 1280px criteria and actions remain scannable without a detached save CTA.
14. Keyboard-only users can open, review, submit, recover from errors, close, and regain the invoking control; reduced-motion users receive no pulsing or translated UI.
15. Every email provider link retains affiliate attribution; no component or email calls a vendor directly.

## Implementation gate

UI/DEV may begin only when all are true:

1. Product marks this capability **APPROVED FEATURE** and accepts capped-free limits (Free 1, Premium 10) plus the 10% and $20/night trigger.
2. Vendor I/O in `lib/pipeline/snapshot.ts` has moved behind `lib/providers`, with `Result<T>` adapters and env-only secrets.
3. The system can store and compare destination, check-in window, actual stay length, adults, children/ages, rooms, rate basis, tax inclusion, currency, and the effective eligibility filters for each saved search.
4. A server-authored monitorability response proves exact-criteria coverage through the saved Through date, and activation revalidates it.
5. Snapshot scheduling can evaluate arbitrary eligible saved criteria daily without silently substituting the current two rotating anchors or fixed 2-night/2-adult/1-room request.
6. Persistence, verification, consent, dedupe, plan limits, expiry, restored-search attribution, and affiliate-safe email links have approved technical designs.
7. Release-wide cadence copy is queued atomically; no `instant` or “the moment” claim remains visible.
8. Operational monitoring can measure coverage misses, duplicate sends, price mismatches, email failures, unsubscribe rate, and provider cost.

Until then, the correct production UI is the current UI with **no saved-search activation control**.

## Handoff status

No UI handoff ticket is created from this stage. The pipeline normally advances UXDES to UI, but doing so here would conflict with the explicit unapproved-feature and data-integrity blockers. After the gates above are cleared, create `UI-HOTEL-PRICE-ALERT-01` referencing this spec and the approval record.
