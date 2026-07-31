# UXD-HOTEL-CURRENCY-COMPARISON-01: Hotel Currency and Price Comparison Confidence Discovery

Date: 2026-07-31
Stage: UX Discovery
Persona: Senior UX Strategist

## User Pain Point

A traveller shopping hotels in a foreign market cannot tell that every nightly rate on screen has already been converted to USD by the provider at an undisclosed rate, so they have no way to judge whether a price is genuinely good in the market they are booking in — and when an offer does arrive in a non-USD currency, expaify silently withholds the Deal Score that is the entire reason they came.

## Who Is Affected And Where

The person affected is a traveller comparing hotels in a market whose local currency is not USD — a Lisbon, Tokyo, or Mexico City stay — either because they live abroad, hold a non-USD card, or simply know the local price level and want to sanity-check it. They are affected at three steps:

- **Results comparison (`app/components/HotelCard.tsx`, `app/components/ui/DealCard.tsx`, `app/deals/DealFeed.tsx`):** the scan moment. Every card renders `formatMoney(hotel.pricePerNight)` as a USD figure with a trailing ISO code. Nothing on the card says that the number is a provider-side conversion rather than the property's own price.
- **Comparison controls (`app/deals/DealFeed.tsx`):** the filtering moment. The nightly-price filter offers `Under $100 / $150 / $200` (lines 96–100) and the sort offers `Lowest nightly price` (line 72). Both are stated in dollars and operate on raw `priceCents`, with no statement of the currency basis they assume.
- **Deal Score (`lib/scoring/scoreDeal.ts`, `app/components/DealScorePanel.tsx`):** the judgement moment. This is where a cross-currency offer fails hardest, and where the failure is invisible.

Both first-time and returning users are affected, but the traveller who *knows* the local market carries the highest trust risk: they are the one most likely to notice that a converted figure does not match what the property charges, and the least likely to accept "trust us" as an answer.

## Measurable Signal

The problem is present wherever the product asks a user to compare, filter, or judge a hotel price without stating the currency basis of that comparison. Concretely, in the current code:

- **Conversion happens at the provider, undisclosed.** `lib/providers/hotellook.ts` requests `&currency=USD` (line 479) and then hardcodes `currency: 'USD'` on every offer it emits (line 518); `lib/providers/bookingComRapidApi.ts` sets `currency_code=USD` (line 87). So the USD figure on a Lisbon property is the *provider's* conversion at the provider's rate on the day of the request — a materially different number from the property's EUR rate — and no surface in the product says so. A cached response makes this worse: rates are cached for 6h, so the conversion is also stale by up to six hours.
- **Cross-currency offers lose the Deal Score entirely.** `lib/scoring/scoreDeal.ts` filters history to same-currency points only (`history.filter((h) => h.currency === currency)`, line 75) and, on an empty result, returns `No comparable {CURRENCY} price history available for this hotel.` (line 89). An offer that arrives in EUR or JPY is therefore not scored *low-confidence* — it is not scored at all, and renders as the generic `Score unavailable` chip in `HotelCard` (line 699). The user is given no reason, and the reason is currency. The product's differentiator silently disappears on exactly the searches where a traveller most needs help judging value.
- **Comparison controls assert a currency they do not verify.** `DealFeed.tsx` line 114 builds the filter summary as `under $${Math.round(filters.maxPriceCents / 100)} a night` with a hardcoded `$`, and the deal rows are stamped `currency: 'USD'` client-side regardless of provider origin (`app/page.tsx` lines 45–46; `DealFeed.tsx` lines 1797, 1814). The control tells the user its basis is dollars; nothing in the data path guarantees that.
- **The one cross-currency comparison that exists is silent about itself.** `app/api/search/route.ts` sorts by `a.price.currency.localeCompare(b.price.currency) || a.price.priceCents - b.price.priceCents` (lines 101–103). This is a defensible choice — it refuses to compare across currencies by grouping instead — but the user reading a "cheapest first" list sees an ordering that is not cheapest-first and is told nothing.
- **The conversion helper cannot express uncertainty.** `lib/fx/convert.ts` returns a bare `number`, carries one hardcoded rate (`RUB → USD`), and passes every other currency through unchanged on the assumption that it is already USD. There is no structure at the conversion boundary to carry a rate, a timestamp, or an "estimated" flag — so even if design asks for provenance copy, there is currently nothing to render.

