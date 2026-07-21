# UXR-LOYALTY-BENEFIT-CLARITY-01: Loyalty Benefit Clarity — Research Brief

Stage: UXR · Model: Claude Fable 5 · Priority: P2
Upstream: `docs/pipeline/loyalty-benefit-clarity/01-discovery.md`
Method: source audit of the actual repo (files + lines cited) + interaction-level reference teardown. No assumptions.

---

## 1. Bottom line up front (the core decision)

**Recommendation: SHIP one honest-unknown handoff note, at the hotel booking handoff only. Do NOT ship a loyalty row on comparison cards or the deal detail body. Do NOT ship anything resembling an earning claim.**

The discovery's open question was: *does loyalty messaging merit MVP placement at all, and if so, only as an honest "unknown/not-applicable" trust note?* After auditing the source, the answer is a **qualified yes, narrowly scoped**:

- The one shippable, non-inferred, trust-positive message is a single sentence at the point of OTA handoff: *expaify can't confirm whether a third-party booking earns hotel-brand points or elite-night credit — check with your loyalty program.*
- This clears the kill criterion (§5.3) because the note is **structurally true and decision-relevant at the exact moment the user leaves for an OTA**, not generic filler. It is not "we don't know" floating in a vacuum; it is "we don't know, *and here is the specific reason and what to do about it*," placed where the trade-off actually occurs.
- Everything richer (per-program earning, elite eligibility, a loyalty field on the card) is **blocked** until a provider returns provider-confirmed loyalty data. The data model holds none today (§3.1).

---

## 2. Segment definitions

Three segments, defined by how each weighs preserved loyalty value against price. Design must serve all three without taxing the price-only majority.

### 2.1 Loyalty-driven (elite status holder)
- **Who:** Holds mid/top-tier hotel or airline status (e.g., Marriott Titanium, Hilton Diamond, AA Executive Platinum). Values retained elite perks — suite upgrades, late checkout, breakfast, lounge, elite-night credit toward re-qualification.
- **Decision model:** total value = price **+** preserved loyalty value. Will knowingly pay *more* to keep status intact.
- **Risk on our flow:** **Highest.** This user knows OTA/wholesale rates commonly sit outside brand programs (no points, no elite-night credit, sometimes ineligible for elite benefits on arrival). Seeing a confident Deal Score and savings figure with zero loyalty acknowledgment, they infer we either don't understand their needs or are hiding the trade-off → they distrust and bounce, or book and feel misled.
- **What they need:** an honest signal that we're *not* claiming loyalty preservation, and a nudge to verify with their program. They do NOT need us to compute their eligibility — they'll do that themselves once we're honest that it's outside our visibility.

### 2.2 Loyalty-aware (points collector, no status)
- **Who:** Enrolled in one or more programs, earns opportunistically, no status to protect. "It'd be nice to get the points."
- **Decision model:** price-first, loyalty as a mild tiebreaker. Won't reliably pay more, but wants to make an informed choice.
- **Risk on our flow:** **Medium.** Won't reject a deal outright, but a post-hoc "wait, did I even earn points?" erodes repeat trust.
- **What they need:** the same one-line honest note — enough to set expectations, not enough to slow them down.

### 2.3 Price-only
- **Who:** Indifferent to loyalty. Cheapest verified price wins.
- **Decision model:** price = value. Loyalty content is pure noise.
- **Risk on our flow:** **Inverse.** The risk here is *us* — any loyalty clutter (a card badge, an extra row on every result, a second disclaimer) burdens the segment that is our conversion core, especially at 375px where the comparison cards and detail page are already dense.
- **What they need:** to never see loyalty UI on the browse/compare path. This segment is the reason placement must be **late and singular**, not card-level.

**Design implication:** the elite segment sets the *need* (honesty at handoff); the price-only segment sets the *constraint* (no loyalty UI before handoff). The single point that satisfies both is the hotel handoff surface, where the price-only user has already decided and the elite user is about to leave our visibility.

---

## 3. Evidence (confirmed against actual source)

### 3.1 No loyalty field exists on the data model — CONFIRMED
- `lib/types.ts`: `NormalizedFare` (L59–78) and `HotelOffer` (L137–151) carry **no** loyalty / program / earning / elite / member-rate field. Nearest tokens are `miles?` (L72, an award-fare *price* unit, not an earning value) and the `HotelRatingEvidence` quality system (L109–117) — unrelated to loyalty.
- There is therefore **no provider-confirmed loyalty datum to render**, even if we wanted a card badge. Any card-level loyalty claim would be **fabricated**, i.e. prohibited (§5.1c).

