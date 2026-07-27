# 01 — Discovery: Deal Score clarity for a first-time user

Ticket: `UXD-DEAL-SCORE-CLARITY-01`
Stage: UX Discovery
Status: complete — handoff to `UXR-DEAL-SCORE-CLARITY-01`

---

## Problem statement

**A first-time user cannot say why a fare or rate is rated Great, Good, or Typical, because the one number the panel leads with — "23rd percentile" — is never explained anywhere in the product, and the surrounding surfaces publish three mutually contradictory definitions of what counts as a deal.**

---

## Who is affected, and where

| Surface | File | What a first-time user sees |
|---|---|---|
| Flight result card | `app/components/FlightCard.tsx:564` | Shared `DealScorePanel`, scope `route` |
| Hotel result card | `app/components/HotelCard.tsx:984` | Shared `DealScorePanel`, scope `hotel` |
| Results header stat | `components/flights/FlightResults.tsx:1029` | "Great deals / N / Ranked well against recent route history." |
| Saved deal detail | `app/deals/[dealId]/page.tsx:393` | Shared `DealScorePanel` + a separate discount-based hero |
| Deal feed / landing card | `app/components/ui/DealCard.tsx:96`, `app/components/ui/DealChip.tsx:9` | "usually $X", "−32% vs usual", "Based on 43 price checks over 60 days" — **no verdict, no percentile** |
| Booking review (hotel) | `app/book/BookingFlow.tsx:356-360` | Hardcoded "Deal Score unavailable" |
| Booking review (flight) | `app/book/BookingFlow.tsx:278-315` | **No Deal Score at all** |

The affected step is the moment of judgement: scanning results, and the final review screen before provider handoff. The user is a first-time visitor with no prior exposure to expaify's vocabulary — the exact person the Deal Score exists to convince.

---

## What the panel actually says today

Reading `app/components/DealScorePanel.tsx` and `lib/scoring/scoreDeal.ts`, a high-confidence Good fare renders:

```
DEAL SCORE                                    [ Good ]
Compared with route history
23rd percentile
USUAL FARE      VS USUAL          WINDOW
$412.00         9% below usual    Last 90 days
$375.00 — about 9% below the usual $412.00 for this route over the last 90 days.
```

The explanation sentence (`scoreDeal.ts:143-149`) is genuinely good plain language. Everything above it is not.

---

## Measurable signals that the problem exists

These are concrete, checkable defects in shipped copy — not opinions.

### 1. "23rd percentile" is undefined everywhere in the product

`DealScorePanel.tsx:165` renders `${formatOrdinal(score.percentile)} percentile` as the **second line of the panel**, directly under the verdict badge. Grepping every `.tsx`/`.ts` outside tests (`grep -rn "percentile" app components lib`) returns only the render site, the type, and the maths. There is no tooltip, no glossary, no "lower is cheaper", no FAQ entry. A first-time user has no way to know whether 23 is good or bad, or that the scale runs the "wrong" way (low = cheap).

This is the sharpest single point of confusion. It is also the most prominent line of copy in the panel after the badge.

### 2. Three published rules for "what is a deal", all different, all live

| Where | Copy | Rule stated |
|---|---|---|
| `lib/pipeline/dealRules.ts:9-11` (**ground truth**) | — | ≤70% of median, min **3** snapshots, 60-day window |
| `app/page.tsx:237` | "A deal is only flagged when a price falls 30% below its rolling median — with at least 3 days of price history behind it." | matches code |
| `app/components/FaqAccordion.tsx:13` | "…when a price drops to 70% or below its median — with at least **8** historical data points…" | **wrong — code says 3** |
| `app/deals/page.tsx:22` | "…hotel deals 30–50% below their 60-day **average** price." | median ≠ average |
| `lib/scoring/scoreDeal.ts:127-133` (Deal Score) | — | **percentile ≤15**, min **10** points, **90**-day window |

So the same product tells a first-time user that a deal means 30%-below-median with 3 checks (homepage), 8 data points (FAQ), 30–50% below a 60-day average (deals page), and — on the actual result card — ≤15th percentile over 90 days with 10 points. The FAQ figure is factually false against `MIN_SNAPSHOTS = 3`.

### 3. The 90-day window claim is asserted regardless of the real data span

`DealScorePanel.tsx:98` hardcodes `<Fact label="Window" value="Last 90 days" />`. It renders identically whether the score was built from 10 price points or 400, and whether those points span 90 days or the last 4. `getBaseline` queries a 90-day *ceiling* (`lib/db/getBaseline.ts:16`), not a guarantee. Meanwhile `DealCard.tsx:130` on the same product does the honest thing: "Based on 43 price checks over 60 days."

### 4. Low-confidence panels still print falsely precise numbers

`DealScorePanel.tsx:191-201` renders `EvidenceGrid` **before** the low-confidence warning and unconditionally of confidence. A low-confidence hotel therefore shows:

- badge "Limited history"
- "Not enough comparable prices for a confirmed rating"
- **"Usual nightly rate $180.00"** and **"Vs usual 25% below usual"** — exact, unqualified
- then the warning "Fewer than 10 comparable prices are available…"

The precise numbers arrive first and win. This was raised as P0 in `AUDIT-DEAL-SCORE-LOW-CONFIDENCE-PRESENTATION-01.md` and survived the refactor into the shared panel.

Related: low confidence replaces the verdict entirely with "Limited history" (`DealBadge.tsx:16`). The user gets no answer to "is this a good price?" — not even "we don't know yet, here's the raw comparison."

### 5. "Typical" can appear next to "9% below usual"

