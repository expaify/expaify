# UXDES-HOTEL-SORT-CONTROL-01: Hotel Result Sorting Control

**Ticket:** UXDES-HOTEL-SORT-CONTROL-01  
**Stage:** UX Design  
**Date:** 2026-07-22  
**Upstream:** `docs/pipeline/hotel-sort-control/01-discovery.md`, accepted `docs/pipeline/hotel-sort-control/02-research.md`

## 1. Design outcome

Replace the current two-button **Newest / Biggest discount** segment with one visibly labelled sort trigger above the live hotel grid. The closed trigger always states the current order and opens a compact three-option radio menu:

1. **Recently found** — default; newest `first_seen` first.
2. **Biggest discount** — highest `discount_pct` first.
3. **Lowest nightly price** — lowest `deal_price_cents` first.

The selected order is visible to every traveler. Premium members can apply any of the three orders. Non-Premium travelers can inspect the same choices, but activating a locked alternative does not change or request results; it opens a clear Premium explanation with a single **See Premium** action.

Do not include **Newest**, **Recently checked**, **Best deal**, **Best value**, **Recommended**, rating, quality, popularity, location, closest, or convenience sorts. The live deal row cannot substantiate those claims.

This is a repair of an ambiguous and inaccessible existing control plus the addition of one data-supported order. It does not introduce provider calls, new hotel evidence, a recommendation model, or a new Premium policy.

## 2. Design goals and success conditions

The design must let a first-time traveler, before scanning a card:

- identify the applied order from the closed control;
- distinguish recently detected deals, relative discount, and absolute nightly price;
- understand that nightly price excludes taxes and fees when that order is active;
- understand a Premium restriction without interpreting an inert control as broken;
- change order with touch, pointer, or keyboard and receive truthful loading, success, or recovery feedback.

The implementation passes when:

- the first returned card follows the selected primary key and deterministic tie-breakers;
- the trigger, option labels, helper/error copy, and menu fit at 375px with no horizontal page scroll or meaning lost to truncation;
- the same information model sits directly above the grid at 1280px;
- a screen-reader user can determine the current option, discover locked alternatives, and hear loading, success, or error feedback;
- no failed or locked attempt changes the applied order or emits a success event.

## 3. Scope and preserved contracts

### In scope

- The sort surface in `app/deals/DealFeed.tsx` above the live `DealCard` grid.
- Visible labels, descriptions, Premium explanation, loading, success, error, empty, mock/sample, keyboard, focus, and responsive states.
- Client state needed to distinguish applied, pending, and failed orders.
- The four analytics events specified in research.
- The API/data-helper extension required for lowest nightly price and deterministic pagination.

### Preserved

- Default order remains the current recency order.
- Sorting remains Premium-gated; this ticket does not decide packaging.
- A sort change resets pagination to offset `0` and refetches results.
- Money remains integer minor units. The comparable field is `deal_price_cents`; never sort a formatted string or float.
- Existing filters, search, tabs, paywall masking, card props, affiliate links, provider boundaries, and `/join` destination remain unchanged.
- Locked cards remain excluded from `hotel_result_card_opened`.

### Explicitly out of scope

- Guest-rating, hotel-class, amenity, neighborhood, landmark, distance, convenience, popularity, or multi-factor recommendation sorts.
- Total-stay or after-tax price sorting.
- Ungating sort, adding a trial, or changing Premium pricing/copy outside this control.
- A new analytics vendor or production analytics sink.
- Repairing the provenance of the card's existing **checked** timestamp.

## 4. Information hierarchy

### Primary

- Hotel result cards and their current nightly price/discount evidence.
- The closed sort trigger: **Sort by: [applied or pending label]**.

### Secondary

- The three supported sort intents in the menu.
- The applied-order/result status: **Sorted by [label] · [N] deals loaded**.
- When price sort is applied, **Nightly prices before taxes and fees**.

### Tertiary

- Premium entitlement explanation and **See Premium** action.
- Sort-specific error and retry.

