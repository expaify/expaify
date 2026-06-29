# Phase 1 eval report — 2026-06-29

## Go / No-Go: GO ✓

---

## golden.json — 8 cases

Methodology: midpoint-rank percentile formula `((countBelow + 0.5 * countEqual) / n) * 100`, verified manually for each case.

**Case 1 — JFK→LAX Great deal** — PASS  
fare 14000¢, all 20 history points > 14000¢ → countBelow=0, countEqual=0 → percentile=0. Confidence high (n=20). Verdict Great (0 ≤ 15). Expected [0, 15]. ✓

**Case 2 — EWR→ORD Good deal** — PASS  
fare 26000¢, sorted history 20000–58000 step 2000. countBelow=3 (20000, 22000, 24000), countEqual=1 (26000) → percentile=(3+0.5)/20×100=17.5. Confidence high. Verdict Good (15 < 17.5 ≤ 40). Expected [16, 40]. ✓

**Case 3 — EWR→ORD Typical** — PASS  
fare 39000¢, same history as Case 2 (no 39000 in list). countBelow=10, countEqual=0 → percentile=50. Median=(38000+40000)/2=39000, pctVsMedian=0. Confidence high. Verdict Typical (50 > 40). Expected [41, 100]. ✓

**Case 4 — BOS→MIA Thin data** — PASS  
fare 20000¢, n=5 → confidence=low. All 5 history prices > 20000 → percentile=0. Verdict Typical (forced by low confidence). Expected [0, 100]. ✓  
Note: bounds [0, 100] are very loose — any percentile passes. See Issues #1.

**Case 5 — SFO→SEA Single data point** — PASS  
fare 25000¢, history=[40000¢], n=1 → confidence=low. countBelow=0 (40000 > 25000), countEqual=0 → percentile=0. Verdict Typical (forced). Expected [0, 100]. ✓  
Note: same loose-bounds concern as Case 4.

**Case 6 — ATL→DFW Fare above all history** — PASS  
fare 45000¢, 20 history prices all ≤ 34000¢. countBelow=20, countEqual=0 → percentile=100. Confidence high. Verdict Typical (100 > 40). Expected [100, 100]. ✓

**Case 7 — LAX→LAS All-equal prices** — PASS  
fare 30000¢, 15 history prices all 30000¢. countBelow=0, countEqual=15 → percentile=(0+7.5)/15×100=50. Median=30000, pctVsMedian=0. Confidence high. Verdict Typical (50 > 40). Expected [50, 50]. ✓

**Case 8 — JFK→LAX High-confidence Great** — PASS  
fare 15500¢, 15 history prices 20000–62000 step 3000, all > 15500. countBelow=0, countEqual=0 → percentile=0. Confidence high (n=15). Verdict Great (0 ≤ 15). Expected [0, 15]. ✓

---

## Adversarial cases

Traced through `lib/scoring/scoreDeal.ts` manually.

**a. Thin history (5 points, fare below all)** — PASS  
n=5 < 10 → `confidence='low'`. Code enters `if (confidence === 'low') { verdict = 'Typical'; }`. Even with percentile=0 (lowest possible), verdict is forced to Typical. Correctly prevents misleading "Great" on thin data.

**b. Single data point equal to fare** — PASS  
n=1 → confidence=low. countBelow=0, countEqual=1. percentile=(0+0.5)/1×100=50. Verdict=Typical (forced). Outputs expected confidence='low', percentile=50, verdict='Typical'.

**c. Fare above all history** — PASS  
All n history prices < currentCents → countBelow=n, countEqual=0 → percentile=(n/n)×100=100. With n≥10, confidence=high, verdict: 100>40 → Typical. Correctly avoids calling an expensive fare a deal.

**d. All-equal prices (15 identical points, fare matches)** — PASS  
countBelow=0, countEqual=15 → percentile=50. medianCents=fare → pctVsMedian=0. verdict: 50>40 → Typical. All three outputs match expectation.

**e. Empty history (`history = []`)** — PASS  
The first guard in scoreDeal immediately returns:
```
{ percentile:50, pctVsMedian:0, medianCents:0, verdict:'Typical', confidence:'low',
  explanation:'No price history available for this route.' }
```
No crash, safe fallback, human-readable explanation. Does not throw.

---

## Adapter smoke checks

