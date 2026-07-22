# UX Research: Hotel Property Type Fit

Ticket: `UXR-PROPERTY-TYPE-FIT-01`
Stage: UX Research
Priority: P1
Date: 2026-07-22

## Source Inputs

- Discovery report (referenced by ticket): `docs/pipeline/property-type-fit/01-discovery.md` — **file not found on disk.** The discovery substance (pain point, affected step, signal, constraints, the five research asks) is embedded verbatim in the ticket description, so this brief works from that embedded statement. The missing file is flagged as a process gap in the final report; it does not block research because the ticket fully specifies the problem.
- Prior research reused, not re-derived:
  - `docs/pipeline/hotel-quality-snapshot/02-research.md` — audited the same live/cached Hotellook paths and already recorded (§2, §Out-of-Scope) that `propertyType` is discarded today and that "surfacing it (as a category, not an amenity) could be a small separate repair." This ticket **is** that repair.
  - The two-quality-chips-at-375px cap and the collapsed scan sequence it cites (`deal-supporting-facts-order`, `hotel-rating-source-confidence`). Property type must respect that budget without re-opening it.
- Current implementation audited (read, not assumed):
  - `lib/types.ts` — `HotelOffer` (137-151), `HotelRatingEvidence`.
  - `lib/providers/hotellook.ts` — live normalization (448-487) and cached normalization (`normalizeCachedHotelOffer`, 318-381); `HotelLookCacheEntry.propertyType` (27).
  - `lib/providers/__tests__/hotellook.test.ts` — the only in-repo occurrence of a real-looking `propertyType` value (line 99, a synthetic fixture).
  - `app/components/HotelCard.tsx` — collapsed quality row (449-470) and expanded panels (523-580). Search-results surface.
  - `app/deals/DealFeed.tsx` — `ApiDeal` (41-60); `app/components/ui/DealCard.tsx` — meta line (117-131). Deals-feed surface.
  - `app/api/deals/route.ts` — `DealRow → ApiDeal` mapping (32-77); `lib/db/schema.sql` — `hotel_snapshots` (18-26), `price_snapshots` (104-119), `deals` (125-148).
- Reference patterns checked at the interaction level (not visual style): Booking.com result-card property-type label + property-type filter; Google Hotels type descriptor ("Vacation rental", "4-star hotel").

## Research Question

Every hotel result renders as a generic N-star card, so a traveler cannot tell a full-service hotel from an aparthotel, resort, hostel, guesthouse, or vacation rental before opening it — even though those categories carry different expectations about kitchens, daily housekeeping, front desk, location, and price basis. The one signal that arrives, `HotelLookCacheEntry.propertyType`, is dropped in normalization. The research question is: **(a) does that field actually arrive with useful coverage, (b) what is the smallest hotels-first taxonomy + provider-string mapping worth freezing, (c) where does a type label sit on each card without colliding with the quality/amenity chips or fabricating data the provider never sent?**

## Research Summary

Property type is an **identity** signal, not a **quality** signal. It answers "what kind of place is this," not "is it good." That distinction drives every recommendation below: type belongs in the identity zone (with the name / folded into the class noun), never as a third quality chip, and it is shown **only when the provider actually asserts it** — never inferred, never defaulted to a guessed category.

Two hard findings shape the design:

1. **Coverage is unconfirmed and must be treated as "present-only."** In-repo evidence that Hotellook returns `propertyType` is limited to one optional typed field and one synthetic test fixture. The same live path was already shown (`hotel-quality-snapshot/02-research.md` §1) to be sparse — on a genuine live `cache.json` fetch, only `stars` reliably survives; guest score and review count come exclusively from cached/seeded data. So the design must degrade cleanly to today's behavior when type is absent, and DEV must measure real coverage before type is treated as dependable. **The correct default state is "no type label," not "type not provided" text.**

2. **The visible vocabulary must be frozen and controlled.** Provider `propertyType` is a free string that may be localized, marketing-flavored ("Boutique"), or an attribute masquerading as a type ("All-inclusive" is a board/rate attribute, not a property type). The card must map provider strings into a small canonical set and show **nothing** for unmapped strings, rather than printing raw provider text.

Because the deals feed (`DealCard`) is fed by seeded/snapshot data through `price_snapshots → deals → DealRow → ApiDeal`, surfacing type there is a full-chain DEV change that only pays off once snapshots capture type. This brief scopes type labeling on both card surfaces but ranks the live search card (`HotelCard`) first, since that is where a provider-sourced `propertyType` can appear today.

## Current Implementation Findings

### 1. The provider signal exists in the type, is captured nowhere, and its real coverage is unverified

