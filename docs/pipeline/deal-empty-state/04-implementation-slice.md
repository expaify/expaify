# 04 — Implementation Slice: Deal Empty State & Freshness Signals

**Ticket:** UI-DEAL-EMPTY-STATE-01 / REPAIR-GEMINI-DEAL-EMPTY-STATE-SLICE-01
**Stage:** Implementation / Codex Handoff
**Upstream:** `docs/pipeline/deal-empty-state/03-design.md`

---

## 1. Impossible or Ambiguous Requirements & Mitigations

During discovery and research, three key constraints and gaps were identified. This plan mitigates them as follows:

1. **Anonymous City Alerts (No Backend Support):** `AlertSignup` and `/api/alerts` require 3-letter airport IATA codes (e.g., MIA, LHR) and reject city names. Thus, anonymous city-scoped email alerts cannot be implemented without schema/backend changes. 
   * *Mitigation:* Explicitly route anonymous and free-tier users to `/join` with a marketing/upsell copy framing, and only enable one-tap watchlist watch for authenticated Premium users.
2. **Hidden Count (`unfilteredTotal`):** The current `/api/deals` endpoint only returns the count of items in the current page, making a Kayak-style hidden count calculation impossible client-side.
   * *Mitigation:* The "hidden count" in the filtered empty state is **conditional**. It will render only if the API response includes a valid `unfilteredTotal` (number type), making it fully opt-in and non-blocking.
3. **Consolidation of Types:** `ApiDeal` and `toApiDeal` are triplicated in the codebase. To remain within the ticket's strict boundaries and avoid breaking other flows, we will edit all three copies independently rather than introducing wide-scale consolidation.

---

## 2. Work Split: UI-only vs. Backend/API

### Backend & API Work
- **D1 (Data):** Add `updatedAt` to `ApiDeal` types and map `row.updated_at` in the three `toApiDeal` routines (locked and unlocked paths). Fix `firstSeen` from `string` to `string | null`.
- **D5 (Cold Fallback):** Refactor the cold fallback in `/deals` and `/api/deals` to yield **3 samples instead of 5**, with all `locked: false`. Ensure mocks undergo a proper snake-to-camel mapping in `/api/deals` to avoid client-side field drift (e.g. `hotel_name` -> `hotelName`).

### UI-only Work
- **D1 (Card):** Replace `firstSeen` "found X ago" on `DealCard` with `updatedAt` "checked X ago" using a shared `timeAgo` helper. Omit the pill entirely if `updatedAt` is null (e.g., sample cards).
- **D2 (Detail Page):** Replace the 6h stale logic with three thresholds: fresh (<30h), aging (30-48h, inline warning), and stale (>=48h, absolute-date banner). Move "Price checked" line up to the price block and update the hero pill.
- **D3 (Filtered-Empty):** Build the filtered-empty state block in `DealFeed` with removable chips and a 1-tap "Clear all filters" button. Remove the 30% ghost skeleton cards. Focus the grid container post-reset.
- **D4 (City Page):** Adjust the `/destinations/[city]` meta line if 0 deals. Create the `WatchCityCta` client component for premium watch/free alerts/anonymous join CTAs. Integrate it into the city empty card.
- **D5 (Cold DB UX):** Detect cold-DB mocks. Render the honest "We're building your feed" block above 3 sample cards. Strip outbound links and hover shadow from sample cards, adding an "Example" badge.

---

## 3. Incremental Codex Implementation Sequence

### Slice 1: Shared Infrastructure & Analytics
Add the core helper modules to ensure unified time logic and event tracking.

* **Files to Edit/Create:**
  * `lib/timeAgo.ts` (Create)
  * `lib/analytics.ts` (Create)
* **Action Items:**
  1. Implement `timeAgo(iso: string | null | undefined): string | null` in `lib/timeAgo.ts`. Ensure it handles all cases: `null`/`undefined`/invalid -> `null`; offset <= 0 or < 2 min -> `"just now"`; < 60 min -> `"{m}m ago"`; < 24 h -> `"{h}h ago"`; 24-47 h -> `"yesterday"`; else `"{d}d ago"`.
  2. Implement a no-op `track(event: string, props?: Record<string, string | number | boolean>): void` in `lib/analytics.ts` that outputs to `console.debug` in development.

### Slice 2: Expose `updatedAt` on API and Types
Expose `updatedAt` from DB rows to both locked and unlocked API endpoints.

