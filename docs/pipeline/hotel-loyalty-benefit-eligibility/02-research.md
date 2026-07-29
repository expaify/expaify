# UXR-HOTEL-LOYALTY-BENEFIT-ELIGIBILITY-01: Hotel Loyalty Benefit Eligibility — Research Brief

Date: 2026-07-29
Stage: UX Research
Priority: P2
Persona: Senior UX Researcher
Ticket: UXR-HOTEL-LOYALTY-BENEFIT-ELIGIBILITY-01
Scope: hotels only — hotel-detail decision → external booking handoff
Upstream: `docs/pipeline/hotel-loyalty-benefit-eligibility/01-discovery.md`
Prior overlapping work (cited, extended, **not** re-derived): `docs/pipeline/loyalty-benefit-clarity/01-discovery.md`, `docs/pipeline/loyalty-benefit-clarity/02-research.md`
Adjacent shipped system (must not be conflated): `docs/pipeline/rate-eligibility/`
Method: source audit of the actual worktree (files + line numbers cited at time of writing) + interaction-level reference teardown. No field data — stated honestly in §2.4.

---

## 1. Bottom line up front

**SHIP — one collapsed disclosure, at the `/book` hotel handoff only, and only if it carries the escalation rule. Do NOT ship the honest sentence on its own.**

Three rulings, in the order they matter:

1. **The escalation rule resolves to a three-way split, and the booking partner owns none of the four benefit questions.** Rate mechanics → partner. Accrual (points, elite nights) → the traveler's own program. Delivery (status recognition, upgrades, on-property perks) → the property. expaify verifies price and owns none of them. Full rule with reasons in §5.
2. **Placement: handoff only.** Not handoff + detail. The detail page is now a five-section, position-tracked decision surface (§4.6); a loyalty line there taxes the price-only segment at the exact moment they are deciding on price. §6.
3. **Kill criterion — NOT killed, but the prior brief's shippable unit fails it.** `loyalty-benefit-clarity/02-research.md` §6.1 recommended a single always-visible caption sentence at the deal-detail action zone. On today's surfaces that is an unread disclaimer on a dense page — a regression under repair mode, and it also violates this ticket's "collapsed by default, no new always-visible block" constraint. The sentence **plus** the owner-routing table clears the bar, because it converts a warning into an answer the traveler can act on. Full ruling and the falsification test in §7.

**What this brief adds that prior work did not:** the escalation rule (§5), the corrected handoff-target audit (§4.3 — the four-OTA table in the prior brief is stale), the membership-field false-positive (§5.4 — the single highest-value honesty item, unaddressed anywhere), and a superseding placement decision (§6).

---

## 2. Segment evidence

Segments are defined in `loyalty-benefit-clarity/02-research.md` §2.1–2.3. **Cited, not redefined.** Below is only what is hotel-specific and handoff-specific, which the prior brief — written across flights and hotels, and across comparison/detail/handoff — did not cover.

### 2.1 Loyalty-driven / elite (prior §2.1) — hotel-specific additions

- **Elite-night credit is a deadline currency, and that is a hotel-only property.** Prior §2.1 grouped hotel and airline elite value together. They do not behave the same. Airline status is largely earned on spend or distance and is partially purchasable in-year; hotel status is earned on *qualifying nights* against a hard calendar-year cut. A traveler at 47 of 50 nights in November is not weighing "$40 vs. some points" — they are weighing "$40 vs. an entire year of tier." This is why a silent handoff is more costly on the hotel path than on the flight path, and it is the strongest single argument that a hotel-specific answer is warranted even though the flight equivalent is deferred (discovery §8).
- **Handoff-specific: this traveler arrives at `/book` already carrying four disclosures.** By the time they reach the continue button they have passed rate restrictions, parking, "What you may need", document readiness, special requests, and funds policy (`app/book/BookingFlow.tsx:1106–1210`). A fifth block that only *warns* is noise to them — they already know OTA rates are program-risky; that is the premise of their hesitation. What they lack is not the warning. It is **who to ask**. This directly sets the shape of the fix: an answer, not a caution.
- **Correction to prior §2.1's "they'll do that themselves once we're honest."** Half true. They will resolve *accrual* themselves with their program. They cannot resolve *delivery* (will the desk honor my tier on a third-party reservation) without knowing the reservation is a third-party reservation — which is exactly the fact expaify holds and they may not. §5.3 assigns it.