The control is a result-ordering tool, not a filter. Keep it after `SearchBar`, after the existing filter area, and immediately before the result grid. Do not merge it into filter pills or place it inside an individual card.

## 5. Naming and data semantics

Use one mapping source in the client; do not duplicate labels in event and rendering branches.

| UI label | Client/API key | Analytics value | Required order | Meaning |
| --- | --- | --- | --- | --- |
| Recently found | `newest` | `recently_found` | `first_seen DESC, id ASC` | When expaify first detected the row as a deal; not hotel age, stay date, or last price check. |
| Biggest discount | `discount` | `biggest_discount` | `discount_pct DESC, first_seen DESC, id ASC` | Largest percentage reduction from that hotel's stored median; not best overall value. |
| Lowest nightly price | `price` | `lowest_nightly_price` | `deal_price_cents ASC, first_seen DESC, id ASC` | Lowest current per-night price in the eligible result set before taxes and fees; not total stay. |

Use `id ASC` as the final unique tie-breaker on every order. Apply filters before ordering and pagination. Perform the order on unmasked deal rows before free-user card locking so masked zero-value prices can never affect rank.

### Sort state model

The UI must track three concepts rather than one optimistic `sort` value:

- `appliedSort`: order represented by the cards currently shown; starts as `newest`.
- `pendingSort`: requested Premium order while its first page is loading; otherwise `null`.
- `failedSort`: last requested order that failed and can be retried; otherwise `null`.

The trigger label uses `pendingSort ?? appliedSort`. The result status and card-open event use `appliedSort` until the response succeeds. On success, promote `pendingSort` to `appliedSort`, clear `pendingSort` and `failedSort`, replace the result set, and set offset to `0`. On failure, retain the previous cards and `appliedSort`, move the target to `failedSort`, and clear `pendingSort`.

Do not send another sort request while `pendingSort` is non-null. Do not treat selecting the already applied option as a change.

## 6. Component anatomy and layout

### 6.1 Toolbar

Use a compact result-toolbar region with the trigger and status. It must not become a large card or compete with the hotel cards.

```tsx
<section
  aria-labelledby="hotel-sort-label"
  className="relative mb-8 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
>
  <div className="relative w-full sm:w-auto">
    {/* label, trigger, menu, Premium explanation, or error */}
  </div>
  <p className="min-h-5 text-[12px] leading-5 text-[var(--text-2)] sm:pt-6 sm:text-right">
    {/* applied order and loaded count */}
  </p>
</section>
```

- `#hotel-sort-label` is a visible `span`, not screen-reader-only copy.
- At 375px, the trigger and any explanation/error panel use the full content width (approximately 335px).
- At 1280px, keep the trigger left-aligned with the grid; the status may align right in the same row.
- Do not use fixed viewport coordinates, a modal sheet, or horizontal scrolling.

### 6.2 Visible label and trigger

Visible label: **Sort hotel deals**.

Closed trigger value: **Sort by: [label]**.

```tsx
<span
  id="hotel-sort-label"
  className="mb-1.5 block text-[12px] font-bold leading-5 text-[var(--text-1)]"
>
  Sort hotel deals
</span>
<button
  type="button"
  aria-haspopup="menu"
  aria-expanded={menuOpen}
  aria-controls="hotel-sort-menu"
  aria-describedby="hotel-sort-status"
  className="flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 text-left text-sm font-bold text-[var(--text-1)] hover:border-[var(--border-hover)] sm:w-[17rem]"
>
  <span className="min-w-0">Sort by: {sortLabel}</span>
  {/* 16px chevron; decorative aria-hidden */}
</button>
```

- Keep the full value visible. Do not apply `truncate`, `whitespace-nowrap`, or an icon-only mobile state.
- The target is at least 44px high.
- Open state changes border to `border-[var(--border-focus)]`; the global `:focus-visible` ring remains intact.
- Pending state keeps the button focusable but uses `aria-disabled="true"` plus a guarded handler to prevent a second request. Add a 16px spinner with `aria-hidden="true"`; the text remains **Sort by: [pending label]**.
- Initial-load and no-result states may use native `disabled` because no alternative can currently act; keep the label readable with `disabled:opacity-60`.

