# UXDES-HOTEL-ROOM-INVENTORY-CONFIDENCE-01 — Hotel room inventory confidence

**Stage:** UX Design · **Priority:** P1 · **Date:** 2026-08-03  
**Upstream:** `docs/pipeline/hotel-room-inventory-confidence/02-research.md`  
**Downstream:** `UI-HOTEL-ROOM-INVENTORY-CONFIDENCE-01`  
**Production surface:** mounted `/deals/[dealId]` saved-hotel detail

## 1. Decision and release boundary

The production repair has two reachable experiences:

1. Before handoff, state the current evidence ceiling: **Room availability not checked by expaify**.
2. After a traveler opens a provider tab and returns, reveal a criteria-preserving recovery panel without diagnosing what happened on the provider site.

The current saved-deal contract has a property, observed nightly price, provider search link, and sometimes dates. It has no room ID, rate ID, requested occupancy, live availability result, alternative product, or room-check timestamp. Therefore production must always use `inventoryEvidenceState: 'not_checked'`. It must not render `checking`, `available`, `sold_out`, `provider_error`, or `alternative_available` from current deal, price, link, cache, error, or result-list data.

This ticket does not authorize a live room search, new traveler inputs, room selection, scarcity treatment, ranking change, provider integration, or fabricated alternative. The UI stage may implement the reachable `not_checked` and return-recovery states and test the evidence guards. The gated designs in §12 are a future contract only and must have no production entry point, query parameter, environment switch, or fixture import.

## 2. Ownership and files

The UI implementation belongs inside the existing provider commitment area, not in the price card or supporting evidence.

- Extend `HotelDealCriteriaHandoff` in `app/components/HotelDealCriteria.tsx`, or extract a colocated client component such as `HotelRoomInventoryConfidence` and mount it there.
- Keep the host section in `app/deals/[dealId]/page.tsx` in its existing fourth decision position, **Check rooms with provider**.
- Reuse `CompareRow` provider eligibility, attributed URL validation, target-new-tab behavior, and provider-specific label. Preserve all current props and exports.
- Update the detail loading skeleton in `app/deals/[dealId]/loading.tsx` only enough to match the commitment area anatomy in §9.
- Add component/interaction tests alongside existing component or deal-detail tests.
- UI must emit the analytics calls in §15 only when `/api/analytics` accepts them. Updating that route's allowlist and validators is DEV/API work, not an allowed UI-only change. If the UI stage cannot make the events accepted without crossing its boundary, it must create a DEV handoff rather than ship rejected events.

Do not build this against `HotelCard` or `/book`; neither is the mounted saved-deal path for this ticket.

## 3. Information architecture and hierarchy

The existing detail order stays unchanged:

1. Property and stay
2. Price and Deal Score
3. Hotel fit
4. **Check rooms with provider** — inventory truth and recovery live here
5. Supporting evidence

Within the provider section the fixed hierarchy is:

1. **Primary:** inventory truth, then the currently valid provider or recovery action.
2. **Secondary:** known property/stay context and the explicit guests/rooms limitation.
3. **Tertiary:** observed-price caveat, provider-tab explanation, optional mismatch feedback, and analytics-only session state.

The observed nightly rate must not be repeated as a room price in this section. A future failed room/rate may become primary only after the evidence gate in §12 passes.

```text
Check rooms with provider
├── Room availability not checked by expaify        primary truth
├── Provider will show current rooms and prices     explanation
├── Stay context                                    secondary
│   ├── {Hotel name} · {Area}
│   ├── {Check-in} – {Check-out} · {N nights}
│   └── Guests and rooms: choose with provider
├── Check rooms at {Provider}                       primary action
└── return only: Couldn't find a room that worked?
    ├── Check rooms again                           primary recovery
    ├── Back to matching hotels                     secondary recovery
    └── Tell us what changed                        tertiary feedback
```

## 4. Reachable state model

The UI state is a small client-side presentation state; it is not room inventory evidence.

```ts
type ProductionInventoryEvidenceState = 'not_checked'

type HandoffRecoveryState =
  | 'idle'              // no eligible provider handoff in this mount/session
  | 'armed'             // valid provider action activated; page not known to have been left
  | 'away'              // document became hidden after activation
  | 'returned'          // same handoff session hid, then became visible
  | 'feedback_open'     // traveler explicitly opened optional feedback
  | 'feedback_recorded'
```

