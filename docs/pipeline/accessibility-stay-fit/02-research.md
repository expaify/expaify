# UX Research: Accessible Stay Fit

Ticket: `UXR-ACCESSIBILITY-STAY-FIT-01`
Stage: UX Research
Priority: P1
Date: 2026-07-21

## Source Inputs

- Discovery report: `docs/pipeline/accessibility-stay-fit/01-discovery.md`
- Settled prior contract (reuse, do not fork):
  - `docs/pipeline/hotel-amenity-provenance/01-discovery.md` + `02-research.md` (`UXR-HOTEL-AMENITY-PROVENANCE-01`) — provider-neutral amenity evidence contract: canonical id, display label, `status` (`confirmed` / `unavailable` / `not_returned` / `unknown`), source label, confidence, optional `fetchedAt`, `scope` (`property` / `room` / `rate` / `selected_stay`), `fee`.
  - `docs/pipeline/hotel-amenity-fit/01-discovery.md` + `02-research.md` (`UXR-HOTEL-AMENITY-FIT-01`) — which high-intent amenities matter and how fit surfaces across scan → filter → card → detail.
- Current implementation audited (source files read, not assumed):
  - `lib/types.ts` — `HotelOffer` shape (`lib/types.ts:137`-`151`), `HotelRatingEvidence` (`lib/types.ts:109`-`117`), `HotelProvider` (`lib/types.ts:179`-`184`).
  - `lib/providers/hotellook.ts` — live and cached normalization paths.
  - `app/components/HotelCard.tsx` — collapsed card (`app/components/HotelCard.tsx:425`-`521`) and expanded details (`app/components/HotelCard.tsx:523`-`582`).
- Reference patterns checked at the interaction-pattern level:
  - Booking.com accessibility facilities and its property-facility vs. room-facility split: https://www.booking.com/accessible-hotels/index.html
  - Google Hotels accessibility filter and per-property accessibility list: https://support.google.com/travel/answer/6276008

## Research Question

Can a traveler with a mobility, vision, or hearing access need tell, from an expaify hotel result and without leaving the app, which accessibility features the provider has actually documented, at what scope (whole property vs. the specific room/rate), and which relevant features are simply not documented — without mistaking a generic label or a property-level claim for a promise about the room they are about to book?

## Research Summary

No. expaify carries zero accessibility data end to end: `HotelOffer` has no accessibility field, `HotellookProvider` maps no facility/accessibility attribute on either the live or cached path, and `HotelCard` has no accessibility surface. So 100% of accessibility fit decisions happen off-platform today, and the discovery signal (in-app documented-accessibility discovery rate) is structurally 0%.

The core risk is **not** the absence of a chip. It is that the naive fix — a single "Accessible ✓" amenity chip — would replace a truthful absence with a false, need-blind, scope-blind promise in a domain where a wrong signal produces a real, unusable, hard-to-reverse booking. Two failure modes dominate and must drive every downstream state:

1. **Need collapse** — "accessible" is not one thing. A lobby ramp does not substitute for a roll-in shower, Braille signage, or a visual fire alarm. A single boolean reads as "usable for me" to a user for whom it is false.
2. **Scope collapse** — "this hotel has accessible rooms" says nothing about whether the room and rate being booked is one of them. Property-level truth read as room-level guarantee is the highest-severity failure.

The provenance `status` + `scope` + source model already solves the data-integrity substructure. This ticket does not need a new evidence shape; it needs (a) a small, need-grouped canonical **accessibility feature taxonomy** layered onto that shape, (b) scope language that structurally cannot be misread, and (c) a first-class, non-alarming, non-reassuring "not documented" state. All three are design/DEV-dependent on a provider that actually returns documented accessibility data — which Hotellook's current thin `cache.json` payload does not.

## Current Implementation Findings

### 1. `HotelOffer` cannot carry accessibility evidence

`HotelOffer` (`lib/types.ts:137`-`151`) carries id, name, area, `location`, `stars`, `pricePerNight`, `priceBasis`, `rating`, `photoUrl`, `deeplink`, `source`, `hotelClass`, `guestRating`. There is no amenity field of any kind and specifically no accessibility feature list, per-feature status, per-feature scope, or accessibility source label. Because `HotelProvider.searchHotels` returns `Promise<Result<HotelOffer[]>>` (`lib/types.ts:179`-`184`), every card receives this same accessibility-free shape.