### 6.3 Sort menu

Use a custom radio menu, not a native `<select>`, so the selected row, descriptions, and discoverable Premium locks can coexist. The trigger owns the accessible name; the menu owns option selection.

```tsx
<div
  id="hotel-sort-menu"
  role="menu"
  aria-label="Sort hotel deals"
  className="absolute left-0 top-full z-30 mt-2 w-full min-w-0 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-raised)] p-1 shadow-[var(--shadow-lift)] sm:w-[22rem]"
>
  {/* three menuitemradio buttons */}
</div>
```

Each row:

```tsx
<button
  type="button"
  role="menuitemradio"
  aria-checked={displayedSort === key}
  aria-disabled={!premium && key !== 'newest' ? true : undefined}
  className="flex min-h-11 w-full items-start gap-3 rounded-[calc(var(--radius-control)-0.125rem)] px-3 py-2.5 text-left hover:bg-[var(--bg-muted)] focus-visible:outline-offset-[-2px]"
>
  {/* selected indicator, label/description, optional lock */}
</button>
```

Option content:

| Label | Supporting description |
| --- | --- |
| Recently found | Deals expaify detected most recently |
| Biggest discount | Largest drop from the usual nightly price |
| Lowest nightly price | Lowest current rate per night |

- Label style: `text-sm font-bold leading-5 text-[var(--text-1)]`.
- Description: `text-[12px] leading-5 text-[var(--text-2)]`.
- Selected row: `bg-[var(--brand-soft)]`; use a visible check/radio indicator and `aria-checked="true"`.
- A locked alternative remains focusable, has `aria-disabled="true"`, and shows a 14px decorative lock plus visible **Premium** text. Do not reduce its opacity below readable contrast.
- The selected default is not visually locked for a non-Premium visitor because it is already applied. Selecting it simply closes the menu without a request or event.
- Menu width is never wider than the page content at 375px. Descriptions may wrap naturally; labels may not be shortened.

### 6.4 Applied status and price caveat

Use one visual and polite live region:

```tsx
<div
  id="hotel-sort-status"
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="min-h-5 text-[12px] leading-5 text-[var(--text-2)]"
>
  <p>Sorted by {appliedLabel} · {loadedCount} {dealWord} loaded</p>
  {appliedSort === 'price' && (
    <p className="font-medium text-[var(--text-1)]">Nightly prices before taxes and fees</p>
  )}
</div>
```

During a request announce **Sorting by [pending label]…** and keep the existing card order represented by `appliedSort` until success. Set the results container `aria-busy="true"`. When the response renders, replace the live region text with the success line.

Use honest loaded-card count only. Do not label the current API `total` as all matches or say **Showing all**.

## 7. Final UI copy

These strings are final. Do not substitute synonyms.

| Context | Copy |
| --- | --- |
| Visible control label | **Sort hotel deals** |
| Closed trigger | **Sort by: [Recently found / Biggest discount / Lowest nightly price]** |
| Default option | **Recently found** |
| Default description | **Deals expaify detected most recently** |
| Discount option | **Biggest discount** |
| Discount description | **Largest drop from the usual nightly price** |
| Price option | **Lowest nightly price** |
| Price description | **Lowest current rate per night** |
| Premium marker | **Premium** |
| Initial loading status | **Loading hotel deals…** |
| Sort loading status | **Sorting by [label]…** |
| Loaded status, plural | **Sorted by [label] · [N] deals loaded** |
| Loaded status, singular | **Sorted by [label] · 1 deal loaded** |
| Price caveat | **Nightly prices before taxes and fees** |
| Premium explanation | **Sorting options are included with Premium. Your results are currently sorted by Recently found.** |
| Premium CTA | **See Premium** |
| Premium explanation dismissal | **Not now** |
| Sort error | **Couldn't apply that sort. Try again.** |
| Sort error context | **Your results are still sorted by [applied label].** |
| Sort retry | **Retry** |
| Initial-feed error | **Couldn't load deals right now.** |
| Initial-feed retry | **Retry** |
| No result status | **No deals to sort.** |
| Mock/sample status | **Sorting is available with live deals.** |