Rules:

- Generate one opaque UUID `handoff_session_id` synchronously when an eligible provider link is activated. Never put it in the URL.
- `armed → away` requires `document.visibilityState === 'hidden'` after that activation.
- `away → returned` requires a subsequent `visible` event in the same mounted page and handoff session.
- A click followed by no hidden event is not a return and reveals no recovery panel.
- Show the recovery panel once for each handoff session. A React remount may restore the active session from `sessionStorage`; if storage fails, an in-memory mount-scoped session is acceptable.
- A recheck creates a new session and retains `prior_handoff_session_id` only in the new restart event. Do not overwrite it before the restart event is constructed.
- Opening feedback does not change inventory evidence. Selecting a reason does not produce `sold_out`.
- Return detection is enhancement only. Storage, visibility, or analytics failure must never disable the provider link or back action.

## 5. Default `not_checked` treatment

### 5.1 Anatomy and final copy

Render immediately inside the existing provider section and immediately above `CompareRow`:

| Element | Final visible copy |
|---|---|
| Section heading | **Check rooms with provider** |
| Status label | **Room availability not checked by expaify** |
| Supporting sentence | **The provider will show current rooms and prices for your stay.** |
| Known context label | **Your stay** |
| Hotel/area | **{Hotel name} · {Area}** |
| Complete dates | **{Check-in} – {Check-out} · {N night/nights}** |
| Occupancy limitation | **Guests and rooms: choose with provider** |
| Primary action | **Check rooms at {Provider}** |
| Provider helper | **Opens {Provider} in a new tab. Your expaify page stays open.** |

Use the provider display name already defined by `CompareRow` (`Expedia`, `Booking`, `Kiwi`, or `Trip.com`). Do not introduce generic **Continue**, **Book now**, or **View availability** labels.

The accessible name for each primary provider link is:

> **Check rooms at {Provider} for {Hotel name}. Opens in a new tab. Room availability has not been checked by expaify; the provider will show current rooms and prices.**

Do not retain accessible copy saying expaify or the current link confirms “live availability.” The provider site is where the traveler checks it; expaify does not know its outcome.

### 5.2 Tailwind pattern

Inventory truth block:

```tsx
<div className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4">
  <p className="text-sm font-medium leading-6 text-[color:var(--text-1)]">…</p>
  <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">…</p>
</div>
```

Context definition list:

```tsx
<div className="mt-4 border-t border-[color:var(--border)] pt-4">
  <p className="text-caption font-medium uppercase tracking-wide text-[color:var(--text-3)]">Your stay</p>
  <p className="mt-1 break-words text-sm font-medium leading-6 text-[color:var(--text-1)]">…</p>
  <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">…</p>
  <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--text-1)]">Guests and rooms: choose with provider</p>
</div>
```

Provider options follow at `mt-4`. Keep `CompareRow`'s current valid-link styling and minimum 52px action height. Neutral `--bg-raised`, `--border`, and text tokens are deliberate: unknown inventory is neither success, warning, nor error.

## 6. Context variations

### 6.1 All known dates

Show property, area, exact check-in, derived check-out, and nights. Use the deal detail's values, not hidden adapter defaults. Example:

> **The Hoxton Portland · Portland**  
> **Oct 14, 2026 – Oct 17, 2026 · 3 nights**  
> **Guests and rooms: choose with provider**

### 6.2 Missing or incomplete dates

This is a criteria-review state, not an inventory state. Keep the inventory label `not_checked`; replace the date line with:

> **Stay dates: confirm with provider**

Support copy becomes:

> **The provider will ask you to choose or confirm dates, guests, and rooms before showing current options.**

The action remains available only if there is a valid attributed provider link and the existing context status is not `mismatch`. Its label remains **Check rooms at {Provider}**.

### 6.3 Valid preserved search context

Recovery's results action uses `context.backHref`, built by the existing criteria-aware helper, and reads **Back to matching hotels**. It must preserve every currently represented criterion and results-view parameter.

### 6.4 Missing or invalid search context

Do not claim the former search can be restored. The action uses `/deals` and reads **Search current hotel deals**. Add before the actions:

