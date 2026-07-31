# UX Research Brief — Hotel Result Sorting and Ranking Clarity

**Ticket:** UXR-HOTEL-SORT-RANKING-01
**Stage:** UXR (UX Research)
**Date:** 2026-07-31
**Upstream:** `docs/pipeline/hotel-sort-ranking/01-discovery.md`
**Surface:** `app/deals/DealFeed.tsx`, `app/components/ui/DealCard.tsx`, `app/components/ui/LockedDealCard.tsx`
**Related, not repeated:** `docs/pipeline/hotel-sort-control/02-research.md` (which options exist). This brief is about
whether the order in front of the user is **predictable and verifiable**.

---

## 1. Research outcome

The feed states its order in five places and confirms it in none. Every card that could carry the sorted-on
attribute either shows a *different* timestamp (`updated_at`, rendered as "Price checked 3h ago") or a
*hardcoded* one ("Deal found today" on every locked card, regardless of `first_seen`). The sort key
`first_seen` is passed all the way to `DealCard` and then dropped — `DealCardDeal.firstSeen` is declared at
`app/components/ui/DealCard.tsx:31` and referenced nowhere in the render body.

This is worse than the discovery report assumed, because of a paywall interaction discovery did not model:
on the free tier the *top* of the newest-first list is dominated by locked cards, and each locked card
asserts "Deal found today" as static copy. The one visible statement about detection recency on the free-tier
feed is the same on card 1 and card 20, and is not read from data at all.

The fix is therefore **not** copy alone. It is three coordinated moves:

1. **Make the sort key visible on the card face** — render the existing, already-transmitted `firstSeen` as a
   distinct "Found" line, separate from the "Price checked" line, so the default order can be checked against
   the cards. The data is already in `ApiDeal` for both locked and unlocked rows.
2. **Repair the locked card's false freshness badge**, which is the only ranking evidence most free users see.
3. **State the basis, not just the name, in one persistent place adjacent to the first result** — and use one
   term for the default everywhere instead of the current three.

Two things stay out: no rating or distance sort (no such data — §5), and no relitigation of the Premium gate
itself.

This is a source audit plus comparative-pattern review. It is not a completed participant study. §8 gives the
validation tasks and pass criteria; UXDES must not treat the copy below as already validated.

---

## 2. Current-code evidence

All line references are from this worktree.

### 2.1 What the default order actually is

```
newest:   d.first_seen DESC, d.id ASC
discount: d.discount_pct DESC, d.first_seen DESC, d.id ASC
price:    d.deal_price_cents ASC, d.first_seen DESC, d.id ASC
```
`lib/pipeline/dealDetection.ts:239-242`. Nothing about price, discount, or quality participates in `newest`.
`first_seen` is selected (`:289`) and returned by the API as `firstSeen` for both locked and unlocked rows
(`app/api/deals/route.ts:54`, `:75`).

Non-Premium requests are forced to `newest` server-side: `const sort: HotelDealSort = pwCtx.premium ? requestedView.sort : 'newest'`
(`app/api/deals/route.ts:132`). Free users are permanently on the default and cannot test their reading of it
by switching.

### 2.2 The card contradicts the order it is sorted by

`DealCard` computes `const checked = deal.isMock ? null : timeAgo(deal.updatedAt)` (`:63`) and renders
**"Price checked {checked}"** (`:108-115`), with the absolute timestamp only in a `title` tooltip (`:110`,
`:47-58`). `firstSeen` is accepted as a prop (`:31`) and never rendered.

`updated_at` is not a proxy for `first_seen`. It is written by expiry sweeps
(`lib/pipeline/dealDetection.ts:134`, `:143`) and by AI headline generation
(`lib/ai/generateHeadline.ts:162`, `:167`), neither of which relates to when the deal was found. So a deal found
four days ago whose headline was regenerated an hour ago displays a *fresher* line than the newer deal ranked
above it. A user verifying the default order from the card faces will correctly conclude the list disobeys its
own label — while the list is in fact correct on `first_seen`. **H2 is confirmed at the code level.**

`timeAgo` (`lib/timeAgo.ts`) is also too coarse to verify ordering: it collapses to `just now`, `Nm ago`,
`Nh ago`, `yesterday`, `Nd ago`. Several adjacent cards will read "2d ago", so even a corrected "Found" line
gives ordinal confirmation only at day granularity. This is acceptable for *comprehension* but must not be sold
as proof of exact ordering.