### 2.2 Loyalty-aware / points collector (prior §2.2) — hotel-specific additions

- **The dominant hotel failure mode for this segment is not absence of information — it is a false positive.** Third-party hotel checkouts commonly expose an optional "rewards / membership number" field. Entering a number there is read by this traveler as confirmation that the stay will earn. It is not: the field passes an identifier to the property, and accrual remains governed by the program's rules about the booking channel and rate code. This traveler books, sees nothing post, and blames whoever showed them the price — expaify. Prior §2.2 characterized the risk as a vague post-hoc "wait, did I even earn points?"; the audit sharpens it into a specific, nameable, correctable inference. It is the single highest-value sentence available to us (§5.4, directive D3).
- **Handoff-specific:** this segment will not open a disclosure labeled as a warning, but will open one labeled as the question they are actually holding. Trigger copy is load-bearing (D1).

### 2.3 Price-only (prior §2.3) — constraint reconfirmed, cost now measurable

- Prior §2.3's constraint stands unchanged and is the binding constraint on this ticket. The audit lets us price it exactly: the proposed fix costs this segment **one collapsed trigger row** in an existing section — the same ~44px cost `HotelBookingOwnershipDisclosure` already charges (`app/components/HotelBookingOwnership.tsx:57–74`), zero network calls, zero card/results/detail footprint, and no change to the price or Deal Score surfaces.
- **Handoff-specific:** this segment has already decided by the time they reach `/book`. That is what makes handoff the only placement that satisfies both §2.1's need and §2.3's constraint — restating prior §2.3's conclusion, and the reason §6 rejects the detail page even though the ticket offered it as an option.

### 2.4 Honest limits of this segment evidence

No field data exists. Segment shares are unmeasured and unmeasurable today: the return-reason instrument carries no loyalty option (§4.5), so a traveler who bounces to check their program is indistinguishable from any other abandoner. Prior §2 had the same limitation and did not state it; stating it here is not a weakening of the case but a precondition for the kill criterion being falsifiable after ship (§7.2, directive D5). The case for shipping is structural, not statistical — as discovery §4 already conceded.

---

## 3. Do not conflate with `rateEligibility` — reconfirmed, with a live trap

Discovery §3.2 warns against overloading `rateEligibility.membership`. The audit found the trap is not hypothetical.

- `HotelRateEligibilityEvidence.membership` (`lib/types.ts:454–464`) carries an optional `membershipLabel` described in-source as "a raw supplier program/group label" (`lib/types.ts:445–446`).
- The shipped test fixture for that field uses the literal value **`'GENIUS LOYALTY'`**, rendering as "Genius Loyalty members only" (`lib/hotels/__tests__/rateEligibility.test.ts:221–225`).

So the one field in the codebase that already contains the word "loyalty" answers **"may I buy this rate?"** and nothing else. A supplier can and does put a loyalty-program name in it. Any downstream stage that reads `membershipLabel` as evidence of *earning* would produce a confidently wrong statement from a shipped, tested code path. Discovery §3.2 and §8 are upheld: **`rateEligibility` is not extended, not read, and not referenced by this feature.** The two answers are independent — a rate can be `clear` on membership and earn nothing, or be `restricted` to a program and still earn nothing.

---

## 4. Source audit — discovery §3.1–§3.5 re-confirmed

Read from the worktree at time of writing. Line numbers are current.

### 4.1 The offer model cannot represent a benefit — **CONFIRMED** (discovery §3.1)
`HotelOffer` (`lib/types.ts:474–495`) carries: `id`, `name`, `area`, `location`, `stars`, `pricePerNight`, `priceBasis`, `rating`, `photoUrl`, `deeplink`, `source`, `documentReadiness`, `hotelClass`, `guestRating`, `amenityEvidence`, `accessEvidenceState`, `fundsPolicy`, `smokingPolicy`, `rateEligibility`, `rateEligibilityCapability`. **No** loyalty, program, earning, elite-night, status, or upgrade field. There is no provider-confirmed benefit datum to render, so the honest-unknown is not a fallback state — it is the **only reachable state**. Prior §3.1 reached the same conclusion against a much smaller `HotelOffer` (it cited L137–151); the model has grown by eight evidence systems since and still holds none.