The Premium explanation names **Recently found** because the server forces non-Premium requests to that default. If that policy changes later, interpolate the actual applied label rather than leaving stale copy.

## 8. State specifications

### 8.1 Default, Premium, real results

Condition: `premium === true`, real `deals.length > 0`, no pending or failed sort.

- Show **Sort hotel deals** and **Sort by: Recently found**.
- The menu is closed.
- Visible status: **Sorted by Recently found · [N] deals loaded**.
- Trigger is enabled. No Premium marker or explanation is visible.
- Results use `first_seen DESC, id ASC`.
- Emit `hotel_sort_control_viewed` once when this real-results control first enters the viewport.

### 8.2 Menu open, Premium

- Focus moves from the trigger to the checked option when opened.
- Show all three options and descriptions; none is locked.
- Exactly one `menuitemradio` has `aria-checked="true"`.
- Selecting a different option closes the menu, returns focus to the trigger, sets `pendingSort`, resets offset to `0`, and starts one request.
- Selecting the applied option closes the menu and returns focus without a request, skeleton, status change, or analytics event.

### 8.3 Sort loading with existing results

- The trigger stays visible and reads **Sort by: [pending label]** with a spinner.
- It remains focusable and uses `aria-disabled="true"`; guarded pointer and keyboard activation do nothing until the request settles.
- Live region says **Sorting by [pending label]…**.
- Result region uses `aria-busy="true"`.
- Replace the current card grid with skeletons matching the existing responsive columns. Use up to the number of cards previously visible, capped at 6, so the page does not collapse.
- Do not briefly revert the trigger to the prior label.
- Do not clear active filters.
- Do not emit `hotel_sort_changed` until the response succeeds and cards render.

### 8.4 Sort success

- Replace cards with the first page for the target order and reset pagination.
- Set the target as `appliedSort`; clear pending/failed state.
- Trigger remains focused if the user has not moved focus.
- Live region says **Sorted by [label] · [N] deal(s) loaded**.
- If applied order is **Lowest nightly price**, show **Nightly prices before taxes and fees** directly below the status.
- Clear the caveat immediately when another order succeeds.
- Emit `hotel_sort_changed` once after the successful result set is committed to the DOM.

### 8.5 Sort-specific error with previously loaded results

- Restore the trigger label to the prior `appliedSort`.
- Preserve the prior cards and filters; remove `aria-busy`.
- Do not show the whole-feed error or an empty grid.
- Render an inline `role="alert"` below the trigger:
  - **Couldn't apply that sort. Try again.**
  - **Your results are still sorted by [applied label].**
  - **Retry**
- The error shell uses `rounded-[var(--radius-control)] border border-[var(--error)] bg-[var(--error-soft)] p-3` and readable `text-[var(--text-1)]`.
- **Retry** requests `failedSort` exactly once and returns to the pending state. It never loops automatically.
- Opening the menu and successfully choosing another order clears the error.
- Do not emit `hotel_sort_changed` for the failed request.

### 8.6 Initial feed loading

Condition: no prior real cards and `loading === true`.

- Show the visible label and a disabled trigger reading **Sort by: Recently found**.
- Live status: **Loading hotel deals…**.
- Do not open the menu and do not show a Premium upsell before eligibility/results resolve.
- The grid retains its existing six skeleton cards.
- Do not emit `hotel_sort_control_viewed`.

### 8.7 Initial feed error

Condition: the first result request fails and no prior cards exist.

- Show disabled **Sort by: Recently found** so the default remains understandable.
- Keep the existing full-feed error:
  - **Couldn't load deals right now.**
  - **Retry**
