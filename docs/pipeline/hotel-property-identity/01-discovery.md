# UXD-HOTEL-PROPERTY-IDENTITY-01: Hotel Property Identity Confidence

Date: 2026-07-31
Stage: UX Discovery (UXD)
Persona: Senior UX Strategist
Feature slug: `hotel-property-identity`

---

## User Pain Point

A hotel result identifies itself with a provider name string and a city, so when two properties share a brand name in the same market the traveler cannot tell **which building they are about to book** — and the app never signals that the ambiguity exists, so the user discovers it at the provider handoff or after payment.

---

## Scope Note: What This Ticket Is And Is Not

This ticket is about **distinguishing one property from another property**. It is a set-level problem: a cue only counts as an identity cue if it *differs* between two candidate properties. That framing is what separates it from adjacent shipped work.

Already scoped or shipped elsewhere — **do not re-solve**:

| Adjacent ticket | Owns | Boundary |
|---|---|---|
| `hotel-photo-match` | What the single photo *means* relative to the rate (labeling, alt text, fallback) | Here the photo matters only as a **discriminator between two properties**, not as a claim about the room |
| `hotel-location-pin` / `hotel-location-decision-context` | Location *precision* and how far the property is from an anchor | Here location matters only as **"is this the same building as the other one"** |
| `hotel-neighborhood-context` | Whether the neighborhood is a good place to stay | Here neighborhood is a **disambiguation token**, not a quality judgment |
| `results-duplicate-offer-trust` | "Is expaify padding the list with repeats?" | That ticket suppresses/groups **the same property shown twice**. This ticket separates **two genuinely different properties that look the same**. They are inverse problems and must not be merged: dedupe logic that collapses same-name cards would actively *cause* this ticket's failure mode. |
| `hotel-rating-source-confidence`, `hotel-quality-snapshot` | Class/rating trust | Star class is not an identity cue — sibling chain properties routinely share it |

Explicitly out of scope per the ticket constraint: **no map, no embedded map tile, no map-dependent interaction.** Identity must be resolvable from text and the one existing image.

---

## Where The Problem Actually Lives

The repo has two hotel code paths, and only one of them ships. This is the single most important fact for downstream stages.

**Path A — the live path (deals feed → deal detail → OTA handoff).** This is what a user actually touches.
- `app/deals/page.tsx` → `app/deals/DealFeed.tsx` → `app/components/ui/DealCard.tsx`
- `app/deals/[dealId]/page.tsx`
- `app/components/HotelDealCriteria.tsx` (`HotelDealCriteriaHandoff`) → OTA links

**Path B — the rich but unmounted path.** `app/components/HotelCard.tsx` is a 1,101-line component carrying `HotelLocation` evidence, precision states, and address handling. A repo-wide grep for `HotelCard` outside `docs/` and `__tests__/` returns only its own definition and an unrelated `HotelCardEligibilityLine` import. **It is not rendered by any route.** Its location sophistication is therefore not available to any user today.

Downstream stages must solve this on **Path A**. Designing against `HotelCard` would ship an improvement no user can see.

---

## Who Is Affected, And At Which Step

**Who:** Paid-intent travelers in a market with chain density — airport corridors, downtown cores, convention districts. Two populations are most exposed:
1. **First-time users** who have not learned that "Hampton Inn Austin" is not one hotel. They have no prior that the name is ambiguous, so they do not think to check.
2. **Screen-reader users**, who get strictly less disambiguating information than sighted users (see Signal 4) — the photo, the only remaining discriminator, is unavailable to them.

**Flow, with the cost of the mistake rising at each step:**

1. **Results scan** (`DealCard`, `app/components/ui/DealCard.tsx:74-80`) — the user forms a belief about which property this is. Cost of error here: zero, and it is the only cheap place to fix it.
2. **Detail open** (`app/deals/[dealId]/page.tsx:349-351`) — the user seeks confirmation. Today the detail adds **no identity information the card did not already have**, so an ambiguity-driven open returns nothing and the user either opens the sibling too or guesses.
3. **Provider handoff** (`HotelDealCriteriaHandoff`, `app/components/HotelDealCriteria.tsx:121-160`) — the user lands on an OTA page showing a street address expaify never showed. Either the address is unfamiliar and they backtrack (abandonment at the revenue moment), or they do not notice and book the wrong building.
4. **Post-booking** — a non-refundable rate at the wrong property. Unrecoverable, and expaify is blamed for it whether or not the provider link was correct.