> **Your previous hotel search could not be restored. This hotel and any known dates are still shown above.**

### 6.5 Context mismatch

Keep the existing mismatch block and prevent provider activation until the traveler reviews or edits the mismatch. Inventory stays `not_checked`. Visible copy in the provider area:

- **Provider link unavailable**
- **Review the search mismatch before checking rooms.**

Do not reveal return recovery because no eligible handoff began.

## 7. Return recovery

### 7.1 Reveal condition and placement

After the same activated provider session has observed `hidden → visible`, append the recovery panel directly below the provider option/helper, within the same **Check rooms with provider** section. Do not replace the inventory truth or known context; the traveler needs both to orient after return.

The reveal is non-modal and must not move focus or scroll the page. Wrap the heading and body in `role="status" aria-live="polite" aria-atomic="true"`; actions are outside the live text or included only if the announcement remains concise.

### 7.2 Final copy

| Element | Valid context | Missing/invalid context |
|---|---|---|
| Heading | **Couldn’t find a room that worked?** | same |
| Body | **expaify did not check what happened on the provider site. You can check this hotel again or return to hotels matching your saved stay.** | **expaify did not check what happened on the provider site. You can check this hotel again or start a current hotel search.** |
| Primary | **Check rooms again** | same |
| Secondary | **Back to matching hotels** | **Search current hotel deals** |
| Tertiary | **Tell us what changed** | same |

`Check rooms again` opens the same still-eligible attributed URL in a new tab with `rel="noopener noreferrer sponsored"`. Revalidate the link at activation. If it has become ineligible, switch to §8 instead of opening it.

### 7.3 Tailwind pattern

```tsx
<div className="mt-5 rounded-[var(--radius-control)] border border-[color:var(--border-strong)] bg-[color:var(--bg-base)] p-4 sm:p-5">
  <div role="status" aria-live="polite" aria-atomic="true">
    <h3 className="text-sm font-medium leading-6 text-[color:var(--text-1)]">…</h3>
    <p className="mt-1 text-sm leading-6 text-[color:var(--text-2)]">…</p>
  </div>
  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
    <a className="btn btn-primary w-full sm:w-auto">Check rooms again</a>
    <a className="btn btn-outline w-full sm:w-auto">…</a>
  </div>
  <button className="mt-3 inline-flex min-h-11 items-center rounded-[var(--radius-control)] text-sm font-medium text-[color:var(--brand)] underline-offset-4 hover:underline">Tell us what changed</button>
</div>
```

Do not use `--warning-soft`, `--error-soft`, a warning icon, or a success check. A return is not evidence of failure or booking outcome.

## 8. Empty / no eligible provider link

This is a link-capability state, not `sold_out` and not `provider_error`.

Keep the default inventory truth and context, then render:

- Label: **Provider link unavailable**
- Body: **You can review this hotel here, but expaify does not have a valid provider link for checking rooms.**
- Action with valid criteria: **Back to matching hotels** → `context.backHref`
- Action without restorable criteria: **Search current hotel deals** → `/deals`

Use `role="status"` on the label/body container. Use `btn btn-outline w-full sm:w-auto`. No disabled provider tiles are required in the primary detail action. Do not say “No rooms,” “No availability,” “Unavailable,” or “Sold out.” No handoff or return event is emitted.

## 9. Loading and page error

### 9.1 Route loading

The route's existing `loading.tsx` remains the only loading state. It must not render textual **Checking availability** because no check is running. In the provider-section skeleton, represent:

- section heading: `h-7 w-56`;
- neutral inventory block: `mt-4 h-20 w-full`;
- three context lines: `mt-4 h-4 w-3/4`, `mt-2 h-4 w-2/3`, `mt-2 h-4 w-56`;
- one provider action: `mt-4 h-[52px] w-full` (or the current responsive provider grid when multiple eligible links are possible).

All shapes use `.skeleton`, `aria-hidden="true"`; the main retains `aria-busy="true"` and one screen-reader status **Restoring your search…**. Do not announce skeleton details individually.

### 9.2 Provider activation

Opening a new tab has no awaitable completion. Do not change the action to **Checking…**, add a spinner, disable it, or optimistically show availability. Create the handoff session and emit the start event synchronously, then let normal anchor behavior proceed.

### 9.3 Route error

