# UX Design — Hotel Detail Decision Order

**Ticket:** `UXDES-HOTEL-DETAIL-DECISION-ORDER-01`  
**Stage:** UX Design  
**Priority:** P0  
**Date:** 2026-07-22

## Upstream inputs

- Discovery: `docs/pipeline/hotel-detail-decision-order/01-discovery.md`
- Research: `docs/pipeline/hotel-detail-decision-order/02-research.md`
- Affected UI:
  - `app/components/HotelCard.tsx`
  - `app/book/BookingFlow.tsx`
  - `app/deals/[dealId]/page.tsx`
  - `app/deals/[dealId]/loading.tsx`
  - `app/components/DealScorePanel.tsx`
  - `app/components/ui/CompareRow.tsx`
- Current continuity contracts:
  - `lib/booking/config.ts`
  - `lib/types.ts`

## Problem statement

Travelers cannot evaluate property fit, price value, and handoff readiness in one predictable pass because the facts are ordered differently—and are partly lost—between a hotel result, the expaify review, and a saved-deal detail.

## Design outcome

Both entrants use one semantic decision order:

1. **Property and stay**
2. **Price and Deal Score**
3. **Hotel fit**
4. **Check rooms with provider**
5. **Supporting evidence**

The order is the visual order, DOM order, heading order, reading order, and section-reach order at both 375px and 1280px. Entry source changes freshness emphasis, back destination, and recovery destination; it does not change the hierarchy.

This is an information-order repair. It does not add room inventory, guest occupancy, beds, amenities, review text, cancellation terms, live availability, booking, or a calculated/confirmed stay total.

## Claims and terminology guardrails

Use these terms consistently:

- **Observed nightly rate:** a valid money value expaify received, displayed as `{formattedMoney}` and backed by integer `priceCents` plus `currency`.
- **Usual nightly rate:** the historical median used by Deal Score, not another provider quote.
- **Deal Score:** expaify's historical comparison. A low-confidence score is never presented as `Great`.
- **Provider-confirmed final total:** no amount is displayed in this release. The provider confirms it after the traveler inspects/selects a room and rate.
- **Room inspection:** the purpose of the outbound action. It is not proof that rooms exist.

Never use `Available`, `Rooms available`, `Book`, `Reserve`, `Selected room`, `Your room`, `Final price`, or `Total` as a value label or action on the expaify surface. Never calculate `nightly rate × nights` and present it as a provider-confirmed amount.

## Shared semantic structure

Use one `<main>` with a single page `<h1>`. Each numbered decision section is a `<section aria-labelledby>` with an `<h2>`. Supporting subsections use `<h3>`. Do not use CSS visual reordering (`order-*`, `grid-area`, `flex-row-reverse`) to place later DOM content earlier on desktop.

```text
Main
├── Source-correct back link
├── H1 Property and stay
│   ├── property name
│   ├── best-supported location
│   └── check-in / check-out / nights or explicit missing state
├── H2 Price and Deal Score
│   ├── observed nightly rate / price state
│   ├── rate basis and freshness
│   └── Deal Score / usual rate / comparison / confidence
├── H2 Hotel fit
│   ├── hotel class
│   ├── rating evidence
│   └── location precision/provenance only when useful
├── H2 Check rooms with provider
│   ├── one provider-confirmation boundary
│   ├── one or more provider-specific outbound actions
│   └── new-tab cue or recovery state
└── H2 Supporting evidence
    ├── photo
    ├── price history and detailed score evidence
    └── offer reference
```

The current `HotelCard` keeps **Review hotel** as its internal-navigation action. Activating it opens the shared detail/review sequence above. The outbound action exists only in section 4 and uses **Check rooms at {provider}**. A saved deal opens directly into the same sequence.

## Hierarchy

### Primary

- Property name and intended stay.
- Observed nightly rate, price scope, freshness, Deal Score, usual nightly rate, and comparison.
- Provider boundary and valid room-inspection action.

### Secondary

- Best-supported location.
- Hotel class and provenance-qualified guest/provider rating.
- Missing-data cautions that change the interpretation of primary facts.

