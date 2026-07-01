# AUDIT-DEAL-SCORE-HOTEL-EXPLANATION-PARITY-01

Date: 2026-07-01
Role: Senior QA
Scope: hotel Deal Score explanation parity against flight Deal Score presentation. No feature code changed.

## Files inspected

- `app/page.tsx`
- `app/components/DealBadge.tsx`
- `app/components/FlightCard.tsx`
- `app/components/HotelCard.tsx`
- `components/flights/FlightResults.tsx`
- `lib/scoring/scoreDeal.ts`
- `lib/types.ts`
- `app/api/score/route.ts`

Requested file mismatch: `components/hotels/HotelResults.tsx` and `components/hotels/HotelCard.tsx` do not exist in this worktree. The executable hotel result card is `app/components/HotelCard.tsx`, rendered directly from `app/page.tsx`.

## Side-by-side Deal Score parity

| Area | Flights | Hotels | QA result |
| --- | --- | --- | --- |
| Score label | `Deal Score` appears in the flight score banner (`app/components/FlightCard.tsx:183` to `app/components/FlightCard.tsx:192`). | `Deal Score` appears in the hotel score panel (`app/components/HotelCard.tsx:138` to `app/components/HotelCard.tsx:166`). | Pass when score exists. |
| Verdict badge | Shared `DealBadge`; low confidence becomes `Limited history` instead of `Great`/`Good` (`app/components/DealBadge.tsx:14` to `app/components/DealBadge.tsx:25`). | Same shared `DealBadge` (`app/components/HotelCard.tsx:145`). | Pass. |
| Percentile/ranking fact | High-confidence flight score shows percentile; low-confidence score says not enough route history (`app/components/FlightCard.tsx:173` to `app/components/FlightCard.tsx:187`). | High-confidence hotel score shows ordinal percentile; low-confidence score says not enough hotel history (`app/components/HotelCard.tsx:126` to `app/components/HotelCard.tsx:142`). | Pass when score exists. Hotel ordinal copy is clearer than flight's `22th`-style risk. |
| Supporting facts | Flight score banner shows explanation only; route/time/stops/cabin evidence is elsewhere in the card (`app/components/FlightCard.tsx:270` to `app/components/FlightCard.tsx:350`). | Hotel score panel shows usual price, vs median, low-confidence warning, and explanation (`app/components/HotelCard.tsx:147` to `app/components/HotelCard.tsx:166`). | Hotel score evidence is visible and specific when present. |
| Confidence honesty | `scoreDeal` caps low-confidence scores to `Typical` and forces percentile to 50 (`lib/scoring/scoreDeal.ts:91` to `lib/scoring/scoreDeal.ts:127`). Flight UI repeats the limited-history state. | Same scoring cap and shared badge. Hotel UI adds "Treat this as a rough comparison" (`app/components/HotelCard.tsx:161` to `app/components/HotelCard.tsx:164`). | Pass. Hotels do not overclaim Great on thin data. |
| Missing score state | Flight cards always render an explicit unavailable panel when score is null (`app/components/FlightCard.tsx:197` to `app/components/FlightCard.tsx:213`, `app/components/FlightCard.tsx:344` to `app/components/FlightCard.tsx:350`). | Hotel cards render nothing when score is null after loading (`app/components/HotelCard.tsx:240` to `app/components/HotelCard.tsx:244`). | Fail. Core score evidence disappears for hotels. |
| Result ranking context | Flights expose `Best deal` / `Lowest price`, show result counts, and announce score-ranking updates (`components/flights/FlightResults.tsx:227` to `components/flights/FlightResults.tsx:286`). `app/page.tsx` sorts visible flights through `sortFlights` (`app/page.tsx:889` to `app/page.tsx:907`). | Hotels are mapped in provider order with no hotel sort control, ranking summary, or "scores still loading" ordering notice (`app/page.tsx:1437` to `app/page.tsx:1483`). | Fail. A scored hotel card can look ranked by Deal Score even when the list is not. |

## Findings

### P1 - Hotel Deal Score can disappear silently when score retrieval fails

Repro/data condition:

1. Run a valid round-trip destination search that returns hotels.
2. Let `/api/score?type=hotel...` fail because `hotel_snapshots` query fails, score params are invalid, or the client fetch rejects (`app/api/score/route.ts:40` to `app/api/score/route.ts:84`).
3. `fireHotelScore` stores `null` for that hotel score (`app/page.tsx:611` to `app/page.tsx:631`).
4. `HotelCard` renders a skeleton while loading, renders `HotelDealPanel` when a score exists, and renders nothing for `score === null` (`app/components/HotelCard.tsx:240` to `app/components/HotelCard.tsx:244`).

Visible defect: hotel cards can lose the product's core differentiator with no "Deal Score unavailable" explanation. Flight cards do the honest thing and keep an unavailable panel visible (`app/components/FlightCard.tsx:197` to `app/components/FlightCard.tsx:213`). This breaks confidence parity and makes hotel ranking feel less trustworthy.

### P1 - Hotels show Deal Scores without list-level ranking context

Repro/data condition:

1. Run a search that returns multiple hotels with score panels.
2. Open the Hotels tab on desktop.
3. Hotel cards render in the provider array order (`app/page.tsx:1437` to `app/page.tsx:1483`).
4. There is no hotel equivalent to flight sort controls, result summary, or "Updating deal ranking as scores finish" message (`components/flights/FlightResults.tsx:227` to `components/flights/FlightResults.tsx:286`).