- Full-feed **Retry** retries the current filters and `appliedSort`, not a stale `failedSort`.
- Do not show the sort-specific alert or emit sort events.

### 8.8 Empty results

Condition: request succeeds with zero real deals.

- Preserve the actual applied label in a disabled trigger.
- Status: **No deals to sort.**
- Keep the existing filtered or personalized empty-state actions unchanged.
- Do not open the sort menu, show the Premium explanation, or emit `hotel_sort_control_viewed`.
- If a sort request itself produces zero results, it is still a successful response: promote the requested order, announce **No deals to sort.**, and do not misstate the API page count as a total.

### 8.9 Non-Premium, real results

- The closed trigger remains enabled and reads **Sort by: Recently found**.
- Opening it shows the three options; **Recently found** is selected.
- **Biggest discount** and **Lowest nightly price** are focusable `aria-disabled="true"` menu items with visible **Premium** markers.
- Activating a locked alternative:
  1. emits `hotel_sort_disabled_attempted`;
  2. does not change the trigger, cards, offset, URL, query parameters, or `appliedSort`;
  3. closes the menu;
  4. opens the adjacent Premium explanation;
  5. moves focus to the explanation heading/container so it is announced.
- Explanation copy: **Sorting options are included with Premium. Your results are currently sorted by Recently found.**
- Actions: **See Premium** links to `/join`; **Not now** dismisses.
- The explanation is a non-modal region with `tabIndex={-1}` and an accessible label such as **Premium sorting**. It uses `rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-muted)] p-3`.
- Pressing Escape or **Not now** closes the explanation and returns focus to the sort trigger.
- Following **See Premium** navigates normally; do not also emit a sort-change or card-open event.

### 8.10 Mock/sample feed

Condition: all visible deals have `isMock === true`.

- Do not claim the sample rows are recently found or meaningfully ranked.
- Render the disabled trigger and status **Sorting is available with live deals.**
- Keep the existing **Example deals** disclosure.
- Do not open the menu, show Premium upsell, or emit any of the hotel-sort/card-open events from this contract.

### 8.11 Loading more

- Infinite-scroll pagination retains the applied order and does not change the trigger or status to a new order.
- Append skeleton cards only; the sort trigger stays enabled unless a first-page sort is pending.
- Appended rows must use the same deterministic order and filters.
- Update loaded count after append, but do not emit `hotel_sort_changed` because the order did not change.

## 9. Responsive behavior

### 9.1 Mobile — 375px

- Content remains inside the page's existing `px-5`, yielding approximately 335px.
- Toolbar is one column: visible label, full-width trigger, status/caveat, then any explanation/error.
- Trigger and menu are `w-full`; the menu is anchored to the trigger's left and right edges.
- Menu labels remain on one line where possible; descriptions wrap. No option is horizontally clipped.
- Touch targets are at least 44px; the menu does not rely on hover.
- The Premium explanation actions stack when necessary: `flex flex-col items-stretch gap-2 min-[420px]:flex-row`.
- The next result begins after `mb-8`; the open menu overlays the grid rather than pushing all cards downward.
- No horizontal scroll, fixed-width 22rem menu, three-column segment, or bottom sheet.

### 9.2 Desktop — 1280px

- Within the existing `max-w-[1140px]` container, toolbar uses a row: control at left, applied status at right.
- Trigger width is 17rem; open menu width is 22rem and left-aligned to it.
- Menu must not cover the filter controls above; it opens downward over the result-grid whitespace.
- Keep the same three options, copy, order, and Premium behavior as mobile. Do not expose more choices at larger widths.
- The existing grid remains three columns at `min-[1024px]`.

## 10. Keyboard, focus, and screen-reader contract

### Closed trigger

- `Tab` reaches the trigger in DOM order after search/filter controls and before result-card actions.
- `Enter`, `Space`, or `ArrowDown` opens the menu and focuses the checked option.
- `ArrowUp` may open the menu and focus the last option.

### Open menu