### travelpayouts.ts (`lib/providers/travelpayouts.ts`)

**Affiliate marker in deeplinks** — WARN (conditional, not guaranteed)  
`buildDeeplink` appends `?marker=${marker}` only when `this.marker` (i.e., `process.env.TP_AFFILIATE_MARKER`) is truthy. If the env var is absent or empty string in production, deeplinks are emitted without the marker and the company earns no affiliate commission. No warning or error is logged when marker is missing. See Issues #2.

**Money stored as integer cents** — PASS  
`priceTrends`: `Math.round(entry.price * 100)` converts whole-RUB to RUB-cents, then `convertToUSD(Math.round(amountCents * 0.011))` applies the exchange rate with its own `Math.round`. Output is always an integer. `searchFares`: same pattern. `lib/fx/convert.ts` line 11 confirms Math.round wraps the multiplication.

**`fareType` hardcoded to `'cash'`** — PASS  
`searchFares` sets `fareType: 'cash'` on every constructed NormalizedFare (line 140). No ambiguity.

**Cache key includes origin, destination, and method name** — PASS  
`priceTrends` key: `tp:priceTrends:${origin}:${dest}:monthly` — includes method name, origin, dest.  
`searchFares` key: `tp:searchFares:${origin}:${dest}:${extraParams}` — includes method name, origin, dest, and date range.

**Returns `{ ok: false, reason }` on errors, never throws** — PASS  
Both methods wrap all logic in try/catch returning `{ ok: false, reason: err.message }`. HTTP non-2xx returns `{ ok: false, reason: 'HTTP ${status}' }`. Nothing re-throws.

### hotellook.ts (`lib/providers/hotellook.ts`)

**Affiliate marker in deeplinks** — WARN (same pattern as travelpayouts)  
Marker is appended only when `this.marker` is truthy. The code correctly handles the `?` vs `&` case (line 63), but silently drops the marker if the env var is unset. See Issues #2.

**Money stored as integer cents** — PASS  
`Math.round((hotel.priceFrom ?? 0) * 100)` — explicitly rounded, handles fractional USD source values.

**`fareType` hardcoded to `'cash'`** — N/A  
`HotelOffer` does not have a fareType field; this check does not apply to the hotel adapter.

**Cache key includes location and method name** — PASS (minor concern noted)  
Key: `tp:hotels:${area}:${range.checkin}:${range.checkout}`. "hotels" in the key functions as an implicit method name. If a second hotel method is added later, the `tp:hotels:` prefix is underspecified. Not a current bug. See Issues #3.

**Returns `{ ok: false, reason }` on errors, never throws** — PASS  
Single searchHotels method is fully wrapped in try/catch; HTTP errors return `{ ok: false, reason }`.

---

## Believability pass — 10 routes

The scoring engine gates "Great" at ≤15th percentile with high confidence (≥10 data points). That means a fare must be cheaper than 85% of the historical record. At the low end of each range below, "Great" would be a genuine signal.

**JFK→LAX ($150–400)** — Believable  
$150–175 at the low end with high confidence would be ≤15th percentile if history centers around $250–350. "Great" at that price is trustworthy. Cases 1 and 8 use synthetic history with a floor of $200–250; in reality JFK→LAX trades as low as $150 regularly, so real data would make the ≤15th-percentile bar harder to hit — appropriately cautious.

**JFK→LHR ($400–900)** — Believable  
"Great" threshold near $400 is realistic; transatlantic flash sales do reach this level. "Typical" at median $600–650 is fair.

**LAX→NRT ($500–1100)** — Believable  
Wide range reflects seasonality (Golden Week, summer). "Great" near $500 is meaningful for transpacific.

**ORD→LHR ($400–850)** — Believable  
Similar to JFK→LHR. Range reflects fewer non-stop options from ORD. Scoring should be fair.

**SFO→NRT ($500–1000)** — Believable  
Consistent with LAX→NRT; "Great" near $500 would be a real deal.

**BOS→CDG ($400–900)** — Believable  
Transatlantic range is correct. "Typical" at $600–650 would be accurate.

**MIA→GRU ($500–1200)** — Believable  
Wide range reflects seasonal and geopolitical pricing volatility. "Great" near $500 is genuinely exceptional.