### 4.2 The membership field is a different question — **CONFIRMED**, and actively hazardous. See §3 above.

### 4.3 Zero loyalty language ships today — **CONFIRMED**, with a corrected handoff-target audit (discovery §3.3)

Grep across `app/` and `lib/` for `loyalty|bonvoy|honors|elite|rewards|points earn` returns exactly three hits:
- `lib/hotels/__tests__/rateEligibility.test.ts:221`, `:225` — the `'GENIUS LOYALTY'` fixture (§3), not user-facing loyalty copy.
- `lib/baggage/fees.ts:124` — a **flight** baggage disclaimer: "Baggage fees are estimates in USD and can vary by fare brand, route, loyalty status, and booking channel." Confirms the honest-variance pattern already exists in the product, on the flight path only.

No user-facing hotel loyalty copy exists. **No false promise, and no honest disclosure.** Discovery §3.3 upheld.

**Correction to prior brief §3.3 — the four-OTA table is stale.** `buildOtaLinks` (`lib/pipeline/otaLinks.ts:22–27`) now hardcodes `expedia`, `booking`, and `kiwi` to `undefined`, with an in-source rationale: the approved hotel contract exposes one Travelpayouts/HotelLook marker, not provider-specific credentials, so unattributed links are withheld rather than emitted. Only `trip` is built, and only when `HOTEL_AFFILIATE_ID` is set, via a `tp.media` redirect. `CompareRow` filters to attributed links (`isAttributedHotelProviderUrl`, `app/components/ui/CompareRow.tsx:35`, applied at `:86` and `:111`), and `HotelDealCriteria.tsx:139–140` renders the "Provider link unavailable" state when none survive.

**Consequence for this ticket — the case strengthens, and one option closes:**
- The handoff is now effectively **a single third-party partner**, resolved at runtime by `getHotelPartnerIdentity` (`app/book/BookingFlow.tsx:103`, used at `:705`) into a `partner.named` / `partner.label` pair. Copy must handle the unnamed case, exactly as `HotelBookingOwnership.tsx:42` does (`'your booking partner'`).
- Prior §3.3's conclusion — 100% third-party, no direct-brand path, therefore **no "loyalty preserved ✓" state and no "not applicable" branch is reachable** — holds *more* strongly than when written. Design one state only.
- Prior §3.3's per-OTA loyalty-currency column (One Key / Genius / Trip Coins) is now moot for design purposes and must not be revived. Prior §4 row 5 already prohibited surfacing it; the link audit removes even the temptation.

### 4.4 The right pattern is already in the codebase — **CONFIRMED** (discovery §3.4)

Two precedents, both on the target surface:

- **"Special requests"** (`app/book/BookingFlow.tsx:1160–1190`). States what expaify does not do — "Nothing is selected or sent by expaify" (`:1173–1174`); refuses to guarantee — "Requests depend on availability and are not guaranteed" (`:1177`); names who to escalate to — "use your confirmation or itinerary to contact the property" (`:1177`); and defines the terms on a four-step ladder behind a `<details>` (`:1179–1189`: Selected / Sent / Acknowledged / Guaranteed). This is the semantic model to copy.
- **`HotelBookingOwnershipDisclosure`** (`app/components/HotelBookingOwnership.tsx:33–125`, mounted at `BookingFlow.tsx:1082–1087`). This is the **mechanical** model to copy: collapsed by default (`useState(false)`, `:39`), `min-h-11` trigger with `aria-expanded` / `aria-controls` and `focus-visible:shadow-[var(--focus-ring)]` (`:57–74`), a two-card owner-split panel (`:76–121`), an `onOpen` that fires once on first open (`:44–53`), and an explicit "expaify cannot access, change, cancel, or refund a reservation completed with the booking partner" (`:98`).

Together they are an existing, shipped, tested precedent for exactly this shape of work: *disclaim what expaify does not do, refuse to guarantee, split ownership by party, name who to ask.* Directive D1/D2 reuse both. No new pattern, no new component vocabulary.