### 2. Hotellook normalization maps quality and location, never facilities

`HotelLookCacheEntry` (`lib/providers/hotellook.ts:10`-`28`) types only `hotelId`, `hotelName`, `stars`, `location`, `address`, `distance`, `priceFrom`, `photoUrl`, `propertyType`. The live normalization (`hotellook.ts:458`-`486`) and cached normalization (`hotellook.ts:318`-`381`) both emit identity, location, hotel-class, and guest-rating evidence and drop everything else. The `engine.hotellook.com/api/v2/cache.json` endpoint returns a thin availability payload with **no** facilities, amenities, room features, or accessibility attributes. There is no current path for accessibility provenance to survive live fetch or cache replay. **DEV work on real accessibility data is therefore blocked on a provider that returns it** (flag below), independent of the UI contract this brief defines.

### 3. `HotelCard` has evidence panels but no accessibility surface — and its evidence patterns are the right precedent to copy

The collapsed card shows photo, name, hotel-class + guest-rating chips, location, nightly price, Deal Score chip, Review/Details controls (`app/components/HotelCard.tsx:425`-`521`). Expanded details show Deal Score, `QualityEvidencePanel`, location, and price-scope panels (`app/components/HotelCard.tsx:523`-`582`). No accessibility summary or panel exists anywhere.

Crucially, the existing `QualityEvidencePanel` (`hotellook.ts` evidence → `HotelCard.tsx:309`-`362`) already demonstrates the exact conservative pattern accessibility should mirror: it distinguishes verified / provider-only / inferred / unavailable, it never renders missing data as a positive claim (`getGuestRatingDetailText` → `Guest rating not provided`), it carries a source label, it does not rely on color alone, and it exposes a plain-language confidence line. Accessibility must reuse this precedent rather than invent a new visual grammar.

### 4. Absence, not incorrect data, is today's state — which sets the first-wrong-move risk

A repo-wide search for `accessib|wheelchair|mobility|step-free|roll-in|grab bar|ada|hearing|braille|sensory` returns zero matches in product code (confirmed). The only adjacent string is a headline-model guardrail telling the model not to mention amenities. Because the problem is total absence, the first wrong move (a generic "Accessible" flag) would swap absence for false confidence — a strictly worse state for the affected users than showing nothing.

## Reference Pattern Comparison (interaction pattern, not visual style)

### Booking.com — property facilities vs. room-level "Accessibility" facilities

Booking.com separates property-level accessibility facilities (e.g., "Toilet with grab rails," "Wheelchair accessible") from room-level facilities shown within a specific room type, and lists named individual features rather than one "accessible" flag. The interaction lesson: accessibility is expressed as a **named feature set with an explicit level**, and the property list is visually and structurally distinct from the room list.

Delta vs. expaify: expaify has neither a named feature set nor a level distinction — only the (unbuilt) idea of one generic chip.

### Google Hotels — accessibility as discrete filterable attributes

Google Hotels exposes accessibility as discrete attributes ("Accessible bathroom," "Step-free path to entrance," "Elevator," "Service animals allowed") that a user can filter on and that appear per property. The interaction lesson: accessibility features are **discrete, individually named decision criteria**, not a rolled-up score, and each is either listed or absent.

Delta vs. expaify: expaify cannot yet filter or list discrete accessibility attributes because no field carries them.

### What neither reference does that expaify must

Neither reference makes the "not documented ≠ unavailable" distinction explicit to the user — an absent feature simply doesn't appear, which a screen-reader user can misread as "confirmed absent." expaify's higher bar (from its existing provenance model) is to name the undocumented state as **provider silence**, not as a negative claim. This is the one place expaify should exceed the references, and it is the crux of the empty-data treatment below.

## Exact Gap

Current code does this:
- Defines hotel offers with no accessibility field; providers map none; the card shows none.
- Would, under the naive plan, express accessibility as a single scope-blind, need-blind boolean chip.