- Use roving focus among the three `menuitemradio` elements.
- `ArrowDown` / `ArrowUp` moves and wraps.
- `Home` / `End` moves to first / last.
- `Enter` / `Space` selects an available option or invokes the Premium explanation for a locked option.
- `Escape` closes and returns focus to the trigger.
- `Tab` closes the menu and continues to the next/previous focusable element; do not trap focus.
- Pointer click outside closes the menu. Do not unexpectedly move focus after the user clicks elsewhere.

### After actions

- Premium selection closes the menu and returns focus to the trigger before the request starts. Focus stays there through loading and success/error unless the user moves it.
- Locked selection closes the menu and moves focus to the newly rendered explanation. Dismiss/Escape returns it to the trigger.
- The global `:focus-visible` outline and `--focus-ring` must remain; do not set `outline-none` on interactive controls.
- Only use `aria-live="polite"` for loading/success. Use `role="alert"` for a sort failure. Avoid duplicate live regions announcing the same sentence.
- Result grid has `aria-busy="true"` only during replacement requests, not during idle or after errors.

## 11. Analytics event contract

`lib/analytics.ts` currently accepts only string, number, and boolean values. Emit bounded primitive properties. Never send hotel names, provider URLs, raw natural-language search text, raw city text, or free-form values.

### Shared values

- Sort values: `recently_found | biggest_discount | lowest_nightly_price`.
- `sort_transition`: `${sort_from}>${sort_to}` using those bounded values.
- `viewport_band`:
  - `mobile_375` when viewport width is `<= 479px`;
  - `desktop_1280` when viewport width is `>= 1024px`;
  - `other` otherwise.
- `loaded_result_count`: count of real deal rows currently rendered, including locked real cards; never the API `total` until it becomes a true eligible total.
- `premium_eligible`: boolean from the resolved server response.
- `filter_state`: a serialized JSON string with only this bounded object:

```ts
{
  city_active: boolean,
  min_discount: 0 | 20 | 30 | 40 | 'other',
  max_price_bucket: 'any' | 'under_100' | 'under_150' | 'under_200' | 'under_300' | 'other',
  min_stars: 0 | 3 | 4 | 5 | 'other',
  date_from_active: boolean,
  date_to_active: boolean,
  personalization_active: boolean
}
```

Serialize keys in the listed order. Dates and city names are reduced to booleans; no raw values are allowed.

### Event timing and required properties

| Event | Exact trigger | Required properties |
| --- | --- | --- |
| `hotel_sort_control_viewed` | Once per `DealFeed` mount when a non-loading control with at least one real result first intersects the viewport | `current_sort`, `premium_eligible`, `loaded_result_count`, `viewport_band`, `filter_state` |
| `hotel_sort_changed` | Once after a different requested order succeeds, first-page cards render, and `appliedSort` updates | `sort_from`, `sort_to`, `sort_transition`, `premium_eligible`, `loaded_result_count`, `viewport_band`, `filter_state`, `request_ms` |
| `hotel_sort_disabled_attempted` | Every keyboard or pointer activation of a non-Premium locked alternative, before the explanation opens | `sort_from`, `sort_to`, `sort_transition`, `premium_eligible` fixed to `false`, `loaded_result_count`, `viewport_band`, `filter_state` |
| `hotel_result_card_opened` | A user activates the internal detail link of an unlocked, non-mock real hotel card | `current_sort`, `previous_sort`, `sort_transition`, `premium_eligible`, `loaded_result_count`, `viewport_band`, `filter_state`, `card_position` |

Additional rules:

- `request_ms` is integer elapsed milliseconds from request start to successful cards rendered; do not emit it on failure.
- `card_position` is 1-based in the fully loaded visible sequence, including locked cards occupying earlier positions.
- `previous_sort` is the order immediately before the current successful sort; before any successful change, use `recently_found` and set `sort_transition` to `recently_found>recently_found`.
- A locked card, sample card, Premium CTA, sort trigger, retry, filter change, or outbound provider link is not `hotel_result_card_opened`.
- A no-op current-option selection is not `hotel_sort_changed` or `hotel_sort_disabled_attempted`.
- Failed and aborted requests do not emit `hotel_sort_changed`.