### 4.5 There is no measurement of this today — **CONFIRMED** (discovery §3.5)

Emitted on the hotel handoff, all carrying `handoffSessionId`: `hotel_handoff_viewed` (`BookingFlow.tsx:744`), `hotel_handoff_returned` (`:908`), `hotel_handoff_continue_clicked` (`:933`), `hotel_handoff_return_reason_selected` (`:955`), `hotel_handoff_back_clicked` (`:1001`). A disclosure-open precedent exists: `hotel_booking_help_opened` (`:966–973`).

`HOTEL_RETURN_REASONS` (`BookingFlow.tsx:42–48`) offers five options — smoking/room, price/fees, room availability, other details, prefer not to say. **No loyalty option.** Discovery §3.5 upheld: a loyalty-driven abandoner is currently invisible. D5 fixes this, and it is what makes §7's kill ruling falsifiable rather than an assertion.

### 4.6 New finding — the detail page has hardened since prior research, which changes the placement answer

Prior §5.1 recommended the deal-detail action zone as PRIMARY placement. That surface is materially different now:
- It is five ordered, position-tracked sections: `data-hotel-decision-position` 1–5, with the provider handoff at position 4 and supporting evidence at position 5 (`app/deals/[dealId]/page.tsx:414`, `:428`), feeding `HotelDecisionAnalytics` (`:452–461`). A shipped ticket owns this ordering; inserting loyalty copy into it is not a free caption line, it is an edit to a decision-order system.
- The action zone no longer renders `CompareRow` directly — it renders `HotelDealCriteriaHandoff` (`page.tsx:423`), which owns three states: mismatch, no-eligible-links, and links-present (`app/components/HotelDealCriteria.tsx:130–170`). Prior §5.1's "extend the caption at `page.tsx` L350–352" no longer maps to anything.
- Meanwhile `/book` has become a full review surface with the disclosure pattern prior research did not have available.

This is why §6 supersedes prior §5.1 rather than restating it.

---

## 5. THE ESCALATION RULE (core deliverable — resolved, not deferred)

Discovery §7 posed the question and named three candidate owners. Here it is resolved. **Each unsupported question gets exactly one owner.**

**The rule in one line — and this is the line UXDES should design around:**

> **The partner owns the rate. Your program owns what you earn. The property owns what you get on arrival. expaify verifies the price and owns none of the three.**

### 5.1 The routing table

| # | Traveler's question | **Single owner** | Honest reason it is that owner, and not the others |
|---|---|---|---|
| 1 | **Will this stay earn points?** | **The traveler's loyalty program** | Accrual is decided by the program's own terms about which booking channels and rate codes qualify. The partner knows what it sold but cannot commit the program to posting a stay; the property can report a stay but does not set the earning rules. Only the program can answer before or after the fact. |
| 2 | **Will this stay credit an elite night toward status?** | **The traveler's loyalty program** | Same authority, **different question** — programs define "qualifying night" separately from points earning, and a stay can post one without the other. Keep it as its own row: a traveler who asks about status re-qualification (§2.1) has not been answered by a points answer. |
| 3 | **Will my status be recognized at check-in?** | **The property** | Recognition happens at the desk, from the property's system, against the reservation as it arrives from the booking channel. The program defines what a tier entitles you to; the individual property decides what it applies to this specific reservation. The partner is not present at check-in and cannot speak for it. |
| 4 | **Can I get an upgrade, breakfast, lounge access, late checkout?** | **The property** | Inventory-dependent and discretionary at arrival. Nobody — not expaify, not the partner, not the program — can guarantee it in advance. This is the same honesty the shipped "Special requests" section already applies to a quiet room or high floor (`BookingFlow.tsx:1177`); loyalty perks are the same class of promise and must not be treated as firmer. |

**The booking partner is the correct owner of exactly one thing, and it is not on this list:** what the rate is, what its terms are, and whether its checkout accepts a membership number. Discovery §7 warned that routing everything to the partner would be inaccurate. Confirmed — the partner owns rate mechanics only. Stating that explicitly is what prevents the traveler from burning a support contact on the wrong party.

### 5.2 Why "the partner" is the wrong default, in one sentence UXDES can use
The partner sells the rate; it does not run the program that posts the stay, and it is not standing at the desk when you check in.

