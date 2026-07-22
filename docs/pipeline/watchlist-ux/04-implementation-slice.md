# Watchlist UX Implementation Slice Specification

**Feature ID:** UI-WATCHLIST-UX-01 / DEV-WATCHLIST-UX-01 · **Stage:** IMPLEMENTATION  
**Feature Slug:** `watchlist-ux`  
**Upstream Docs:** `01-discovery.md`, `02-research.md`, `03-design.md`  

---

## 1. Overview & Smallets Safe Codex Implementation Sequence

This document defines the exact implementation plan for the watchlist UX slice. It divides the tasks into **Backend/API/Email-Route Work** and **UI-Only Work**. Each phase is ordered to minimize risk, avoid breakage of existing flows, and provide a clear sequence for an automated agent (Codex) to follow.

### Implementation Sequence Overview:
1. **[Backend] Consolidate City Lists & Adopt Dead Routes:** Adapt `/api/account/watchlist` and `/api/account/alerts` to support incremental updates. Eliminate duplicate hardcoded city arrays.
2. **[Backend] Token-Based Email Landing Routing:** Implement GET and POST at `/alerts/manage` (handled inside `app/alerts/manage/route.ts`) and enhance the unsubscribe route (`app/api/alerts/unsubscribe/route.ts`) with a recovery block.
3. **[UI] Account Panel Rework:** Implement per-action instant saving in `/account#alerts`, removing the batch save mechanism entirely.
4. **[UI] Component Creation (`WatchCityPill`):** Develop the optimistic, premium-only watchlist pill.
5. **[UI] Integration & Nav Header Update:** Place the pill on destination/deal detail pages, and add the account avatar to the `/deals/[dealId]` header.
6. **[Email Template] Link Injection:** Enhance the `DealAlert.tsx` email template footer and the alert sender to pass granular links.

---

## 2. Split: Backend/API/Email-Route Work vs. UI-Only Work

### 2.1 Backend / API / Email-Route Work

#### Step B1: Adopt and Refactor `PATCH /api/account/watchlist`
*   **File:** `app/api/account/watchlist/route.ts`
*   **Action:** 
    *   Delete the local `CITIES` array. Import `TRACKED_MARKET_NAMES` from `@/lib/trackedMarkets`.
    *   Support two payloads:
        1. Bulk replace (for back-compat): `{ watchlist: string[] }`
        2. Atomic update (for the Watch pill): `{ op: 'add' | 'remove', city: string }`
    *   Validate that any city added/passed is in `TRACKED_MARKET_NAMES`.
    *   If `op === 'add'`:
        *   Fetch current subscription. If the current watchlist length is `>= 10`, return `NextResponse.json({ error: 'watchlist_full' }, { status: 400 })`.
        *   Append the city if not already present, ensuring maximum limit of 10.
    *   If `op === 'remove'`:
        *   Remove the city from the array.
    *   Update DB using `subscriptions SET watchlist = ... WHERE user_id = ...`.
    *   Return `{ ok: true, watchlist }` with HTTP 200. Enforce Auth + Premium (`isPremium(sub.status)`) with HTTP 401/403.

#### Step B2: Adopt and Refactor `PATCH /api/account/alerts`
*   **File:** `app/api/account/alerts/route.ts`
*   **Action:**
    *   Support single-field partial updates. Ensure it validates and patches `alertPreference` (values: `'instant' | 'daily' | 'off'`) and `alertMinDiscount` (values: `30 | 40 | 50`).
    *   Use `upsertSubscription(session.user.id, { ... })` from `@/lib/subscription`.
    *   Enforce Auth + Premium. Return `{ ok: true }` on success.