### 2.3 The free tier sees a fabricated freshness claim (new finding)

`LockedDealCard` renders a static badge, `Deal found today`, as a literal string
(`app/components/ui/LockedDealCard.tsx:28-30`). It takes no timestamp prop at all. `DealFeed` renders it for
every locked deal (`app/deals/DealFeed.tsx:1894-1902`).

How many cards is that? `getFreeUnlockedDealIds()` returns at most `FREE_WEEKLY_LIMIT = 3` ids
(`lib/paywall.ts:12`, `:42-54`), so on a 12-deal first page a free user sees up to **9 locked cards** and at
most 3 readable ones. And the unlock ordering is not newest-first:

```sql
ORDER BY (first_seen >= date_trunc('week', NOW())) ASC,
         CASE WHEN first_seen >= date_trunc('week', NOW()) THEN first_seen END ASC,
         first_seen DESC
```
`lib/paywall.ts:47-51` — deals *older* than the current week sort first into the unlock set. So the three
cards a free user can actually read skew **old**, while the feed itself is sorted **newest-first**. The
unlocked cards therefore tend to sit low in the list, and positions 1–3 tend to be locked cards all stamped
"Deal found today".

Net effect for the largest affected segment: the only ranking evidence at the top of the list is a constant
string that cannot vary with position, and the readable cards that do carry a timestamp carry the *wrong* one.
The list cannot be verified as newest-first by any visible means. This also independently supports **H5**: the
free-tier trust problem is not only the gate.

### 2.4 The order's meaning is stated where it is least legible

| Where | String | Problem |
| --- | --- | --- |
| Trigger, always visible | `Sort by: Recently found` (`DealFeed.tsx:1676`) | Names the order, does not define it |
| Status line, always visible | `Sorted by Recently found · N deals loaded` (`:1746`) | Restates the label; sits in a `role="status"` `aria-live` region that is `sm:text-right` and `sm:pt-6` (`:1735`) — announcement furniture, not primary explanation |
| Menu option description | `Deals expaify detected most recently` (`:61`) | The only real definition, visible only while the menu is open (`:1717`) |
| Free-tier status sentence | `…newest first` (`:104`) | Third term for the same order |
| Filter explainer | `sorted by Recently found` (`:1623`) | — |
| Premium explainer | `currently sorted by Recently found` (`:1761`) | — |

Three names for one order — "Recently found", "newest first", and (in the menu only) "detected most recently".
None of the always-visible strings says *newest what*.

Scope caveats are asymmetric: only `price` earns one — `Nightly prices before taxes and fees`
(`:1747`). `discount` (drop vs. the stored 60-day median) and `newest` get none, so the two orders whose basis
is least guessable are the two with no stated basis.

### 2.5 The grid works against ordinal reading

The results grid is `grid-cols-1 min-[680px]:grid-cols-2 min-[1024px]:grid-cols-3` inside a `max-w-[1140px]`
main (`DealFeed.tsx:1182`, `app/deals/page.tsx:162`). At 1280px, "rank 1" is the top-left cell of a
three-across grid with no rank markers, no rank-ordered vertical spine, and no visual distinction from cells 2
and 3. A three-across card grid reads as a *set of options*, not a *ranked list* — which makes an unexplained
position-1 card read as an editorial "best pick". At 375px the single column at least preserves ordinal
reading. **This makes H1 more likely on desktop than on mobile**, the opposite of the usual assumption, and
segments 1 and 2 in §7 should be compared directly on it.

### 2.6 What already works and must not regress

- Sort control is a labeled `aria-haspopup="menu"` trigger with `role="menu"` / `menuitemradio` options, roving
  arrow-key focus, Home/End, Escape-with-focus-return (`DealFeed.tsx:1283-1339`).
- Locked options use `aria-disabled`, never the native `disabled` attribute, so they stay focusable and can
  emit `hotel_sort_disabled_attempted` (`:1699`, `:1303-1317`).