Keep `app/deals/[dealId]/error.tsx` as the page-level error treatment. Its current copy and **Try again** / **Back to saved deals** actions remain valid. It must not render an inventory status because the deal could not be loaded.

### 9.4 Retry loading

The existing retry status **Loading hotel details** is correct. It must never become **Checking room availability**.

## 10. Optional feedback disclosure

Feedback is tertiary and may ship only if its analytics event is accepted. On **Tell us what changed**:

- Expand inline below the trigger; set `aria-expanded` and `aria-controls`.
- Move focus to the feedback heading because opening was explicit.
- Heading: **What changed on the provider site?**
- Instruction: **Choose one. This feedback does not confirm availability.**
- Radio options:
  - **Room availability did not match**
  - **Price did not match**
  - **Dates did not match**
  - **Something else changed**
- Buttons: **Send feedback** and **Cancel**.
- Confirmation: **Thanks. We’ll use this to improve provider handoffs.**

Use a semantic `<fieldset>` with `<legend>`. Nothing is selected by default. **Send feedback** stays disabled until a choice is selected. Cancel collapses and returns focus to **Tell us what changed**. Submission failure is silent to the journey: retain the selection, show **We couldn’t send that feedback. Try again.**, focus the error, and offer **Try again** plus **Cancel**. Never change inventory state based on the selected reason.

Feedback is optional for UI scope. Recovery actions are required even if feedback is deferred.

## 11. Expired and stale observed price

Price freshness and room inventory remain independent.

- **Fresh, aging, or stale rate:** render `not_checked` and provider handoff normally. Existing price freshness copy remains in **Price and Deal Score**. Do not echo “fresh” beside room availability.
- **Expired saved rate:** keep the existing **Saved rate expired** blocker and **Search current deals** action. Do not render the provider link or arm return recovery. Add the neutral truth sentence **Room availability was not checked by expaify.** beneath the expired-rate body so expiration cannot be misread as sold out.
- **Missing price-check timestamp:** does not change inventory state.

## 12. Gated future evidence states — specification only

### 12.1 Required evidence envelope

No future state below may render unless a provider adapter returns `Result<RoomInventoryEvidence>` and the presentation guard validates all required fields:

```ts
type RoomInventoryScope = {
  propertyId: string
  roomId: string
  rateId: string
  checkIn: string
  checkOut: string
  adults: number
  children: number
  roomCount: number
  provider: string
  checkedAt: string
}

type RoomInventoryEvidence =
  | { state: 'sold_out'; scope: RoomInventoryScope; roomName: string; priorPrice?: { priceCents: number; currency: string } }
  | { state: 'provider_error'; scope: RoomInventoryScope; reasonCode: string }
  | { state: 'alternative_available'; scope: RoomInventoryScope; failedRoomName: string; alternatives: RoomAlternative[] }
```

The actual data-stage owner may revise this illustrative shape, but not the semantic gates. Evidence is invalid if IDs are blank, dates/occupancy differ from active criteria, `checkedAt` is invalid or outside the approved freshness window, money is not integer minor units plus currency, the provider differs, or a result was inferred from empty/missing/error data. Invalid evidence degrades to `not_checked`, never `sold_out`.

No production component may accept a bare boolean such as `soldOut`, `hasAlternatives`, or `available`.

### 12.2 Future `sold_out`

Only explicit, current, selected room/rate-scoped negative evidence earns this state.

- Heading: **This room is no longer available**
- Failed selection: **{Room name}**
- Scope: **{Check-in} – {Check-out} · {Guest count} · {Room count}**
- Prior price when valid: **Previously observed at {formatted money} {price basis}**
- Freshness: **Checked {absolute or approved relative time} with {Provider}**
- Body: **The provider reported that this room and rate are no longer available for your stay.**
- Primary: **Check this hotel again**
- Secondary: **Back to matching hotels**

Use `border-[color:var(--error)] bg-[color:var(--error-soft)]` for the evidence panel and `text-[color:var(--error-text)]` only for the status label. Body remains `--text-1/--text-2`. Never claim the property is sold out. Never add scarcity quantity, urgency, countdown, or “just missed it.”

### 12.3 Future `provider_error`

This is mutually exclusive with `sold_out`.

