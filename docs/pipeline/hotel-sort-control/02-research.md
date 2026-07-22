# UX Research Brief — Hotel Result Sorting Control

**Ticket:** UXR-HOTEL-SORT-CONTROL-01  
**Stage:** UXR (UX Research)  
**Date:** 2026-07-22  
**Upstream:** `docs/pipeline/hotel-sort-control/01-discovery.md`

## 1. Research outcome

The smallest truthful MVP set is **Recently found**, **Biggest discount**, and **Lowest nightly price**.

- **Recently found** is the truthful replacement for **Newest** because the query orders by the time expaify first detected the row as a deal (`first_seen`), not by hotel age, stay date, or most recent price check.
- **Biggest discount** is supported by the stored integer `discount_pct` and is distinct from absolute price. Do not rename it **Best deal**, **Best value**, or **Recommended**: none of those claims follows from discount percentage alone.
- **Lowest nightly price** is supported by `deal_price_cents`, the same integer value rendered as the card's current `/ night` price. The option must retain the qualifier **nightly** and the nearby caveat **before taxes and fees**; it does not rank total-stay cost.
- **Quality** and **convenience** sorts are unsupported in the live deal feed. Stars are nullable hotel class, not guest satisfaction; the live row has no guest score, review count, amenities, coordinates, neighborhood, landmark, or distance.

The selected order must be visible to everyone, including non-Premium visitors. Changing it may remain Premium-gated as a commercial policy, but the current native-disabled implementation is not an adequate gate: it removes the options from keyboard focus, cannot emit a disabled-attempt event, and makes label comprehension inseparable from entitlement friction.

This is a source audit and comparative-pattern review, not a completed participant study. The recommended labels and gate behavior therefore have explicit validation tasks and pass criteria in §8; UXDES should not substitute untested synonyms.

## 2. Current-code evidence

All findings in this section come from the assigned worktree. `app/deals/DealFeed.tsx` and `app/components/ui/DealCard.tsx` are the live result surface; the unused `app/components/HotelCard.tsx` is not the target.

### 2.1 What the control currently communicates

- `DealFeed` initializes `sort` to `newest` and accepts only `newest | discount` (`app/deals/DealFeed.tsx:70`, `:231`, `:294`).
- The control has an accessible group name, **Sort deals**, but no visible **Sort by** label (`:563–588`). The active choice is communicated visually and with `aria-pressed`; it is not stated in the feed heading or a results summary.
- The labels are **Newest** and **Biggest discount**. “Newest” is semantically ambiguous because it can describe a hotel, a listing, a travel date, or a recently checked price.
- Both buttons use the native `disabled` attribute for non-Premium users (`:570–587`). Native-disabled buttons are skipped by the tab sequence and do not fire click handlers, so `hotel_sort_disabled_attempted` cannot be captured from either button.
- The entitlement explanation appears separately below the control only after loading: **“Filters and sorting are included with Premium.”** The text does not say which order is currently applied or what will happen if the user upgrades (`:591–601`).
- At 375px the content width is approximately 335px (`app/deals/page.tsx:86`). The present two-segment control can wrap only as a whole. Adding **Lowest nightly price** as a third padded segment would create horizontal overflow or an internally awkward multi-line label; a single active-order trigger is the smaller responsive pattern.

### 2.2 What each existing order actually does

`GET /api/deals` accepts a sort parameter only for Premium users. Every non-Premium request is forced to `newest` (`app/api/deals/route.ts:109–117`). `getActiveDeals` translates the values to:

| UI/API value | SQL order | Truthful meaning | Risk |
| --- | --- | --- | --- |
| `newest` | `first_seen DESC` | Deals most recently first detected by expaify | **Newest** does not name what is new. No final unique tie-breaker. |
| `discount` | `discount_pct DESC, first_seen DESC` | Largest percentage below that hotel's stored median | Percentage ties have no final unique tie-breaker. **Best deal** would overclaim. |

Evidence: `lib/pipeline/dealDetection.ts:213–239` and `:277–297`.

The card's freshness chip does **not** explain this order. It renders `updatedAt` as **“checked [time ago]”** (`app/components/ui/DealCard.tsx:49`, `:98–108`), while the sort uses `first_seen`. `updated_at` is changed both by deal refreshes and by generated-headline writes (`lib/pipeline/dealDetection.ts:98–107`; `lib/ai/generateHeadline.ts:162–167`). The API sends both timestamps, but the card does not render `firstSeen` (`app/deals/DealFeed.tsx:695–711`). Therefore **Recently checked** would also be false for today's order.