- Pending sort shows skeleton cards, not a spinner, and returns focus to the trigger (`:1063`, `:1801-1804`).
- Failed sort has a real recovery path stating the still-applied order (`:1767-1773`).
- `hotel_sort_control_viewed`, `hotel_sort_changed`, `hotel_sort_disabled_attempted`, and
  `hotel_result_card_opened` all emit with bucketed, non-identifying payloads (`:1249-1276`, `:1346-1356`,
  `:1416-1446`).

Everything in §6 must preserve all of the above.

---

## 3. Reference patterns

Compared at the level of interaction pattern, not visual style.

**Booking.com — search results.** The active order is named on a persistent trigger ("Sort by: Our top picks"),
and the *basis* of the default is available adjacent to the results rather than only inside the menu. The
operative property: **whatever the list is sorted by is legible on every card**. Under price order the nightly
price is the dominant card element; under review-score order the score block is; under distance the
distance-to-centre string is. The user can spot-check the order without opening anything. Booking also refuses
to let the default read as "cheapest": the default is explicitly named as a curated pick, not a price rank.

**Google Hotels — result list.** Same property, two additions worth stealing. First, the sort control names the
order *and* the list carries a one-line basis statement near the top of the results. Second, when a result's
position is driven by something non-obvious, the card carries the justification inline rather than deferring it
to a tooltip. Google also uses a single-column ranked list for ranked results, keeping ordinal position
unambiguous.

**The delta, stated exactly:**

| | Reference pattern | expaify today | Delta |
| --- | --- | --- | --- |
| Order named persistently | Yes | Yes (`Sort by: …`, status line) | **None** — already shipped |
| Order's *basis* stated persistently, near the first result | Yes | No — only inside the open menu, right-aligned status line otherwise | **Gap A** |
| Sorted-on attribute visible on every card | Yes | No — card shows `updated_at`; `firstSeen` is a dead prop | **Gap B (primary)** |
| Card evidence cannot contradict the stated order | Yes | No — "Price checked" is non-monotonic under `newest`; "Deal found today" is hardcoded | **Gap C (trust-critical)** |
| Default never implies price/quality rank | Yes | Copy is neutral, but the 3-across grid and unexplained position 1 imply it | **Gap D** |
| One term per order across all surfaces | Yes | Three terms for the default | **Gap E** |

Gap B is the root cause. Closing A and E without B leaves a stated order the user can still disprove from the
card face — which constraint 4 of the discovery correctly calls worse than saying nothing.

---

## 4. Hypothesis verdicts

| ID | Verdict from this audit | What still needs participants |
| --- | --- | --- |
| **H1** default misread | **Plausible, not provable from code.** §2.5 raises desktop risk specifically. | Task 1, §8 |
| **H2** invisible-key contradiction | **Confirmed at code level.** `updated_at` ≠ `first_seen`, and `updated_at` is written by headline generation and expiry sweeps. Contradiction is guaranteed for some card pairs, not merely possible. | Only the *magnitude* of trust loss — Task 2 |
| **H3** name + basis beats name alone | **Untested.** No basis clause is persistently visible today, so there is no baseline. | Task 3 |
| **H4** three intents are the ceiling | **Confirmed on the data side** (§5). Acceptance of the absence is untested. | Task 4 |
| **H5** honest default raises free-tier trust | **Strengthened.** §2.3 shows the free tier is not just gated, it is shown a fabricated recency claim on most cards. | Task 2 (free-tier arm) |
| **H6** position anchoring | **Unmeasurable as scoped.** Free users cannot switch sort, so cross-sort position comparison is Premium-only. `card_position` is `index + 1` over the whole `deals` array (`DealFeed.tsx:1907`), which on the free tier counts locked cards the user cannot open. | Premium-only cohort; see §7 |

---

## 5. What cannot be built (data check, re-verified)

The live deal query selects `id, hotel_id, hotel_name, stars, photo_url, city, deal_price_cents,
median_price_cents, discount_pct, check_in_window, check_in_date, nights, snapshot_count, ota_links, headline,
description, is_mock, first_seen, expires_at, updated_at` (`lib/pipeline/dealDetection.ts:283-291`).

No guest rating. No review count. No coordinates. No distance. `stars` is nullable provider hotel class and is
already surfaced as `★★★☆☆` next to the city (`DealCard.tsx:78`) — it may be labeled *hotel class* and nothing
else. A "Best rated", "Top reviewed", or "Closest to centre" order would be a fabricated ranking. If product
wants one, it is a data-layer discovery ticket first.

