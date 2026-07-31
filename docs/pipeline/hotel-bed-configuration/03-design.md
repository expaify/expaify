# UX Design: Hotel Bed Configuration Confidence

Ticket: `UXDES-HOTEL-BED-CONFIGURATION-01`  
Stage: UX Design  
Priority: P0  
Date: 2026-07-31  
Persona: Senior UX Designer / Interaction Designer

## Source inputs and binding decisions

- Discovery: `docs/pipeline/hotel-bed-configuration/01-discovery.md`
- Research: `docs/pipeline/hotel-bed-configuration/02-research.md`
- Adopted display contract: `docs/pipeline/room-rate-clarity/03-design.md`, especially §1, §2.3, §6–§8
- Evidence contract only: `docs/pipeline/guest-room-fit/02-research.md`, especially canonical fact `bed_config`
- Current implementation inspected:
  - `app/components/HotelCard.tsx`
  - `app/book/BookingFlow.tsx`
  - `lib/providers/hotelAmenityEvidence.ts`
  - `lib/types.ts`
  - `app/api/analytics/route.ts`
  - `app/globals.css`

This spec makes four binding decisions:

1. There is one factual display home: the existing **Room & bed** row inside **Room & rate details**. There is no second Room fit panel, collapsed bed chip, room table, or bed selector.
2. The current shippable state is the unpopulated `not_returned` form. Hotellook supplies a hotel-level lead-in price and no room/rate/stay-bound bed descriptor.
3. The existing **Special requests** block remains guidance-only. Beds become discoverable in its examples, but expaify still selects, sends, acknowledges, and guarantees nothing.
4. Bed-attributed reversal measurement remains a separate DEV dependency. This design does not repair analytics or claim that the available return proxy proves a bed mismatch.

No room/rate disclosure is inferred from occupancy, room name, property type, stars, photos, or price.

---

## 1. User outcome and hierarchy

This is solved when a first-time traveler can understand, before leaving expaify, that the current provider did not return a bed arrangement and that any bed preference must be requested from the booking provider and is not guaranteed until the provider or property explicitly confirms it.

### 1.1 Surface hierarchy

The existing hotel hierarchy remains unchanged:

1. **Primary:** Deal Score and price decision.
2. **Secondary:** evidence about the offer, including the **Room & rate details** section and its **Room & bed** row.
3. **Tertiary:** provider-directed **Special requests** guidance at the handoff.

The factual row answers “What does the supplier state?” The guidance block answers “What can I do if I need something different?” These are related but not duplicates.

### 1.2 Placement

In expanded `HotelCard`, preserve the placement specified by room-rate-clarity:

1. Photo
2. Deal Score
3. Quality evidence
4. Low-confidence warning, when present
5. **Room & rate details**
6. Location
7. Price scope / rate check

Within **Room & rate details**, preserve the existing order:

1. Refundable
2. Cancellation deadline
3. **Room & bed**
4. Meal plan (this rate)

Do not promote bed configuration into the collapsed hotel card. An all-missing current result remains scannable and does not gain a warning chip.

At `/book`, preserve the current handoff sequence. **Special requests** remains after “What you may need” and document readiness and before funds policy. Do not move it next to the factual row or create a second provider-confirmation boundary.

---

## 2. Current deliverable: unpopulated `not_returned` form

The current provider cannot bind a bed descriptor to the displayed offer. The UI must therefore render exactly:

| Element | Final copy |
|---|---|
| Section title | `Room & rate details` |
| Row label | `Room & bed` |
| Row value | `Room type not provided by this provider` |

This is normal content, not an error, empty state, skeleton, disabled row, or placeholder. The row remains visible whenever expanded offer details are available. It must not be hidden because the value is absent.

The row does not include a “Confirm” link or an extra provider label. The existing review CTA and handoff already establish where the traveler continues.

### 2.1 Visual treatment

Use the inherited `Room & rate details` panel treatment:

- Section: `rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 text-xs leading-5 text-[color:var(--text-2)]`
- Section title: `font-bold text-[color:var(--text-1)]`
- Two-row grid containing Room & bed and Meal plan: `mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6`
- Row label (`dt`): `font-bold text-[color:var(--text-1)]`
- Row value (`dd`): `mt-0.5 font-medium text-[color:var(--text-2)] break-words`

Do not use warning, success, or error color for `not_returned`. Absence is expressed by the sentence itself and must not imply that a room is incompatible.

---

## 3. Complete Room & bed state model and final copy

The five strings inherited from room-rate-clarity remain exact and unchanged. `unknown` is added only as the safety output required by the existing evidence normalizer; it is not a second provider-unavailable string.

