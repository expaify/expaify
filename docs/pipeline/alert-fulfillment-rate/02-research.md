# UXR-ALERT-FULFILLMENT-RATE-01: Research

## Correction & Category 6 — added after real code verification (2026-08-25)

The Stage 2 brief below was written by Gemini from real analytics numbers but without direct
code/schema access, so its SQL is against a guessed schema (wrong table/column names — do not
run it as written) and two of its "Current Data Alignment" calls don't hold up:

- **Category 4 is miscalibrated.** Empty watchlist (`{}`) is confirmed (both `sendDailyDigest.ts`
  and `sendDealAlert.ts`) to mean "match any city," not "match nothing." The 2 empty-watchlist
  subscribers are not at risk here — deprioritize the "empty watchlist = dead end" framing.
- **Query A/B/C's actual answers**, run for real against production Postgres just now:
  - **Query A equivalent** (empty-watchlist skip behavior): not a distinct failure mode — see above.
  - **Query B equivalent** (discount-bar filtering): of 46 active deals, 13 sit in the 30–39%
    band, 19 in 40–49%, 14 at 50%+. Anyone still on the default 40% personal alert bar never sees
    those 13 — expected behavior (user-configured), not a bug, but worth surfacing in-product
    ("lower your bar to see 3 more deals this week").
  - **Query C equivalent** (why 18/27 markets show zero active deals): not yet root-caused to
    "scraper coverage failure" vs "genuinely no drops there" — that would need a real query
    against `price_snapshots`/`snapshots` (not `price_snapshots.hotel_market`/`median_60_day`,
    those columns don't exist; real columns are `market_id`, `price_cents`, `snapshot_date`,
    `captured_at`) and hasn't been run yet. Flagged as still open if Category 2 gets picked up.

**The actual, verified root cause is a mechanism Gemini didn't have visibility into:**
`lib/email/sendDailyDigest.ts`'s query restricts candidate deals to `d.first_seen >= NOW() -
INTERVAL '24 hours'`, and separately excludes any deal already recorded in
`deal_alert_deliveries` for that user (i.e. each deal is delivered to a given subscriber **at
most once, only within 24h of first being flagged**). A deal can be active and matching a
subscriber's city and discount bar for a week straight and they will never hear about it after
missing that first-day window. This — not market/supply coverage — is what produced the Aug
19–23 five-day 100% skip streak.

### Category 6 (new, highest-confidence, not in the original five): Loosen the digest's freshness/delivery-once window
- **Description:** Change `sendDailyDigest.ts`'s candidate query from "first_seen in the last
  24h" to something like "no deal delivered to this user in the last N days AND this specific
  deal hasn't been delivered to them before" — i.e. still never re-send the *same* deal, but stop
  requiring it to be *brand new today*. A currently-active, never-before-sent, matching deal
  should qualify regardless of when it was first flagged.
- **Tradeoffs:** Small, contained change (one query, one file) — far lower effort than Category 2
  (supply rebalancing) or Category 5 (near-miss tier), and directly targets the confirmed
  mechanism rather than a correlated-but-not-causal signal (market concentration).
- **Risk:** Low. Doesn't touch `DEAL_THRESHOLD`/`MIN_SNAPSHOTS` (the brand-integrity constraint
  from the discovery doc), doesn't touch Stripe/billing, doesn't touch onboarding UX. Needs a
  real query first to estimate how much this actually improves skip rate before committing to a
  design (see Next Steps).
- **Recommendation:** This should be **Rank 1**, ahead of Categories 4 and 5, because it's the
  only one that fixes the actual mechanism confirmed in code rather than a plausible-but-unproven
  hypothesis.

### Next steps if picked up
1. ~~Run a real query...~~ **Done, 2026-08-25.** Result, per real subscriber:

   | Subscriber pattern | Count | Currently-matching, never-delivered deals | Of those, missed by the 24h freshness window |
   |---|---|---|---|
   | Single-city watcher (Hurghada/Cairo/Cancún×2) | 4 | 0 each | n/a — their city has **zero active deals of any discount right now**, confirmed directly, not a freshness-window artifact |
   | Empty watchlist ("everywhere") | 2 | 31 and 24 | 7 and 6 (~22–25% of their real matches) |
   | 10-city power watcher | 1 | 3 | 0 |

2. **This splits the fix by subscriber pattern, and changes the priority call:**
   - For the 4 single-city watchers (the majority pattern in this real base), **Category 6 would
     not help at all** — there is nothing to miss, their city genuinely has no supply right now.
     Only Category 2 (market coverage) addresses their situation.
   - For the 2 broad/"everywhere" watchers, Category 6 is real and would meaningfully increase
     what they receive (~22–25% more of their genuine matches).
   - Category 6 remains the cheaper, lower-risk fix and is still worth doing — it just won't move
     the needle for most of today's real subscriber base. Category 2 (expanding/rebalancing
     tracked markets) is the one that would, but is real engineering scope (scraper coverage for
     new markets), not a quick fix.
3. Do not implement anything from this doc without a `03-design.md` design pass and the DEV-stage
   quality gate per `AGENTS.md` — this document is research/options only. **Decision point:**
   which of Category 6 (cheap, helps 2/7 subscribers today) or Category 2 (expensive, helps the
   majority pattern) to commission first is a real product-priority call for the user, not
   something to default into.

---

## Stage 2: UX Research & Intervention Analysis (original, Gemini)

To bridge this supply-density gap, we analyzed five categories of intervention.

```
       [USER VALUE VS. BRAND RISK MATRIX]

       High | [Cat 4] Watchlist UX      [Cat 5] Near-Misses
            |