### 2.3 Lowest nightly price is implementable with current deal data

- `deal_price_cents` is a required integer on the `deals` table (`lib/db/schema.sql:125–147`) and `DealRow` (`lib/pipeline/dealDetection.ts:154–175`).
- The API returns it as `dealPriceCents`, and `DealCard` renders the same value as USD followed by **/ night** (`app/deals/DealFeed.tsx:695–703`; `app/components/ui/DealCard.tsx:133–146`).
- The existing **Max price** filter already applies `d.deal_price_cents <= …`, so the application already treats the field as the comparable current nightly rate (`lib/pipeline/dealDetection.ts:248–251`).
- The card itself does not state **before taxes and fees**; that caveat appears on detail (`app/deals/[dealId]/page.tsx:332`). A price-order label without this scope nearby risks being read as lowest payable total.

Required implementation semantics are `deal_price_cents ASC, first_seen DESC, id ASC`. The final unique key is necessary for deterministic offset pagination. This requires a small API/data-helper extension; it is not a new provider field.

### 2.4 Quality and convenience are not implementable honestly

The live `DealRow` has nullable `stars` and city only. It has no guest-review evidence or usable location evidence (`lib/pipeline/dealDetection.ts:154–175`). `lib/types.ts` defines richer `HotelRatingEvidence` and `HotelLocation` types for provider offers, but neither is persisted into or selected by the live deal query. This distinction matters: the existence of an unused shared type is not live ranking data.

| Proposed intent | Evidence users would reasonably expect | Live feed evidence | Decision |
| --- | --- | --- | --- |
| Best rated / quality | Comparable guest score, source, review count; possibly class and amenities | Nullable hotel-class stars only | **Omit.** Keep stars as a filter, explicitly called hotel class in future copy. |
| Closest / convenient | A user-selected reference point plus comparable coordinates/distance | City/market name only | **Omit.** A city is not a distance origin. |
| Recommended / best | A disclosed multi-factor rank with fit/quality/value inputs | No such model or explanation | **Omit.** Default is recency, not recommendation. |

### 2.5 Result feedback and analytics are currently insufficient

- A sort change resets offset and refetches rather than reordering loaded cards (`app/deals/DealFeed.tsx:287–321`). During that request the entire grid becomes skeletons; there is no persistent current-order summary or post-load status announcement tied to sort.
- The API's `total` is `source.length`, i.e. the current page length, not the total eligible result count (`app/api/deals/route.ts:136–160`). The client reads it but does not store it (`app/deals/DealFeed.tsx:264`). Instrumentation must call the current value `loaded_result_count`, not `result_count`, until a real count is returned.
- The server first paint requests 20 rows, while client refetches and pagination use 12 (`app/deals/page.tsx:46–55`; `app/deals/DealFeed.tsx:204`, `:246–269`). `hasMore` starts false when initial deals are supplied, so the initial 20-row feed does not auto-page until a refetch. A sort change also changes the visible batch from up to 20 to 12. This can confound card-depth comparisons.
- Existing tracked events cover filter removal and empty states only. There are no sort-viewed, sort-changed, disabled-attempted, or card-opened calls (`app/deals/DealFeed.tsx:339–347`, `:414–423`, `:680–714`).
- `lib/analytics.ts` only logs in development and has no production sink. The proposed measurement plan cannot produce production evidence until an analytics destination is wired.

## 3. Reference-pattern guidance (not current-code evidence)

### Google Hotels

Google exposes **lowest price** and **highest user rating** as separate sort intents, while separately offering map/location adjustment. Its result model includes the lowest bookable partner price, average user rating, amenities, and location information. The useful interaction rule is: **each order names one field the cards and underlying result contract can substantiate**. Expaify meets that bar for nightly price, but not for user rating or location. Google also distinguishes hotel class from user rating, reinforcing that expaify's star field should not become a quality sort. [Google Travel Help](https://support.google.com/travel/answer/6276008?hl=en-CA)

### Expedia and Booking.com