- Heading: **We couldn’t check this room**
- Body: **The provider did not return a reliable availability result. Your room may still be available.**
- Scope/freshness: show the attempted room and stay; do not say **Checked** unless the evidence contract distinguishes an attempt timestamp from a successful check.
- Primary: **Try again**
- Secondary: **Back to matching hotels**

Use neutral `--border-strong` / `--bg-raised`, not sold-out/error styling. While retry is genuinely pending, disable only **Try again**, show `.spinner`, label **Checking room…**, and expose `aria-busy="true"`. Success routes to the newly earned state. A repeated failure stays `provider_error` with focus on its heading; it never becomes `sold_out`.

### 12.4 Future `alternative_available`

This is an attached recovery result, not a replacement label for `sold_out`. It requires one or more distinct, currently available room/rate products for the exact same property and criteria.

- Heading: **Other rooms are available for this stay**
- Body: **These options were returned by {Provider} for the same dates, guests, and rooms.**
- Each alternative must show: room name; bed configuration if supplied; max occupancy; price as `{priceCents, currency}` with per-night or total basis; material cancellation/payment difference; and **Checked {time}**.
- Alternative action: **View this room at {Provider}**
- Hotel-level recovery: **Back to matching hotels**

At 375px, alternatives are a vertical list; no horizontal carousel. At 1280px, use `grid gap-4 lg:grid-cols-2` with equal-height cards. Do not preselect an alternative or label it “Best” unless a separately approved ranking contract exists.

If a valid check returns no alternatives, do not render an empty grid. Show:

> **No other rooms were confirmed by this check.**

Then offer **Check this hotel again** and **Back to matching hotels**. This does not imply the property is sold out.

## 13. Responsive behavior

### 13.1 Mobile — 375px viewport

- The page retains `px-4`; provider section uses `p-4` and fits within 343px content width.
- Every status, hotel name, date, and action may wrap; no line clamp, ellipsis, `whitespace-nowrap`, or fixed text height.
- Inventory block, context, provider options, and recovery panel stack vertically.
- Every action is full width and at least 44px high. Provider link remains 52px as in `CompareRow`.
- Recovery order is primary, secondary, then tertiary. Do not use `flex-col-reverse`.
- Feedback radio labels have a 44px minimum clickable row.
- Future alternative cards are a one-column list.

### 13.2 Desktop — 1280px viewport

- The page remains in the existing `max-w-[1080px]` container; do not widen it.
- The inventory truth and context stay in the provider section adjacent to the action; do not move either to **Supporting evidence**.
- Provider options may retain `sm:grid-cols-2`.
- Recovery primary and secondary actions may share one row, left aligned, with intrinsic width; tertiary remains the next row.
- Future alternatives may use two columns. Evidence/content order never changes from mobile.

No sticky CTA, floating panel, overlay, or viewport-fixed recovery is introduced.

## 14. Keyboard, focus, and assistive technology

- Natural tab order: back link → existing page controls → eligible provider link(s) → recovery actions when present → feedback trigger → feedback controls.
- Use native anchors for navigation/new-tab actions and buttons for disclosure/submission actions.
- Preserve the global `:focus-visible` 3px `--primary` outline and `--focus-ring`; do not remove outline.
- Provider links announce “opens in a new tab” and the `not_checked` truth in their accessible name.
- On ordinary provider return, do not steal focus. Announce recovery once through a polite atomic live region.
- On explicit feedback open, focus its heading (`tabIndex={-1}`). On cancel, return focus to the trigger. On feedback error, focus the error container.
- Do not use `role="alert"` for `not_checked`, no-link, or ordinary return. Reserve alert for a feedback submission error or future failed provider request after a user-initiated retry.
- Status cannot depend on color or icon. Icons, if added, are decorative `aria-hidden="true"`; the final text is mandatory.
- Respect reduced motion. Recovery appears without entrance animation; skeleton behavior already collapses under the global reduced-motion rule.

## 15. Accepted analytics requirements

### 15.1 Event contract

Use one opaque UUID across start, return, recovery view, recovery action, and optional feedback. No hotel name, city, raw dates, provider URL, room name, free text, or other PII enters event properties.