`HotelLookCacheEntry` types `propertyType?: string` (`hotellook.ts:27`), but the live normalization (`hotellook.ts:458-486`) never reads it — the returned `HotelLookOffer` has no type field. `HotelOffer` (`lib/types.ts:137-151`) has no type field, so there is no slot to carry it even if it were read. The cached path (`normalizeCachedHotelOffer`, `hotellook.ts:318-381`) likewise has no type field and, like `normalizeCachedEvidence`, works from an explicit allow-list — any `propertyType` on a cached object is silently dropped.

The only place a concrete value appears is a **test fixture** (`hotellook.test.ts:99`, `propertyType: 'Hotel'`). That is authored data, not evidence of production coverage. Combined with `hotel-quality-snapshot/02-research.md` §1 (live `cache.json` yields little beyond `stars`), the honest conclusion is: **real `propertyType` coverage is unknown and may be low or zero.** Directive 1 handles this by making the label present-only and requiring DEV to instrument coverage before building anything that assumes type is usually there.

### 2. `HotelCard` (search results) — stars sit in the quality chip row, which is at its two-chip cap

The collapsed card renders a quality chip row (`HotelCard.tsx:449-470`) holding a hotel-class chip ("4-star hotel", built by `getHotelClassCollapsedText`, 157-170) and, when present, a guest-rating chip. The shipped `rating-source-confidence` contract caps this row at **two chips at 375px**. Property type is not a quality chip and must not become the third one.

The opening for type is that the class chip's noun is already the word "hotel": `getHotelClassCollapsedText` returns `` `${value}-star hotel` ``. When the provider asserts a non-hotel type, that noun is exactly what is wrong on a generic card. Folding type into the class noun ("4-star aparthotel", "4-star resort") adds the missing signal **inside the existing chip** — zero new chips, no cap collision. When there is a type but no class value, a small standalone identity label under the name is the fallback (identity zone, not the quality row).

### 3. `DealCard` (deals feed) — type belongs on the existing meta line

`DealCard` shows `★★★★ · City · check-in window` on one meta line (`DealCard.tsx:122-131`). Type fits this identity/meta line (e.g. `Aparthotel · ★★★★ · Miami · Sep 20–22`), not the price or savings zone. But the deals feed is fed by DB rows: `price_snapshots`/`deals` (`schema.sql:104-148`) have no `property_type` column, `DealRow`/`ApiDeal` (`app/api/deals/route.ts:10-77`) have no type field, and `ApiDeal` in `DealFeed.tsx:41-60` has none either. Surfacing type here is a full-chain change (snapshot capture → schema → detection → API → card) that only produces visible labels once snapshots actually carry type. Until then the deals feed correctly shows no type label — the same present-only behavior as the search card.

### 4. "All-inclusive" and "Boutique" are not property types

The ticket's problem statement lists "resort, aparthotel, all-inclusive, boutique." Two of those are traps:
- **All-inclusive** is a board/rate attribute (what the price includes), orthogonal to property type — a resort or a hotel can be all-inclusive. Modeling it as a type would produce a card that says "all-inclusive" instead of "resort" and lose the structural fact. Out of scope for this taxonomy; note it for a future board/amenity ticket.
- **Boutique** is a marketing descriptor, not a reliably provider-asserted category, and it overlaps "hotel." Including it invites fabricated or inconsistent labels. Excluded from the frozen set; if a provider ever returns it explicitly it maps to `hotel` (or is left silent), not a distinct badge.

## Reference Pattern Comparison (interaction level, not visual style)

### Booking.com — type as a scannable identity label + filter

Booking.com prints a property-type label on each result card (e.g. "Hotel", "Apartment", "Hostel", "Entire home/apt") adjacent to the name and stars, and offers a "Property type" filter. The **interaction principle**: type is a first-class identity fact shown at scan time so a shopper can reject a whole category before reading further, and it is only shown when the property genuinely belongs to that category.

Delta vs expaify: expaify shows a star count and nothing about category, so an aparthotel and a full-service hotel are visually identical. The fix replicates the *principle* (identity label at scan time) at expaify's scale (fold into the class noun / meta line), not the *filter* — a property-type filter is a separate future feature, out of scope here.

### Google Hotels — type folded into the descriptor line

Google Hotels renders type as part of the property descriptor ("4-star hotel", "Vacation rental") rather than a separate badge, and shows it only when known. The **interaction principle**: type modifies the class descriptor a user is already reading; absence is silent, not labeled "unknown."