#### Step B3: Create the Token-Based Action Handler `/alerts/manage`
*   **File:** `app/alerts/manage/route.ts` (New file)
*   **Action:**
    *   Create a Next.js dynamic Route Handler. Define `GET` and `POST` methods.
    *   **`GET` (No Mutation, Renders HTML):**
        *   Extract `token` (36-character UUID), `action` (`stop-city` or `daily`), and optional `city` (URL slug) from search parameters.
        *   Validate `token` matches `/^[0-9a-fA-F-]{36}$/` and resolves to a subscription row (via querying the DB: `SELECT user_id, watchlist, alert_preference FROM subscriptions WHERE alert_unsubscribe_token = $1 LIMIT 1`). Return HTTP 400/404 with the **Invalid link** HTML if invalid.
        *   If `action === 'daily'`:
            *   Check `alert_preference`. If not `'daily'`, render the **Confirm Daily** HTML. If already `'daily'`, render the **Already daily** HTML.
        *   If `action === 'stop-city'`:
            *   Validate `city` slug maps to a displayName via `CITY_SLUGS` from `@/lib/cities`.
            *   If city display name is in the user's `watchlist`:
                *   If `watchlist.length >= 2`, render the **Confirm stop-city** HTML.
                *   If `watchlist.length === 1`, render the **Confirm — last city** HTML.
            *   If city display name is not in the watchlist, render the **Not watching** HTML.
    *   **`POST` (Mutates DB, Renders HTML):**
        *   Read token, action, and city slug from the submitted form body (urlencoded).
        *   Verify the token. If invalid, return **Invalid link** HTML.
        *   If `action === 'daily'`:
            *   Update subscription setting `alert_preference = 'daily'` and render **Success daily** HTML.
        *   If `action === 'stop-city'`:
            *   Check current watchlist. If city display name is in watchlist:
                *   If `watchlist.length >= 2`: Remove city from watchlist, keep current `alert_preference`, and update DB. Render **Success stop-city** HTML.
                *   If `watchlist.length === 1`: Remove city from watchlist, set `alert_preference = 'off'`, and update DB. Render **Success — alerts off** HTML.
            *   If city is not in watchlist, skip mutation and render **Not watching** HTML.

#### Step B4: Refactor Unsubscribe Landing Page
*   **File:** `app/api/alerts/unsubscribe/route.ts`
*   **Action:**
    *   Modify the `html(message: string, status = 200, recoveryBlock = false, token = '')` function to optionally append the HTML recovery block inside the card under the body content:
        ```html
        <div style="border-top: 1px solid #E8E2D8; margin-top: 16px; padding-top: 16px;">
          <p style="font-size:14px; color:#5C5852; margin-bottom: 8px;">Too much email, but don’t want to miss a real deal?</p>
          <div style="line-height: 2;">
            <a href="/alerts/manage?token=${token}&action=daily" style="color:#0E5A54; font-weight:600; text-decoration:underline;">Get one daily email instead</a><br>
            <a href="https://expaify.com/account#alerts" style="color:#0E5A54; font-weight:600; text-decoration:underline;">Manage alert settings</a>
          </div>
        </div>
        ```
    *   On successful unsubscribe (GET), return `html(..., 200, true, token)`.
    *   Update error messages (400 and 404 branches) to include real hyperlinks instead of bare prose:
        *   400: `This unsubscribe link is invalid. You can still manage alerts from your <a href="https://expaify.com/account#alerts" style="color:#0E5A54; font-weight:600;">account settings</a>.`
        *   404: `This unsubscribe link has expired or was already removed. You can still manage alerts from your <a href="https://expaify.com/account#alerts" style="color:#0E5A54; font-weight:600;">account settings</a>.`

#### Step B5: Update Email Delivery Logic to Pass URLs
*   **File:** `lib/email/sendDealAlert.ts`
*   **Action:**
    *   Import `CITY_DISPLAY_TO_SLUG` from `@/lib/cities`.
    *   In `sendInstantAlerts`, calculate:
        *   `switchDailyUrl`: `${BASE_URL}/alerts/manage?token=${recipient.unsubscribeToken}&action=daily`
        *   `stopCityUrl`: If `recipient` has a non-empty watchlist, set to `${BASE_URL}/alerts/manage?token=${recipient.unsubscribeToken}&action=stop-city&city=${CITY_DISPLAY_TO_SLUG[deal.city] ?? ''}`. If the watchlist is empty, set to `null` to indicate "everywhere" mode.
    *   Pass `switchDailyUrl` and `stopCityUrl` to the `DealAlert` component call.

---

### 2.2 UI-Only Work

#### Step U1: Rework `/account` Page & AccountClient Settings
*   **Files:** 
    *   `app/account/page.tsx`
    *   `app/account/AccountClient.tsx`