Verdict boundaries are percentile-based (`scoreDeal.ts:127-133`) but the evidence row is median-based. At the 45th percentile a fare can legitimately be several percent below the median. The panel then reads badge **Typical** next to **"Vs usual: 5% below usual"** and an explanation ending "…about 5% below the usual $412.00." Two adjacent lines pointing in opposite directions, with nothing telling the user that the badge is about rank and the percentage is about the middle.

### 6. The Deal Score disappears at the highest-stakes moment

The booking review is the last screen before provider handoff. `FareSummary` (`BookingFlow.tsx:278-315`) shows route, carrier, stops, price basis, offer reference — and no Deal Score. `HotelDecisionSummary` (`BookingFlow.tsx:356-360`) renders a **hardcoded** "Deal Score unavailable / We could not compare this nightly rate with enough recent hotel prices." — it is a static branch with no scoring path behind it, so it says "unavailable" even for a hotel that was scored Great two clicks earlier.

### 7. Two vocabularies for one concept

The deal feed and landing speak in **discount** ("−32% vs usual", "usually $412", "Save $37/night", "Based on 43 price checks"). The result cards and detail panel speak in **rank** ("Good", "23rd percentile", "Vs usual"). On `app/deals/[dealId]/page.tsx` both appear on the same page — a gold "−32% vs usual" chip lineage above a `DealScorePanel` that may say "Typical" or "Limited history" for the same hotel.

---

## Missed trust-building opportunity

The panel never says **how many prices it compared against** — the single fact that would make the verdict legible and the confidence state self-explaining. `DealScore` (`lib/types.ts:86-94`) carries `percentile`, `pctVsMedian`, `medianCents`, `currency`, `verdict`, `confidence`, `explanation` — no sample size. Yet `scoreDeal` already computes `comparableHistory.length` at `scoreDeal.ts:73` and branches on it at line 93.

This is the one **real backend gap** found: adding `sampleSize: number` (and optionally the observed date span) to `DealScore` requires no new query, no new provider call, no new column — it is a value already in scope, discarded before return. Everything else identified here is a copy and hierarchy problem.

With it, "Limited history" becomes "Compared with 4 prices — not enough to confirm a rating", and "Window: Last 90 days" becomes "43 prices over the last 90 days". That is the difference between a claim and evidence.

---

## The sharpest point of confusion

**The panel leads with a rank the user cannot interpret, and buries the sentence they can.**

`percentile` is line 2 of the panel at `DealScorePanel.tsx:188`. The plain-language explanation — the only string that actually answers "why is this rated that way" — is the **last** element, at line 202, in `text-2` secondary colour at `text-xs`, below a three-column fact grid. The hierarchy is exactly inverted: jargon is promoted, the explanation is demoted to a footnote.

---

## Constraints the fix must respect

1. **No new colour or type tokens.** Work inside `app/globals.css`: `--success`/`--success-soft`, `--brand`/`--brand-soft`, `--warning`/`--warning-soft`, `--bg-raised`, `--border`, `--border-strong`, `--text-1/2/3`, `--radius-card`, `--radius-control`. The existing verdict→token mapping in `DealBadge.tsx` and `panelClasses()` stays as-is.
2. **One new backend field, and only one.** `sampleSize` on `DealScore`, derived from `comparableHistory.length` already computed in `scoreDeal`. It must be optional at the presentation layer so persisted/normalised scores (`lib/booking/config.ts:581-601`, `lib/deals/dealDetail.ts`) that lack it degrade to today's copy rather than crashing or claiming a count of 0. No new provider call, no new query, no schema change. Money stays `{ priceCents, currency }`.
3. **Preserve every existing contract and state.** `DealScorePanel`'s props (`score`, `loading`, `scope`, `priceNoun`, `unavailableCopy`) and `DealBadge`'s (`verdict`, `confidence`) must not be renamed or removed — six call sites plus `app/components/__tests__/scorePresentation.test.tsx` depend on them. All four states (loading, unavailable, low-confidence, scored) must survive, remain screen-reader labelled, and remain readable at 375px where the evidence grid is only two columns wide.

---

## Success statement

**This is solved when a first-time user, looking at any single deal card without scrolling or hovering, can state in one sentence why it is rated Great, Good, or Typical — naming the comparison price and how many prices it was compared against — without asking, and finds the same rule stated identically on the results card, the deal detail page, the booking review, and the FAQ.**

Supporting checks:
- No visible string contains an unexplained ordinal percentile.
- The FAQ minimum-history figure matches `MIN_SNAPSHOTS`.
- A low-confidence panel shows no unqualified precise median comparison ahead of its warning.
- The booking review shows the same verdict the user saw in results, or an honest reason it cannot.

---

## Out of scope for this feature (flagged, not fixed here)

- Reconciling the two deal *systems* — `lib/pipeline/dealRules.ts` (60-day, 30%-below, 3 snapshots) and `lib/scoring/scoreDeal.ts` (90-day, percentile, 10 points) — is a product decision above this ticket. This feature must at minimum stop them from contradicting each other in copy.
- `bestDealCount` at `components/flights/FlightResults.tsx:643` counts `verdict === 'Great'` without checking confidence. Currently safe because `scoreDeal` caps low-confidence to `Typical`, but the presentation layer does not enforce it. Noted for UXR.

---

## Handoff

Next: `UXR-DEAL-SCORE-CLARITY-01` — audit `DealScorePanel`/`DealBadge` against a reference pattern (Google Flights price insights, Booking.com "Great value today") and produce 3–5 testable directives covering: percentile presentation, sample-size disclosure, low-confidence evidence ordering, cross-surface rule consistency, and booking-review continuity.
