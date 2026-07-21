# UXD-DEAL-EXPIRY-URGENCY-01: Deal Expiry & Urgency Discovery

Date: 2026-07-21
Stage: UX Discovery
Persona: Senior UX Strategist

## User Pain Point

Travelers scanning the deal feed or opening a deal-alert email cannot tell which hotel deals are at real risk of disappearing and which are stable enough to compare calmly — and the one "urgency" cue the product does display (an `Expires <date>` line on the deal detail page) is not actually derived from deal risk, so it will eventually read as fake to attentive users and damage trust in every other number expaify shows.

## Who Is Affected And Where

First-time and returning users are affected at four points in the flow:

1. **Deal feed grid** (`app/deals/DealFeed.tsx` → `app/components/ui/DealCard.tsx`) — the primary decision surface. Each card shows a discount chip, a neutral "checked `{timeAgo}`" freshness badge, and price — but no signal that distinguishes a deal likely to hold for days from one about to flip back to normal price. Every card looks equally urgent (i.e., not urgent at all).
2. **Hotel card in live search results** (`app/components/HotelCard.tsx`) — this surface has no freshness data at all. The `HotelOffer` type (`lib/types.ts:137-151`) has no `fetchedAt` field, and the card hardcodes the literal string "Last-checked time unavailable" in four separate places (lines 46, 64, 416, 575). Urgency cannot be shown honestly here today because the underlying timestamp doesn't exist in the type.
3. **Deal detail page** (`app/deals/[dealId]/page.tsx`) — this is the only surface with real urgency-adjacent logic today: `isAging` (30–48h since `updated_at`) and `isStale` (≥48h) drive a "Price may be out of date" banner (lines 226-227, 254-262), and a separate `isExpired` flag drives an "Expired {date}" / "Deal expired" state (lines 222, 303-308, 337-346). But `isExpired` is computed from `deal.expires_at`, which is **not** a deal-risk signal — see Measurable Signal below.
4. **Alert email click-through** (`lib/email/templates/DealAlert.tsx`, `lib/email/sendDealAlert.ts`, `lib/email/sendDailyDigest.ts`) — the email itself carries zero urgency or freshness cue. `sendDealAlert.ts:37` and `sendDailyDigest.ts:77` only use `expires_at` as a send-eligibility filter (`expires_at IS NULL OR expires_at > NOW()`), not as user-facing copy. A user who clicks through a day or two after receiving the email has no signal, before landing on the detail page, of whether the deal is still live.

## Measurable Signal

- **The only "expiry" field in the data model is not a deal-risk signal.** `lib/pipeline/dealDetection.ts:97` sets `expires_at = check_in_date + INTERVAL '90 days'` once, at insert time. It never gets recalculated from price behavior. It is a data-retention TTL (so old check-in-date rows eventually stop showing), not a measure of how likely a deal is to disappear. Yet `app/deals/[dealId]/page.tsx:396-399` renders it to users as `Expires {fmtDate(deal.expires_at)}` — a date roughly three months out on every single deal, regardless of how volatile or stable that hotel's price actually is.
- **A real risk signal exists but is discarded.** `lib/pipeline/dealRules.ts` defines a hysteresis band: prices ≤70% of median get flagged (`DEAL_THRESHOLD`), prices >85% of median get expired (`EXPIRE_THRESHOLD`), and anything in between is a `'hold'` — meaning the price is trending back up toward "not a deal anymore" but hasn't crossed the line yet. `dealDetection.ts:70-137` computes this decision nightly per hotel but only ever persists `'flag'` (creates/refreshes a deal row) or `'expire'` (marks status `'expired'`). The `'hold'` trajectory — the actual "this is drifting back to normal price, act soon" signal — is never written to the `deals` table and never reaches the UI.
- **The team already treats naive urgency copy as a trust risk.** `lib/ai/generateHeadline.ts:69` explicitly forbids AI-generated headlines from containing `available|only|last chance|expires?|book now|limited`. That filter exists but there is no approved, data-backed replacement pattern for communicating urgency — so today the only urgency-shaped copy in the product (the `expires_at` date) bypassed that same scrutiny by being handwritten into the detail page rather than AI-generated.
- **The freshness pattern that does work isn't reused as an urgency cue.** `updated_at`-driven staleness (`isAging`/`isStale` in `app/deals/[dealId]/page.tsx:226-227`) is a legitimate, currently-computed signal — but it's framed only defensively ("Price may be out of date," a data-integrity disclaimer) and only appears on the detail page, never on the feed card or in the alert email where the decision to click actually happens.

## Constraints

1. **Only real, currently-computable signals may drive urgency copy or styling.** That means `updated_at` recency/staleness and the price-recovery hysteresis trajectory (`dealRules.ts`'s `'hold'` state, once persisted) are fair game. The `expires_at` TTL field must not be used as a user-facing urgency cue in its current form — it measures data retention, not deal risk, and continuing to label it "Expires" is a data-integrity problem, not just a copy problem.
2. **No countdown timers or literal time-remaining claims.** expaify has no live inventory feed (`lib/providers` exposes price/fare data only, no room-count or availability-remaining data), so any "sells out in 2h" or ticking-clock pattern would be fabricated. This violates the non-negotiable contract against inventing data the provider didn't return, and it directly conflicts with the existing headline-copy ban on "last chance"/"limited" language.
3. **Mobile scannability at 375px must hold.** The deal feed card (`DealCard.tsx`) and hotel card (`HotelCard.tsx`) are already dense at mobile width (discount chip, freshness badge, price block, savings line, compare row, trust line). Any new urgency element must fit into that existing hierarchy without pushing the primary CTA below the fold or duplicating information already carried by the "checked `{timeAgo}`" badge.

## Success Statement

This is solved when a first-time user scanning the deal feed, a live hotel search result, or a deal-alert email can tell — from a signal expaify can actually stand behind (how recently the price was checked, or whether the price is trending back toward its usual level) — which deals need faster action and which can be compared calmly, without expaify ever showing a countdown, a scarcity claim, or an "Expires" date that is actually just a database cleanup timestamp.