Rankable today, and only these: `first_seen`, `discount_pct`, `deal_price_cents` — exactly the three shipped
options. **H4's data half holds.**

---

## 6. Design directives

Five directives. Each is testable and each names the file it lands in. All are UI-layer; none changes a
provider call, the money shape, the deal contract, or the `/api/deals` request/response.

### D1 — Render the sort key on the card face (closes Gap B)

`app/components/ui/DealCard.tsx` must render `deal.firstSeen` as a line distinct from the existing price-check
line. Both lines appear; neither replaces the other (they answer different questions and instrumentation
question 6 is answered "yes, both, without displacement").

- Found line: `Found {timeAgo(deal.firstSeen)}` — e.g. "Found 2d ago". Placed **above** the price-check line so
  it sits with identity/recency rather than with price provenance.
- Price-check line keeps its current copy and `title` absolute-timestamp tooltip: `Price checked {timeAgo(deal.updatedAt)}`.
- Both suppressed when `deal.isMock` (sample cards have `firstSeen: null`, `updatedAt: null` —
  `app/api/deals/route.ts:99-100`).
- If `firstSeen` is null on a non-mock deal, omit the Found line entirely. Never substitute `updatedAt`.
- The Found line must carry an absolute `title` timestamp, matching `absoluteCheckedAt` (`DealCard.tsx:47-58`),
  because `timeAgo` is day-coarse.

**Pass test:** with the default sort applied, the sequence of `Found` values down the visible list is
non-increasing at day granularity. Ties are allowed and expected; inversions are not.

### D2 — Replace the locked card's hardcoded recency badge (closes Gap C on the free tier)

`app/components/ui/LockedDealCard.tsx:28-30` currently renders the literal string `Deal found today` for every
locked deal. This is the single most-shown ranking claim on the free feed (up to 9 of 12 cards, §2.3) and it is
not read from data.

- `LockedDealCard` takes a new optional `firstSeen?: string` prop; `DealFeed` passes `deal.firstSeen ?? undefined`
  at `app/deals/DealFeed.tsx:1894-1902` (and at the two inert/loading duplicates, `:1794-1798` and `:1811-1815`).
- Badge copy becomes `Found {timeAgo(firstSeen)}` — identical wording to D1, so locked and unlocked cards are
  comparable in the same list.
- If `firstSeen` is absent, render **no badge**. Do not fall back to "today".
- Everything else about the locked card — blur, Members pill, "Unlock with Premium" CTA, `joinHref` — is
  unchanged. This is not a gate change.

**Pass test:** no locked card in a feed can display a recency string that differs from its row's `first_seen`,
and two locked cards with different `first_seen` values never display the same string unless they genuinely fall
in the same `timeAgo` bucket.

### D3 — One persistent basis clause per order, adjacent to the first result (closes Gaps A and E)

Move the definition out of the closed menu. The always-visible status block (`DealFeed.tsx:1735-1750`) gains a
basis clause for **all three** orders, not just `price`, and one term is used for the default everywhere.

Final copy, no placeholders:

| Sort | Persistent line 1 (existing) | Persistent line 2 (basis — new/extended) |
| --- | --- | --- |
| `newest` | `Sorted by Recently found · N deals loaded` | `Newest expaify finds first — not cheapest, not biggest discount.` |
| `discount` | `Sorted by Biggest discount · N deals loaded` | `Largest drop from each hotel's usual nightly price over 60 days.` |
| `price` | `Sorted by Lowest nightly price · N deals loaded` | `Nightly prices before taxes and fees.` (unchanged) |

Placement constraint: at 375px this block is a full-width row above the grid; two lines is the ceiling
(discovery constraint 2). At ≥640px it currently sits `sm:text-right sm:pt-6`. The basis clause must read as
explanation, not as an announcement fragment — UXDES decides whether the basis clause moves out of the
`role="status"` region into a static sibling. **Whatever is decided, the `aria-live` region must keep announcing
sort changes exactly as it does now.** Announcing the static basis clause on every re-render would be a
regression.

Term unification — "Recently found" replaces every variant of the default's name:

- `FREE_TIER_STATUS_SENTENCE` (`:104`): `Showing every expaify deal at 20% or more off, sorted by Recently found — newest expaify finds first. Filters and sorting are included with Premium.`
- Filter explainer (`:1623`): keep `sorted by Recently found`, append `— newest expaify finds first.`
- Premium explainer (`:1761`): keep `currently sorted by Recently found`, append `— newest expaify finds first, not cheapest.`
- Menu option description (`:61`) becomes `Newest expaify finds first — not cheapest` so the menu and the
  persistent line agree word-for-word.

**Pass test:** grep the repo for `newest first`, `Newest`, and `detected most recently` as customer-visible
strings on this surface; zero remain. Every visible mention of the default is "Recently found" plus the same
basis clause.

### D4 — Do not let position 1 read as an editorial pick (closes Gap D)

No new control, no new component, no "recommended" framing. Two constraints for UXDES:

- The default order's basis clause must contain an explicit negative ("not cheapest"). A positive-only
  statement leaves the price-led reading intact — this is the specific claim H3 tests.
- Position 1 must gain **no** visual emphasis (no larger cell, no badge, no border, no "Top deal" chip) unless
  and until a ranking exists that justifies it. The three-across desktop grid (§2.5) already invites the
  editorial reading; adding emphasis would confirm a claim the data does not support.

**Pass test:** at 1280px, card 1 is visually indistinguishable from cards 2 and 3 apart from its content.

### D5 — Close the two instrumentation blind spots

Both are additive `track()` calls using the existing `sharedSortAnalytics()` payload
(`DealFeed.tsx:1270-1277`); no new identifying fields.

- `hotel_sort_menu_dismissed` — fires in `closeSortMenu()` (`:1293`) and on outside-pointer dismissal
  (`:1383-1396`) when no option was activated. Payload: `current_sort`, `dismiss_method` (`escape` | `trigger` |
  `outside` | `tab`), plus `sharedSortAnalytics()`. This separates "opened, read, rejected the taxonomy"
  (comprehension failure) from "never opened" (discoverability failure) — instrumentation question 3, currently
  unanswerable.
- `hotel_default_ranking_explanation_viewed` — fires once per feed view when the basis clause from D3 is
  actually in the viewport, via the same `IntersectionObserver` + `useRef` once-guard pattern already used for
  `hotel_sort_control_viewed` (`:1416-1430`). Payload: `current_sort`, `premium_eligible`, `viewport_band`.
  Required because D3's clause is right-aligned and below the fold risk differs by breakpoint.

If UXDES chooses a disclosure ("What's this order?") over always-visible copy, a paired `_expanded` event is
also required — but see §8 Task 3: a disclosure adds an interaction cost that the free tier, which cannot act on
the information, is least likely to pay. Always-visible is the recommended default.

---

## 7. Instrumentation questions — answers and remaining unknowns

1. **Baseline sort-use rate by `premium_eligible`, and free-tier `hotel_sort_disabled_attempted` share.**
   Measurable today: `hotel_sort_control_viewed` → `hotel_sort_changed` (Premium) or
   `hotel_sort_disabled_attempted` (free), all carrying `premium_eligible`. Read the free-tier rate *against* D5's
   dismissal event: high attempt = entitlement friction; near-zero attempt + high dismissal = comprehension;
   near-zero of both = discoverability. Today only the middle case is invisible.
2. **Median opened `card_position` across sorts.** Premium-only comparison. Free sessions are pinned to `newest`
   server-side, and their `card_position` counts locked cards that cannot be opened
   (`DealFeed.tsx:1893-1907`), so free and Premium position distributions are not comparable. Segment strictly.
3. **`hotel_sort_menu_dismissed`.** Yes, needed. Specified in D5.
4. **Default-explanation viewed/expanded event.** Yes for `_viewed` (D5). `_expanded` only if UXDES chooses a
   disclosure, which this brief recommends against.
5. **Booking-start conversion by sort-at-handoff and ever-switched.** `hotel_result_card_opened` already carries
   `current_sort`, `previous_sort`, `sort_transition`, so sort-at-handoff is derivable at the card-open step. A
   session-level "ever switched sort" flag is not currently derivable client-side within this component; the
   analysis is a warehouse-side session rollup over existing events, not new instrumentation.
