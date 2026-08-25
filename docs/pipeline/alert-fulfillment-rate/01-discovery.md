# UXD-ALERT-FULFILLMENT-RATE-01: Discovery

**Date:** August 25, 2026
**Product:** expaify (Hotel-Deal-Alert SaaS)
**Authors:** Senior UX Strategist & Senior UX Researcher (Gemini, persona-prompted), corrected against real code by the orchestrating session

> **Correction, added after code verification (2026-08-25):** this brief was written from real analytics/DB numbers but without direct code access, so it drew two conclusions the code doesn't support. Both matter enough to flag before anyone designs against this doc:
> 1. **The stated root cause ("supply concentration in 9/27 markets") is not the actual mechanism.** `lib/email/sendDailyDigest.ts` only considers deals with `first_seen >= NOW() - INTERVAL '24 hours'`, and each deal is delivered to a given user at most once (`NOT EXISTS ... deal_alert_deliveries`). A city can have several currently-active, qualifying deals and a subscriber will still be skipped if none of them were *newly flagged in the last 24 hours* — this is the real mechanism behind the 5-day skip streak, independent of how many markets currently have zero active deals.
> 2. **"2 subscribers with empty watchlist arrays receive zero notifications" is backwards.** Per the real query in both `sendDailyDigest.ts` and `sendDealAlert.ts`: `(COALESCE(array_length(s.watchlist,1),0) = 0 OR city = ANY(s.watchlist))` — an empty watchlist matches *any* city. Those 2 subscribers have the broadest possible match, not a dead end.
>
> See `02-research.md`'s appended correction section for the revised recommendation. The rest of this document (pain point framing, constraints, success statement) still holds.

---

## Stage 1: UX Discovery

### 1. User Pain Point Statement
Subscribers watching a single destination—representing the majority of our active user base—experience total platform silence and a perceived breakdown in product value, driven by a five-day streak (Aug 19–23) where 100% of the daily alert jobs failed to deliver a single email across both free and paying tiers.

### 2. Affected Audience & Journey Phase
*   **Primary Affected:** Single-city watchers (e.g., subscribers watching only Cancún, Cairo, or Hurghada), who receive zero notifications during the daily **Alert Evaluation Phase** whenever no *new* qualifying deal was flagged for their city in the trailing 24 hours.
*   **Secondary Affected:** Anonymous web prospects in the **Discovery Phase** landing on destination pages. They encounter empty states (`city_empty_viewed`) instead of active deals, specifically concentrated on high-intent hubs like Barcelona, Lisbon, and Paris.
*   **Socio-Technical Impact:** This is not a delivery bug in the sense of something broken; it is a designed-in "only ever alert once, only within 24h of first detection" policy with a real cost — subscribers penalized equally across free and paying tiers (18 premium vs. 21 free skips), directly threatening retention.

### 3. The Measurable Signal
```
                     [AUG 19 - AUG 23]                [AUG 24]
Alert Evaluations:   6 per day (30 total)             6 total
Alerts Delivered:    0                                3
Alerts Skipped:      30 (100% skip rate)              3 (50% skip rate)
Skip Attribution:    21 Free, 18 Premium (Over entire 6-day window)
```
*   **Supply Concentration (context, not root cause):** Out of 27 tracked markets, 18 markets (66.6%) have 0 active deals right now. The remaining 46 active deals are heavily skewed: the top 3 markets hold 30 deals (65.2% of total supply).
*   **Discount-bar filtering (context, not root cause):** Of the 46 active deals, only 33 clear the default 40% personal alert bar (13 sit in the 30-39% band, invisible to anyone on default settings).
*   **High-Intent Abandonment:** The `city_empty_viewed` event fired 150 times against only ~530 total `destination_hub_view` events (a ~28% empty-page rate), heavily led by search traffic for Barcelona, Lisbon, and Paris.

### 4. Constraints
*   **Constraint A (Brand Integrity):** Do not weaken `DEAL_THRESHOLD` (must remain ≤ 0.70) or bypass `MIN_SNAPSHOTS` (≥ 8) for the primary "Verified Alert" classification. Diluting the 30%+ drop promise to force alerts would destroy the core value proposition of high-accuracy, spam-free curation.
*   **Constraint B (Technical Boundary):** No modifications to Stripe integration, billing tables, subscription schemas, or payment gateways.
*   **Constraint C (Data Validation):** No solution may be deployed without first running real queries against the production Postgres (this session has direct access) to quantify its expected yield.

### 5. Success Statement
We will consider this problem solved when the daily digest's skip rate drops meaningfully for subscribers who have at least one currently-active qualifying deal in their watched scope — i.e., "you have a live match but we didn't tell you" approaches zero, independent of whether new supply is added.