The failure is *silent* through step 3. Nothing in the product tells the user there is a decision to make.

---

## Measurable Signal — Evidence In The Code

These are observable facts about the current implementation, not opinions.

**1. On the live path, identity is name + stars + city + photo. Nothing else exists.**
`DealCard` renders exactly one identity line (`app/components/ui/DealCard.tsx:74-80`):
```
<h3 className="text-body line-clamp-2 ...">{deal.hotelName}</h3>
<p>{starChars(deal.stars)} · {deal.city} · {deal.checkInWindow}</p>
```
For two "Courtyard by Marriott" properties in Austin with the same class and overlapping dates, **every rendered character in that block is identical.** The only remaining discriminators are the photo (`:118`) and the price.

**2. The database has no address column at all on the live path.**
`lib/db/schema.sql:125-148` (`deals`) carries `hotel_id, hotel_name, stars, photo_url, market_id, …`. `lib/db/schema.sql:104-119` (`price_snapshots`) carries the same identity fields. There is **no address, no street, no neighborhood, no postal code, no latitude/longitude** in either table. `app/api/deals/route.ts:61,85` maps through only `hotel_name`. The strongest available identity cue — the street address — is not persisted anywhere on the surface that ships.

**3. The detail page hardcodes the "no address" disclosure regardless of evidence.**
`app/deals/[dealId]/page.tsx:349-351`:
```
<h1 ...>{deal.hotel_name}</h1>
<p>Area: {deal.city}</p>
<p>Provider supplied an area, not a street address.</p>
```
That third line is a **static string**, not derived from any evidence field. The app has already conceded in copy that it cannot locate the property — and it says so at the exact step where the user came looking for confirmation. Note the contrast with Path B, where the equivalent copy is *computed* from `location.precision` (`app/components/hotelLocationContext.ts:37-96`).

**4. Screen-reader users receive a strictly weaker identity signal.**
`app/components/ui/DealCard.tsx:146` sets `aria-label={\`View deal: ${deal.hotelName}\`}`. Two sibling properties therefore produce **two links with byte-identical accessible names**, and the photo at `:118` is the discriminator they cannot use. The star row at `:78` is `aria-hidden` with a separate `aria-label`, so it adds no differentiation either. This is a WCAG 2.4.4-adjacent defect that exists *only* in the collision case, which is precisely why per-card review has never caught it.

**5. Ambiguity is never computed, because nothing looks across the result set.**
`DealFeed` renders the deals array with no cross-item comparison; `trackCardOpen` (`app/deals/DealFeed.tsx:1346-1356`) emits `hotel_result_card_opened` with `card_position` and sort dimensions but **no collision dimension**. There is no name-normalization helper, no sibling count, no `identityConfidence` field anywhere in `lib/`. Identity uniqueness is a property of the *set*, and the codebase only ever reasons about a *card*.

**6. The ambiguity survives the handoff boundary.**
On the deals path the booking context is assembled with `area: deal.city` and **no `location` object** (`app/deals/[dealId]/page.tsx:212-222`). Any surface consuming it via `getHotelLocationDisplay` falls through to the `search_area`/`missing` branches (`app/components/hotelLocationContext.ts:78-95`), which return the searched destination or `'Confirm with provider'`. So the last expaify screen before the OTA shows the user the same city string they typed in — offered back to them as property identification.

**7. The provider does return address data. The live path discards it.**
`lib/providers/hotellook.ts:104-151` normalizes `address`, `providerLocationName`, `lat`, `lng` into a graded `HotelLocation`. That structure reaches `HotelOffer.location` (`lib/types.ts:560`) and is rendered well by `HotelCard`. It is dropped entirely before anything reaches `deals` or `price_snapshots`. **The gap is not provider capability — it is a persistence and rendering gap inside expaify.**

---

## Constraints The Solution Must Respect

1. **Provider-supported data only, and honestly graded.** Identity cues must come from provider-supplied name, address, neighborhood/area, and imagery. No inferred addresses, no geocoding a name into a street, no "probably the airport location." Where a cue is absent, the UI must say it is absent rather than substituting the search string — the existing `HotelLocationPrecision` ladder (`exact | coordinates | area | search_area | missing`, `lib/types.ts:387`) is the established vocabulary for this and should be reused, not reinvented.