### 5.3 The one fact expaify actually holds, and must contribute
expaify knows — and the traveler may not — that **this booking will be completed with a third-party booking partner, not with the hotel brand directly.** That is a confirmed structural fact (§4.3), it is class (a) confirmed-fact under prior §4's taxonomy, and it is the fact that makes all four routings actionable: it tells the traveler *which* question to ask their program ("does a third-party booking earn on this rate?") instead of asking it blind. This is the only assertion in the entire disclosure. Everything else is routing.

### 5.4 The one inference the rule must actively break
**"The checkout accepted my membership number, so I will earn."** It will not necessarily. Entering a number passes an identifier to the property; it does not change whether the program's rules count the booking channel and rate code as qualifying. This is a *partner*-owned mechanic being misread as a *program*-owned outcome — precisely the boundary the rule exists to draw, and the dominant failure for §2.2. Copy must name it (D3). No prior document covers this; it is the highest-value single sentence available.

### 5.5 What the rule must never say
Reconfirming prior §4's taxonomy against this ticket's constraint (discovery §5.1), plus two new prohibitions:
- ❌ "This rate does not earn points" — a per-brand negative we cannot confirm. Some third-party rates do earn. Stay at unknown; never flip to a false "no." *(prior §4 row 4)*
- ❌ "Earn points on this stay" / "Elite benefits included" / any ✓-preserved state — unreachable and unsourced. *(prior §4 row 3)*
- ❌ "Book direct to keep your benefits" — unsourced recommendation, steers off the monetized path on a guess. *(discovery §5.1, §8)*
- ❌ **NEW —** any copy implying the **partner** can confirm earning or elite-night credit. Misroutes question 1 and 2 and wastes the traveler's escalation.
- ❌ **NEW —** any copy implying the **program** can confirm an upgrade or on-property perk for a specific stay. Misroutes question 4; only the property can, and only at arrival.

---

## 6. Placement decision — **handoff only**

**Ruling: one disclosure, at the `/book` hotel handoff, inside the existing "Check rooms with provider" section (`app/book/BookingFlow.tsx:1076–1104`), as a sibling to `HotelBookingOwnershipDisclosure` (`:1082–1087`). Nothing on the detail page. Nothing on cards, results, or the deals feed.**

This **supersedes** `loyalty-benefit-clarity/02-research.md` §5.1 and §6.1, which named the deal-detail action zone as PRIMARY. Reasons, in order:

1. **The prior recommendation violates this ticket's constraints.** It specified an always-visible caption sentence. Discovery §5.3 requires progressive disclosure, collapsed by default, with no new always-visible block. The two cannot both be satisfied. This ticket's constraint governs.
2. **Its anchor no longer exists.** Prior §5.1/§6.1 pointed at `page.tsx` L347–353 and the "Opens the provider site…" caption. The detail action zone now renders `HotelDealCriteriaHandoff` with three states of its own (§4.6). The edit as specified is not applicable.
3. **The detail page is where the price-only segment is still deciding.** It is a five-section, position-tracked decision order (§4.6) owned by a shipped ticket. The handoff is where they have already decided. Prior §2.3 and §5.1 set exactly this test — "the price-only user has already decided and won't be taxed" — and on today's surfaces `/book` is the surface that passes it, not the detail page.
4. **The escalation rule is post-decision content by nature.** Questions 3 and 4 (§5.1) are about check-in. Placing them beside the price and Deal Score answers a question the traveler has not asked yet, at the cost of the one they have.
5. **Adjacency does the teaching for free.** Sitting next to "Who handles my booking?" — which already splits partner vs. expaify ownership — the loyalty disclosure reads as one more row in an ownership map the traveler has already learned, not as a new disclaimer genre.

**Rejected: handoff + detail.** A second surface would double the price-only tax for zero added reach — every traveler who reaches the handoff has passed the detail page, so the detail placement adds no audience, only cost. Discovery §7's strategist read is confirmed by the audit.

**Explicitly unchanged:** `HotelCard.tsx`, `DealCard.tsx`, `CompareRow.tsx`, `app/deals/[dealId]/page.tsx`, `HotelDealCriteria.tsx`, `lib/pipeline/otaLinks.ts`, `HotelOffer`, `rateEligibility`, and every affiliate marker and `isAttributedHotelProviderUrl` gate.