6. **Can `first_seen` be surfaced without displacing "Price checked"?** Yes. `firstSeen` is already in `ApiDeal`
   for locked and unlocked rows, already passed into `DealCard`, and already an unused prop
   (`DealCard.tsx:31`). Both lines fit the existing `space-y-2` price block at 375px. This is a **UI ticket, not
   a DEV ticket** — no API, query, or contract change. H2 is fixed by a card change plus copy, not copy alone.

**Segment definitions for every readout:** (1) free / first-time / ≤479px, (2) free / first-time / ≥1024px,
(3) Premium / has switched sort, (4) Premium / never switched, (5) price-led vs value-led by whether the session
sets a max-price filter. `viewport_band` (`DealFeed.tsx:1243-1247`) already supplies the breakpoint split.

---

## 8. Validation plan

Moderated, 8–10 participants per arm, unmoderated first-click for Task 1 if volume allows. Run 1 and 2 against
the current build before D1–D3 ship; re-run after.

**Task 1 — default comprehension (H1).** Land on `/deals`, no instruction, no scrolling. "What decides which
hotel is at the top of this list?" Run both 375px and 1280px arms; §2.5 predicts worse desktop performance.
*Pass:* ≥70% name detection recency, unprompted, post-change. *Fail signal to escalate:* baseline majority says
"cheapest" / "best deal" / "recommended".

**Task 2 — verification and trust (H2, H5).** "Is this list in the order it says it is? How can you tell?"
Free-tier arm sees the locked-card majority. *Pass:* ≥70% cite a card-face attribute that actually matches the
sort key, and no participant cites a timestamp inversion as evidence the list is broken. *Also record:* whether
any free-tier participant notices that every locked card claims "Deal found today" — pre-change only.

**Task 3 — name vs. basis (H3).** Between-subjects: A = label only, B = label + basis clause with the explicit
negative, C = label + basis behind a disclosure. Ask participants to predict the top three cards before
scrolling. *Pass:* B beats A on prediction accuracy at equal or lower time-to-first-scroll. *Decision rule:* if
C's disclosure open rate is <40% on the free tier, always-visible copy wins regardless of C's accuracy among
those who opened it.

**Task 4 — taxonomy ceiling (H4).** Ask what other order they want. Then show `★★★★☆` and ask what it means.
*Pass:* participants accept the absence of rating/distance sorts once told the data is not collected, and a
majority reject a `stars`-based "Best rated" as misleading once they learn `stars` is hotel class. *If they
insist:* that is the trigger to write a data-layer discovery ticket, not to add the option.

**Regression gate for the build, checked by TEST:** `role="menu"` / `menuitemradio` semantics, roving focus,
Home/End/Escape/Tab handling, `aria-disabled` (never native `disabled`) on locked options, the `aria-live` sort
status region announcing changes and not the static basis clause, focus return to the trigger on sort apply and
on failure, and the skeleton-not-spinner pending state. All must survive unchanged.

---

## 9. Out of scope, and why

- **Rating / distance sorts** — data does not exist on this surface (§5). Separate data-layer discovery.
- **The Premium gate's existence** — only its comprehension is in scope. D2 repairs a false claim on a locked
  card; it does not unlock anything.
- **`app/components/HotelCard.tsx`** — not imported by the live feed. Untouched.
- **Refetch vs. client-side reorder on sort change** (`DealFeed.tsx:1046-1109`) — a performance question, not a
  legibility one. Not relitigated here.
- **Provider calls, money representation, deal contract, `/api/deals` shape** — unchanged by every directive.

---

## 10. Handoff

**Next ticket:** `UXDES-HOTEL-SORT-RANKING-01` — design spec for `docs/pipeline/hotel-sort-ranking/03-design.md`.

Deliverables required of UXDES: full state coverage for the sort status block and both card variants (default,
loading, pending-sort, empty, error, cold-sample, locked, `firstSeen`-null, 375px, 1280px, keyboard focus);
final copy for every string named in D3 with no placeholders; Tailwind class patterns against the existing
tokens in `app/globals.css`; and an explicit decision on whether the basis clause lives inside or outside the
`role="status"` region, with the `aria-live` consequences stated.

**Route it as a UI ticket, not DEV.** Every directive is component-layer: `DealCard.tsx`, `LockedDealCard.tsx`,
and the copy/analytics blocks in `DealFeed.tsx`. No API route, provider, scoring, or query change is required —
`firstSeen` is already on the wire for both locked and unlocked deals.