### Tertiary

- Photo.
- Price history/chart and detailed percentile/window evidence already summarized above.
- Detailed location provenance/distance.
- Offer reference and diagnostic metadata.
- Share action.

Tertiary content must not precede or split the first four sections. Remove the saved-detail `Why this is a deal` card because it repeats the observed and usual nightly rates; preserve any non-duplicative snapshot count under Supporting evidence.

## Section specifications and final copy

### 0. Back navigation

Place the explicit back link immediately before the page heading in DOM and visual order.

| Entrant | Visible copy | Destination rule |
|---|---|---|
| Hotel result | `Back to results` | Restore the originating results URL including its normalized query/filter state. Do not default to `/` when a source URL exists. |
| Saved deal | `Back to saved deals` | `/deals`, preserving saved-feed query/filter state when supplied. |
| Unknown/direct entrant | `Back to hotel search` | The safest product-owned hotel-search destination; do not fabricate prior history. |

Use a real link when the destination is known. Browser history may be an enhancement, but must not be the only path. Class pattern: `inline-flex min-h-11 items-center text-sm font-medium text-[color:var(--text-2)] no-underline hover:text-[color:var(--text-1)] focus-visible:rounded-[var(--radius-control)]`.

### 1. Property and stay

The property name is the page `<h1>`. Do not add a generic `Review selected hotel` heading above it.

Visible labels and values:

- Eyebrow: search entrant `Hotel review`; saved entrant `Saved hotel deal`.
- Location label/value comes from `getHotelLocationDisplay`.
- Stay row labels: `Check-in`, `Check-out`, `Nights`.
- Complete date values: localized, unambiguous dates such as `Aug 12, 2026`; nights: `3 nights` or `1 night`.
- Complete stay helper: `Rate shown for this stay context; the provider confirms room-level details.`
- Check-in missing: `Check-in not provided`.
- Check-out missing: `Check-out not provided`.
- Night count missing: `Night count not provided`.
- Any missing stay prerequisite helper: `Stay dates are incomplete. Choose or confirm dates with the provider before comparing room options.`
- All stay fields absent: show one full-width state, `Stay dates not provided`, followed by the same helper. Do not render three empty skeleton facts after loading completes.

Location copy by precision:

| Precision | Label | Value | Supporting note | Effect |
|---|---|---|---|---|
| Exact | `Exact location` | Best valid address/name | `Provider-supplied address. Confirm the final address before payment.` | Non-blocking |
| Coordinates | `Map position` | Best valid provider label/area | `Provider-supplied map position. Confirm the final address before payment.` | Non-blocking |
| Area | `Area` | Provider name/label/area | `Provider supplied an area, not a street address.` | Non-blocking |
| Search area | `Search area` | Search label | `Only the searched destination is available. Confirm the property location with the provider.` | Caution, non-blocking |
| Missing | `Location not provided` | `Confirm with provider` | `No property location details were returned.` | Unresolved-fit caution, non-blocking |

Class pattern: outer `rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6`; H1 `font-display text-2xl font-bold leading-tight text-[color:var(--text-1)] sm:text-3xl`; facts `grid grid-cols-1 gap-3 min-[480px]:grid-cols-3` with labels `text-caption font-bold uppercase tracking-wide text-[color:var(--text-3)]`.

### 2. Price and Deal Score

Heading: `Price and Deal Score`.

Keep the observed rate and Deal Score in one section. The observed rate precedes the score in DOM and visual order.

Observed-rate copy:

- Label: `Observed nightly rate`.
- Value: `{formattedMoney}`.
- Basis: `per night before taxes and fees`.
- Source: `Rate observed from {provider}`. If provider identity cannot be safely named: `Rate observed from a booking partner`.

Freshness copy:

| State | Final copy | Tone |
|---|---|---|
| Fresh timestamp | `Price checked {relativeTime}.` | `text-[color:var(--text-2)]` |
| Aging (30–47.99h current saved-deal rule) | `Price checked {relativeTime}. Confirm the current rate with the provider.` | warning |
| Stale (48h+ and not expired) | `Price may be out of date. We have not rechecked it since {absoluteDate}.` | warning |
| Timestamp unknown | `Last-checked time not provided.` | warning |
| Expired | `This saved rate expired {absoluteDate}. It is shown for reference only.` | error |

Do not repeat the complete provider checklist in this section. `per night before taxes and fees` is the only provider-boundary fragment allowed here.

Deal Score always occupies its normal position:

| State | Visible copy |
|---|---|
| Loading | Label `Deal Score`; status `Checking recent price history` |
| Confident Great/Good/Typical | Existing verdict badge; `Compared with hotel history`; `Usual nightly rate {money}`; `{N}% below usual`, `At usual price`, or `{N}% above usual`; `Last 90 days`; score explanation |
| Low confidence | Badge must not say `Great`; `Limited price history`; `Usual nightly rate {money}` when valid; `Fewer than 10 comparable prices are available, so this is not a confirmed deal rating.`; score explanation |
| Unavailable/no history | `Deal Score unavailable`; `We could not compare this nightly rate with enough recent hotel prices.` |
| Score error | `Deal Score unavailable`; `We could not load the price comparison. You can still inspect rooms with the provider.`; action `Retry Deal Score` only when a real retry handler exists |
| Usual price invalid/missing | `Usual nightly rate unavailable`; do not show a percentage comparison derived from invalid data |

For low confidence, if the current scoring contract emits `Great`, the presentation must suppress that verdict and use `Limited price history`; do not change scoring math in the UI.

Class pattern: section `rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6`; interior `grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]`; rate value `font-display text-3xl font-bold tabular-nums text-[color:var(--text-1)] sm:text-4xl`; warning panel `border-[color:var(--border-strong)] bg-[color:var(--warning-soft)]`; error/expired panel `border-[color:var(--border-strong)] bg-[color:var(--error-soft)]`.

### 3. Hotel fit

Heading: `Hotel fit`.

This section is a minimum evidence check, not a review or amenities feature. Use a definition list. Hotel class precedes rating evidence.

Final quality copy:

- Class, integer: `{N}-star hotel class from {source}`.
- Class, non-integer/other scale: `{value} of {scale} hotel class from {source}`.
- Class missing: `Hotel class not provided`.
- Verified guest rating: `{value}/{scale} guest rating from {source}`; append `from {formattedCount} guest reviews` only when provided.
- Provider-only rating: `{value}/{scale} provider rating from {source}` followed by `Review source not confirmed.`
- Inferred/legacy rating: `No verified guest rating` followed by `We do not label inferred hotel data as a guest rating.`
- Rating absent: `Guest rating not provided` followed by `This provider did not return guest-rating evidence.`
- Quality evidence loading independently: `Checking hotel class and rating evidence`.
- Quality evidence error: `Hotel fit evidence unavailable`; `We could not load class or rating evidence. This does not confirm or rule out room availability.`

Missing hotel class or rating never disables the room-inspection action. Do not render empty stars, `0-star`, `0.0`, a fake review count, or a qualitative `Excellent/Very good/Good` label unless the existing verified-rating rules support it.

Location provenance is shown here only when it adds information beyond section 1: precision note, valid distance, and provider source. Do not repeat the location value without added provenance.

Class pattern: `rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 sm:p-6`; definition list `grid grid-cols-1 gap-4 sm:grid-cols-2`; row `rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-3.5`.

### 4. Check rooms with provider

Heading: `Check rooms with provider`.

This is the only visible provider-confirmation boundary. Place its explanatory copy and action(s) in one bordered unit with no intervening content.

Boundary copy:

`The provider confirms room details, live availability, final total, taxes and fees, cancellation policy, and terms.`

When stay context is incomplete, append:

`Choose or confirm your dates there before comparing room options.`

When location is missing, append:

`Confirm the property location there before choosing a room.`

Action copy:

- One named provider: `Check rooms at {provider}`.
- One unnamed partner: `Check rooms at provider`.
- Multiple saved-deal providers: one action per valid link, each `Check rooms at {provider}`. Label the group `Provider options`; do not use `Compare and book on:`.
- New-tab helper: `Opens {provider} in a new tab. Your expaify page stays open.` For an unnamed partner: `Opens the provider site in a new tab. Your expaify page stays open.`

Accessible link name for a named provider:

`Check rooms at {provider} for {hotelName}. Opens in a new tab. The provider confirms room details, live availability, final total, taxes and fees, cancellation policy, and terms.`

Do not repeat the observed rate in the accessible name; it is already read in section 2 and makes the boundary unnecessarily verbose. Every outbound link retains `target="_blank"` and `rel="noopener noreferrer sponsored"`, and the existing affiliate markers must remain in the URL.

Class pattern: `rounded-[var(--radius-card)] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] p-4 sm:p-6`; primary link `btn btn-primary min-h-11 w-full text-center`; multiple links `grid grid-cols-1 gap-2 sm:grid-cols-2`; boundary copy `text-sm leading-6 text-[color:var(--text-2)]`.

### 5. Supporting evidence

Heading: `Supporting evidence`.

Place after the provider unit even when suspense-streamed. Streaming content must resolve in its reserved location and must not shift sections 1–4.

Order:

1. Photo, when present. Decorative hotel photo uses `alt=""` because the property name is already the page heading. If absent, omit the photo; do not show a large decorative placeholder.
2. `Price history` with chart or snapshot trust line.
3. `Deal Score details` for percentile/window detail not already needed in the summary.
4. `Offer reference` in a disclosure labeled `Offer details`, collapsed by default.
5. Share action, if retained, in this section rather than beside the page heading.

Price-history loading: `Loading price history` in a reserved skeleton with `role="status"` and a visually hidden label. Empty: `Price history unavailable`; `Not enough historical checks are available to draw a chart.` Error: `Price history could not be loaded`; `The observed nightly rate and provider handoff are still available above.`

Offer-reference label/value: `Offer reference`; raw ID. Helper: `Use this reference if you contact expaify support.` Do not put currency, property name, location, or price basis here because they are already visible above.

## Whole-page and transition states

### Default

Render all five sections in the shared order. A search entrant arrives from `HotelCard` via **Review hotel**; a saved entrant arrives directly. Focus starts at the normal document position and is not programmatically moved after standard link navigation.

### Initial loading

Use a skeleton that preserves the final order and approximate heights:

1. back-link skeleton;
2. property/stay heading and three fact skeletons;
3. observed-rate and Deal Score skeletons;
4. two fit rows;
5. boundary text and one action skeleton;
6. supporting-evidence skeleton.

Do not place a hero-image skeleton before identity. One live announcement on initial load: `Loading hotel details`. Skeleton shapes are `aria-hidden="true"`; the status uses `role="status" aria-live="polite" aria-atomic="true"`. Respect `prefers-reduced-motion` by disabling the skeleton pulse animation.

### Empty / hotel not found

Use page title `Hotel details unavailable` and body `We could not find this hotel deal. It may have been removed or the link may be incomplete.`

- Search-source recovery: `Back to results`.
- Saved-source recovery: `Back to saved deals`.
- Unknown-source recovery: `Search hotels`.

Do not render empty versions of sections 1–5.

### Page-load error

Use `role="alert"` with title `Hotel details could not be loaded` and body `We could not load this hotel right now. Try again, or return to your previous hotel list.`

Actions, in order: `Try again`, then the source-correct back link. Retry keeps the user on the same URL, announces `Loading hotel details`, and replaces the alert only after a new request begins.

### Invalid/orphaned HotelCard review URL

Title: `Hotel review unavailable`.

Body: `This hotel link is incomplete, so expaify cannot show a trustworthy property and nightly rate.`

Action: `Back to results` when source continuity exists; otherwise `Search hotels`. Do not list internal required fields or say `verified provider` to the traveler.

### Property name missing

Property identity is a prerequisite. Do not substitute `Hotel` or `Unnamed property` and do not show a selected-hotel provider handoff.