Expedia exposes focused alternatives such as lower price, higher guest-review score, distance to city center, and higher property class, but its accommodation rank is backed by location, prices, offers, review scores/counts, and other supply evidence. [Expedia — How our sort order works](https://www.expedia.com/lp/b/sort-order-info?currency=USD&langid=1033&siteid=4407)

Booking.com visibly names its default **Our top picks** and documents that this is a multi-factor recommendation. Its API supports price, review-score, star, and distance sorting, with distance requiring coordinates; its price example explicitly uses ascending order for most affordable first. The transferable rule is not to copy the menu: **name the active default and expose only orders whose required inputs exist**. [Booking.com — How we work](https://www.booking.com/content/how_we_work.en-gb.html), [Booking.com Demand API sorting guide](https://developers.booking.com/demand/docs/accommodations/filter-sorting)

### Premium-disabled accessibility

W3C's Authoring Practices note that native-disabled controls leave the tab sequence and can become undiscoverable to screen-reader users; `aria-disabled="true"` can keep a control focusable when discovering the unavailable function matters. Here discovery matters because sorting is an advertised Premium capability and the ticket explicitly needs a disabled-attempt signal. This supports a focusable, non-executing Premium explanation pattern rather than two inert native-disabled choices. [W3C — Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)

## 4. Exact gap

| Dimension | Current expaify behavior | Reference/interaction principle | Delta |
| --- | --- | --- | --- |
| Default visibility | Selected segment has color/`aria-pressed`; no visible **Sort by** | Name the current order where results begin | First-time users must infer what **Newest** means. |
| Recency semantics | **Newest** means `first_seen DESC`; card shows a different `updatedAt` freshness | Label the actual ranked field | Rename to **Recently found**; do not say **Recently checked**. |
| Price intent | Max-price filter and nightly card price exist; no ascending order | Lowest price is a distinct, direct intent | Add server-supported **Lowest nightly price** with scope caveat. |
| Value intent | **Biggest discount** is available | Relative savings should stay distinct from sticker price | Keep the label; never generalize to **Best**. |
| Quality/location | No guest score, reviews, coordinates, or distance | Only expose an order when its comparable evidence exists | Omit both; document data prerequisites. |
| Premium gate | Native-disabled options plus separate upsell copy | Current state remains understandable; unavailable action remains discoverable | Show current order to all; activation explains gate and is measurable. |
| Sort feedback | Whole-grid skeleton refetch; no result/order status | Confirm the applied order after results arrive | Add an order/result status; preserve the trigger during loading. |
| Pagination | Offset order lacks a unique tie-breaker; batch sizes differ | Stable order across pages and transitions | Add `id` tie-breaker and normalize measurement batch semantics. |

## 5. Segment and viewport implications

| Segment | Primary task | Expected order | Research guardrail |
| --- | --- | --- | --- |
| Budget-led leisure | Minimize current cash nightly rate | **Lowest nightly price** | Participant must understand this is not total stay or final checkout price. |
| Value-led deal hunter | Find the most exceptional reduction vs usual | **Biggest discount** | Participant must distinguish percent reduction from cheapest rate. |
| Fit-led trip planner | Balance quality/location with price | None beyond the three supported intents | Requests for reviews, amenities, neighborhood, or distance are evidence to omit unsupported sorts, not permission to use stars as a proxy. |
| First-time visitor | Understand what appears first | **Recently found** default | Must identify the active order without opening the menu or scanning cards. |
| Returning Premium member | Switch intent quickly and verify results changed | Any of the three | Preserve selection and focus through refetch; do not make repeat users re-infer state. |

At **375px**, use one full-width or content-width trigger whose text includes the active value, e.g. **Sort by: Recently found**; options may open in a compact menu/sheet. Do not add a third segmented button. At **1280px**, keep the same information model and place it immediately above the grid; a wider viewport is not a reason to add unsupported options.

## 6. Design directives for UXDES (specific and testable)

### D1 — Replace the segmented control with one visibly labelled, active-order control

The closed state must literally communicate **Sort by: [active value]** before interaction. It must expose exactly these values and no others:

1. **Recently found** — default; means `first_seen DESC`.
2. **Biggest discount** — means `discount_pct DESC`.
3. **Lowest nightly price** — means `deal_price_cents ASC`.

At 375px the trigger and all option text must fit without horizontal page scroll or truncated meaning. At 1280px it stays adjacent to the results grid, not mixed into filter pills. The selected option must be programmatically determinable; keyboard Enter/Space opens or selects, Escape closes and returns focus.

### D2 — State the scope of each ranking and never overclaim

- Use **Recently found**, never **Newest**, **Latest**, or **Recently checked**.
- Keep **Biggest discount**, never **Best deal**, **Best value**, or **Recommended**.
- Use **Lowest nightly price**, never **Cheapest**, **Lowest price**, or **Lowest total** without qualification.
- Place **Nightly prices before taxes and fees** in the sort/results context whenever **Lowest nightly price** is active; do not rely on detail-page copy.
- Do not include rating, quality, popularity, location, closest, or convenience orders until the live deal row has the evidence defined in §2.4.

Pass condition: after sorting, the first unlocked card is consistent with the selected primary key, and its visible card evidence allows the user to explain why it is first.

### D3 — Make Premium entitlement understandable and measurable without hiding the current order

All users must see the active order. For non-Premium users, opening/activating an unavailable alternative must not change results or send a sort parameter as though it succeeded. It must expose a focusable explanation adjacent to the action: **Sorting options are included with Premium. Your results are currently sorted by Recently found.** Provide one CTA, **See Premium**, to `/join`.

Do not use native `disabled` on every discoverable sort option if disabled-attempt measurement remains a requirement. Use an `aria-disabled`/guarded activation pattern or a focusable locked trigger that announces the entitlement, prevents the refetch, and emits `hotel_sort_disabled_attempted`. UXDES must specify focus return after dismissing the explanation.

This directive does not decide whether sorting should be free; it repairs comprehension and accessibility under the existing gate. Any ungating decision requires product/monetization evidence.

### D4 — Preserve state during refetch and confirm the applied order

On a Premium member's sort change, keep the labelled trigger visible with the newly selected value, set the results region busy, and replace/refresh cards without visually reverting the control. On success, expose a polite status in the form **Sorted by [value] · [N] deals loaded**. On error, keep the prior successfully applied order selected and say **Couldn't apply that sort. Try again.** Retry must request the failed target order once.

The implementation must add deterministic orders:

- Recently found: `first_seen DESC, id ASC`
- Biggest discount: `discount_pct DESC, first_seen DESC, id ASC`
- Lowest nightly price: `deal_price_cents ASC, first_seen DESC, id ASC`

Do not announce API `total` as the full result total until the API returns a real eligible count. Normalize the initial/refetch page-size behavior before evaluating card depth.

### D5 — Instrument the decision path, not hotel identity

Implement the four events below. Never send hotel names, provider URLs, or free-text search content.

| Event | When | Required properties |
| --- | --- | --- |
| `hotel_sort_control_viewed` | Once when a non-loading real-results control enters the viewport | `current_sort`, `premium_eligible`, `loaded_result_count`, `viewport_band`, serialized filter flags/values |
| `hotel_sort_changed` | After the requested sorted response succeeds and is rendered | `sort_from`, `sort_to`, `sort_transition`, `premium_eligible`, `loaded_result_count`, `viewport_band`, serialized filter flags/values, `request_ms` |
| `hotel_sort_disabled_attempted` | Non-Premium user activates a locked alternative | `sort_from`, `sort_to`, `sort_transition`, `premium_eligible=false`, `loaded_result_count`, `viewport_band`, serialized filter flags/values |
| `hotel_result_card_opened` | User opens an unlocked real deal detail | `current_sort`, `previous_sort`, `sort_transition`, `premium_eligible`, `loaded_result_count`, `viewport_band`, serialized filter flags/values, `card_position` (1-based) |

Use bounded values: `viewport_band = mobile_375 | desktop_1280 | other`; `current_sort/sort_to = recently_found | biggest_discount | lowest_nightly_price`. Track `loaded_result_count` honestly until a full count exists. Locked-card or Premium CTA interactions are not `hotel_result_card_opened`.

## 7. Premium gate evaluation

The current gate cannot answer whether sorting is a compelling Premium benefit because participants cannot try the result transformation, keyboard users may not discover the options, and native-disabled controls cannot record attempts. Evaluate label comprehension and willingness to upgrade separately:

1. **Comprehension prototype (Premium enabled):** every participant completes all three intent tasks. This tests labels and resulting order without gate interference.
2. **Gate prototype (non-Premium):** show the same active-order trigger with locked alternatives. Compare the current inert-disabled treatment against D3's focusable explanation. Measure discovery, correct statement of current order, disabled attempt, CTA intent, and perceived brokenness.
3. **Decision rule:** retain the gate only if at least 80% can identify the current order, at least 80% understand that alternatives require Premium, and fewer than 10% describe the control as broken. This is a usability threshold, not a subscription-conversion forecast.

The default orientation label is not itself a Premium benefit; it is necessary to interpret the feed. Do not hide it. Whether one direct sort (especially lowest nightly price) should be free is a product packaging experiment outside this UXR ticket.

## 8. Lean validation plan

### Participants and setup

Recruit 10 participants: two budget-led leisure, two value-led deal hunters, two fit-led trip planners, two first-time visitors, and two returning Premium members. Ensure at least five complete the prototype at 375px and five at 1280px; each viewport group must contain both first-time and returning users. Use at least 8 realistic results with deliberately non-correlated price and discount ranks, and a price spread of at least 15%.

### Tasks and pass criteria

| Task | Primary segment | Pass criterion |
| --- | --- | --- |
| “Which deal did expaify find most recently?” | First-time | Finds **Recently found** and explains that it is discovery recency, not hotel age or latest check; ≥8/10 correct. |
| “Find the lowest current nightly rate.” | Budget-led | Chooses **Lowest nightly price**, does not call it total stay/final checkout, and opens a rank-1 or tied card; ≥8/10 correct. |
| “Find the largest reduction from what this hotel usually costs.” | Value-led | Chooses **Biggest discount** and distinguishes it from lowest rate; ≥8/10 correct. |
| “Sort by best quality / closest to the place you need to visit.” | Fit-led | Recognizes the control cannot do this; probes identify expected rating/location evidence. No participant should infer that stars equal guest rating. |
| Non-Premium sort attempt | First-time/free | Identifies current order, Premium requirement, and next action without calling the control broken; thresholds in §7. |

Use teach-back before selection (“What do you expect the first card to be?”) and after results render (“Why is this first?”). Record menu discovery time, wrong-sort selections, cards scanned, first opened position, and whether the participant notices the before-fees scope.

### Price-sort behavioral hypothesis

For sessions with at least 6 eligible results and at least 15% price spread:

- Compare **Lowest nightly price** sessions with the same participants' **Recently found** baseline.
- Success signal: median `card_position` at first meaningful detail open is at least 25% lower after the price sort.
- Non-inferiority guardrail: the proportion of sessions with a meaningful detail open must not fall by more than 5 percentage points, and provider-handoff rate must be reviewed where available.
- “Meaningful detail” should be operationalized as detail opened plus either 10 seconds of detail dwell, price-evidence interaction, or outbound-provider click. A raw card click alone is insufficient.
- Segment by viewport, Premium eligibility, filters, loaded-result count, and price spread. Do not compare the 20-card initial batch against a 12-card sorted batch.

## 9. Blockers and out-of-scope findings

- **Measurement blocker:** `lib/analytics.ts` has no production analytics sink. Event calls alone will not validate the hypotheses outside development. Wiring a sanctioned destination is a separate DEV/analytics dependency.
- **Direct implementation dependency:** **Lowest nightly price** requires extending the `newest | discount` unions in the client, route, and `getActiveDeals`, plus deterministic SQL tie-breakers. This is within the expected downstream implementation scope and does not require provider work.
- **Out of scope but measurement-relevant:** initial results use a 20-row server batch while sorted/refetched results use 12, and initial `hasMore` remains false. Normalize or explicitly control this before interpreting card-depth data.
- **Out of scope trust issue:** the card's **checked** timestamp uses `updated_at`, which can also change during headline generation. This research does not repair freshness provenance, but UXDES must not use that timestamp to explain **Recently found**.
- **No contract conflict found:** all recommended sort keys use existing integer price/discount/timestamp fields. No vendor call, new provider field, secret, affiliate behavior, or money-shape change is proposed.

## Sources

- [Google Travel Help — Search for hotels on Google](https://support.google.com/travel/answer/6276008?hl=en-CA)
- [Expedia — How our sort order works](https://www.expedia.com/lp/b/sort-order-info?currency=USD&langid=1033&siteid=4407)
- [Booking.com — How we work](https://www.booking.com/content/how_we_work.en-gb.html)
- [Booking.com Demand API — Filtering and sorting accommodation results](https://developers.booking.com/demand/docs/accommodations/filter-sorting)
- [W3C WAI-ARIA Authoring Practices — Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