---

## 7. Reference teardown — interaction level, at the point of handoff

Pattern-level observation of how major hotel marketplaces behave. Cited as **industry interaction pattern, not as any provider's current policy** — the same discipline prior §3.3 applied. Prior §3.5 covered Booking.com Genius and airline-direct; the two below are hotel-and-handoff specific and are new.

**A. The third-party checkout "rewards / membership number" field — the decoupling pattern.**
- *Interaction:* major hotel marketplaces commonly expose an optional hotel-brand membership-number field at the **rate/checkout step** — never on the results card, never on the property page. The number is collected and passed to the property. The honest implementations scope it **at the field itself**, in terms of what it is for (recognition at the property) rather than what it yields (points), and defer accrual to the hotel's own program terms.
- *What this proves:* the industry itself treats **collecting the number** and **promising the earning** as two separate things, resolved by two different parties. That is not our invention — it is the established pattern, and it is precisely the boundary in §5.4.
- *Takeaway for us:* we do not collect a number and will not (discovery §8). Our honest analog is to **name the decoupling in words at the same point in the flow** — the handoff. Borrow the scoping discipline; do not borrow the field.

**B. Marketplace-owned currency stated, brand currency silent — the parity pattern.**
- *Interaction:* marketplaces state their **own** program value (their tier, their currency) at the property and rate level, and are simply **silent** about hotel-brand points and elite nights at handoff. The silence is not an oversight; it is the legally safe default for a channel that cannot bind another company's program.
- *What this proves, and it matters for the kill criterion:* our current silence is **industry parity, not a gap**. Shipping an honest deferral is above-parity behavior, which raises the bar the fix must clear — "everyone else is silent too" removes the competitive-catch-up justification and forces the value to come entirely from the routing (§5).
- *Takeaway for us:* silence alone is defensible; that is why the bare sentence is not enough (§8) and the routing table is the whole product.

**C. Synthesis — where the pattern places loyalty content.**
Across both references and prior §3.5's Booking/airline-direct teardown, every loyalty statement is bound to **the channel actually being booked** and appears at **the rate/checkout/handoff step**, never on a browse or comparison card. No reference invents cross-channel earning. This independently validates §6: handoff, singular, late.

---

## 8. Kill criterion — explicit ruling

Discovery §9: *if an honest sentence plus an escalation rule does not measurably change loyalty-traveler confidence at handoff, recommend shipping nothing.*

### 8.1 Ruling: NOT KILLED — ship, with one component of the prior recommendation killed

**Killed:** the bare honest sentence as a standalone, always-visible caption (`loyalty-benefit-clarity/02-research.md` §6.1). On today's `/book` surface — already carrying rate restrictions, parking, readiness, documents, special requests, and funds policy (§4.4, §2.1) — one more always-visible line of "we can't confirm this" is an unread disclaimer on a dense page. Repair mode is active; discovery §9 names that outcome a regression. It would also fail against the reference parity finding (§7B): silence is defensible, so a warning that adds no action adds nothing.

**Shipped:** the same sentence, collapsed behind a question-shaped trigger, carrying the four-row owner routing (§5.1) and the membership-number correction (§5.4). This clears the bar on four counts:

1. **It answers rather than warns.** The elite traveler already knows third-party rates are program-risky (§2.1); what they lack is who to ask. Four questions → four named owners is new information, not a restatement of their existing doubt.
2. **It corrects an active false inference.** §5.4 is not a disclaimer — it is a fact that changes what the traveler does at the partner's checkout. That alone is decision-relevant for §2.2.
3. **It contributes the one fact only we hold** — that this is a third-party booking, not a brand-direct one (§5.3) — which converts a blind question into a specific one.
4. **The cost to the price-only majority is one collapsed row** in a section that already has one (§2.3), with no network call and no footprint anywhere else.

### 8.2 How to falsify this after ship — the criterion must remain testable