Title: `Property details unavailable`.

Body: `The provider did not return a property name, so expaify cannot confirm which hotel this rate belongs to.`

Recovery follows the source-correct rule. This is a whole-page unavailable state.

### Price missing or invalid

Keep property/stay and fit evidence visible. In section 2 show:

- Label: `Observed nightly rate`.
- State: `Price unavailable`.
- Reason: `The provider did not return a valid nightly rate and currency.`
- Deal Score state: `Deal Score unavailable`; `A valid nightly rate is required for a price comparison.`

Section 4 becomes a blocked status, not a disabled pseudo-button:

- Title: `Room check unavailable`.
- Body: `A trustworthy nightly rate is required before expaify can send this hotel selection to a provider.`
- Recovery: search entrant `Back to results`; saved entrant `Search current deals`; direct entrant `Search hotels`.

### Provider link missing or invalid

Keep sections 1–3 and supporting evidence. Section 4:

- Title: `Provider link unavailable`.
- Body: `You can review this hotel here, but expaify does not have a valid provider link for room inspection.`
- Recovery: search entrant `Back to results`; saved entrant `Search current deals`; direct entrant `Search hotels`.

Do not render an anchor without a valid URL and do not use an inert link styled as enabled.

### Stale observed rate

Keep the observed amount and score visible with the stale freshness warning in section 2. Keep the room-inspection action available if money and link are valid. Do not say the rate or rooms are available. The single section-4 boundary remains unchanged.

### Expired saved deal

Keep sections 1–3 for reference. In section 2 show the expired copy. Replace section 4 entirely:

- Title: `Saved rate expired`.
- Body: `This observed nightly rate is no longer current. Search again before inspecting room options.`
- Action: `Search current deals` → `/deals` or the current-deal search destination supplied by the product.

Do not show old provider links and do not say the prior price is still available.

### Missing dates / partial stay

Use the exact missing labels in section 1. The observed amount must be called `Observed nightly rate`, never `Rate for your stay` or `Selected nightly rate`. Keep a valid room-inspection action, append the date-confirmation sentence to the boundary, and do not infer check-out from a default one-night stay.

### Missing/coarse location

Use the precision matrix in section 1. Keep a valid action. For missing location, append the location-confirmation sentence to the boundary. Never infer an exact address from city/area, coordinates, search destination, or provider host.

### Deal Score loading, unavailable, or failed

Keep its reserved position in section 2. A score state never moves the provider section. Loading and failure announcements must not steal focus. The outbound action remains available if property name, price, and link are valid.

### Fit evidence unavailable

Keep section 3 with explicit missing/error copy. The action remains available. Do not collapse the section away because its absence is itself decision information.

### Provider navigation failure/return

Normal browser/new-tab behavior owns outbound load failures. When the expaify tab becomes visible again, do not claim the provider failed or that booking was incomplete. Preserve page position and state. No modal, toast, or automatic redirect is specified.

## Responsive layout

### 375px

- Page: `mx-auto w-full max-w-[760px] px-4 py-5`.
- One column only. Sections use `space-y-4` and full available width.
- First viewport begins with back navigation, property/stay, then the start of price/value; no hero photo precedes them.
- Stay facts stack at 375px; they may move to three columns only at `min-[480px]`.
- Observed rate and Deal Score stack.
- Provider actions are one column and minimum 44px high.
- Long hotel/provider names use `break-words`; money uses `tabular-nums` and must not shrink below readable size.
- No sticky provider action. It must not obscure content or detach the action from its confirmation boundary.
- Supporting photo, when present, is `h-44 w-full object-cover`; it does not use meaningful alt text.

### 1280px

- Page content: `mx-auto w-full max-w-[1080px] px-6 py-8`.
- Sections 1–3 remain in DOM order in the primary column. Section 4 may appear in a right rail using a parent grid only after its DOM position is preserved; preferred implementation is a full-width sequential section to eliminate reading-order risk.
- If a right rail is used: `lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:gap-6`; do not use `order-*`; section 4 is not sticky in this repair.
- Price and Deal Score may use the specified two-column interior grid.
- Fit evidence may use two columns.
- Supporting evidence may use a photo/chart two-column grid, but remains after the provider section.

