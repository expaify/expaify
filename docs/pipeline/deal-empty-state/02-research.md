# 02 — UX Research: deal feed empty state & freshness signals

**Ticket:** UXR-DEAL-EMPTY-STATE-01 · **Stage:** UXR · **Date:** 2026-07-19
**Upstream:** `docs/pipeline/deal-empty-state/01-discovery.md`
**Surfaces:** `/deals`, `/destinations/[city]`, `/deals/[dealId]`, `DealCard`

---

## 1. Method

Re-audited every source claim in the discovery report against this worktree
(no claim taken on trust), then compared the current interaction patterns
against Booking.com, Kayak, and Google Flights at the level of *interaction
pattern* — what the reference states, offers, and refuses to do — not visual
style. Two additional constraints were discovered during the audit (§2.7,
§2.8) that materially shape the directives.

## 2. Verified current-state audit

All six discovery findings reproduce in this worktree:

1. **Mock fallback masks the unfiltered-empty state.** Server pre-fetch falls
   back to `generateMockDeals(5)` (`app/deals/page.tsx:56–83`); `/api/deals`
   does the same for unfiltered requests (`app/api/deals/route.ts:119–128`).
   The honest "We're building your feed" branch (`app/deals/DealFeed.tsx:534`)
   is unreachable without premium filters. Sole disclosure is a caption-sized
   "Preview deal" line (`app/components/ui/DealCard.tsx:159–161`). Mock cards
   also render a live `CompareRow` of outbound OTA links for inventory that
   does not exist.

2. **Filtered-empty has copy but no control.** `app/deals/DealFeed.tsx:527–542`
   renders the message over three 30%-opacity skeleton cards; recovery
   requires finding per-pill × buttons or the SearchBar clear. No "clear all"
   action exists in the empty state itself.