Reference patterns do this:
- Express accessibility as discrete, individually named features with an explicit property-vs-room level.

The delta:
- expaify needs (1) a need-grouped canonical accessibility feature taxonomy layered onto the existing provenance `status`/`scope`/source shape; (2) scope language that cannot be read as a room-level promise; (3) a first-class "not documented by the provider" state that reads correctly to assistive tech; and (4) a normalization path in `lib/providers`, contingent on a provider that returns documented accessibility data.

---

## Deliverable 1 — Participant Criteria

Evaluate with people who have real access needs and their own assistive-tech setups. Do not simulate needs with non-disabled staff for the primary read; simulation is acceptable only for early keyboard/screen-reader smoke checks, never for comprehension claims.

**Recruitment guardrails**
- Real, self-identified access needs; a range of assistive tech and severity within each group (do not recruit only expert power-users).
- Mix of experience booking accessible stays (first-timers included, since the success statement is about a first-time user).
- Both phone (375px) and desktop testers in every group.
- Compensate participants; recruit through disability communities/organizations, not only convenience panels.
- Exclude expaify employees and anyone who has seen the design spec from the comprehension read.

**Groups (minimum) and what each must accomplish**

| Group | Assistive tech / context to cover | Must be able to accomplish on the card/detail |
|---|---|---|
| Wheelchair / mobility-aid users | Manual + power chair, walker/rollator; needs step-free entry, roll-in shower or grab bars, doorway/turning clearance, accessible parking/path | Locate which of their required mobility features the provider documents, read whether each is property- or room-level, and correctly conclude when a needed feature is simply **not documented** (not "absent"). |
| Blind / low-vision screen-reader users | JAWS/NVDA (desktop), VoiceOver/TalkBack (mobile), screen magnification, high-contrast/OS large-text | Reach the accessibility content in a predictable reading order, hear feature name + status + scope + source without relying on color/icon, and not hear "not documented" announced as "unavailable." |
| Deaf / hard-of-hearing users | Needs visual/vibrating fire alarm, visual doorbell/phone alerts; may rely on written copy over audio/video help | Find visual-alert and hearing-accessibility features when documented, and understand the undocumented state from text alone. |
| Booking companions | Booking on behalf of someone with an access need; may not share the need themselves | Match the traveler's stated needs against documented features and correctly identify what they must still confirm with the provider (especially room/rate scope) before paying. |

**What to measure per group:** task success (found the right documented fact or the right "not documented" state), scope comprehension (property vs. room), silence comprehension (not-documented vs. unavailable), and mis-set confidence (did the surface make them feel a room was usable on property-level evidence alone?).

## Deliverable 2 — Evidence Standards

A fact is surfaceable as accessibility information **only if** all hold:

1. **Provider-documented.** The provider explicitly returns the feature. No claim may be inferred from stars, price, photos, property type, review text, name, or the absence of a "not accessible" flag. If it isn't in the provider payload, it is not a claim.
2. **Normalized in `lib/providers`.** Vendor-specific accessibility strings are mapped to canonical feature ids inside the provider adapter (per the non-negotiable contract). Components never parse vendor accessibility vocabulary. Unmapped/ambiguous vendor values normalize to `unknown`, never silently to `confirmed`.
3. **Explicitly scoped.** Every fact carries `scope` ∈ `property | room | rate | selected_stay`. If the provider does not indicate a level, scope is `property` at most **and** the copy must not promise the room. Never up-level a `property` fact to `room`/`selected_stay`.
4. **Source-labeled.** Every fact carries the provider source label (as `hotelClass`/`guestRating` already do) so the user sees who documented it. expaify attributes; it does not certify.

**"Not documented" ≠ "documented as unavailable" — the load-bearing distinction**

Map to the existing provenance `status` values; do not invent new ones:

- `confirmed` — provider explicitly documents the feature present (at its stated scope).
- `unavailable` — provider explicitly documents the feature **absent** (e.g., "no elevator"). A real negative claim, shown as such.
- `not_returned` — provider returned accessibility data but not this feature, **or** returned no accessibility data at all: **provider silence.** This is the common case. It must render as *"Not documented by [provider]"* and must never read as either present or absent.
- `unknown` — provider returned an ambiguous/unmappable value. Treat conservatively, like silence, with wording that signals ambiguity rather than a claim.