| Event | Required properties |
|---|---|
| `hotel_room_handoff_started` | `handoff_session_id`, `provider`, `deal_id`, `criteria_version` when present, `context_status`, `destination_present`, `date_state`, `occupancy_state: 'not_captured'`, `room_state: 'not_captured'`, `inventory_evidence_state: 'not_checked'`, `alternative_state: 'not_checked'` |
| `hotel_room_handoff_returned` | `handoff_session_id`, `provider`, `deal_id`, `away_duration_bucket`, `inventory_evidence_state`, `alternative_state` |
| `hotel_room_recovery_viewed` | `handoff_session_id`, `deal_id`, `context_restoration_status`, `inventory_evidence_state`, `alternative_state` |
| `hotel_room_recovery_action` | `handoff_session_id`, `deal_id`, `action`, `context_restoration_status`, `inventory_evidence_state`, `alternative_state` |
| `hotel_room_handoff_restarted` | `prior_handoff_session_id`, `handoff_session_id`, `provider`, `deal_id`, `recovery_action: 'recheck_same_hotel'`, `context_restoration_status`, `inventory_evidence_state`, `alternative_state` |

Allowed enums:

- `context_status`: `matched | mismatch | missing | invalid`
- `date_state`: `checkin_window | missing`
- `context_restoration_status`: `restorable | missing | invalid | mismatch`
- `inventory_evidence_state`: current release only `not_checked`; future validator may add `available | sold_out | provider_error` only with the evidence contract.
- `alternative_state`: current release only `not_checked`; future validator may add `none_confirmed | confirmed` only with evidence.
- `action`: `recheck_same_hotel | back_to_matching_hotels | edit_stay | feedback`
- `away_duration_bucket`: `under_10s | 10s_59s | 1m_4m | 5m_29m | 30m_plus | unknown`

If optional feedback ships, use `hotel_room_recovery_action` with `action: 'feedback'` when the form opens, plus `hotel_room_recovery_feedback` on successful submission with only `handoff_session_id`, `deal_id`, and `reason: room_availability_mismatch | price_mismatch | dates_mismatch | other`.

### 15.2 Acceptance gate

Before production emission:

1. Every event and property must exist in `EVENT_PROPERTIES` and its required subset in `REQUIRED_PROPERTIES` in `app/api/analytics/route.ts`.
2. Every enum and opaque ID must pass `validPropertyValue`; session IDs are UUIDs/opaque values, not raw URLs.
3. Route tests must POST each minimum valid payload and receive the accepted status used by the endpoint; invalid enum, extra property, raw URL, and missing session ID fixtures must be rejected.
4. An interaction test must join start → return → recovery view → recovery action → restart using the expected prior/new IDs.
5. `hotel_provider_handoff_clicked` may remain for existing dashboards during migration, but it is not completion and does not replace the new sessioned start event.

As of this spec, the route does **not** accept four of the five required event names and its existing `hotel_room_handoff_started` property set is insufficient. UI must not claim analytics acceptance until a DEV/API change closes that gap.

### 15.3 KPI

Primary in-product KPI:

> Unique returned handoff sessions that start a second valid handoff with known context preserved ÷ unique returned sessions shown recovery.

Secondary diagnostics are action distribution and feedback reasons per feedback-form impression. Outbound click, tab return, and feedback submission are not room-selection or booking completion. Provider callback or attributable conversion evidence is required before adopting provider-side completion as a KPI.

## 16. Edge cases and guards

- Multiple eligible providers: each starts its own session; return recovery rechecks the provider from the most recent active handoff. The panel may name that provider only in the action's accessible name, not diagnose its inventory.
- Rapid double click: debounce session creation for the same provider/link activation in the same task; do not emit two starts for one navigation gesture.
- Two provider tabs opened sequentially: the most recent session becomes active; retain older completed events but do not merge IDs.
- Page already hidden for unrelated reasons: do not mark `away` until after an eligible activation.
- Browser never fires visibility events: no recovery panel; provider journey remains usable.
- Session storage unavailable/corrupt: discard invalid values, create a new in-memory UUID, and continue without user-facing error.
- Return after URL/link becomes invalid: show recovery, then switch recheck to no-link state and retain results recovery.
- Dates/property changed between handoffs: create a new criteria/session identity; do not join it as preserved-context recovery.
- Analytics endpoint fails: never block navigation, recovery, or feedback UI. Failed telemetry does not change copy.
- Price empty, stale, expired, or error: never infer room inventory.
- Empty provider result, absent deeplink, HTTP error, timeout, cache miss, or list coverage `unconfirmed`: never infer `sold_out`.
- Current hidden provider defaults of two adults/one room: never render them as traveler intent and never send them as `applied` analytics state.
- Locked deal detail: out of scope; it exposes no provider handoff and therefore no inventory/recovery treatment.