**LAX→SYD ($700–1400)** — Believable  
Longest route; low end $700 would be historically exceptional and warrant "Great." Scoring is conservative enough.

**DFW→CDG ($450–950)** — Believable  
Range is appropriate. "Great" near $450 is rare and would be trustworthy.

**EWR→MAD ($400–900)** — Believable  
Consistent with other transatlantic. Range and scoring thresholds align.

**Overall**: The ≤15th percentile threshold for "Great" is strict enough that it would not fire on median-priced fares. "Typical" at the median is fair across all routes. No route presents an obvious miscalibration risk.

---

## Data contract

`lib/types.ts` defines: `NormalizedFare`, `PricePoint`, `DealScore`, `HotelOffer`, `FlightProvider`, `HotelProvider`, `Result<T>`, `Money`, `FareType`.

| Consumer | Types used | Alignment |
|----------|-----------|-----------|
| `lib/scoring/scoreDeal.ts` | `NormalizedFare` (`.price.priceCents`, `.price.currency`), `PricePoint` (`.priceCents`), `DealScore` (all fields populated) | PASS |
| `lib/providers/travelpayouts.ts` | `NormalizedFare` (all required fields present), `PricePoint` (`date`, `priceCents`, `currency`), `Result<T>`, `FlightProvider` interface | PASS |
| `lib/db/getBaseline.ts` | `PricePoint` — maps DB row to `{date, priceCents, currency}` exactly as typed | PASS |

No silent divergences. `getBaseline` applies `.trim()` to `currency` from the DB (safe). All three consumers agree on field names and types.

**Data contract: PASS**

---

## Issues found

**Issue #1 — Loose eval bounds on Cases 4 & 5** (`evals/golden.json` lines 156–161, 181–186)  
`percentileGte: 0, percentileLte: 100` allows any percentile output to pass. These are low-confidence cases where the actual percentile is 0 (fare below all history). A buggy implementation returning percentile=99 would still pass the test. Recommend tightening to `percentileGte: 0, percentileLte: 10` to actually exercise the percentile path. Non-blocking for go/no-go but weakens the test harness.

**Issue #2 — Silent affiliate marker omission** (`lib/providers/travelpayouts.ts` line 47, `lib/providers/hotellook.ts` line 62)  
When `TP_AFFILIATE_MARKER` env var is absent or empty, both adapters emit deeplinks without the affiliate marker and no warning is logged. In production this means zero affiliate revenue without any error signal. Recommend adding a startup assertion or at minimum a `console.warn` when marker is missing. Does not affect scoring correctness.

**Issue #3 — Hotellook cache key lacks explicit method segment** (`lib/providers/hotellook.ts` line 34)  
Key is `tp:hotels:${area}:...`. If a `hotelHistory` or `hotelPricing` method is added later with a similar key shape, namespace collision becomes a risk. Low priority but worth noting for the cache layer design.

**Issue #4 — Hardcoded FX rate** (`lib/fx/convert.ts` line 11)  
`1 RUB = 0.011 USD` is hardcoded with a comment noting it is MVP. A significant RUB/USD rate movement (common given geopolitical events) will distort all historical price comparisons for Travelpayouts data, potentially inflating perceived "deal" quality. Acceptable for MVP but must be addressed before production traffic.

**Issue #5 — Empty-history percentile sentinel** (`lib/scoring/scoreDeal.ts` line 30)  
Empty history returns `percentile: 50` as a placeholder. This is not a real percentile and could pollute analytics dashboards or A/B test data. Consider returning `percentile: null` and widening the `DealScore` type, or a dedicated `noHistoryFlag` boolean. Non-blocking.

---

## Recommendation

The Deal Score engine is mathematically correct: all 8 golden cases produce the right percentile, confidence, and verdict by manual trace; all 5 adversarial edge cases are handled safely including empty history. The critical safety gate — blocking "Great" verdicts when confidence is low — is correctly implemented and would prevent misleading scores from reaching real travelers with thin data. The adapter layer is structurally sound with proper error encapsulation.

The issues found are operational risks (affiliate marker, FX rate) and test-harness weaknesses (loose eval bounds), not scoring correctness bugs. Phase 2 can proceed, but Issue #2 (silent marker omission) and Issue #4 (hardcoded FX rate) should be tracked as P1 items to resolve before public launch to avoid revenue and data-quality problems.