Comprehension rule for downstream copy: a user must be able to tell `unavailable` (a negative claim expaify stands behind as reported) apart from `not_returned`/`unknown` (no claim either way). Never merge them into one "no" state.

**No medical or legal guarantees.** Copy may never assert ADA/standard compliance, "guaranteed accessible," certification, or that a room is "suitable/safe for" any condition or person. expaify reports what the provider documented, attributed to the provider, and defers final suitability to the provider and the user.

**Is the provenance contract sufficient? Yes — with one additive, non-forking extension.**

The `status` + `scope` + source + confidence + `fetchedAt` shape from `UXR-HOTEL-AMENITY-PROVENANCE-01` is sufficient as the per-feature evidence substructure. **Do not fork it.** The only accessibility-specific addition is metadata *about the feature*, not a new evidence mechanism:

- A canonical **accessibility feature taxonomy**: stable `featureId` + display label + `needType` (`mobility | vision | hearing | general`) — see Deliverable 4. A feature is one provenance-shaped evidence item keyed by `featureId`.
- An optional per-feature **`detail`** free-text string **only when provider-supplied and source-labeled** (e.g., roll-in shower dimensions), never expaify-authored, never used to upgrade status/scope.

Everything else (status semantics, scope semantics, "never render missing as a claim," "no color-only status") is inherited verbatim from the provenance contract. DEV must not model accessibility as a single amenity id inside the generic amenity set — that reintroduces the need-collapse failure this ticket exists to prevent.

## Deliverable 3 — Success Measures

Tied to the discovery signals; each has a comprehension guard so a "success" cannot be a confident misread.

1. **In-app documented-accessibility discovery rate** (primary; today structurally 0%). Share of accessibility decisions where a user with a stated need locates the relevant provider-documented feature **or** its correct "not documented" state without leaving expaify. Target: substantial lift from 0, measured per need group (mobility/vision/hearing), not blended — a blended number can hide a group that is fully unserved by the provider's data.

2. **Scope-comprehension pass rate.** In moderated comprehension checks, ≥ the pre-registered threshold (recommend ≥90%) of participants correctly answer "does this tell you the *room you'd book* has feature X, or only that the *property* does?" for property-scoped facts. A property fact misread as room-level is a **failure even if the task looked successful.**

3. **Silence-comprehension pass rate.** ≥ threshold of participants correctly classify a `not_returned`/`unknown` feature as "the provider didn't say" and **not** as "the hotel doesn't have it" (and vice-versa for a true `unavailable`). Run in both directions to catch over-pessimism and over-optimism.

4. **Confidence calibration (no false reassurance).** No participant books, or states they would book, on property-level-only evidence while believing the specific room is confirmed usable. This is a hard gate: any occurrence is a design defect to fix before ship, not a metric to average away.

5. **Downstream: unsupported-accessibility mismatch complaints.** Reduction in post-booking reports of "the room wasn't actually usable / feature wasn't there." Lagging, cannot be read in a lab — instrument for it and set a post-launch review, but do not treat lab comprehension as a substitute.

6. **Assistive-tech parity.** Screen-reader users reach and correctly interpret every state at a success rate not materially below sighted keyboard users; feature name + status + scope + source are all announced without color/icon dependence. Parity is a gate, not an average — the audience for this feature is disproportionately assistive-tech users.

## Deliverable 4 — Pragmatic MVP Feature Set (provider-data-dependent)

A small, ranked, need-grouped canonical set. Each item is one provenance-shaped evidence entry keyed by `featureId`, carrying its own `status`, `scope`, and source. **The whole set is contingent on the provider actually documenting these** — with today's Hotellook payload most will be `not_returned`, which is expected and must render safely (Deliverable 5). Ranking is by decision-blocking severity (a missing must-have blocks the booking outright).