Delta vs expaify: expaify's class descriptor is hard-coded to the noun "hotel" (`getHotelClassCollapsedText`). Adopting Google's fold-into-descriptor pattern is a near-exact match for finding §2 and is the lowest-noise placement.

## Frozen Taxonomy + Provider-String Mapping

Smallest hotels-first canonical set. Each canonical type earns its place by changing a booking expectation at scan time (kitchen / housekeeping / front desk / whole-place / budget-shared). Absent or unmapped → `unknown` → **no visible label**.

| Canonical | Shown label | Why it changes the decision | Example provider strings to map (case-insensitive) |
| --- | --- | --- | --- |
| `hotel` | Hotel | Baseline: front desk, daily housekeeping | `Hotel`, `Hotels` |
| `aparthotel` | Aparthotel | Kitchen / self-catering, often no daily service | `Apartments`, `Apartment`, `Apart-hotel`, `Aparthotel`, `Serviced apartment` |
| `resort` | Resort | On-site amenities, often outside the city center | `Resort`, `Resorts` |
| `hostel` | Hostel | Budget, shared rooms/facilities | `Hostel`, `Hostels` |
| `guesthouse` | Guesthouse | Small, host-run, often breakfast | `Guesthouse`, `Guest house`, `Bed and breakfast`, `B&B`, `Inn` |
| `vacation_rental` | Vacation rental | Whole place, private, no front desk | `Villa`, `Villas`, `Vacation rental`, `Holiday home`, `Chalet`, `Cottage` |
| `unknown` | *(no label)* | Absent, empty, or unmapped provider string | `""`, `null`, anything not in the map above |

Rules the mapping must obey:
- **Six visible categories, no more.** Six is enough to separate the expectation clusters travelers actually act on without turning the card into a taxonomy dump.
- **Case-insensitive, trimmed match against a controlled map.** Never print the raw provider string.
- **Unmapped non-empty strings map to `unknown` (silent), and should be logged** so the map can be extended from real data rather than guessed. This keeps the visible vocabulary frozen while letting coverage inform expansion.
- **No `boutique`, no `all-inclusive`** in this set (finding §4).
- Normalization lives in `lib/providers` (mapping helper), never in a component — same contract as every other provider vocabulary in this repo.

## Not-Provided + Provenance Copy

Present-only, provenance-honest, mirroring the shipped quality-evidence pattern:

- **Absent / `unknown` (the default, likely-common state):** collapsed card shows **no type label and no "not provided" text** — the card reads as today's generic star card. A visible "Type not provided" chip would add scan cost with no decision value (same rationale as `hotel-quality-snapshot` §Ranking). Absence is silent.
- **Present (mapped):** collapsed label is the canonical **Shown label** only (e.g. "Aparthotel"), folded into the class noun where a class chip exists.
- **Expanded panel, provenance line (opt-in detail):**
  - Present → `Property type: Aparthotel — from {ProviderLabel}.`
  - Absent → `Property type: not provided by this source.` (This "not provided" wording lives **only** in the expanded panel a user opted into, never on the collapsed card.)
- **Never inferred.** Type is never derived from name text, stars, price, amenities, or `fetchedAt`. A property is labeled a type only because the provider asserted that type and it mapped to a canonical value.

## Design Directives For UXDES

1. **Treat type as present-only; the absent state is silent, and coverage must be verified before type is assumed dependable.**
   - Default collapsed state (no mapped type) = no type label, no "not provided" text. The card is byte-for-byte today's card when type is absent.
   - The design must not build any UI that assumes type is usually present; DEV (downstream) must instrument real `propertyType` coverage over a snapshot/live cycle before type is relied on beyond present-only labeling.
   - Testable: with `propertyType` absent/empty/unmapped, `HotelCard` and `DealCard` render exactly as they do today (no extra node) at 375px and 1280px.

2. **On `HotelCard`, fold type into the hotel-class noun; do not add a third quality chip.**
   - When a class chip renders and a mapped type exists, the chip noun becomes the type: "4-star aparthotel", "4-star resort" (replacing the hard-coded "hotel" in `getHotelClassCollapsedText`, `HotelCard.tsx:157-170`). `hotel` type keeps today's "N-star hotel".
   - When a mapped type exists but there is **no** class value, show a single small identity label in the name/identity zone (not the quality chip row).
   - Testable: at 375px the collapsed quality row still renders at most two chips (class, guest rating); type never appears as a standalone quality chip; the class chip's noun reflects the mapped type.