3. **City page contradicts itself at zero deals.** Header prints
   "Updated daily · 0 deals found" (`app/destinations/[city]/page.tsx:93–95`)
   directly above the empty card ("No deals in {city} right now… We check
   daily", `page.tsx:100–113`). Only recovery is "See all destinations". No
   alert capture.

4. **`updated_at` is selected but dropped.** `getActiveDeals` returns it
   (`lib/pipeline/dealDetection.ts:174,284`) and the pipeline maintains it on
   every upsert/expiry (`dealDetection.ts:106,133,142`), but all three
   `toApiDeal` mappings omit it (`app/api/deals/route.ts:31–74`,
   `app/deals/page.tsx:16–37`, `app/destinations/[city]/page.tsx:10–31`).
   Feed-level freshness is structurally impossible until this is added.

5. **Cards fabricate freshness.** `DealCard` shows "found {timeAgo(firstSeen)}"
   — discovery age, not price recency — and `timeAgo(undefined)` returns
   `"today"` (`DealCard.tsx:35–44`), so mock deals (`firstSeen: null`) display
   a fabricated "found today". The helper is duplicated at
   `app/deals/[dealId]/page.tsx:36–44`.

6. **Stale banner fires on healthy deals.** Pipeline runs daily at 4am UTC
   (`.github/workflows/snapshot.yml`); the detail page warns "Price may be
   stale" at 6h (`app/deals/[dealId]/page.tsx:220–222,250–252`) — on for ~75%
   of every day on a healthy deal. The banner omits the timestamp; the only
   "Updated {date}" line sits at the bottom of "Why this is a deal"
   (`page.tsx:383`).

New findings from this audit:

7. **`AlertSignup` cannot serve city alerts as-is.** The component
   (`app/components/AlertSignup.tsx`, imported nowhere) and its backend
   (`app/api/alerts/route.ts:58–63`) both require 3-letter IATA
   origin **and** destination codes — flight-shaped, rejects city-name input.
   An anonymous city-deal email capture would need DEV-stage backend work.

8. **A city-watch backend already exists for signed-in users.**
   `subscriptions.watchlist` (city-name array, set during onboarding —
   `app/api/onboarding/route.ts:60`) already gates the daily digest
   (`lib/email/sendDailyDigest.ts:80`). "Watch this city" for authed users is
   a UI + small API task, not a new system.

Maintenance note for downstream stages: the `ApiDeal` shape and `toApiDeal`
mapping are duplicated in three files, and `timeAgo` in two. Any additive
field (directive D1) must touch all copies or the surfaces will silently
diverge; UXDES should spec the field once and UI/DEV should consolidate the
mapping if the ticket allows.

## 3. Reference patterns (interaction level)

**Booking.com — filtered/unfiltered empty results.** States the cause
("There are no matching properties for your search criteria"), keeps every
active filter visible and removable in place, and names the specific filters
to relax. Never backfills with fabricated inventory; genuine-zero markets get
alternative destinations/dates. The pattern: *cause → in-place one-tap
relaxation → alternative path.*

**Kayak — filtered empty + hidden-count.** When filters hide everything,
Kayak quantifies it ("X results are hidden by your filters") with a single
**reset/clear filters** action — one tap back to inventory. It distinguishes
"our filters hid results" from "there is genuinely nothing", which is exactly
the distinction `DealFeed` already makes in copy but not in controls. On
genuinely empty routes it offers a **price alert** capture, not fake results.

**Google Flights / Kayak — price freshness.** Cached prices carry an explicit
"as of" qualifier calibrated to actual refresh cadence (e.g. "Prices are
based on searches within the last 48 hours"), shown quietly with the price —
not as a warning. A warning appears only when data exceeds the expected
cadence, and it prompts re-verification rather than sitting permanently. The
pattern: *quiet always-on recency label + loud only-on-anomaly warning*, with
thresholds derived from how often the data actually refreshes.

**Pattern chosen to model:** Kayak's filtered-empty (quantified cause +
single reset action + alert capture on genuine-zero) and Google Flights'
freshness calibration (quiet "checked X ago" label; warning only past
cadence).

## 4. Gap analysis

| Surface | Current | Reference pattern | Delta |
|---|---|---|---|
| `/deals` cold DB | 5 mock cards at full visual parity, live OTA links, "found today" | Honest empty + alert capture; never fabricated inventory | Fabricated inventory with fabricated timestamps and real outbound links |
| `/deals` filtered-empty | Copy only, ghost skeletons behind it | Cause + one-tap clear-all + hidden-count | No recovery control; skeletons read as a loading failure |
| `/destinations/[city]` empty | "Updated daily · 0 deals found" over "No deals right now" | Cause + alternative + alert capture | Self-contradicting trust cue; no capture despite existing watchlist backend |
| `DealCard` freshness | "found {firstSeen}"; null → "today" | Quiet "checked X ago" price-recency label | Wrong signal (age ≠ freshness) and fabricated when null |
| Detail page staleness | Warning at 6h vs 24h cadence, no timestamp in banner | Warning only past expected cadence, timestamp shown | Always-on warning users learn to ignore; no signal left for real failures |

## 5. Design directives

Each directive is testable; acceptance criteria are the test.

### D1 — Expose `updatedAt` end to end; never render a time claim without a timestamp

Add `updatedAt: string | null` to `ApiDeal` and populate it in **all three**
`toApiDeal` mappings, in both the locked and unlocked branches (a check
timestamp is not identifying, so paywall lock-masking is unaffected). In
`DealCard`, the image-corner pill becomes a price-recency label —
"checked {timeAgo(updatedAt)}" — and `timeAgo` must never fabricate:
when the timestamp is null/undefined the pill is omitted entirely (no
"today", no "just now").

**Accept when:** `ApiDeal` (all three copies) contains `updatedAt`; a card
with `updatedAt` 3h old renders "checked 3h ago"; a card with null
`updatedAt` renders no time text anywhere; no code path passes `undefined`
into a helper that returns a time string.

### D2 — Calibrate staleness tiers to the actual 24h pipeline cadence

Replace the detail page's 6h threshold with three tiers derived from the 4am
UTC daily run: **fresh ≤ 30h** (one missed-run grace) — quiet
"Price checked {timeAgo}" line near the price, no warning; **aging 30–48h** —
same line with mild emphasis (token-level, e.g. `--warn`-tinted text), still
no banner; **stale ≥ 48h** — the warning banner, which must include the
absolute timestamp: "We haven't been able to re-verify this price since
{date}. Check the provider for the current price." The buried
"Updated {date}" line at `page.tsx:383` moves up to join the price block.

**Accept when:** a deal updated 20h ago shows no warning; 36h shows the
emphasized inline line but no banner; 50h shows the banner containing an
absolute date; the 6h constant no longer exists.

### D3 — Filtered-empty gets a one-tap reset and loses the ghost skeletons

Replace the filtered-empty state in `DealFeed` with a designed block
(`role="status"`): headline "No deals match your filters", the active filter
pills repeated inline (removable), a primary **Clear all filters** button
(≥44px target) that resets every filter + search in one interaction, and a
secondary link "Browse all deals". Remove the 30%-opacity skeleton cards
behind the message. If the unfiltered total is cheaply known, show
"{n} deals are hidden by your filters" as the Kayak-style hidden-count.

**Accept when:** one activation of "Clear all filters" returns the full feed;
no skeleton renders while the empty message is visible; the block has
`role="status"`; all controls are keyboard-reachable with visible focus.

### D4 — City page: one consistent freshness story plus capture

At zero deals the header meta line must not assert "0 deals found" beneath
"Updated daily". Replace with "Checked daily — no active deals right now"
(or drop the count when zero). The empty card keeps cause + "See all
destinations" and adds capture: for signed-in users a one-tap
**Watch {city}** control that appends to `subscriptions.watchlist` (backend
exists, §2.8) with confirmed state ("Watching — you'll get {city} deals in
your daily digest"); for anonymous users a sign-up-framed CTA ("Get an email
when a {city} deal appears" → join/onboarding), since the anonymous alert
backend is flight-only (§2.7). If product wants true anonymous city-email
capture, that is explicit DEV scope — do not bend `AlertSignup` onto city
input; its API rejects non-IATA values.

**Accept when:** with zero deals the rendered page contains no "0 deals
found" string; an authed user can start watching the city in one tap and
sees a confirmed state; an anonymous user sees an email-alert path; header
and empty card make no contradictory freshness claims.

### D5 — Mock deals become clearly-framed samples or disappear

The cold-DB fallback on `/deals` (both server pre-fetch and `/api/deals`)
must stop presenting fabricated inventory at real-deal weight. Preferred
resolution: show the honest "We're building your feed" state first, followed
by at most 3 mock cards demoted to explicit sample framing — a section
header ("Example deals — here's what expaify surfaces once tracking
completes"), a per-card "Example — not bookable" badge at label weight (not
caption), **no** outbound OTA `CompareRow`, and **no** time pill (follows
from D1's null rule, since mock `firstSeen`/`updatedAt` are null). Locked
paywall variants of mock cards are dropped — never upsell on fabricated
inventory. Alternative (accepted if product prefers): remove the mock
fallback entirely. Either way the choice is made explicitly in UXDES, not
left to the current silent fallback.

**Accept when:** on a cold DB, a disclosure element renders before the first
sample card; no sample card renders an outbound OTA link, a time claim, or a
locked/upsell state; the "Preview deal" caption pattern is gone.

## 6. Notes for UXDES

- Keep `firstSeen` ("found Xd ago") only if it earns its place *alongside*
  "checked Xh ago" without overloading the card — recency of verification is
  the trust signal discovery prioritized; deal age is secondary. Recommend:
  card shows only "checked Xh ago"; detail page may show both.
- All copy above is directional; UXDES owns final strings for every state
  (default, loading, empty, error, 375px, 1280px, focus/keyboard).
- Analytics gap from discovery stands: no event distinguishes
  filtered-empty vs cold-empty vs city-empty. Spec event names in UXDES so
  UI can instrument.

## 7. Constraints carried forward

Unchanged from discovery: honesty (no fabricated timestamps or inventory,
no always-on warnings), additive-only `ApiDeal` change with paywall masking
preserved, integer-cents money untouched, provider boundaries untouched,
375px + 1280px usable, `role="status"` on content-replacing states, ≥44px
touch targets, existing design tokens only.

## 8. Handoff

Next stage: **UXDES-DEAL-EMPTY-STATE-01** — produce
`docs/pipeline/deal-empty-state/03-design.md` covering every state for the
four surfaces, final copy for every string, and Tailwind/token patterns per
state, implementing directives D1–D5.