### 3.2 No provider returns loyalty data — CONFIRMED
- `lib/providers/travelpayouts.ts`: returns trend `PricePoint[]` only (`points`, L125–126). No loyalty payload.
- `lib/providers/duffel.ts`: grep for `loyalty|miles|programme` → **zero hits**. Although Duffel's API supports a passenger `loyalty_programme_accounts` concept, our adapter neither requests, collects, nor returns it, and `app/book/BookingFlow.tsx` (traveler form, L695–746) collects title/name/DOB/gender/email/phone only — **no loyalty number field**.
- `lib/providers/hotellook.ts`: the hotel provider builds an affiliate deeplink (`buildDeeplink`, L405–407) and normalizes name/stars/price/location/rating only (`normalizeCachedHotelOffer`, L318–381). **No loyalty metadata** anywhere in the response shape (`HotelLookCacheEntry`, L10–28).
- Net: across cash baseline, live flight, and hotel providers, **nothing** confirms loyalty earning or eligibility. The constraint "show only provider-confirmed info or an explicit unknown" collapses to **there is only the unknown to show.**

### 3.3 Handoff-target classification: OTA vs direct-brand — CONFIRMED, 100% OTA
- The hotel action zone is `CompareRow` (`app/components/ui/CompareRow.tsx`), rendered on the deal detail page as the `size="primary"` action (`app/deals/[dealId]/page.tsx` L347–349) and inside cards as `size="compact"`.
- Its four targets are hardcoded (`PROVIDERS`, `CompareRow.tsx` L14–19) and built by `buildOtaLinks` (`lib/pipeline/otaLinks.ts` L14–44):

  | Target | URL built | Type | Brand loyalty earned? |
  |---|---|---|---|
  | Expedia | `expedia.com/Hotel-Search?…` (L24–27) | **OTA** | Generally **no** hotel-brand points/elite credit; earns Expedia's own *One Key*. |
  | Booking | `booking.com/search.html?…` (L29–32) | **OTA** | Generally **no** hotel-brand points/elite credit; earns Booking's own *Genius*. |
  | Kiwi | `kiwi.com/en/search/…` (L34–37) | **OTA/aggregator** | **No** brand loyalty. |
  | Trip.com | `trip.com/hotels/?…` (L39–41) | **OTA** | Generally **no** hotel-brand points; earns Trip.com's own *Trip Coins*. |

- Every target is a **search-results deeplink** (query = `hotelName city`), not a rate-specific or brand-direct URL. **None** is a direct-to-brand booking (no `marriott.com`, `hilton.com`, airline site, etc.). So the handoff is **exclusively** to channels where hotel-brand points and elite-night credit are, per general industry pattern, **not reliably earned**.
- **Industry pattern (cited as pattern, not per-provider policy):** major hotel groups (Marriott Bonvoy, Hilton Honors, IHG One Rewards, World of Hyatt) exclude most third-party/OTA and wholesale rates from points earning and elite-night credit, and sometimes from elite benefit delivery on-property. The *specific* OTA may run its own loyalty currency (One Key, Genius, Trip Coins), but that is **not** the hotel-brand value the elite segment (§2.1) is protecting. This distinction — "the OTA's own program ≠ your hotel-brand program" — is the exact ambiguity the honest note must name.
- **Consequence:** because 100% of targets are OTAs, there is **no "not applicable" branch to design for** at MVP (there is no direct-brand path that *would* earn). The only state is **honest-unknown**. A "loyalty preserved ✓" state is unreachable and must not be built.

### 3.4 Where loyalty is currently silent — CONFIRMED (matches discovery)
- Deal detail "Why this is a deal" (`app/deals/[dealId]/page.tsx` L374–401): reasons on median vs today's rate + snapshot count only.
- "Stay details" (L404–416): already models honest unknowns — "Guest count unavailable", "Room or rate unavailable" (L412–413) with `muted` styling. **This is the exact precedent to extend** — the app already has a sanctioned visual pattern for "we don't have this datum."
- `CompareRow` copy: only "Compare and book on:" (`CompareRow.tsx` L30). The detail page adds "Opens the provider site. Prices and availability can change." (`page.tsx` L350–352). Neither mentions loyalty.
- `BookingFlow` hotel path (`HotelHandoffReview`, `BookingFlow.tsx` L481–522): lists provider-confirmed items — taxes, fees, cancellation, room availability, price basis (`hotelTermsCopy` L18) — but is **loyalty-silent**.