**Mobility** (highest booking-blocking risk; room-scope matters most here)
1. `step_free_entrance` — step-free/level entrance to the building. Gatekeeper: no entry, no stay.
2. `accessible_room` — an accessible/adapted room type exists. Property-level by nature; must **explicitly** not read as "your room."
3. `roll_in_shower` — roll-in / step-free shower. Common hard requirement; room/rate-scoped when the provider says so.
4. `bathroom_grab_bars` — grab bars at toilet/shower. Room-scoped.
5. `accessible_parking_path` — accessible parking and a step-free path from it to the entrance. Path-of-travel gap is a frequent silent failure.
6. `elevator` — elevator/lift to upper floors. Decides whether any non-ground room is reachable.

**Vision** (sensory)
7. `braille_tactile_signage` — Braille/tactile signage for wayfinding. Property-scoped.
8. `accessible_booking_path` — screen-reader-accessible booking/confirmation with the provider. Signals the handoff itself is usable.

**Hearing** (sensory)
9. `visual_vibrating_alarm` — visual/vibrating fire/emergency alarm. Safety-critical; room-scoped when stated.
10. `visual_alerts` — visual doorbell/phone/knock alerts. Room-scoped.

**General**
11. `service_animals_welcome` — service animals accepted (a policy, not a room feature — scope `property`; do not phrase as a room amenity).
12. `accessible_common_areas` — step-free access to lobby, dining, pool, and other shared spaces. Property-scoped.

Notes for downstream:
- Keep the set this size for MVP; do not sprawl vendor vocabulary into it. Unmapped vendor values → `unknown`, not a new id.
- Group by `needType` in the UI so a user scans only their relevant group; do not present one flat list of twelve.
- `accessible_room`, `service_animals_welcome`, `braille_tactile_signage`, `accessible_common_areas` are inherently property/policy-level — copy must never let them imply the selected room/rate.

## Deliverable 5 — Empty-Data Treatment (the common case)

Given Hotellook's thin payload, the default reality is **little or no documented accessibility data**. This must be a first-class, designed state — not an edge case, and never rendered as "No accessibility features."

**Collapsed card:** Do **not** show accessibility on the collapsed card when there is no `confirmed` feature. Accessibility must never occupy scarce collapsed real estate with a scary or falsely-reassuring line, and must not displace price, Deal Score, location, quality, or the Review CTA. When (and only when) the provider `confirms` one or more features relevant to the whole property, at most a small, need-labeled, non-color-only indicator may appear (e.g., a text chip "Accessibility info" that routes into the detail); the collapsed card must never assert room-level fit. Absent confirmed data, the collapsed card shows nothing about accessibility — silence on the card is correct, because a card-level claim cannot carry scope.

**Expanded detail — an "Accessibility" evidence panel** mirroring `QualityEvidencePanel`, grouped by need type, with these states and final-intent copy for UXDES to lock:
- **Provider documents features:** list each confirmed feature under its need group with status + scope + source, e.g. *"Roll-in shower — documented for accessible rooms by [provider]. Confirm this specific room and rate with the provider before booking."* Property-scoped: *"[provider] lists this for the property, not a specific room."*
- **Documented as unavailable:** *"No elevator — [provider] indicates this is not available."* Shown as an explicit negative claim, distinct from silence.
- **Not documented (silence — the common case):** a single calm line, not a wall of "missing" rows: *"[provider] has not documented accessibility features for this stay. Not documented does not mean unavailable — check directly with the provider for step-free entry, bathroom features, alarms, and room-level details."* No red/alarm styling; neutral, not warning.
- **Ambiguous/unknown:** *"[provider] returned accessibility information we could not confirm feature by feature. Confirm details with the provider."*
- **Always-present handoff line:** *"expaify shows what the provider documented and does not verify accessibility or guarantee suitability."* No ADA/compliance/"suitable for" language anywhere.

**Screen-reader behavior for the empty state:** the not-documented state must be announced as provider silence, in reading order after price/score/quality and before the provider-handoff copy, with the words "not documented" and "does not mean unavailable" spoken — never conveyed by a greyed icon alone. It must neither alarm (no "warning"/"error" role) nor reassure (no "available"/"included"/"free"). Property-level items must be spoken with their scope in the same phrase as the feature, so the level cannot be lost between the name and a separate visual tag.