| UI state | Trigger | Exact visible value | Current reachability |
|---|---|---|---|
| Confirmed, provider-backed | A legal supplier descriptor is bound to the represented room/rate/stay | `{room name}, {bed config}` verbatim, e.g. `Standard Room, 1 King Bed` | Blocked on future provider |
| Provider-returned unavailable | Supplier explicitly returns no specified room/bed configuration for the legal room or selected-stay scope | `Room type not specified for this rate` | Blocked on future provider |
| **Not returned — default** | Provider returns the offer but no bound room/bed descriptor | `Room type not provided by this provider` | **Reachable and required now** |
| Unknown | Descriptor, scope, source, certainty, or alternative structure is malformed, ambiguous, or illegal | `Room details are unclear — confirm with the provider before booking` | Fixture/future defensive state |
| Loading | Room/rate detail resolution is independently pending | `Checking room details…` | Fixture/future async state |
| Error | Room/rate detail request returns `Result.ok === false` | `Room details could not be loaded` | Fixture/future async state |

### 3.1 State styling

- Confirmed, requestable: standard `text-[color:var(--text-2)]`; certainty is carried in adjacent text, not green styling.
- Confirmed, guaranteed: standard `text-[color:var(--text-2)]`; certainty is carried in adjacent text, not green styling.
- Unavailable and not returned: standard `text-[color:var(--text-2)]`.
- Unknown and loading: `text-[color:var(--text-3)]`.
- Error: `text-[color:var(--error-text)]`. Never use `--error` for text; it does not meet the app’s text contrast contract.

No icon, badge, or color is required. If a future implementation adds an icon, the complete status sentence must remain visible.

### 3.2 Room name and descriptor formatting

- Display provider vocabulary verbatim after trimming surrounding whitespace.
- If both a non-empty room name and a non-empty bed descriptor are returned, join them with `, `: `{room name}, {bed config}`.
- A populated row is illegal without a non-empty bed descriptor. A room name alone must normalize to `unknown`; never render `Standard Room` as evidence of a bed arrangement.
- Do not title-case, singularize, pluralize, translate, or convert bed sizes in the UI.
- Do not display raw HTML or provider markup. Provider adapters must supply safe plain text.
- Long values wrap in place. Do not clamp or truncate.

### 3.3 Alternatives versus beds that coexist

Provider alternatives must remain alternatives:

- Alternative set: `1 king bed or 2 twin beds`
- Coexisting beds within one configuration: `1 king bed, 1 sofa bed`
- Multiple configurations: preserve each configuration and join them with visible `or`.

Never flatten `1 king bed or 2 twin beds` into `1 king bed, 2 twin beds`; the latter falsely says all three beds are present.

If a provider returns a preformatted, safe plain-text alternative string, preserve its explicit `or`. If it returns structured configurations, the adapter—not the component—must join alternatives with ` or ` and coexisting beds with `, `. Empty alternatives are removed before evaluation. If more than one valid configuration remains, the certainty cannot be `guaranteed`.

---

## 4. Certainty copy and interaction rules

Certainty is shown directly beneath the populated row value inside the same `dd`. It is not a second factual row and does not repeat the bed descriptor.

| Legal confirmed form | Qualifier copy |
|---|---|
| Room scope + requestable | `Request only — not guaranteed until the provider confirms.` |
| Selected-stay scope + requestable | `Request only — not guaranteed until the provider confirms.` |
| Selected-stay scope + guaranteed | `The provider guarantees this bed arrangement for the selected stay.` |

Qualifier classes: `mt-1 block text-xs leading-5 text-[color:var(--text-2)]`.

The requestable sentence is inherited from the existing room-request evidence pattern. Do not replace “request” with “choose,” “selected,” “reserved,” or “confirmed.”

The guaranteed sentence may appear only when one unambiguous configuration is bound to the selected stay. It must not appear for room scope, rate scope, property scope, multiple alternatives, or hedged supplier text.

### 4.1 Scope/source metadata for populated fixtures

After the certainty qualifier, render metadata only for a legal confirmed state:

`Source: {sourceLabel}.`

Metadata classes: `mt-1 block text-xs leading-5 text-[color:var(--text-3)]`.

The accessible reading order must be:

1. `Room & bed`
2. provider descriptor or state sentence
3. requestable/guaranteed meaning, when confirmed
4. source, when confirmed

Do not surface internal terms such as `selected_stay`, `not_returned`, or `bed_config` to travelers.

### 4.2 Tap, keyboard, retry, and errors