*   **Actions:**
    *   **In `app/account/page.tsx`:**
        *   Locate the Alerts section wrapper (rendered around `AccountClient`).
        *   Add `id="alerts"` and `className="scroll-mt-20"` to the container.
        *   Modify the intro header paragraph string to say exactly: `Choose how often we email you when a deal appears. Changes save instantly.`
    *   **In `app/account/AccountClient.tsx`:**
        *   Remove the single `Save preferences` button, its 2s flash state, and the bulk form `savePreferences` submission callback.
        *   Convert the radio groups for **Frequency** and **Minimum deal size** to fire updates immediately upon clicking/changing selection. Group updates call `PATCH /api/account/alerts` with the chosen value.
        *   Convert the **City Pills** to fire atomic updates instantly. Toggle clicks must invoke `PATCH /api/account/watchlist` with `{ op: 'add' | 'remove', city }`.
        *   Add group-level inline status tags (`Saving...`, `Saved` [disappears after 2s], `Couldn't save. Your change was undone — try again.`, or `You’re watching 10 cities — the maximum. Unwatch one first.` for city pills).
        *   Update the local state immediately on click (optimistic update). If the call fails, revert the state and display the group's error message.
        *   Do not lock/disable other toggles while one saving operation is in flight. Handle multiple consecutive quick clicks using an `AbortController` (aborting the previous patch of the same group).
        *   At `10/10` count, ensure unselected city pills are not fully `disabled` (which blocks focus), but instead get `aria-disabled="true"` + `opacity-40` styling. A click on an `aria-disabled` pill must display the at-cap error.

#### Step U2: Eliminate Hardcoded City Array Duplication
*   **File:** `app/deals/DealFeed.tsx`
*   **Action:**
    *   Delete the hardcoded `CITIES` string array (lines 11-15).
    *   Import `TRACKED_MARKET_NAMES` from `@/lib/trackedMarkets` and use it as the replacement data source for rendering city options in the filter dropdown.

#### Step U3: Implement `WatchCityPill` Component
*   **File:** `app/components/ui/WatchCityPill.tsx` (New file)
*   **Action:**
    *   Write a client component accepting: `city: string`, `initialWatching: boolean`, `initialCount: number`.
    *   If user session is missing or user is not active premium (`isPremium`), render nothing.
    *   Maintain local state: `watching` (boolean), `count` (number), `saving` (boolean), and `errorMessage` (string | null).
    *   Implement an interactive `<button type="button" aria-pressed={watching}>`:
        *   Not Watching state: `.btn-pill` base, hover state, SVG plus icon, text label: `Watch {city}`.
        *   Watching state: `.btn-pill.active` classes, SVG checkmark icon, text label: `Watching {city}`.
        *   Pending state: Swaps the icon for a loading spinner (`<span class="spinner" aria-hidden />`) and sets `aria-busy="true"`.
        *   Cap limit (not watching and `count >= 10`): renders default visual with `opacity-60` and `aria-disabled="true"`. Clicking it doesn't fire the API, but renders the at-cap helper text.
    *   Status Text Area (rendered below/adjacent to the pill with reserved height to avoid layout shift):
        *   Include a `aria-live="polite"` div.
        *   Error: `Couldn’t update your watchlist. Try again.`
        *   At-cap error: `You’re watching 10 cities — the maximum. Manage watchlist` (where “Manage watchlist” is a `<a>` styled link pointing to `/account#alerts`).
        *   Just-removed last city: `You’re not watching any specific cities — alerts now cover every destination.` (clears after 6 seconds).

#### Step U4: Integrate `WatchCityPill` on Destination Page
*   **File:** `app/destinations/[city]/page.tsx`
*   **Action:**
    *   Derive the subscription using `auth()` + `getSubscription()`.
    *   Insert the `<WatchCityPill>` element directly under the `<h1>` heading but above the "Updated daily" meta row. Ensure it is rendered in its own row, left-aligned.
    *   Ensure the pill is still visible on empty-state pages (when no deals are currently active for the destination).