**Mobile 375px / desktop:** the panel wraps without overlapping the photo, price block, score chip, or CTA; need-group headings stack on mobile; no status is conveyed by color alone at any breakpoint.

---

## Design Directives For UXDES (specific, testable)

1. **Reuse the provenance evidence shape; add only a need-grouped feature taxonomy.** Each accessibility feature is one `status`/`scope`/source/confidence item keyed by a canonical `featureId` with a `needType`. Do not fork the provenance contract; do not model accessibility as a single amenity id in the generic set.
2. **Scope must be inseparable from the feature.** Every displayed feature states property vs. room/rate in the same phrase; property-level facts use language that cannot be read as a room promise and direct the user to confirm room/rate with the provider before payment. No feature may up-level from `property` to `room`.
3. **`not_returned`/`unknown` render as calm provider silence, never as unavailable and never as available.** One neutral line, explicitly saying not-documented ≠ unavailable. `unavailable` renders as a distinct explicit negative claim. Never render "No accessibility features."
4. **No color-only status; assistive-tech parity is a gate.** Feature name + status + scope + source are all available as text and announced in a predictable reading order after price/score/quality, before handoff copy. Mirror `QualityEvidencePanel`'s confidence-line pattern.
5. **No medical/legal claims.** No ADA/compliance/certification badges, no "guaranteed accessible," no "suitable/safe for." Attribute every fact to the provider; keep the standing "expaify does not verify accessibility or guarantee suitability" line.
6. **Preserve hierarchy and 375px usability.** Accessibility never displaces price, Deal Score, location, quality, or the Review CTA on the collapsed card; absent confirmed data, accessibility is off the collapsed card entirely. Panel wraps cleanly at 375px and desktop.

## Acceptance Criteria For UXDES

- Design covers: provider-documents-features, documented-unavailable, not-documented (silence), ambiguous/unknown, loading/failed-separately-from-inventory, mobile 375px, desktop 1280px, focus/keyboard, and assistive-tech announcement copy.
- Final UI strings provided for the "Accessibility" panel heading, each need-group heading, confirmed/unavailable/not-documented/unknown states, the property-vs-room scope phrasing, the source/provider disclosure, and the standing non-verification line.
- A hotel with no accessibility data never shows "No accessibility features"; it shows the provider-silence state.
- A property-level feature never reads (visually or to a screen reader) as selected-room/rate availability unless the payload explicitly supports that scope.
- No color/icon is the sole status signal in any state.
- Design names DEV work as required and provider-contingent: `HotelOffer`, `HotellookProvider` (live + cached), cache validation, and tests all lack accessibility fields, and no current provider returns documented accessibility data.

## Risks And Constraints

- **Provider blocker:** the Hotellook `cache.json` payload returns no accessibility attributes; there is no path today for accessibility provenance to survive fetch or cache replay. DEV that surfaces *real* accessibility data is contingent on a provider that documents it. The UI contract and empty-state can and should be built to the "not documented" default now; do not fabricate data to fill the panel.
- **First-wrong-move risk:** because today's state is total absence, a generic scope-blind chip would be strictly worse than nothing. Guard against it in design and review.
- Existing non-negotiables hold: external calls stay in `lib/providers`; adapters return `Result<T>`; money stays integer cents; secrets from env; outbound hotel deeplinks keep affiliate markers; components never parse vendor accessibility strings.

## Out Of Scope (flag for later tickets)

- Building a general amenity/accessibility **filter** UI — owned by `hotel-amenity-fit`. Accessibility may reference it; it must not build it here.
- Letting accessibility data influence **Deal Score** — no approved hotel-fit scoring model; must not conflate price percentile with usability.
- Any **provider integration** that does not actually return documented accessibility data; DEV surfacing real data is contingent on such a provider.

## Handoff

Create `UXDES-ACCESSIBILITY-STAY-FIT-01` (UX Design) to produce the implementation-ready spec for the need-grouped accessibility evidence panel and its empty/not-documented default on hotel result cards and expanded details, reusing the provenance `status`/`scope`/source shape with the additive feature taxonomy defined here.