- The factual row is static. Tap and Enter do nothing; no row-level control is added.
- Expanding the existing Details control reveals the row through its existing `aria-expanded` relationship.
- Loading updates use `aria-live="polite"` on the value region. Do not move focus.
- Error is non-blocking and must not use `role="alert"`; price and provider handoff can remain usable.
- No row-level Retry control is introduced. A future parent offer retry may refetch the state; during retry the row returns to `Checking room details…` and then resolves without focus movement.
- If a stale populated descriptor is being refreshed, do not show it as current alongside loading. Render the loading string until the refreshed evidence resolves.

---

## 5. Legal bed evidence-state table

Canonical fact:

- `id`: `bed_config`
- traveler-facing label: `Room & bed`
- kind: `room_request`
- default scope: `room`
- inference: prohibited

“Downgrade” means output `status: 'unknown'`, clear `certainty`, and use the default room scope when the supplied scope is itself invalid.

| `HotelEvidenceStatus` | `property` scope | `room` scope | `rate` scope | `selected_stay` scope |
|---|---|---|---|---|
| `confirmed` | **Downgrade.** Beds are not property-wide guarantees. | **Legal only with `requestable`.** Use for supplier-stated alternatives or a room-type preference not guaranteed for the stay. Missing or `guaranteed` certainty downgrades. | **Downgrade.** A rate without the selected room/stay binding cannot guarantee a physical bed. | **Legal with `requestable` or `guaranteed`.** `guaranteed` requires one unambiguous configuration bound to this selected stay; alternatives remain `requestable`. Missing certainty downgrades. |
| `unavailable` | **Downgrade.** | **Legal without certainty** when the supplier explicitly returns no specified room/bed configuration for the room. | **Downgrade.** | **Legal without certainty** when the selected-stay response explicitly returns no specified room/bed configuration. |
| `not_returned` | **Downgrade.** | **Legal without certainty; default today.** | **Downgrade.** | **Legal without certainty** if the selected-stay response omitted bed detail. |
| `unknown` | **Downgrade to default room-scoped `unknown`.** | **Legal without certainty.** | **Downgrade to default room-scoped `unknown`.** | **Legal without certainty.** |

Forced normalization rules:

1. `confirmed` or `unavailable` without a non-empty `sourceLabel` becomes `unknown`.
2. `confirmed` without a non-empty supplier bed descriptor becomes `unknown`.
3. Any status or scope outside the existing unions becomes room-scoped `unknown`.
4. `certainty` on `unavailable`, `not_returned`, or `unknown` is stripped.
5. More than one valid alternative cannot be `guaranteed`; it becomes `confirmed + requestable` and retains visible `or` alternatives.
6. Hedged text such as “or similar,” “subject to availability,” or “selected at check-in” cannot be `guaranteed`; it is `requestable` when safely interpretable, otherwise `unknown`.
7. `confidence: inferred` is never legal for `bed_config`; it becomes `unknown`.
8. Occupancy, stars, room name, property type, photo, and price never establish a confirmed bed configuration.
9. A provider-level room catalogue not bound to the displayed price is not sufficient to populate this row.

These rules must live in the provider/evidence normalizer. Components consume normalized evidence and never inspect vendor payloads.

---

## 6. Special requests guidance: final copy

The existing guidance-only block remains structurally unchanged. Replace only the example prompt:

| Element | Final copy |
|---|---|
| Heading | `Special requests` |
| Prompt | `Need a quiet room, high floor, preferred bed setup, or early check-in?` |
| Named-partner direction | `Add your request on {partner name} while booking. Nothing is selected or sent by expaify.` |
| Generic-partner direction | `Add your request on the booking partner’s site while booking. Nothing is selected or sent by expaify.` |
| Non-guarantee guidance | `Requests depend on availability and are not guaranteed. After booking, use your confirmation or itinerary to contact the property and ask it to confirm what it can provide.` |
| Help summary | `How requests work` |
| Selected | `Selected: You have chosen a preference. expaify does not offer this step.` |
| Sent | `Sent: The booking service says it submitted the request. Continuing from expaify does not send one.` |
| Acknowledged | `Acknowledged: The property has replied about the request.` |
| Guaranteed | `Guaranteed: The property explicitly confirms it for this stay. Until then, treat it as a preference.` |

“Preferred bed setup” is deliberately neutral: it includes one shared bed, separate beds, or another supplier-supported arrangement without implying expaify offers known choices.

Do not add a checkbox, radio group, select, free-text field, “Add request” button, selected state, confirmation state, or post-booking workflow. Do not prefill or transmit a bed request.