The absence of a production event sink is a known DEV/analytics dependency. Implementing calls alone does not make production measurement available.

## 12. Implementation responsibilities by stage

### UI stage

- Replace the segmented control with the labelled trigger, radio menu, status, price caveat, Premium explanation, and sort-specific error UI.
- Implement the responsive, focus, keyboard, and `aria-*` behavior in this spec.
- Add client `appliedSort`, `pendingSort`, and `failedSort` state without changing existing public component exports.
- Keep the existing search, filters, empty states, cards, and grid contracts.
- Wire event calls at the specified UI moments; do not add an analytics vendor.
- Add component tests for labels, menu selection, locked attempts, focus return, and state copy if the current test setup supports client interaction tests.

### DEV stage

- Extend the accepted client/route/data-helper sort union to `newest | discount | price`.
- Accept `sort=price` only for Premium requests; free requests remain forced to `newest`.
- Add all three deterministic SQL orders from §5.
- Ensure replacement-request failure can retain prior results and applied order.
- Normalize the initial and refetch page size before card-depth analytics are interpreted; do not claim the current page length is the full result total.
- Preserve integer money, provider, paywall, affiliate, and Result contracts.

The UI stage must hand off to DEV because **Lowest nightly price** cannot function against the current `newest | discount` API/data-helper contract.

## 13. Acceptance checklist for UI and TEST

### Data truth

- [ ] Exactly three labels appear: Recently found, Biggest discount, Lowest nightly price.
- [ ] Recently found uses `first_seen`, never the card's `updatedAt`/checked text.
- [ ] Lowest nightly price orders integer `deal_price_cents` ascending.
- [ ] Price caveat appears only while price order is applied.
- [ ] No unsupported quality/convenience/recommendation language appears.
- [ ] Every order has `id ASC` as final tie-breaker.

### Premium and recovery

- [ ] Non-Premium users can read the applied order and focus locked alternatives.
- [ ] Locked activation sends no sort request and changes no result/order state.
- [ ] Premium explanation uses final copy, links to `/join`, and dismisses back to trigger.
- [ ] Sort loading preserves the pending label and active filters.
- [ ] Sort error preserves previous cards/order and retries only the failed target.
- [ ] Current-option selection is a no-op.

### Responsive and accessibility

- [ ] 375px: no page/menu overflow, truncated meaning, overlap, or target under 44px.
- [ ] 1280px: control sits directly above and aligned with the three-column grid.
- [ ] Trigger/menu support Tab, Enter, Space, arrows, Home, End, and Escape as specified.
- [ ] Exactly one option is programmatically checked.
- [ ] Focus-visible ring remains visible; result loading uses `aria-busy`; status and alert do not double-announce.
- [ ] Initial loading, empty, full-feed error, sort error, Premium, mock, and load-more states match this spec.

### Analytics

- [ ] All four events use exact names, timing, and required bounded properties.
- [ ] Success event fires after render, not on request start.
- [ ] Card position is 1-based and mock/locked actions are excluded.
- [ ] No hotel identity, provider URL, raw city/date/search text, or other free text is sent.

## 14. Blockers and out-of-scope findings

- **Production measurement dependency:** `lib/analytics.ts` has no production sink. The event contract can be implemented, but production evidence requires a separately approved analytics destination.
- **Required DEV dependency:** lowest-nightly-price and stable pagination require route/data-helper work after UI.
- **Measurement confound:** the server first paint currently loads 20 rows while client refetches use 12, and initial `hasMore` behavior differs. Normalize this before comparing card depth or loaded-result behavior.
- **Existing trust issue, out of scope:** card **checked** time is backed by `updatedAt`, which can change for non-price work. This spec never uses it to explain **Recently found**.
- **No provider or money-contract conflict:** all three supported orders use existing deal-row integer/timestamp fields and require no external API call.