USER        | [Cat 2] Supply Rebalance  [Cat 3] Digests
VALUE       |
            |                           [Cat 1] Lower Thresholds
        Low |__________________________________________________
              Low                                         High
                             BRAND RISK
```

---

### Category 1: Loosening Pipeline Parameters (`MIN_SNAPSHOTS` or `DEAL_THRESHOLD`)
*   **Description:** Lowering `MIN_SNAPSHOTS` below 8 to allow younger historical data to trigger alerts, or adjusting `DEAL_THRESHOLD` to 0.75 (25% off).
*   **Tradeoffs:** High risk of brand dilution. Lowering snapshot depth introduces high price volatility and false positives. Lowering the threshold directly invalidates "30%+ off" marketing.
*   **Current Data Alignment:** Unfavorable. Compromising these parameters would trigger alerts for low-confidence drops, turning high-value notifications into noise.

### Category 2: Supply Expansion & Rebalancing (Market Optimization)
*   **Description:** Retiring the 18 zero-deal markets and replacing them with high-volume destinations, or prioritizing scraping resources toward high-intent destinations like Barcelona, Lisbon, and Paris.
*   **Tradeoffs:** Increases database size and scraping costs, but directly aligns system supply with user demand.
*   **Current Data Alignment:** Supported, but not yet root-caused (see Query C note above — need to confirm whether these markets have genuinely thin supply vs. a scraper coverage gap).

### Category 3: Alert Cadence & Alternative Formats (Weekly Digests/Status Emails)
*   **Description:** Replacing the binary "alert or silence" daily model with a scheduled weekly digest (e.g., "Weekly Destination Update: 0 major drops in Cancún, but here are the pricing trends").
*   **Tradeoffs:** Reduces unsubscribe rates by maintaining a steady, valuable touchpoint without spamming daily "no deal" emails.
*   **Current Data Alignment:** Supported as a complement to Category 6, not a substitute — Category 6 fixes real missed matches; this addresses the *feeling* of silence on days with genuinely nothing new.

### Category 4: Onboarding & Watchlist UX Changes (Steering & Validation)
*   **Description:** Redesigning onboarding to steer users to select at least 3 destinations, or add a "Watch Everywhere / Regional" option; intercepting the empty-watchlist state.
*   **Tradeoffs:** Low engineering effort. Does not modify pipeline math.
*   **Current Data Alignment:** Downgraded per the correction above — empty watchlist already behaves as "watch everywhere," so this isn't the critical fix Gemini judged it to be. Steering *narrow single-city* watchers toward 2-3 cities may still have some value, but it's a smaller effect than Category 6.

### Category 5: Transparent "Near-Miss" UI & Notification Exposure
*   **Description:** Introducing a secondary tier of signal (e.g., "Trending Drops: 20-29% off") clearly separated visually from the core "Verified 30%+ Deals."
*   **Tradeoffs:** Maintains the integrity of the 30% brand promise while dramatically increasing the density of helpful information on both destination hubs and in-app feeds.
*   **Current Data Alignment:** Supported for the *anonymous destination-hub* empty-state problem (150 `city_empty_viewed` events) — this is a separate real problem from the subscriber-digest one, and this category is still the right answer for it.

---

## Revised Prioritized Recommendations

| Rank | Category | Real mechanism confirmed? | Effort | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Category 6: Digest freshness/delivery-once window** | Yes — code-confirmed root cause | Low | New, added post-correction |
| **2** | **Category 5: Near-miss tier on destination hubs** | Yes — separate, real anonymous-visitor problem | Medium | Addresses `city_empty_viewed`, not the digest skip rate |
| **3** | **Category 3: Weekly digest / status framing** | Complements #1, doesn't replace it | Medium | |
| **4** | **Category 2: Supply rebalancing** | Plausible, not yet root-caused | High | Needs Query C run for real first |
| **5** | **Category 4: Watchlist onboarding steering** | Downgraded — weaker than believed | Low | |
| **6** | **Category 1: Loosen pipeline thresholds** | N/A | Low | Do not pursue — brand risk |