The only related analytics-count correction is:

- `eligibleRequestCount: 4`, matching quiet room, high floor, preferred bed setup, and early check-in.
- `selectedRequestCount: 0`, unchanged because expaify provides no selection control.
- `capabilityState: 'provider_directed_only'`, unchanged.

No event or payload may claim a bed preference was selected, sent, acknowledged, or guaranteed.

### 6.1 Guidance interaction and accessibility

- The prompt and guidance paragraphs remain static.
- The existing `How requests work` `<details>` is the only control added to tab order by this block.
- Tap/click or Enter/Space on its `<summary>` toggles the existing help content.
- Preserve `min-h-11`, visible browser/platform focus treatment, and the current text-first definitions.
- Adding “preferred bed setup” must not change focus order or auto-open the help.

---

## 7. Responsive behavior

### 7.1 Mobile — 375px

- The **Room & rate details** grid remains `grid-cols-1`; Room & bed occupies its own row.
- Value, qualifier, and source wrap naturally with `break-words`. No line clamping, ellipsis, fixed height, or horizontal scrolling.
- A long provider descriptor remains within the panel. Plain-text output must permit breaking at spaces; malformed unbroken provider strings normalize to `unknown` rather than forcing overflow.
- The not-returned value is expected to fit in approximately two to three lines depending on browser text metrics.
- **Special requests** retains `px-3.5 py-3`; the four-example prompt wraps naturally. No example becomes a chip.
- Existing 44px-equivalent (`min-h-11`) summary target remains usable.

### 7.2 Desktop — 1280px

- Room & bed remains paired with Meal plan in the inherited `sm:grid-cols-2` layout.
- The descriptor, certainty, and source stay in the Room & bed column; they do not flow beneath Meal plan.
- The Special requests block remains full-width within the handoff content column.
- No hierarchy, column order, or panel placement changes between desktop and mobile.

---

## 8. Loading, empty, error, and edge-case behavior

### Default / not returned

Render `Room type not provided by this provider`. Do not hide the row and do not call this an empty state.

### Loading

Render `Checking room details…` only in the value position. Keep `Room & bed` visible. Do not show a spinner, skeleton, or pulse that changes panel height.

### Error

Render `Room details could not be loaded` in `--error-text`. The card remains expandable and the review flow remains available if its independent price/deeplink requirements are valid.

### Provider explicitly does not specify a room type

Render `Room type not specified for this rate`. This does not mean the hotel has no beds, that a preferred setup is impossible, or that the offer cannot be booked.

### Unknown / malformed

Render `Room details are unclear — confirm with the provider before booking`. Do not expose the raw malformed value.

### Alternatives

Render all valid configurations joined by `or`, then the request-only qualifier. Never show guaranteed copy.

### One unambiguous selected-stay configuration

Render the descriptor and guaranteed qualifier only when the normalized evidence is selected-stay scoped and guaranteed.

### Missing room name but valid bed descriptor

Render the bed descriptor alone. Do not add a comma or synthesize a room name.

### Room name present but bed descriptor missing

Normalize to `unknown`; do not present the room name as bed evidence.

### Duplicate evidence

The normalizer resolves duplicates using the existing status precedence. The component renders one Room & bed row, never two.

### Provider switch or refreshed offer

Re-normalize against the new provider response. Do not retain a prior provider’s descriptor, certainty, or source during loading or after fallback.

### No valid booking URL or price

Preserve the card’s independent unavailable reason. The Room & bed row still reports its evidence state; it does not replace booking-link or price availability messaging.

### JavaScript-disabled/native details behavior

No new dependency is introduced. The row is static content within the existing expanded region; Special requests help continues to use native `<details>`/`<summary>` semantics.

---

## 9. Component and data boundary

### 9.1 UI implementation eligible now

The next UI stage may implement only the honest current presentation:

- Reuse/create the **Room & rate details** surface owned by room-rate-clarity.
- Render the **Room & bed** `not_returned` row with exact inherited copy.
- Extend the Special requests prompt with `preferred bed setup`.
- Update the existing eligible-example analytics count from 3 to 4 while keeping selected count 0 and capability state provider-directed-only.
- Add UI fixtures/tests for the specified display states only if they can be supplied through existing component contracts without introducing provider/business logic.

If the room-rate-clarity panel is still absent when UI begins, the UI ticket may implement the panel shell and its current disclosure rows as specified by that upstream design; it must not invent a bed-only panel.

### 9.2 Separate populated-data DEV dependency