## 17. State-by-state acceptance matrix

| Test state | Expected result |
|---|---|
| Default valid deal + eligible link | `not_checked` label, known stay, guests/rooms limitation, provider action |
| Page loading | neutral skeleton; one **Restoring your search…** announcement; no availability claim |
| Page error | existing detail error; no inventory status |
| No eligible attributed link | no-link copy + criteria-aware results action; no sold-out language |
| Missing dates | `not_checked`; confirm dates/guests/rooms with provider; no availability claim |
| Invalid/missing criteria | known deal context retained; prior search not restorable; `/deals` recovery |
| Criteria mismatch | provider action blocked by mismatch; no handoff session or recovery |
| Stale rate | stale price remains separate; `not_checked` unchanged |
| Expired rate | current expired blocker + neutral no-check sentence; no provider action/recovery |
| Provider click without hidden event | handoff start only; no recovery panel |
| Hidden → visible after valid click | return + recovery viewed once; focus remains where browser restores it |
| Recheck | new provider tab, new session ID, prior/new restart event, same known context |
| Back to matching hotels | exact criteria-aware `backHref`; recovery action emitted |
| Storage/analytics failure | all actions still function; no misleading error/inventory state |
| Missing room/rate IDs fixture | future states cannot render; degrade to `not_checked` |
| Explicit scoped sold-out fixture in production | unreachable; test must prove no production import/entry point |
| Future provider error fixture | renders error-specific copy, never sold-out copy, only in isolated contract tests |
| Future valid alternatives fixture | exact same scope, distinct IDs, valid money/freshness, full differences; gated from production |
| 375px | no overflow/truncation; stacked ≥44px controls; one-column alternatives |
| 1280px | content stays within 1080px; recovery actions may share row; hierarchy unchanged |

## 18. Prohibited copy and visual treatments

Never render or expose in an accessible label from current data:

- **Available**, **Rooms available**, **Live availability**, **Sold out**, or **No rooms left**
- **Only {N} left**, **Selling fast**, **Popular**, **High demand**, countdowns, pulse indicators, or urgency colors
- **We found another room** or **Similar room** without a provider-returned distinct product
- **Booking complete**, **Room selected**, or **Recovery successful** based on a click, return, or feedback event
- a green success badge for `not_checked`, amber warning badge for ordinary return, or red error badge for no link

The phrase “live availability” must be removed from the current provider-link supporting and accessible copy on this surface because expaify cannot verify what the provider link will return.

## 19. UI handoff checklist

The UI stage is complete only when:

- reachable `not_checked`, no-link, missing/invalid/mismatch criteria, expired/stale, and return-recovery states match this spec;
- the current property, area, dates, and nights are retained; guests/rooms read **choose with provider** and analytics remains `not_captured`;
- return detection requires an activated valid link plus `hidden → visible` and never steals focus;
- all actions work by keyboard at 375px and 1280px with no overflow;
- sold-out/provider-error/alternative fixtures have hard guards and no production route, or are omitted until the data contract exists;
- no unsupported scarcity or availability-positive copy remains in visible or accessible content;
- analytics calls are either accepted end to end or explicitly handed to DEV before emission;
- `npx tsc --noEmit --incremental false` exits 0; and
- `npm test -- --passWithNoTests` is run, with repository-baseline failures separated from new regressions.

## 20. Out-of-scope findings carried forward

- No provider callback or affiliate-conversion feed exists, so provider-side room-selection completion is not measurable.
- Occupancy and room count are not captured; this repair preserves only known property/destination/dates.
- The saved-deal snapshot pipeline performs direct vendor fetches outside `lib/providers`, conflicting with the repository's provider contract. This requires a separate DEV repair and is not changed here.
- The research handoff recorded three unrelated baseline test-suite failures. UI/QA must compare exact failing suites and must not attribute unchanged failures to this work.