2. **No map dependency, and no new provider calls.** The solution must work in text plus the one existing `photo_url`. It must not add a per-card provider request to resolve identity — that would violate the caching contract and put a network dependency on the results scan.

3. **Accessibility parity and mobile integrity.** Whatever disambiguates a property visually must disambiguate it in the accessible name too; a photo-only fix is not a fix. The cue must fit `DealCard` at 375px without pushing price, Deal Score, or the CTA below the fold, and without overlapping text. Identity cues compete for the same vertical space as the Deal Score — the differentiator — so the design cannot simply add lines.

4. **Do not suppress the collision.** Anything that hides, merges, or collapses same-name cards makes this problem worse, not better, and collides head-on with `results-duplicate-offer-trust`. The user must see both properties *and* see that they are two.

---

## Success Statement

**This is solved when a first-time user looking at two same-brand properties in the same city can tell, from the results card alone, that they are two different buildings and which one is which — without opening both detail pages, without a map, and without discovering the difference at the provider handoff.**

Secondary: a screen-reader user reaches the same conclusion from the accessible name alone.

---

## Open Question For Downstream — Flag, Do Not Guess

**The strongest identity cue is not persisted on the shipping path.** Per Signal 2, `deals` and `price_snapshots` have no address or neighborhood column, and per Signal 7 the provider does return that data. This means a genuine fix on Path A likely requires a schema and pipeline change (`lib/db/schema.sql`, `scripts/snapshot-job.ts`, `app/api/deals/route.ts`) — a **DEV** stage, not UI-only.

UXR must determine and state explicitly which of these the design targets:

- **(a) Persist and render address/neighborhood** — highest-confidence disambiguation, requires DEV work and a schema migration.
- **(b) Disambiguate from data already in the DB** — name, stars, photo, price, `hotel_id`. Cheaper, UI-only, but weaker: it can *flag* that two properties collide without fully resolving *which is which*.
- **(c) Flag first, resolve later** — ship (b) as an honest ambiguity signal now, sequence (a) behind it.

Do not let UXDES assume address availability without UXR confirming the path. Designing an address line against a column that does not exist would repeat the Path B mistake at a new layer.

---

## Handoff Notes For UXR (`UXR-HOTEL-PROPERTY-IDENTITY-01`)

### Ambiguity test cases to audit against

Each case should be run through the live path — `DealFeed` → `DealCard` → `app/deals/[dealId]` → `HotelDealCriteriaHandoff` — and answered with: *what does the user see, and can they tell the two apart?*

| # | Case | Fixture shape | Question to answer |
|---|---|---|---|
| A1 | **Exact-name chain siblings** | Two deals, identical `hotel_name`, same `city`, same `stars`, different `hotel_id` | Baseline collision. Is anything at all different on screen besides the photo and price? |
| A2 | **Sub-brand variants** | "Hilton Garden Inn Austin" vs "Hampton Inn Austin" vs "Hilton Austin" | Does `line-clamp-2` at 375px truncate these to the same visible string? Measure it. |
| A3 | **Qualifier-only difference** | "Marriott Austin Downtown" vs "Marriott Austin Airport" | The discriminator is the last token — exactly what truncation eats first. |
| A4 | **Same name, different market** | Same `hotel_name`, different `city`, surfaced in an all-destinations feed | Does the city line carry enough weight to be read as a discriminator? |
| A5 | **Independent name collision** | Two unrelated "The Grand Hotel", same city, different owners | Non-chain case; brand logic will not save this one. |
| A6 | **Photo is the only discriminator, and it is missing** | A1 plus `photo_url = null` on one or both (`PropertyPhoto` fallback) | Worst case. Confirm what remains. |
| A7 | **Screen-reader collision** | A1, read via accessible names only | Two identical `View deal: …` labels (`DealCard.tsx:146`). Confirm and record verbatim. |
| A8 | **Collision across the handoff** | A1 → detail → OTA handoff | Trace `deal.hotel_name` + `area: city` through `[dealId]/page.tsx:212-222`; confirm the OTA page shows an address expaify never did. |
| A9 | **Locked / mock cards** | `is_mock` and locked-detail states (`app/deals/page.tsx:28-29` renders `hotelName: 'Members-only deal'`; `app/api/deals/route.ts` `mockToApiDeal` sets `city: ''`) | Every locked card shares one name by design, and mock cards have no city at all. Ensure the identity treatment does not make legitimate paid-gating read as a collision bug. |