3. **On `DealCard`, place type on the existing meta line as an identity token.**
   - Type renders on the `stars · city · window` line (`DealCard.tsx:122-131`), e.g. `Aparthotel · ★★★★ · Miami · Sep 20–22`, in the same muted identity styling — not in the price, savings, or discount-chip zone.
   - Absent type = the meta line is unchanged from today.
   - Testable: with type present the meta line gains one leading token; with type absent the line is identical to current output; no change to price/discount rendering.

4. **Freeze the six-category taxonomy and the mapping contract; show nothing for unmapped strings.**
   - Adopt the canonical set and Shown labels in the table above. The visible vocabulary is exactly these six labels; `unknown` is silent.
   - Provider-string matching is case-insensitive/trimmed against the controlled map; raw provider strings are never rendered; unmapped non-empty strings map to `unknown` and are logged for map expansion.
   - `all-inclusive` and `boutique` are explicitly excluded (they are a board attribute and a marketing descriptor, respectively).
   - Testable: given provider strings `"Apartments"`, `"RESORT"`, `"Bed and breakfast"`, `"Chalet"`, `"All-inclusive"`, `""` → labels `Aparthotel`, `Resort`, `Guesthouse`, `Vacation rental`, *(none)*, *(none)*.

5. **Add a provenance line in the expanded panel; state provenance and honest absence there, never on the collapsed card.**
   - Present → `Property type: {Label} — from {ProviderLabel}.` Absent → `Property type: not provided by this source.` Placed with the identity/quality detail, without reordering any shipped expanded panel above Location (respect `hotel-quality-snapshot` Directive 4 ordering).
   - Type is never color-only or icon-only; the label text carries the meaning (WCAG + consistency with shipped evidence copy).
   - Testable: expanded panel shows the provenance line in both present and absent forms; collapsed card contains no "not provided" type text; screen-reader text names the type and its source when present.

## Acceptance Criteria For UXDES

- The design covers, with final copy: default (type absent → silent collapsed, "not provided by this source" expanded), each of the six present labels, folded-noun vs standalone-label cases on `HotelCard`, the meta-line token on `DealCard`, expanded provenance line, mobile 375px, desktop 1280px, and focus/keyboard + screen-reader text.
- The collapsed quality row stays within the shipped two-chip 375px cap; type is never a third quality chip and never a standalone collapsed "not provided" chip.
- The taxonomy is exactly the six canonical labels; unmapped/absent is silent; raw provider strings are never shown; `all-inclusive`/`boutique` are excluded.
- Type is present-only and never inferred from name, stars, price, amenities, or `fetchedAt`.
- The design names the data-flow surface DEV must extend for the deals feed (snapshot capture → `price_snapshots`/`deals` `property_type` column → `DealRow`/`ApiDeal` → card) and marks it "no visible label until snapshots carry type."

## Risks And Constraints

- **Coverage risk is the whole risk.** If `propertyType` rarely arrives, an over-built type UI is dead weight; present-only labeling makes zero coverage degrade to exactly today's card. DEV must measure coverage, not assume it.
- **Vocabulary integrity.** Free provider strings can be localized/marketing text or attributes ("all-inclusive"); the frozen map + silent-unknown rule is what keeps the card honest and consistent.
- **Two token namespaces.** `HotelCard` uses the `--text-1/--bg-muted/--border` set; `DealCard`/`DealFeed` use `--ink/--primary/--surface/--line-ivory`. UXDES must spec each surface in its own token set; do not cross them.
- Non-negotiables still apply: type mapping lives in `lib/providers`, never a component; adapters keep returning `Result<T>`; money stays integer cents; outbound deeplinks keep affiliate markers. Property type stays out of `scoreDeal.ts` and `DealBadge` — it is identity, not a Deal Score input.

## Out-Of-Scope Findings

- **A property-type filter** (Booking-style) on the deals feed or search is a separate feature ticket, not this labeling repair.
- **Board/rate attributes** ("all-inclusive", "breakfast included", "half-board") are a distinct amenity/board ticket; they must not be modeled as property types.
- **Live coverage instrumentation** and the deals-feed data-flow extension (schema column, snapshot capture, detection/API wiring) are DEV work triggered by the design; this brief specifies the target but ships no code.
- The `hotel-quality-snapshot` "not returned by provider" caveat pattern is the honesty precedent reused here; no `hotel-quality-snapshot` decision is re-opened.

## Handoff

Create `UXDES-PROPERTY-TYPE-FIT-01` for an implementation-ready design that surfaces provider-asserted hotel property type as a present-only identity label — folded into the class noun on `HotelCard`, placed on the meta line of `DealCard` — using the frozen six-category taxonomy and mapping, with silent absence on the collapsed card and an honest provenance line in the expanded panel.