* **Files to Edit:**
  1. `app/api/deals/route.ts`
  2. `app/deals/DealFeed.tsx`
  3. `app/deals/page.tsx`
  4. `app/destinations/[city]/page.tsx`
* **Action Items:**
  1. Add `updatedAt: string | null` to the `ApiDeal` type declarations in `app/api/deals/route.ts` and `app/deals/DealFeed.tsx`. Change `firstSeen` type from `string` to `string | null` in `app/api/deals/route.ts`.
  2. Update `toApiDeal` mapper in `app/api/deals/route.ts` to populate `updatedAt: row.updated_at` on both locked and unlocked branches.
  3. Update `toApiDeal` mapper in `app/deals/page.tsx` to populate `updatedAt: row.updated_at`.
  4. Update `toApiDeal` mapper in `app/destinations/[city]/page.tsx` to populate `updatedAt: row.updated_at`.

### Slice 3: Card Price-Recency (D1)
Upgrade `DealCard` to show when prices were last checked instead of age.

* **Files to Edit:**
  * `app/components/ui/DealCard.tsx`
* **Action Items:**
  1. Add `updatedAt?: string | null` to `DealCardDeal` interface.
  2. Replace local `timeAgo` helper with the shared one from `lib/timeAgo.ts`.
  3. Replace the top-right card image corner pill. If `timeAgo(updatedAt)` is not null, render `"checked {checked}"` with the full ISO date as the `title` attribute. If null, render **nothing** (do not display any timestamp).
  4. Delete the `"Preview deal"` caption block (`DealCard.tsx:159-161`).

### Slice 4: Detail Page Freshness Tiers (D2)
Replace the 6h threshold with actual 24h-pipeline-calibrated tiers.

* **Files to Edit:**
  * `app/deals/[dealId]/page.tsx`
* **Action Items:**
  1. Delete local duplicate `timeAgo`. Import the shared `timeAgo` helper.
  2. Replace the 6h stale check (`app/deals/[dealId]/page.tsx:220–222`) with three tiers relative to `deal.updated_at`:
     - **Fresh (<30h):** Render quiet `"Price checked {timeAgo}"` in the price section (after the savings line). No banner.
     - **Aging (30-48h):** Render semibold warning-colored `"Price checked {timeAgo} — verify with the provider"`. No banner.
     - **Stale (>=48h):** Render a top-of-page warning-themed banner containing the absolute formatted date: *"Price may be out of date. We haven't been able to re-verify this price since {date}. Check the provider for the current price and availability."*
  3. Remove the buried "Updated {date}" line from the "Why this is a deal" section (`page.tsx:382-385`).
  4. Ensure the hero "found" pill is omitted if `first_seen` is null.
  5. Fire `deal_stale_banner_viewed` if the stale banner mounts.

### Slice 5: Filtered-Empty State (D3)
Provide a keyboard-accessible, 1-tap reset state for active filters.

* **Files to Edit:**
  * `app/deals/DealFeed.tsx`
* **Action Items:**
  1. Replace the filtered-empty UI inside `DealFeed.tsx` (when `hasActiveFilters` is true and `deals.length === 0`).
  2. Completely remove the 30% opacity skeleton cards behind the empty state.
  3. Build a structured block (`role="status"`) displaying:
     - Headline: *"No deals match your filters"*
     - Conditional hidden count (if `unfilteredTotal` is defined and > 0): *"{n} deals are hidden by your filters"*
     - Removable inline filter chips for active filters (e.g., city, minDiscount, ratings, price limit). Clicking a chip removes that individual filter.
     - Primary button: *"Clear all filters"* (min-h-44px). Triggers a full reset of all active filters in one operation (except city on city-scoped pages, which resets to `defaultCity`).
  4. Implement post-reset focus redirection: move focus back to the results grid wrapper using a ref and `tabIndex={-1}`.
  5. Track events: `feed_empty_filtered_viewed`, `feed_clear_all_clicked`, `feed_filter_chip_removed`.

### Slice 6: Cold-DB Samples and Fallback (D5)
Avoid presenting fabricated inventory at full weight, demoting mocks to samples.

* **Files to Edit:**
  * `app/deals/page.tsx` (server pre-fetch fallback)
  * `app/api/deals/route.ts` (API mock branch)
  * `app/deals/DealFeed.tsx` (conditional layout)
  * `app/components/ui/DealCard.tsx` (mock-specific visual styling)