Cases A2 and A3 need real measurement at 375px, not estimation — truncation is the mechanism, so the exact truncation point is the finding.

### Reference patterns to compare against

Compare at the level of **interaction pattern**, not visual style, and pick one or two only:
- **Booking.com** — property-name row followed by a distinct, differently-weighted address/neighborhood line, with the neighborhood promoted for chain properties.
- **Google Hotels** — neighborhood token adjacent to the name and, notably, an explicit **"different location"**-style treatment when nearby same-brand properties appear in one result set.

The question to answer is not "what do they show" but **"what is the minimum they show that resolves the collision"** — the ticket asks for the *minimal* cue set, so the deliverable is a ranked list of cues by disambiguating power per unit of vertical space, not a wish list.

### Directives UXR must produce (3–5, testable)

At minimum, the research brief must specify:
1. The **minimal identity cue set** — ranked, with the evidence for the ranking, and explicit about which cues exist in the DB today versus which require DEV work.
2. The **collision-detection rule** — what normalization defines "these two names collide" (case, punctuation, brand-token stripping, `hotel_id` equality as the negative case), and whether detection is per-page, per-market, or per-visible-set.
3. The **degradation ladder** — exact copy and treatment for each rung: address present → neighborhood/area only → city only → nothing. Reuse `HotelLocationPrecision` vocabulary. No cue may silently fall back to echoing the user's search string.
4. **Accessible-name composition** — the exact string for the collision and non-collision cases, closing the `DealCard.tsx:146` gap.
5. The **375px space budget** — what the identity cue displaces, given that Deal Score, price, and CTA are all above the fold today and none of them may move below it.

### Proposed success metrics

Instrumentation exists (`lib/analytics.ts:62`, `track()`), and `hotel_result_card_opened` (`app/deals/DealFeed.tsx:1346-1356`) is the natural carrier — it needs an ambiguity dimension added, which UXR should specify and DEV should implement.

**Leading indicator (add first — none of this is measurable today):**
- `identity_collision_rate` — share of rendered result sets containing ≥2 colliding names. Establishes whether the problem is frequent enough to justify the fix, and *this number should be captured before any UI change ships.*

**Primary:**
- **Comparison-shopping detail opens** — detail opens where the user opens **both** members of a colliding pair within one session. This is the cleanest proxy for "the card did not answer the question," and it should fall. Distinguish it from ordinary interest-driven opens, which should not fall.
- **Handoff backtrack rate on colliding cards** — return-to-feed within a short window after a handoff click, colliding vs. non-colliding cards. The gap between the two is the metric; the absolute rate is noise.

**Secondary:**
- Time-to-first-handoff on colliding result sets (should fall, or at minimum not rise — a slower but *correct* decision is an acceptable trade and UXR should say so explicitly).
- Wrong-property support contacts. Ground truth, but low volume and lagging; treat as confirmation, never as the gate.

**Guardrail:**
- Handoff click-through on **non**-colliding cards must not fall. If the identity treatment adds visual noise to the 90%+ of cards with no ambiguity, the fix costs more than the problem.

### Files UXR must read

- `app/components/ui/DealCard.tsx` — the live identity block (`:74-80`, `:118`, `:146`)
- `app/deals/DealFeed.tsx` — result-set assembly and `trackCardOpen` (`:1346-1356`)
- `app/deals/[dealId]/page.tsx` — detail identity (`:349-351`) and booking-context assembly (`:212-222`)
- `lib/db/schema.sql:104-148` — `price_snapshots` and `deals`; confirm the missing address columns
- `app/api/deals/route.ts:55-90` — the field mapping that ends the identity chain
- `lib/providers/hotellook.ts:100-230` — the address data that is returned and then discarded
- `app/components/hotelLocationContext.ts` — the precision ladder and copy patterns worth reusing
- `app/components/HotelCard.tsx` — read as a **reference for vocabulary only**; confirm for yourself that it is unmounted before borrowing anything from it

---

## Handoff

Next ticket: `UXR-HOTEL-PROPERTY-IDENTITY-01` — UX Research: hotel property identity confidence.
Input for that stage: this document.
Output expected: `docs/pipeline/hotel-property-identity/02-research.md`.