Future populated states require a DEV ticket, not silent UI inference:

- Add `bed_config` to the canonical evidence registry and `HotelOffer`/provider evidence path.
- Carry a safe supplier descriptor (and structured alternatives where available), room name if returned, source, scope, certainty, and status through `lib/providers`.
- Enforce §5 in the normalizer and return `Result<T>` without throwing to callers.
- Bind the descriptor to the same room/rate/stay represented by the displayed offer.
- Preserve integer minor-unit money and outbound affiliate markers.
- Add adapter, normalizer, cache, API serialization, and component-boundary tests.

Hotellook cannot populate these fields today. Provider-backed fixtures are contract tests, not claims about live inventory.

---

## 10. Measurement plan and separate DEV analytics dependency

### Available directional proxy

Compare `hotel_handoff_returned / hotel_handoff_continue_clicked` before and after the change, segmented by `awayDurationBucket`, especially `<5s` and `5–30s`.

This is directional only. It can show that travelers return after handoff; it cannot identify bed configuration as the cause.

### Blocked bed-attributed metric

Do not mark “reduced bed mismatches” as measurable until a separate DEV analytics repair:

1. Registers `hotel_handoff_return_reason_selected` in the server allow-list.
2. Validates only the intended properties and accepted reason values.
3. Separates bed configuration mismatch from `Smoking policy or room did not match` and other room mismatch reasons.
4. Preserves privacy by recording a bounded reason enum, not free text.
5. Allows analysis by the exposed bed state: not returned, requestable, or guaranteed.

That repair is a measurement dependency, not part of this UXDES/UI handoff.

### Comprehension release gate

Moderated prototype test with 5–7 travelers spanning a couple, colleagues sharing, and a family. At least 85% must answer each correctly:

1. On `Room type not provided by this provider`, “How many beds does this price include?” Correct: the provider did not supply that detail; confirm at the provider.
2. On `1 king bed or 2 twin beds` plus request-only copy, “Are two twins guaranteed?” Correct: no; these are alternatives and the preferred setup is not guaranteed until confirmed.
3. On a selected-stay guaranteed fixture, “What is different?” Correct: the provider guarantees that single arrangement for this selected stay.

---

## 11. Acceptance criteria for UI handoff

1. Exactly one factual **Room & bed** disclosure appears, inside **Room & rate details** in expanded hotel details.
2. Current Hotellook-backed offers render exactly `Room type not provided by this provider`.
3. The inherited provider-backed, provider-unavailable, not-returned, loading, and error strings remain unchanged; `unknown` uses the safety copy in §3.
4. No bed claim is inferred from occupancy, room name, stars, property type, photo, or price.
5. Alternatives retain visible `or`; comma separation means beds coexist within one configuration.
6. Requestable and guaranteed certainty are stated in text and follow §4/§5; color never carries certainty alone.
7. Special requests reads `Need a quiet room, high floor, preferred bed setup, or early check-in?` and retains all provider-directed and non-guarantee copy unchanged.
8. No bed selector, checkbox, text field, request submission, or confirmation control is added.
9. Guidance analytics remain `provider_directed_only`, with `eligibleRequestCount: 4` and `selectedRequestCount: 0`.
10. At 375px and 1280px, all row and guidance copy wraps without truncation, overlap, or horizontal scroll.
11. Keyboard order is unchanged except for the existing native Special requests help summary; no new focus target is introduced.
12. Screen readers encounter row label, state/descriptor, certainty, then source in that order.
13. Loading is polite and non-focus-moving; error is textually explicit, non-alerting, and does not block an otherwise valid handoff.
14. The populated provider path and bed-attributed analytics repair remain separate DEV dependencies and are not simulated in UI.

---

## 12. Out of scope

- Hotel guests/rooms intake or party matching
- Room inventory browser, room selector, bed filter, or in-app booking
- A second Room fit panel or collapsed bed chip
- Occupancy, child policy, cribs, rollaways, connecting-room logic, smoking, meal-plan, refundability, or cancellation redesign
- Inferring bed details from any non-bed attribute
- Adding or repairing a hotel supplier/API in this stage
- Repairing analytics or retroactively recovering dropped return reasons
- Changing the Special requests four-state truth model
- Changing Deal Score based on bed configuration

## Handoff

Create `UI-HOTEL-BED-CONFIGURATION-01` to implement the current unpopulated Room & bed disclosure and the provider-directed Special requests copy extension, with the responsive and accessibility requirements above. Do not bundle the future populated provider contract or return-reason analytics repair into that UI ticket; both are separately recorded DEV dependencies.