* **Action Items:**
  1. Update `app/deals/page.tsx` and `app/api/deals/route.ts` mock generators to return **3 mock deals** (instead of 5). Set all to `locked: false`. Ensure `updatedAt` and `firstSeen` are explicitly `null` on mocks, and map mock objects properly into full camelCase `ApiDeal` shapes in `route.ts`.
  2. In `DealFeed.tsx`, detect if `deals.every(d => d.isMock)`. If true, render the cold-DB state:
     - Honest message first: *"We're building your feed. Our tracker sweeps hotel prices across 20 destinations once a day. Real deals appear here after the next sweep — check back soon."*
     - Followed by divider and a clearly marked section: *"Example deals — Here's what expaify surfaces once tracking completes. These use sample hotels and prices — they're not bookable."*
  3. In `DealCard.tsx`, if `isMock` is true:
     - Render an *"Example"* badge in the top-right corner.
     - Hide the outbound `CompareRow` and show *"Sample hotel — not bookable"* instead.
     - Prevent hover lift/shadow CSS styles.
     - Skip the time pill and trust line.
  4. Track events: `feed_empty_cold_viewed`.

### Slice 7: City Page Zero-Deals & Watch CTA (D4)
Ensure a coherent zero-deal story on `/destinations/[city]` with actionable CTAs.

* **Files to Edit/Create:**
  * `app/destinations/[city]/page.tsx`
  * `app/components/WatchCityCta.tsx` (Create)
* **Action Items:**
  1. Edit header count line in `/destinations/[city]/page.tsx`: if `n === 0`, render *"Checked daily — no active deals right now"*. Ensure the phrase *"0 deals found"* never appears.
  2. Create a Client Component `WatchCityCta` supporting the following tiers determined server-side:
     - **Premium (not watching):** Render a *"Watch {city}"* button. On click, disable and show saving spinner, `PATCH /api/account/watchlist` with the city added, and transition to: *"Watching {city} — new deals will be in your daily digest."* (along with a *"Manage watchlist"* link).
     - **Premium (watching):** Immediately display the watch confirmation text and *"Manage watchlist"* link.
     - **Free (authed, not premium):** Render Premium upsell card: *"Premium members get an email the moment a {city} deal appears."* and CTA button: *"Get {city} alerts with Premium"* -> `/join`.
     - **Anonymous:** Render CTA: *"Want an email when a {city} deal appears?"* and button: *"Get {city} deal alerts"* -> `/join`.
  3. Integrate `WatchCityCta` into the empty destination card. Replace "See all destinations" button with a simple text link when a capture CTA button is displayed.
  4. Track events: `city_empty_viewed`, `city_watch_clicked`, `city_watch_saved`, `city_watch_failed`, `city_join_cta_clicked`.

---

## 4. Final Copy Requirements (Source of Truth)

All user-facing copy strings must be preserved exactly as specified below:

| ID | Surface / Position | Exact String |
|---|---|---|
| **C1** | `DealCard` corner pill | `checked just now` / `checked {m}m ago` / `checked {h}h ago` / `checked yesterday` / `checked {d}d ago` |
| **C2** | Detail freshness (fresh) | `Price checked {timeAgo}` |
| **C3** | Detail freshness (aging) | `Price checked {timeAgo} — verify with the provider` |
| **C4** | Detail stale banner title | `Price may be out of date` |
| **C5** | Detail stale banner body | `We haven't been able to re-verify this price since {Mon D, YYYY, HH:MM}. Check the provider for the current price and availability.` |
| **C6** | Detail hero pill | `found {timeAgo}` (only when `first_seen` is non-null) |
| **C7** | Filtered-empty headline | `No deals match your filters` |
| **C8** | Filtered-empty hidden-count | `{n} deals are hidden by your filters` (`1 deal is hidden by your filters`) |
| **C9** | Filtered-empty body | `Remove a filter, or clear them all to see everything that's live.` |
| **C10**| Filtered-empty primary CTA | `Clear all filters` |
| **C11**| Filtered-empty secondary CTA | `See all destinations` |
| **C12**| Chip removable label | `Remove filter: {label}` |
| **C13**| Cold-empty headline | `We're building your feed.` |
| **C14**| Cold-empty body | `Our tracker sweeps hotel prices across 20 destinations once a day. Real deals appear here after the next sweep — check back soon.` |
| **C15**| Sample section title | `Example deals` |
| **C16**| Sample section subtitle | `Here's what expaify surfaces once tracking completes. These use sample hotels and prices — they're not bookable.` |
| **C17**| Sample card badge | `Example` |
| **C18**| Sample card mock line | `Sample hotel — not bookable` |
| **C19**| City meta (deals > 0) | `Updated daily · {n} deal{s} found` |
| **C20**| City meta (deals === 0) | `Checked daily — no active deals right now` |
| **C21**| City empty headline | `No {city} deals right now.` |
| **C22**| City empty body | `We check {city} hotel prices every day — deals appear here the moment a price drops.` |
| **C23**| Watch watchlist button | `Watch {city}` (saving states: `Saving…`) |
| **C24**| Watch watchlist confirmation | `Watching {city} — new deals will be in your daily digest.` |
| **C25**| Already watching state | `You're watching {city} — you'll get an email when a deal appears.` |
| **C26**| Watchlist link | `Manage watchlist` |
| **C27**| Watch save error message | `Couldn't save — check your connection and try again.` |
| **C28**| Watch 10-city cap message | `Your watchlist is full (10 cities). Manage it in your account.` |
| **C29**| Free capture prompt | `Premium members get an email the moment a {city} deal appears.` |
| **C30**| Free capture CTA | `Get {city} alerts with Premium` |
| **C31**| Anonymous capture prompt | `Want an email when a {city} deal appears?` |
| **C32**| Anonymous capture CTA | `Get {city} deal alerts` |
| **C33**| City empty secondary CTA | `See all destinations` |