The ruling above is reasoned from a source audit, not from field data (§2.4). D5 makes it checkable. **Retire the disclosure if, after a reasonable observation window:**
- the disclosure open rate at the handoff is negligible — meaning the trigger copy does not match a question travelers are actually holding (retest the trigger wording once before retiring, per D1); **and**
- adding the loyalty return reason surfaces no meaningful share of loyalty-driven abandonment — meaning the segment is too thin on the hotel path to warrant surface area.

If both hold, remove the disclosure and keep the escalation rule as internal support guidance. Discovery §9 explicitly permits that outcome; this brief commits to it as a defined exit, not a hypothetical.

---

## 9. Testable design directives for UXDES

Five. Exact states, exact copy rules. Copy below is a research-approved baseline meeting §5's routing and §5.5's prohibitions — UXDES owns final wording but **may not change the owner assignments or add an assertion**.

### D1 — One collapsed disclosure, at the handoff, question-shaped trigger
- **Location:** `app/book/BookingFlow.tsx`, inside `<section aria-labelledby="hotel-provider-title">` (`:1076–1104`), rendered directly after `HotelBookingOwnershipDisclosure` (`:1082–1087`) and **before** the continue anchor (`:1089–1101`). New component alongside `app/components/HotelBookingOwnership.tsx`; do not modify that file.
- **Default state: collapsed.** Never open on mount. No `open` prop, no deep-link expansion.
- **Trigger copy (exact):** `Will this stay earn points or status?`
  - Rule: the trigger is **a question, not a warning.** "Loyalty benefits" or "Important loyalty information" are rejected — §2.2 will not open a warning but will open their own question.
- **Mechanics:** mirror `HotelBookingOwnership.tsx:57–74` exactly — `<button type="button">`, `aria-expanded`, `aria-controls`, `min-h-11`, `text-[color:var(--brand)]`, `focus-visible:shadow-[var(--focus-ring)]`, chevron with `aria-hidden` + `motion-reduce:transition-none`. Panel mirrors `:76–121`.
- **States to design:** collapsed (default), expanded, partner-named, partner-unnamed. **No loading, no error, no empty** — the content is static copy with zero network dependency, so those states are unreachable by construction. Do not invent them.
- **Test:** at 375px the trigger is one line with no truncation of the question mark; expanded panel wraps with no overlap; the continue button remains reachable without horizontal scroll.

### D2 — The panel is the escalation rule, in three owner blocks
- **Structure:** one lead statement, then three labeled blocks in the order **partner → program → property** (rate → accrual → delivery, the §5 mnemonic). Reuse the `HotelBookingOwnership.tsx:79–120` card treatment (`rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)]`).
- **Lead (exact):** `expaify checks the price. It cannot confirm what a stay earns or what a property will honor.`
- **Block 1 — the booking partner** (heading: `{partner.label} sells this rate` / unnamed: `Your booking partner sells this rate`):
  `You are booking with a third-party partner, not with the hotel brand directly. The partner can tell you what the rate includes and whether its checkout accepts a membership number. It cannot tell you whether the stay will earn points or count toward status.`
- **Block 2 — your loyalty program** (heading: `Your loyalty program decides what you earn`):
  `Points and elite-night credit are set by your program's rules about the booking channel and the rate. Ask your program whether a third-party booking on this rate earns points or qualifying nights — before you book if it matters to your decision.`
- **Block 3 — the property** (heading: `The property decides what you get on arrival`):
  `Status recognition, upgrades, breakfast, lounge access, and late checkout are decided by the property at check-in and depend on availability. No one can guarantee them in advance. After booking, use your confirmation to contact the property and ask what it can provide.`
- **Partner-name rule:** use `partner.named ? partner.label : 'your booking partner'`, matching `HotelBookingOwnership.tsx:42`, with `[overflow-wrap:anywhere]` on the label span (`:5`).
- **Test:** every one of the four questions in §5.1 maps to exactly one block, and no block claims an outcome. A reader can state, unprompted, who to ask about points and who to ask about an upgrade, and give different answers.

### D3 — Break the membership-number inference, explicitly
- The panel **must** contain, as its own line (research-approved exact copy): `Entering a membership number at checkout passes it to the property. It does not decide whether the stay earns — your program's rules do.`
- Placement: closing line of Block 1, or its own line immediately after it. It is the highest-value sentence in the disclosure (§5.4); it may be reworded but may not be cut.
- **Test:** a reader who is told "the checkout took my number" can correctly say that this does not confirm earning.