Visible defect: a paid user sees Deal Score evidence on hotel cards but no statement of whether the list is sorted by score, price, provider order, or availability. Flights explicitly say how ranking is working and update as scores settle; hotels do not. This is especially risky while hotel scores are loading asynchronously, because the first visible card is not necessarily the best hotel deal.

### P2 - Hotel supporting evidence includes an unsupported "Guest rating" if upstream data is not a true review score

Repro/data condition:

1. `HotelOffer.rating` is optional in the shared type (`lib/types.ts:47` to `lib/types.ts:56`).
2. `HotelCard` treats any positive `hotel.rating` as a guest rating (`app/components/HotelCard.tsx:185`) and renders `Guest rating` plus qualitative labels like `Excellent`, `Very good`, or `Good` (`app/components/HotelCard.tsx:30` to `app/components/HotelCard.tsx:45`, `app/components/HotelCard.tsx:229` to `app/components/HotelCard.tsx:235`).

Visible defect: this is not inside the Deal Score sentence, but it sits next to the score as selection evidence. If provider data does not prove this is a review rating, the card gives hotels stronger qualitative support than the data can defend. This remains a blocker for paid-user trust around hotel ranking and selection.

## Score copy review

The shared scoring function is conservative:

- No comparable history returns `Typical`, `low`, and "No price history..." copy (`lib/scoring/scoreDeal.ts:75` to `lib/scoring/scoreDeal.ts:88`).
- Fewer than 10 comparable points returns `low` confidence (`lib/scoring/scoreDeal.ts:91` to `lib/scoring/scoreDeal.ts:93`).
- Low confidence is capped to `Typical`, never `Great` (`lib/scoring/scoreDeal.ts:121` to `lib/scoring/scoreDeal.ts:127`).
- High-confidence explanations cite current price, percent vs median, usual median price, context label, and 90-day window (`lib/scoring/scoreDeal.ts:135` to `lib/scoring/scoreDeal.ts:149`).

I did not find generic, promotional, or unsupported hotel Deal Score explanation text when a score exists. The hotel explanation uses the same source as flights and swaps the context label from `route` to `hotel` (`lib/scoring/scoreDeal.ts:41` to `lib/scoring/scoreDeal.ts:43`). The problem is presentation parity around missing score and ranking context, not the sentence generated by `scoreDeal`.

## State verification

Loading:

- Flights show list-level loading copy and score skeletons (`components/flights/FlightResults.tsx:299` to `components/flights/FlightResults.tsx:318`, `app/components/FlightCard.tsx:344` to `app/components/FlightCard.tsx:345`).
- Hotels show card skeletons while the hotel tab is active and per-card score skeletons while hotel scores load (`app/page.tsx:1437` to `app/page.tsx:1450`, `app/components/HotelCard.tsx:240` to `app/components/HotelCard.tsx:241`).

Empty/error:

- Flights have provider/dates/filter-specific empty states and retry/edit actions (`components/flights/FlightResults.tsx:159` to `components/flights/FlightResults.tsx:199`, `components/flights/FlightResults.tsx:320` to `components/flights/FlightResults.tsx:331`).
- Hotels have unavailable/skipped/empty copy from `hotelUnavailableCopy` and an edit action (`app/page.tsx:916` to `app/page.tsx:934`, `app/page.tsx:1452` to `app/page.tsx:1471`).

Manual desktop ranking-context verification:

- Desktop grid is three columns at `lg` for both flights and hotels (`components/flights/FlightResults.tsx:334`, `app/page.tsx:1473`).
- Flight results expose visible sort controls and state text before scored cards; hotel results do not expose any sort/ranking context before scored cards.
- Blocker: no browser automation package is installed in this repo, and the audit did not add tooling. This verification is manual source/render-path inspection, not a screenshot-backed browser run.

Manual mobile 375px verification:

- At 375px, hotel cards render as a single column because the grid is `grid-cols-1` until `sm` (`app/page.tsx:1438`, `app/page.tsx:1473`).
- Hotel price and primary action stack vertically until `sm`, so the Deal Score panel does not share a row with price or CTA on mobile (`app/components/HotelCard.tsx:248` to `app/components/HotelCard.tsx:254`).
- Long hotel names clamp to two lines, areas truncate, and hotel facts wrap (`app/components/HotelCard.tsx:207` to `app/components/HotelCard.tsx:237`).
- Flight cards likewise stack price in the header grid until `sm` and keep the CTA full width (`app/components/FlightCard.tsx:270` to `app/components/FlightCard.tsx:350`).
- Blocker: this is manual responsive-class verification without a browser screenshot because the repo has Jest/node tooling but no Playwright or jsdom browser harness.

## Blockers and out-of-scope notes

- `components/hotels/HotelResults.tsx` and `components/hotels/HotelCard.tsx` are absent. Hotel results are embedded in `app/page.tsx`.
- Hotel score inputs are only `hotelId`, current nightly cents, and currency in the score API (`app/api/score/route.ts:48` to `app/api/score/route.ts:83`). The UI cannot explain stay length, taxes/fees, or area-level market context from those inputs.
- I did not change score algorithms, provider adapters, hotel baselines, or result sorting because the ticket is an audit and those changes are out of scope.

## Verification

- `npx tsc --noEmit --incremental false` - passed.
- `npm test -- --runInBand` - passed: 20 suites, 176 tests.

## Changes

Audit document added only.