#### Step U5: Integrate `WatchCityPill` and Nav Header on Deal Page
*   **File:** `app/deals/[dealId]/page.tsx`
*   **Action:**
    *   **Pill Integration:**
        *   Fetch subscription on the server, determine `initialWatching` (i.e. if `deal.city` is in the user's watchlist) and `initialCount`.
        *   Inject `<WatchCityPill>` directly below the title block (after the H2 + ShareButton row) and above the Price section.
    *   **Nav Header Update:**
        *   Update the top nav section (lines 234-243) right-aligned actions group to contain both the `← Back to deals` link and a new `<a>` hyperlink pointing to `/account#alerts`.
        *   Use the exact SVG person avatar icon used in `LandingNav.tsx` (line 46) for visual consistency. Ensure a 44px hit-box target for mobile compatibility.

#### Step U6: Enhance `DealAlert` Email Template Footer
*   **File:** `lib/email/templates/DealAlert.tsx`
*   **Action:**
    *   Add `stopCityUrl: string | null` and `switchDailyUrl: string` to props.
    *   Directly above the main compliance line, render:
        `Getting too many emails? {Stop alerts for {city}} · {Switch to daily digest}` (using styled `<a href="...">` elements).
    *   If `stopCityUrl` is `null` (watchlist empty / "everywhere" mode), omit the "Stop alerts" link and render only the daily digest link: `Getting too many emails? Switch to daily digest`.

---

## 3. List of Exact Files to Edit and Create

| File Path | Change Type | Purpose |
|---|---|---|
| **`app/api/account/watchlist/route.ts`** | Modify | Adopt route; support bulk/atomic updates; validate via `TRACKED_MARKET_NAMES`. |
| **`app/api/account/alerts/route.ts`** | Modify | Adopt route; support partial edits for alert preferences/discounts. |
| **`app/alerts/manage/route.ts`** | **CREATE NEW** | Token-authenticated landing route. Renders GET forms & performs POST updates. |
| **`app/api/alerts/unsubscribe/route.ts`** | Modify | Add recovery footer block to successful unsubscribes; turn text into live links on errors. |
| **`lib/email/sendDealAlert.ts`** | Modify | Calculate tokenized `switchDailyUrl` and `stopCityUrl` links and forward to email template. |
| **`app/account/page.tsx`** | Modify | Add `id="alerts"` anchor, `scroll-mt-20` offset, and update header intro string. |
| **`app/account/AccountClient.tsx`** | Modify | Remove batch "Save" button. Wire toggles to immediate updates. Add status tags & at-cap limits. |
| **`app/deals/DealFeed.tsx`** | Modify | Import `TRACKED_MARKET_NAMES` to eliminate duplicate hardcoded `CITIES` array. |
| **`app/components/ui/WatchCityPill.tsx`** | **CREATE NEW** | Optimistic watch status toggler component for premium sessions. |
| **`app/destinations/[city]/page.tsx`** | Modify | Insert `WatchCityPill` under heading. |
| **`app/deals/[dealId]/page.tsx`** | Modify | Insert `WatchCityPill` under heading; inject account icon/avatar link to the top header nav. |
| **`lib/email/templates/DealAlert.tsx`** | Modify | Receive urls; conditionally render granular alert management footer options. |

---

## 4. Acceptance Tests

### Test 1: Route Integration and Validation
*   **Method:** Execute cURL or local fetch commands.
*   **Expected Behavior:**
    *   `PATCH /api/account/watchlist` with `{ op: 'add', city: 'Miami' }` returns `200 { ok: true, watchlist: [...] }`.
    *   Attempting to add an invalid city (e.g. `'InvalidCity'`) returns `400 { error: 'Invalid city' }` or similar rejection.
    *   Attempting to add when watchlist length is already 10 returns `400 { error: 'watchlist_full' }`.
    *   `PATCH /api/account/alerts` with `{ alertPreference: 'daily' }` returns `200 { ok: true }`.

### Test 2: In-Context Surface Toggle (Watch Pill)
*   **Method:** Browser interaction as a premium member.
*   **Expected Behavior:**
    *   Navigate to `/destinations/cancun`.
    *   Verify the "Watch Cancún" pill is visible.
    *   Click "Watch Cancún" -> pill flips instantly to "Watching Cancún ✓" with a spinner in-flight, saving persists successfully.
    *   Reload `/account#alerts` and verify Cancún is checked.
    *   Uncheck Cancún on `/account` -> navigate back to `/destinations/cancun` -> pill correctly reflects "Watch Cancún" state.

### Test 3: Account Panel Instant-Save UX
*   **Method:** Browser interaction inside `/account#alerts`.
*   **Expected Behavior:**
    *   Toggling any city pill immediately shows a fleeting `Saving...` followed by `Saved` indicator below the group.
    *   Reloading the browser page preserves all selected options without having to click any central batch "Save" button.
    *   With 10/10 cities selected, other city pills become faded (`opacity-40`) and focusable. Clicking one does not change state, but displays the at-cap error.

### Test 4: Email Footer Granularity & Landing Recoverability
*   **Method:** Local rendering or direct GET/POST hit against `/alerts/manage`.
*   **Expected Behavior:**
    *   Hit `/alerts/manage?token={token}&action=daily` (where token is active UUID):
        *   Renders a Georgia-styled page: `Switch to one daily email?` and a prominent `Switch to daily digest` button.
        *   Submit the form (POST) -> displays `You’re on the daily digest` and a link back to `/account#alerts`. Verify the subscription's `alert_preference` in the DB is now `daily`.
    *   Hit `/alerts/manage?token={token}&action=stop-city&city=cancun` with watchlist `['Cancún', 'Miami']`:
        *   Renders confirmation heading `Stop alerts for Cancún?`.
        *   Submit form -> removes Cancún from watchlist, keeps preference `instant`.
    *   Hit `/alerts/manage?token={token}&action=stop-city&city=cancun` with watchlist `['Cancún']` (last city):
        *   Renders confirmation heading `Cancún is your only watched city`.
        *   Warning text warns: `Stopping it turns off deal alerts entirely...`.
        *   Submit form -> removes Cancún from watchlist, updates `alert_preference = 'off'`.
    *   Navigate to `/api/alerts/unsubscribe?token={token}`:
        *   Renders "Deal alerts are off" page, with a recovery section containing a functional hyperlink to `/alerts/manage?token={token}&action=daily`.

---

## 5. Ambiguities & Safe Resolutions

1.  **Duplicate City Mappings & Slugs:** URL parameters use slugs (e.g., `cancun`, `punta-cana`), while DB watchlist entries use Display Names (e.g., `'Cancún'`, `'Punta Cana'`).
    *   *Safe Resolution:* Utilize `CITY_SLUGS` and `CITY_DISPLAY_TO_SLUG` from `@/lib/cities` inside `app/alerts/manage/route.ts` to translate slugs received in query parameters into proper Display Names before performing array membership logic.
2.  **State Reversions on Interrupted Saves:** If a user rapidly double-clicks a toggle button, the API responses may arrive out-of-order.
    *   *Safe Resolution:* Implement a standard `AbortController` or ignore older pending API promises inside the component click handler. If an operation fails, revert the state to the last successfully confirmed server state, rather than simply flipping the boolean.
3.  **GET prefetching vulnerability on Email Links:** GET requests can be triggered by email security scanners, pre-mutating user choices.
    *   *Safe Resolution:* Confirm GET requests do **not** perform DB updates under `/alerts/manage`. Form submissions (POST) must be used to execute mutations, ensuring security scrapers do not alter preferences.

---

## 6. Copy Requirements Preservation

### 6.1 Interactive Watch Pill (In-App)
*   **Error:** `Couldn’t update your watchlist. Try again.`
*   **At-cap:** `You’re watching 10 cities — the maximum. Manage watchlist`
*   **Last city removed:** `You’re not watching any specific cities — alerts now cover every destination.`

### 6.2 Account Panel Settings
*   **Header text:** `Choose how often we email you when a deal appears. Changes save instantly.`
*   **In-flight tag:** `Saving…`
*   **Saved tag:** `Saved`
*   **Error tag:** `Couldn’t save. Your change was undone — try again.`
*   **At-cap tag:** `You’re watching 10 cities — the maximum. Unwatch one first.`

### 6.3 Standalone Email Landing Page (`/alerts/manage`)
*   **Daily Confirm:** `Switch to one daily email?` / `Instead of an email per deal, you’ll get a single morning digest with the best new deals for your cities.`
*   **Daily Success:** `You’re on the daily digest` / `One email each morning with the best new deals — no more instant alerts.`
*   **Stop City Confirm:** `Stop alerts for {City}?` / `You’ll stop getting deal alerts for {City}. Alerts for your other watched cities keep coming.`
*   **Stop City Last-City Confirm:** `{City} is your only watched city` / `Stopping it turns off deal alerts entirely, since you’re not watching any other cities.`
*   **Stop City Success:** `Done — no more {City} alerts` / `You’ll keep getting alerts for your other watched cities. Changed your mind? You can re-add {City} anytime.`
*   **Stop City Success (Alerts Off):** `Deal alerts are off` / `We removed {City} and turned off deal alerts. Transactional account and billing emails may still be sent.`
*   **Invalid Link Error:** `This link isn’t working` / `It may have expired or been copied incompletely. You can still manage alerts from your <a href="https://expaify.com/account#alerts">account settings</a>.`
*   **Server Error:** `Something went wrong` / `Your alert settings were not changed. Please try the link again in a minute, or use your <a href="https://expaify.com/account#alerts">account settings</a>.`

### 6.4 Unsubscribe Recovery Block
*   **Recovery prompt:** `Too much email, but don’t want to miss a real deal?`
*   **Recovery links:** `Get one daily email instead` and `Manage alert settings`.