Downstream measures for UXR to define: (1) **comprehension** — after reading a card, can the user say whether the figure is the property's own price or a conversion, and at whose rate; (2) **score-loss visibility** — share of hotel results rendering `Score unavailable` where the true cause is a currency mismatch rather than thin history; (3) **filter trust** — whether users interpret `Under $150` as a guarantee about the currency basis of the results.

## Constraints

1. **No guaranteed rates, no FX feature.** Any disclosure must present conversion as the provider's, at an unknown rate and an unknown moment, and must never state or imply a rate expaify stands behind. This work must not add live FX, rate lookup, or a conversion engine, and must preserve the money contract (`{ priceCents: number; currency: string }`, integer minor units, no floats).
2. **Preserve provider-native payment currency.** The provider settles in whatever currency it settles in. Nothing here may change what is requested from or sent to a provider, alter `currency=USD` request parameters, change deeplinks or affiliate markers, or weaken the same-currency rule in `scoreDeal.ts`. The scoring rule is correct — only its silence is the defect.
3. **Smallest viable disclosure, mobile-intact.** The output must be the minimum copy and structure that makes a comparison legible, using existing tokens, fitting at 375px and 1280px without crowding the price block, preserving every component contract, export, and accessible name (`HotelCard` `reviewAriaLabel`, `PriceUnavailable` `aria-label`). This is repair, not a new feature: no currency picker, no comparison table, no second price line unless it replaces something.

## Success Statement

This is solved when a first-time traveller comparing hotels in a foreign market can tell, from the card alone, that the price shown is the provider's conversion rather than the property's own figure, and — when a Deal Score is missing — can tell that currency is the reason, without opening details and without being shown a rate expaify cannot stand behind.

## Handoff Notes For UXR

Currency-context segments to evaluate separately, since their needs diverge:

- **Converted-to-USD offer (the common case).** Provider returned USD because expaify asked for USD. Price is comparable to other results and to history; the score works. The gap is provenance only.
- **Native non-USD offer.** Price is not comparable to a USD-based filter, sort, or baseline, and the Deal Score is dropped with no stated reason. This is the segment with the real failure.
- **Mixed-currency result set.** Sorting and the `Under $X` filter both become claims the product cannot support.

Directives should establish: what the minimum provenance line says on a card and where it sits relative to the existing `per night before taxes and fees` / `Rate from {provider}` / `Last-checked time unavailable` stack; the replacement copy for `Score unavailable` when the cause is currency mismatch rather than thin history; and whether the price filter and sort must state their currency basis or be constrained to a single-currency result set.

Two conflicts UXR must resolve rather than inherit:

- The ticket names **currency-control use** as a measurable signal, but no currency control exists anywhere in the codebase (no `preferredCurrency`, `displayCurrency`, or selector in `app/` or `lib/`), and `docs/pipeline/local-currency-payment/01-discovery.md` constraint 1 explicitly rules currency selection out of scope. Treat currency-control use as unmeasurable today and substitute comprehension measures, or escalate the scope question — do not design a picker on the strength of that phrase.
- Scope boundaries against shipped adjacent work: `results-currency-localization` owns formatting consistency of the currency basis across surfaces; `local-currency-payment` owns charge-currency, payment-timing, and FX-cost disclosure at handoff; `hotel-total-stay-cost` owns exact-vs-estimated totals. This ticket owns only **comparability** — whether two prices on screen can honestly be compared, and what happens to the Deal Score when they cannot. Reuse their copy contracts; do not restate them.