At both widths, test at 200% browser zoom and with long names/currencies. There must be no overlap, clipping, horizontal scroll, or action text truncation.

## Interaction rules

### HotelCard → review

- **Review hotel** remains a normal internal link.
- Enter/Space behavior follows native link semantics; do not add a key handler.
- Preserve the current result/search destination plus supported hotel decision context in the review URL or server-owned state.
- Do not open the expaify review in a new tab.

### Back action

- Pointer click or Enter returns to the source-correct destination.
- Preserve source list state when carried.
- Do not make a `<button>` call `history.back()` as the sole behavior because direct visits and expired history are unsafe.

### Supporting-evidence disclosure

- Use a native `<details>`/`<summary>` or a button with `aria-expanded` and `aria-controls`.
- Copy: collapsed `Show offer details`; expanded `Hide offer details`.
- Enter and Space toggle it. Opening it does not move focus. Content remains immediately after its control in DOM.

### Deal Score retry

- Render `Retry Deal Score` only if the UI owns a genuine retry callback.
- On activation set the score region to loading, announce `Checking recent price history`, and retain focus on the retry control or its stable replacement. Do not reload the whole page for a sectional failure.

### Provider action

- Enter activates the native anchor. It opens a new tab.
- Emit any authorized handoff event before navigation without delaying navigation.
- Never intercept the click to simulate availability, confirmation, or booking.

## Keyboard, focus, and assistive technology

Tab order follows DOM order:

1. global navigation controls;
2. source-correct back link;
3. any real retry control in Price and Deal Score;
4. provider room-inspection link(s);
5. supporting-evidence disclosure/share controls.

Static sections and cards are not tabbable. Do not add `tabIndex=0` to facts, warnings, or score panels. Multiple provider links follow their visible provider order.

Focus styling uses the global `:focus-visible` rule and `--focus-outline`/`--focus-ring`; do not remove outlines. All controls have at least 44×44px targets.

Reading/landmark order matches the shared semantic structure. Requirements:

- The hotel name is the sole `<h1>`.
- Section headings are `<h2>` and are not skipped.
- Use `<dl>/<dt>/<dd>` for stay and fit facts.
- Initial/section loading and non-blocking state updates use `role="status" aria-live="polite" aria-atomic="true"`.
- Page-load and retry failures use `role="alert"`; do not repeat the same failure in more than one live region.
- On an in-place page-load error, move focus to the alert heading with `tabIndex={-1}` after failure. On recovery, move focus to the page `<h1>` only when content replaced the error in place.
- Expired/stale labels are visible text and not color-only.
- Decorative arrows, stars, external-link icons, skeletons, and photos are hidden from assistive technology.
- Provider links' visible text remains sufficient without an icon; the accessible name adds the single boundary meaning once.

## UI implementation scope

The UI ticket may implement, without changing provider/business logic:

- Reorder saved-detail sections into the shared semantic hierarchy.
- Recompose `/book` hotel review with the same named sections using facts already present.
- Replace repeated provider caveats with the one boundary-action unit.
- Rename saved provider actions from booking language to room-inspection language.
- Move photo, chart, score detail, offer reference, and share into Supporting evidence.
- Remove duplicated `Why this is a deal` presentation.
- Implement visual/loading/empty/error/missing states supported by current props/data.
- Implement responsive, keyboard, focus, and assistive-technology behavior.
- Preserve existing component exports/props and all affiliate/sponsored link semantics.

The UI implementation must not invent fields to make the two entrants look complete. Where data is absent from the current contract, it renders the specified missing state.

## Later DEV continuity and instrumentation dependencies

These are required for full cross-entrant parity but are not authorization to change contracts in the UI ticket:

1. Extend an internal hotel-detail/review context so HotelCard → review can safely carry or resolve:
   - entry source and source-return URL/state;
   - check-in, check-out, and night count;
   - Deal Score/usual price/confidence or a stable server-side key for recomputation;
   - price checked timestamp/freshness state;
   - hotel class and guest-rating evidence;
   - validated affiliate provider URL(s).