---

## 5. Acceptance Tests (Step-by-Step Verification)

Each verification step must pass before declaring the ticket resolved:

### 1. Relative Time & Null-Safety Tests (`lib/timeAgo.ts`)
- **Action:** Execute the unit tests for `timeAgo`.
- **Criteria:**
  - Passing `null`, `undefined`, or unparseable input returns `null`.
  - Future dates or offsets < 2 min return `"just now"`.
  - Values < 60 min return `"{m}m ago"`, < 24 h return `"{h}h ago"`, 24–47 h return `"yesterday"`, and larger offsets return `"{d}d ago"`.

### 2. Deal Card Freshness Pill Rendering
- **Action:** Mock a search API response with:
  - Deal A: `updatedAt` = 3 hours ago.
  - Deal B: `updatedAt` = `null`.
- **Criteria:**
  - Deal A card renders a top-right corner pill saying `"checked 3h ago"`.
  - Deal B card does not render any time pill or text at all. No `"Preview deal"` or `"found today"` is printed anywhere.

### 3. Price Freshness Tiers on Detail Page
- **Action:** Access a deal detail page `/deals/[dealId]`.
- **Criteria:**
  - If `updatedAt` is 15 hours old, verify no banner is shown, and the text *"Price checked 15h ago"* appears in the Price block.
  - If `updatedAt` is 36 hours old, verify no banner is shown, and the yellow/warning-colored text *"Price checked 36h ago — verify with the provider"* appears in the Price block.
  - If `updatedAt` is 52 hours old, verify the stale warning banner appears at the top of the main container displaying the formatted absolute check date.
  - Verify the original "Updated {date}" line in the footer has been removed.

### 4. Filtered-Empty Reset and Skeletons Removal
- **Action:** Input filters that yield 0 results on the feed.
- **Criteria:**
  - No skeleton loaders or cards are displayed.
  - The structured `"No deals match your filters"` block mounts.
  - Removable chips for active filters render.
  - Activating *"Clear all filters"* resets all active parameters and immediately restores the results grid. Focus is moved automatically onto the results grid.

### 5. Cold Fallback Sample Demotion
- **Action:** Simulate a database with zero deals (cold-DB).
- **Criteria:**
  - The page displays the honest builder block (*"We're building your feed..."*).
  - Below it, the section *"Example deals"* renders exactly 3 mock cards.
  - Each card has an `"Example"` badge, does not show outbound OTA `CompareRow` links, lacks hover/scale classes, displays *"Sample hotel — not bookable"*, and has no time pill.

### 6. City Zero-Deals Header Meta and Watch CTAs
- **Action:** Navigate to `/destinations/miami` when miami has 0 deals.
- **Criteria:**
  - Header meta prints: *"Checked daily — no active deals right now"*. (Assert that `"0 deals found"` is absent).
  - Verify CTA matching the user tier:
    - **Premium:** Clicking *"Watch Miami"* transitions to *"Watching Miami — new deals..."* and updates the watchlist via PATCH.
    - **Free:** Displays *"Get Miami alerts with Premium"*.
    - **Anonymous:** Displays *"Get Miami deal alerts"*.