### 3.5 Reference teardown (interaction-pattern level, not visual)
**A. Booking.com "Genius" (OTA-owned loyalty, honest self-scoping).**
- *Pattern:* Booking never claims you earn the *hotel's* brand points. It surfaces **its own** program value ("Genius Level 2 · 10% off this property") tied to a Booking account, at the property/rate level, and is explicit that the benefit is Booking's, not the hotel's.
- *Takeaway for us:* the honest move is to **name whose loyalty currency is (and isn't) in play.** We have no Genius equivalent to offer, so our honest analog is the inverse: state that the *hotel-brand* currency is **outside our visibility** on a third-party booking. We borrow the *scoping discipline* ("this benefit belongs to channel X, not brand Y"), not the promotional framing.

**B. Airline-direct comparison (e.g., Google Flights → carrier site / airline.com fare pages).**
- *Pattern:* Direct-brand surfaces state loyalty value **only when the booking channel is the brand itself** ("Earn AAdvantage miles" appears on aa.com, not on an OTA fare). Aggregators that route to OTAs do **not** assert brand earning; they route and let the brand confirm.
- *Takeaway for us:* the honest, industry-consistent behavior for an **aggregator that hands off to OTAs** is exactly what we should do — **do not assert brand earning, defer to the program, and say so at the handoff.** Our current silence is worse than the reference (it leaves the user to assume); a one-line deferral note brings us to parity.

- *Interaction-level synthesis:* both references tie any loyalty statement to the **channel actually being booked**, and neither invents cross-channel earning. Placement is always at the point of channel choice/handoff, never on the browse card. This directly validates the "handoff-only, single note" recommendation.

---

## 4. Claim taxonomy (every candidate statement classified)

Only **(a) confirmed-fact** and **(b) honest-unknown** may proceed. **(c) prohibited-inferred** must never ship.

| # | Candidate statement | Class | Verdict |
|---|---|---|---|
| 1 | "expaify can't confirm whether a third-party booking earns hotel-brand points or elite-night credit. Check with your loyalty program." | **(b) honest-unknown** | ✅ SHIP (the recommended note) |
| 2 | "Bookings on Expedia/Booking/Kiwi/Trip.com are made through the provider, not the hotel brand directly." | **(a) confirmed-fact** | ✅ MAY ship as supporting context (true per §3.3; keep terse) |
| 3 | "Earn points on this stay" / "Elite benefits included" / any ✓-preserved state | **(c) prohibited-inferred** | ❌ NEVER — no provider datum (§3.1–3.2); unreachable state (§3.3) |
| 4 | "This rate does not earn Marriott/Hilton/etc. points" | **(c) prohibited-inferred** | ❌ NEVER — asserts a *negative* eligibility per brand we cannot confirm; some OTA rates *do* earn. Stay at unknown, don't flip to a false "no." |
| 5 | "You'll earn Genius / One Key / Trip Coins on this booking" | **(c) prohibited-inferred** | ❌ NEVER at MVP — we hold no account/program datum; also drags price-only users into OTA-program marketing. |
| 6 | A per-result loyalty badge/row on `FlightCard`/`HotelCard`/`DealCard` | **(c) prohibited-inferred (no data) + clutter** | ❌ NEVER at MVP — no field to populate (§3.1); violates price-only constraint (§2.3). |

**Rule for UXDES:** the only permitted loyalty content is **honest-unknown framed as a deferral to the user's own program**, optionally supported by the confirmed structural fact that the handoff is to a third-party provider. Never a positive claim, never a per-brand negative claim.

---

## 5. Decision criteria handed to UXDES

### 5.1 Placement test — single earliest surface that reduces rejection without cluttering the price-only path
Candidate surfaces, earliest→latest, scored on *(reduces elite rejection?)* × *(spares price-only?)*:

| Surface | Reduces elite rejection | Spares price-only | Verdict |
|---|---|---|---|
| Comparison cards (`FlightCard`/`HotelCard`/`DealCard`) | low (too early; user hasn't committed) | **fails** (taxes every browse, worst at 375px) | ❌ |
| Deal detail body ("Why this is a deal" / price block) | medium | poor (loyalty noise on a price-reasoning surface) | ❌ |
| **Deal detail action zone — at `CompareRow` primary (`page.tsx` L347–353)** | **high** (exactly when user picks an OTA) | **good** (one line, below the fold of the price decision) | ✅ **PRIMARY** |
| Booking handoff review (`HotelHandoffReview`, `BookingFlow.tsx` L481–522) | high | good | ✅ acceptable secondary/reinforcement |

**Recommendation:** place the single honest note **adjacent to the primary `CompareRow`** on the deal detail page — extend the existing caption at `page.tsx` L350–352 ("Opens the provider site. Prices and availability can change.") with the loyalty deferral, OR add one sibling line in the same `--ink-faint` caption treatment. This is the earliest surface where (a) the price-only user has already decided and won't be taxed, and (b) the elite user is about to leave our visibility for an OTA. If a second reinforcement is cheap, echo it once in `HotelHandoffReview`'s existing terms area (near `hotelTermsCopy`, L504). **Do not** place it in `CompareRow` itself (that component also renders `compact` inside cards — see §5.4).

### 5.2 Reuse the existing honest-unknown pattern
Do not invent a new visual language. The "Stay details" muted-unknown treatment (`page.tsx` L412–413, `--text-3`/`muted`) and the caption treatment (`--ink-faint`, L350) already exist. The loyalty note should read as a **quiet caption/footnote**, not a badge, alert, or colored panel — matching how the app already admits "we don't have this."

### 5.3 Kill criterion — explicit ruling
- **Criterion:** if the only shippable message is a bare "we don't know," decide whether it's net trust-positive or noise to defer until a provider returns loyalty data.
- **Ruling: NOT killed — SHIP, but only in the scoped handoff form.** Rationale: the note is not a bare "we don't know." It is **(1) decision-relevant** (fires exactly when the user chooses a third-party channel), **(2) structurally true** (100% of targets are OTAs, §3.3), and **(3) actionable** ("check with your program"). Against the elite segment's current experience — a confident Deal Score with silent omission of a known trade-off — a one-line honest deferral is strictly trust-additive.
- **What WOULD trip the kill criterion (and is therefore deferred):** any attempt to render loyalty state *per result*, *per brand*, or as a *positive/negative eligibility*, since those require data we don't have (§3.1–3.2) and would ship either a fabrication or clutter. Those wait for a provider that returns confirmed loyalty data (award phase / Duffel `loyalty_programme_accounts` wiring).

### 5.4 Contract & scope guardrails for downstream
- **No new network round trip / no provider call** — the note is static, provider-agnostic copy. Confirmed feasible: nothing in §3 requires a fetch.
- **Preserve `CompareRow`'s contract** — it is shared between `compact` (in-card) and `primary` (detail action zone). Do **not** bake the loyalty note *inside* `CompareRow`, or it leaks onto every card and violates §2.3. Place the note in the **detail-page caller** (`page.tsx` action-zone block) where only `primary` renders.
- **Affiliate markers, money-as-minor-units, `Result<T>`, secrets-from-env** — untouched; this is copy-only, no data-layer change.
- **375px** — one caption line, wraps cleanly; no new columns, badges, or overlapping elements.

---

## 6. Testable directives for UXDES (3–5, exact)

1. **Add exactly one honest-unknown loyalty note, copy-locked**, at the deal detail action zone (`app/deals/[dealId]/page.tsx`, adjacent to the `CompareRow size="primary"` block, L347–353). Approved copy: **"expaify can't confirm whether a third-party booking earns hotel-brand points or elite-night credit — check with your loyalty program."** Render in the existing caption treatment (`text-caption`/`--ink-faint`), as a sibling to the current "Opens the provider site…" line. No badge, no colored panel, no icon.
2. **Do NOT modify `CompareRow.tsx` or any result card** (`FlightCard`, `HotelCard`, `DealCard`). The note lives only in the detail-page caller so it renders once, on `primary` only, and never taxes the browse/compare path (price-only protection, §2.3; contract guardrail §5.4).
3. **Ship only taxonomy classes (a) and (b).** No positive earning claim (row 3), no per-brand negative claim (row 4), no OTA-program promo (row 5). The note must frame as a **deferral to the user's own program**, never as expaify asserting or denying eligibility.
4. **Optional single reinforcement, not required:** if UXDES judges it low-clutter, echo the same deferral once inside `HotelHandoffReview` (`app/book/BookingFlow.tsx` L481–522) near `hotelTermsCopy` (L504), matching that surface's `--text-2` body treatment. If it adds visual weight, omit — one note is sufficient.
5. **Every state stays reachable and honest:** because 100% of handoff targets are OTAs (§3.3), design **only** the honest-unknown state. Do **not** design a "loyalty preserved" or "not applicable" state — both are unreachable at MVP and one is a prohibited claim. Verify at 375px and desktop that the note wraps without overlap and does not push the price/decision content.

---

## 7. Out-of-scope / future (for the pipeline, not this feature)
- Wiring Duffel `loyalty_programme_accounts` into `NormalizedFare` + `BookingFlow` (would unlock a *confirmed-fact* flight-loyalty state — DEV/award phase).
- A hotel provider that returns brand-program eligibility per rate (would unlock a genuine "earns brand points ✓/✗" state).
- OTA-owned loyalty (Genius/One Key/Trip Coins) surfacing — requires account linkage; explicitly deferred to avoid dragging price-only users into third-party program marketing.

## Handoff
Create `UXDES-LOYALTY-BENEFIT-CLARITY-01` with the placement (§5.1), copy (§6.1), taxonomy constraints (§4), and the reuse/guardrail rules (§5.2–5.4). Design the honest-unknown state only.