### D4 — Zero assertion, zero footprint
- **Prohibited copy (hard fail, §5.5):** any positive earning/benefit claim; any per-brand negative ("does not earn Marriott points"); any "book direct" steer; any implication the **partner** can confirm accrual; any implication the **program** can confirm an upgrade; any named brand program (Bonvoy, Honors, IHG One, Hyatt) — we cannot speak to a specific program's rules, and naming one implies we have.
- **Prohibited scope:** no field on `HotelOffer`; no read of or reference to `rateEligibility` / `rateEligibilityCapability` / `membershipLabel` (§3); no change to `HotelCard`, `DealCard`, `CompareRow`, `HotelDealCriteria`, `app/deals/[dealId]/page.tsx`, or `lib/pipeline/otaLinks.ts`; no new provider method; no network call — copy is static and provider-agnostic; no loyalty-number collection or storage.
- **Affiliate contract:** deeplinks, `HOTEL_AFFILIATE_ID` markers, `rel="noopener noreferrer sponsored"` (`BookingFlow.tsx:1092`), and `isAttributedHotelProviderUrl` gating (`CompareRow.tsx:35`) are untouched. The disclosure sits above the continue anchor and must not alter its label, `href`, or `onClick` (`:1089–1101`).
- **Test:** `git diff --stat` for the UI stage touches the new component, `BookingFlow.tsx`, and tests only.

### D5 — Instrument it so §8.2 is checkable
- **Disclosure open:** emit once on first closed→open transition, mirroring `handleBookingOwnershipOpen` (`BookingFlow.tsx:966–973`). Event `hotel_loyalty_disclosure_opened`, props `{ source, partnerHost, partnerNamed, handoffSessionId }`. Use the fire-once `useRef` guard from `HotelBookingOwnership.tsx:40, 44–53`.
- **Return reason:** add one option to `HOTEL_RETURN_REASONS` (`BookingFlow.tsx:42–48`) — value `loyalty_or_points_uncertainty`, label `Not sure this stay earns points or status`. Insert **before** `prefer_not_to_say`, which must remain last. Extend the `HotelReturnReason` union (`:35–40`).
- **Test:** open the disclosure twice in one session → exactly one `hotel_loyalty_disclosure_opened`. Select the new reason → `hotel_handoff_return_reason_selected` carries `loyalty_or_points_uncertainty`. Both events carry `handoffSessionId`, so open-rate can be segmented against `hotel_handoff_continue_clicked`.

---

## 10. Out of scope (reconfirmed)

Per discovery §8, unchanged: flights; any loyalty UI on cards, results, or the deals feed; collecting/storing/transmitting a loyalty number; adding a loyalty field to `HotelOffer` or a provider method; reusing or extending `rateEligibility`; any "book direct instead" recommendation.

**Added by this brief:**
- Surfacing marketplace-owned loyalty currency. Moot as well as prohibited — the current link contract emits one attributed partner (§4.3).
- Flight loyalty. Discovery §3.6 recommends treating `loyalty-benefit-clarity` as superseded for the hotel path; this brief acts on that. `lib/baggage/fees.ts:124` already carries an honest flight-side loyalty-variance note, so the flight path is not silent in the same way. Separate ticket if wanted.

---

## 11. Handoff — for UXDES-HOTEL-LOYALTY-BENEFIT-ELIGIBILITY-01

Design the collapsed handoff disclosure only. Inputs: the escalation rule (§5) — owner assignments are fixed, wording is yours; placement (§6) — handoff only, not detail; directives D1–D5 (§9); prohibitions (§5.5, D4). States to specify: collapsed, expanded, partner-named, partner-unnamed, 375px, 1280px, keyboard/focus. There is no loading, error, or empty state, and no "loyalty preserved" or "not applicable" state — do not design ones that cannot be reached (§4.1, §4.3).

**Flag for the pipeline owner:** this brief supersedes `loyalty-benefit-clarity/02-research.md` §5.1 and §6.1 for the hotel path (placement and always-visible caption). Its §2 segments, §4 claim taxonomy, and §5.4 contract guardrails remain valid and are carried forward here.