2. Define equivalent normalized saved-deal fields, especially explicit location precision and quality evidence; do not infer them from city/stars.
3. Validate all serialized context server-side. Money remains `{ priceCents: number; currency: string }`; do not trust formatted strings or floats.
4. Preserve affiliate markers through any redirect/handoff adapter.
5. Implement the research event contract:
   - `hotel_detail_viewed`;
   - `hotel_decision_section_reached` after ≥50% visibility for ≥1 second;
   - `hotel_room_handoff_started` before outbound navigation;
   - `hotel_detail_back_to_results`.
6. Event properties: `hotel_id`, `entry_source`, `viewport_group`, `has_dates`, `has_verified_guest_rating`, `score_state`, `price_freshness_state`, named `section`, semantic `position`, and provider where appropriate. Exclude raw URLs and personal data.
7. Deduplicate section-reach events once per detail view. Do not treat outbound navigation as booking success.

The current `HotelCard` is not mounted by a live page in this worktree. Search-result parity and end-to-end measurement remain blocked until a separately authorized wiring ticket mounts the flow. This spec does not authorize that wiring.

## Acceptance criteria

1. Both entrants expose sections in the exact shared visual/DOM/heading order.
2. At 375px, property/stay and price/value precede any large photo; no overlap, clipping, horizontal scroll, or obscured focus occurs.
3. At 1280px, any multi-column presentation retains the same DOM and reading order.
4. The observed nightly rate, usual nightly rate, and provider-confirmed final total responsibility are distinguishable; no total is calculated or implied.
5. The full provider checklist appears visibly once, immediately paired with room-inspection action(s).
6. No visible or accessible action uses `Book`, `Reserve`, or availability-confirming language.
7. Missing dates, rating, score, freshness, and location occupy their expected positions with exact explicit copy; only missing property identity, invalid price/link, or expiry blocks/replaces the handoff as specified.
8. Expired saved deals show no old provider links; stale/unknown rates retain qualified room inspection when price/link are valid.
9. Search-result, saved-deal, and direct entrants receive source-correct back/recovery copy and destinations.
10. Keyboard, focus, live-region, heading, and assistive-reading order meet this spec.
11. Every outbound provider URL retains affiliate markers and `rel="noopener noreferrer sponsored"`.
12. No room inventory, occupancy, amenities, review content, cancellation value, live availability, or provider-confirmed total is added.

## Validation notes for TEST

Test the required state matrix at 375px and 1280px:

- search entrant vs saved entrant;
- complete vs partial/missing stay;
- fresh vs aging vs stale vs unknown vs expired rate;
- confident vs low-confidence vs loading vs unavailable/error Deal Score;
- exact vs coordinates vs area vs search-area vs missing location;
- verified vs provider-only vs inferred vs absent rating;
- valid vs invalid/missing price;
- one vs multiple vs missing provider links;
- default vs initial loading vs empty/not-found vs page error.

Verify with pointer, keyboard only, screen-reader landmarks/headings, 200% zoom, reduced motion, and long content. Search-result end-to-end parity cannot be marked tested while `HotelCard` remains unmounted; record that as a wiring dependency rather than fabricating a pass.

## Out of scope and known blockers

- Search-page mounting/wiring for `HotelCard`.
- Provider selection strategy or ranking among multiple links.
- New external provider calls or API fields.
- Room selection, booking, payment, occupancy, beds, amenities, review content, cancellation details, or total-price calculation.
- Deal Score computation changes.
- Production measurement conclusions; the specified funnel is not currently emitted.
- Full continuity in `/book` without the later DEV contract work listed above.

## Handoff

Create `UI-HOTEL-DETAIL-DECISION-ORDER-01` to implement the UI ordering and supported states in this spec without changing provider contracts or business logic. Any missing cross-page continuity or instrumentation must be handed from UI to a scoped DEV ticket rather than inferred in components.
