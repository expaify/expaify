# UX Research — Hotel room-view confidence

**Ticket:** UXR-HOTEL-ROOM-VIEW-CONFIDENCE-01  
**Stage:** UXR (Research)  
**Priority:** P0  
**Date:** 2026-07-31  
**Input:** `docs/pipeline/hotel-room-view-confidence/01-discovery.md`

## Executive finding

expaify cannot currently substantiate any room-view claim. The shipped offer is a property-level lowest-price result with one property photo; neither `HotelOffer` nor the hotel booking context carries a room, rate, view attribute, view scope, certainty, or room-linked image. The honest current state is therefore always **View not confirmed**. A room name such as “Ocean View King” could be preserved as supplier wording only after a future provider returns it, but the name alone must never cause expaify to say the view is guaranteed.

Booking.com and Expedia Group provide the useful reference pattern at the contract level: property search, room content, live room/rate availability, structured room-view content, and image scope are separate objects. Expedia additionally distinguishes property-, room-, and rate-level amenities and supplies room-view identifiers plus image captions/categories. The transferable interaction rule is not their visual styling; it is that a promise should inherit the narrowest verified scope of the inventory object that supports it.

This is a repair, not a room-selector feature. UXDES should specify an honest unsupported state for the current provider and define future-ready rendering rules for provider evidence, without inventing inventory that expaify does not have.

## Method and limits

This brief is based on:

- static inspection of the discovery report, shared hotel contract, Hotellook adapter, hotel card, property-photo component, booking-context serializer, provider handoff, request guidance, return feedback, and analytics allowlist;
- interaction-pattern comparison using official Booking.com Demand API and Expedia Group Rapid API documentation;
- a cognitive walkthrough of three evidence cases: a view only in a supplier room name, a structured view tied to an available room/rate, and a representative property photo that depicts a desirable outlook.

No live provider room payload, production analytics, user interviews, moderated tests, booking confirmation, or post-stay records were available. Reference documentation demonstrates how mature inventory systems separate scopes; it does **not** prove that every Booking.com or Expedia consumer listing guarantees every displayed view term. Behavioral impact and label comprehension remain hypotheses to test.

## Current implementation audit

### 1. The normalized offer stops at property level

`HotelOffer` contains property identity, area/location, nightly price, one `photoUrl`, deeplink, source, and several property/stay policy evidence objects (`lib/types.ts:556–578`). It contains none of the following:

- room or product ID;
- rate ID;
- supplier room/category name;
- normalized or verbatim view term;
- view evidence scope;
- view certainty/status;
- view evidence source or freshness;
- photo category, room association, or rate association.

This is a structural absence, not an empty-state bug. There is no current field from which UI code could truthfully derive “Ocean view,” “Partial ocean view,” “View request only,” or “Guaranteed room view.”

### 2. Hotellook returns a lowest-price hotel result, not selectable room inventory

`hotellook.searchHotels()` calls the property cache endpoint with destination and dates (`lib/providers/hotellook.ts:447–481`). Each normalized result uses `hotelId`, `hotelName`, location, `priceFrom`, and a hotel-ID-based static photo URL (`:494–535`). The adapter does not receive or map an available room/product ID, rate ID, room name, view field, or room-level photo association.

The outbound deeplink is affiliate-marked (`:432–438`), so the existing provider contract is valid for handoff, but it is not evidence about what room the observed nightly price buys. A higher price, waterfront location, hotel name, or image content cannot fill this gap.

### 3. The photo is now honestly property-scoped, but it cannot support a room-view claim

`PropertyPhoto` renders decorative image alt text and a visible **Property photo** caption (`app/components/ui/PropertyPhoto.tsx:35–58`). `HotelCard` uses the same component for the collapsed thumbnail and expanded image (`app/components/HotelCard.tsx:857–865`, `:1093–1095`). This is an appropriate repair from the adjacent photo work: the image is explicitly property-level.

The important consequence for this ticket is negative: even if the photo shows the sea, skyline, landmark, mountain, or garden, it is not associated with a room or rate and must not be parsed or presented as room-view evidence. The caption reduces ambiguity but does not eliminate a traveler’s visual inference, so a view-confidence fallback must explicitly say photos may show the property or another room category.

### 4. The view evidence cannot survive the current handoff context

`BookingHotelContext` carries property identity, price basis, provider URL, stay dates, score, ratings, and selected policy evidence, but no room/rate/view/photo evidence (`lib/booking/config.ts:60–87`). `buildBookingHotelContext()` serializes the same property-level fields (`:1061–1082`). Even if a card locally displayed ad hoc view copy, it would disappear before the most consequential surface: booking review and provider handoff.

Any future supported view state therefore requires one normalized evidence object to pass through `lib/providers` → `HotelOffer` → `BookingHotelContext`. UI-only keyword matching would violate both evidence continuity and the provider contract.

### 5. The handoff is generally honest but not view-specific

The booking review says the provider confirms “room details” and asks the traveler to compare room options there (`app/book/BookingFlow.tsx:1123–1128`). Its Special requests section correctly states that requests depend on availability, are not guaranteed, and become guaranteed only when the property explicitly confirms them for the stay (`:1211–1239`). This supplies a good certainty grammar and should be reused.

The gap is specificity and placement. “Room details” does not tell a traveler whether “Ocean View King” is supplier naming, a structured attribute, or a request. The Special requests examples omit view, and the explanation sits in supporting evidence below the primary handoff. A view-specific state must appear beside the room/view evidence it qualifies, not rely on a generic disclosure elsewhere.

### 6. Current measurement cannot isolate the problem—and one relevant event is dropped

The handoff records return timing (`BookingFlow.tsx:924–950`) and offers mismatch reasons after return. Existing reasons combine smoking and generic room mismatch or use broad room availability; there is no room-view reason (`BookingFlow.tsx:30–47`). The UI emits `hotel_handoff_return_reason_selected` (`:989–995`), but that event is absent from the analytics API’s `EVENT_PROPERTIES` allowlist (`app/api/analytics/route.ts:12–50`), so the internal production sink rejects it rather than persisting it.

Accordingly:

- away duration is only an observational hesitation signal, not proof that the traveler compared views;
- a provider return does not establish that booking failed or that a room was selected;
- current mismatch feedback cannot isolate view expectations;
- adding a view-specific reason would still produce no internal data until the existing allowlist defect is repaired in a separate instrumentation ticket.

## Reference-pattern comparison

### Booking.com: separate property content, room mapping, and live product availability

Booking.com’s official Demand API documentation separates three layers:

1. accommodation search returns a property and its best matching available product;
2. accommodation details optionally returns property photos and room details such as room name, bed configuration, occupancy, size, and smoking status;
3. availability returns live products for the traveler’s dates, with each product carrying its own product ID and room reference.

The availability tutorial explicitly instructs implementers to combine live products/prices with rich property and room content on the property page. Booking.com also describes a product ID as the identifier for a room-and-rate combination. This is the critical pattern: a room name is content, while a bookable product establishes inventory and price scope. Neither a property photo nor a property-level facility should silently become a selected-room promise.

Sources: [Booking.com — About accommodations](https://developers.booking.com/demand/docs/accommodations/about-accommodation), [Retrieve accommodation details](https://developers.booking.com/demand/docs/accommodations/look-accommodation-details), [Search for accommodation](https://developers.booking.com/demand/docs/accommodations/search-for-available-properties), [Accommodation tutorial](https://developers.booking.com/demand/docs/accommodations/accommodation-tutorial), [v2 to v3 migration FAQs](https://developers.booking.com/demand/docs/migration-guide/v3/migration-faqs).

**Guidance, not a copied UI:** expaify should require a stable room reference plus a stay-available rate/product reference before elevating a structured view to a selected-room guarantee. Booking.com’s documentation does not establish that a marketing-style room name alone is a contractual guarantee.

### Expedia Group: make evidence scope and media scope explicit

Expedia Group’s official Rapid API documentation is more explicit about scope:

- Shopping returns live rates and availability for room types, with separate room IDs, room names, and nested rate IDs.
- Content amenities can exist at property, room, or rate-plan level.
- Room views are structured identifiers and localized names in a room’s `views` object (for example, “Courtyard view”).
- Property images have category/caption metadata, room images also have captions, and Expedia’s image taxonomy distinguishes views from a room from views seen in a property common area.

Sources: [Expedia Group — Rapid Shopping](https://developers.expediagroup.com/rapid/lodging/shopping/about-shopping-api?locale=en_US), [Content reference lists](https://developers.expediagroup.com/rapid/lodging/content/content-reference-lists), [Image API category enumerations](https://developers.expediagroup.com/supply/lodging/docs/property_mgmt_apis/image/reference/enumerations/).

**Guidance, not a copied UI:** use separately scoped facts. A structured room view may describe a room category; a rate identifies the offer for the dates; an image needs its own room assignment/category. None should borrow certainty from another. In particular, “view from property” and “view from room” are materially different evidence states.

## Exact gap: current code vs reference pattern

| Evidence dimension | Current expaify behavior | Established contract pattern | Delta |
|---|---|---|---|
| Property vs room | One property offer | Separate property and room objects | No room identity or content |
| Room vs rate | One `priceFrom` nightly amount | Room ID plus nested product/rate ID and availability | No selected or stay-available room/rate pair |
| View semantics | No view field | Structured, localized room-view value | No normalized view value or raw supplier term |
| Certainty | Generic provider-confirmation copy | Evidence inherits object scope; post-booking confirmation is separate | No supported/request-only/unconfirmed state |
| Room name | Not carried | Supplier room name is separate from structured attributes | Cannot preserve naming; must not infer from it later |
| Imagery | One captioned property photo | Categorized property images and room-assigned/captioned images | No image-to-room/rate linkage |
| Continuity | Booking context drops any hypothetical ad hoc view | Identifiers/content travel through search, detail, booking, order | No end-to-end evidence object |
| Outcome signal | Broad return timing and dropped mismatch event | Product/order identifiers can support scoped outcomes | No room selection or booking outcome; feedback is not persisted |

## Evidence model and precedence

UXDES should design against the following semantic model. This is a research directive, not authorization to add provider logic in the UI.

### Minimum evidence fields for a future provider-backed state

- `roomId`: provider-stable room/category identifier;
- `rateId`: provider-stable, available product/rate identifier for the searched dates and occupancy;
- `roomNameRaw`: verbatim supplier room/category name, optional and never parsed for certainty;
- `viewLabelRaw`: exact provider-returned view term;
- `viewScope`: `property | room_category | selected_rate | request`;
- `viewStatus`: `guaranteed | request_only | not_confirmed | conflict`;
- `sourceLabel` and `fetchedAt`;
- optional `photoAssociation`: only when provider metadata links an image to the same room ID, never derived from pixels.

These fields should be normalized in `lib/providers` and carried unchanged through `HotelOffer` and `BookingHotelContext`. A populated-state implementation is blocked until a candidate hotel provider can supply equivalent evidence.

### Precedence rules

From strongest to weakest:

1. **Selected-rate structured guarantee:** explicit provider view value that the provider identifies as included/guaranteed and attaches to the same room ID and live rate/product ID for the traveler’s dates and occupancy. This is the only pre-handoff evidence eligible for **Guaranteed room view**. A structured view whose guarantee semantics are unspecified falls to rule 4.
2. **Property confirmation for the booked stay:** post-booking confirmation tied to the reservation and specific room/view. This may establish a guarantee after booking, but expaify currently cannot observe it and must not simulate it pre-booking.
3. **Request/preference capability:** provider explicitly offers the view as a request or preference. Render **View request only** and always pair it with **Not guaranteed until the property confirms it for this stay.**
4. **Structured room-category view without selected-rate linkage:** informative category evidence, but not proof that the observed price or eventual selection includes it. Render **View not confirmed** for the current offer; show the provider term only as scoped supplier detail if UXDES can keep the distinction clear.
5. **Supplier room/category name containing view language:** preserve verbatim as a room name when available; never parse, normalize, badge, or upgrade it. Render **View not confirmed** unless stronger structured evidence exists.
6. **Property description, hotel name/location, price, amenity, or imagery:** never view evidence for a room. Do not display a room-view value from these sources.

### Conflict and degradation rules

- If two provider fields disagree on view type, scope, room ID, rate ID, or certainty, use **View not confirmed**; never choose the more favorable claim.
- If a selected rate points to one room ID but the structured view or photo points to another, treat the view/photo as unrelated to the selected rate.
- Preserve modifiers exactly: **partial**, **limited**, **obstructed**, **side**, **possible**, and equivalent supplier wording must never be shortened to the unqualified view. “Partial ocean view” must not become “Ocean view.”
- Missing, stale, malformed, unsupported, or property-level evidence all degrade to **View not confirmed**. “No view” is allowed only when the provider explicitly returns that negative room/rate fact; absence is not proof of no view.
- A room-linked photo may illustrate the room category, but it does not increase certainty beyond the structured room/rate evidence. A property photo never participates in precedence.
- Do not merge separate view values into a stronger composite. If a provider returns “city” and “partial ocean,” retain both exact labels or show conflict; do not invent “city and ocean view.”

## Testable design directives

### Directive 1 — Ship the honest unsupported state before any populated state

For the current Hotellook offer and every case without selected-rate structured view evidence, show one view-confidence row in booking review immediately before the provider CTA:

- label: **Room view**;
- status: **View not confirmed**;
- explanation: **View not confirmed for the room you choose. Photos may show the property or other room categories. Confirm the room’s view with the provider before booking.**

Do not place a positive “view” chip on the property card, do not extract view words from the hotel name, and do not add a separate warning banner. This is supporting decision evidence, subordinate to price/Deal Score but adjacent to the handoff it qualifies.

**Acceptance test:** with a property photo visibly showing the ocean and no view evidence in the contract, a first-time participant must answer “not confirmed,” not “guaranteed,” when asked what view the observed rate includes. Target: at least 90% correct across 10–12 evaluative sessions, with zero critical false-guarantee interpretations tolerated before release.

### Directive 2 — Keep supplier room naming separate from certainty

When a future provider supplies a room/category name, render it verbatim as **Provider room name**. Place the independent **Room view** status directly beneath it. Never bold, badge, or repeat view words from the name as evidence.

Required adversarial fixture:

- Provider room name: **Ocean View King**
- no structured room/rate view evidence
- Room view: **View not confirmed**

**Acceptance test:** participants must correctly explain that the provider called the category “Ocean View King” but expaify has not confirmed the selected rate’s view. Target: at least 80% unaided correct and at least 90% after reading the explanation; any interpretation that expaify guarantees the view is a failure.

### Directive 3 — Use exactly three user-facing certainty outcomes

Do not expose internal evidence enums. Render only:

- **Guaranteed room view** — only for an explicit provider guarantee attached to the same selected room and live rate for the searched stay;
- **View request only** — only when the provider exposes the view as a preference/request; always add **Not guaranteed until the property confirms it for this stay.**;
- **View not confirmed** — for every other state, including room-name-only, room-category-only without rate linkage, missing, unsupported, stale, malformed, and conflicting evidence.

For a guaranteed state, show the exact provider term without strengthening it: **Provider lists “Partial ocean view” for this room and rate.** Include **Source: [provider].** For request-only, never use “available,” “included,” or a checkmark. For unconfirmed, never use “no view.”

**Acceptance test:** in randomized cards for all three states, at least 90% of participants classify each as guaranteed, request-only, or unconfirmed. Confusion between request-only/unconfirmed is recoverable copy friction; either state being read as guaranteed blocks release.

### Directive 4 — Bind every claim to scope; keep photos outside the proof chain

The visible hierarchy within the view row is:

1. certainty status;
2. exact view term and scope (“this room and rate,” “room category,” or “request”);
3. provider source/freshness;
4. photo caveat only when evidence is unconfirmed or the visible media is property-level.

At 375px, these must stack in that order with no truncation of the view term or certainty status. At 1280px, they may share a row only if reading and keyboard order stay the same. Do not use image analysis, property location, price, amenities, or promotional prose as evidence. Keep **Property photo** as the media caption.

**Acceptance test:** swap a sea-view property photo for a lobby photo while keeping evidence constant; the rendered certainty and view term must remain identical. Swap the selected `rateId` to a rate not linked to the view; the status must degrade to **View not confirmed**.

### Directive 5 — Measure comprehension and explicit mismatch, not inferred booking outcomes

Before implementation, test five fixtures: guaranteed full view, guaranteed qualified/partial view, request-only view, supplier-name-only view, and property-photo-only view. Collect forced-choice certainty, open explanation, and room-choice change after disclosure. Do not use self-reported confidence alone.

If instrumentation is later approved:

- record exposure to the view state with non-sensitive enums only: `surface`, `viewStatus`, `evidenceScope`, `hasQualifiedTerm`, and viewport group;
- add **Room view did not match** as an explicit return-feedback reason only after repairing the existing analytics allowlist and defining an eligible returned-handoff denominator;
- never send raw supplier room names, free text, booking confirmation numbers, or inferred image content;
- treat `hotel_handoff_returned` and away duration as navigation behavior, not as proof of a view mismatch, room selection, booking, or stay.

**Acceptance test:** a return without submitted feedback produces no view-mismatch event. A submitted reason produces one persisted enumerated event linked to the handoff session, and no raw room/view text.

## Recommended hierarchy by surface

### Results card

- Do not add a positive or unconfirmed view badge to today’s property-level card; repeated unsupported badges would create clutter and imply room comparability that does not exist.
- Keep the visible **Property photo** caption.
- If future search results truly represent a specific room/rate, show view evidence only after the room name and never above price/Deal Score.

### Hotel review / provider handoff

- Primary: observed nightly rate, Deal Score, and **Check rooms with provider** action.
- Secondary: room/view confidence row immediately before the provider action.
- Tertiary: source/freshness and the photo caveat.
- The generic Special requests explanation remains supporting education; include “preferred view” among its examples only if doing so does not duplicate a dedicated request-only state.

### Provider return

- Ask for mismatch feedback only after a genuine hidden→visible return following CTA activation.
- Keep the prompt optional and closed by default.
- A view-specific reason is an outcome signal only when the traveler submits it; it is not a verified post-stay claim.

## Research protocol for label validation

Recruit 10–12 travelers who have booked a hotel online in the past year, oversampling 4–5 who say a room view has influenced willingness to pay. On 375px mobile first, then 1280px desktop:

1. Show the five fixtures in randomized order without explanation prompts.
2. Ask: “What view will you get if you continue with this rate?” Force one answer: guaranteed / request only / not confirmed.
3. Ask participants to point to the evidence that caused the answer.
4. Reveal two prices for different room options and ask which they would choose and what the premium secures.
5. Change only the evidence scope or qualifier and repeat; this isolates semantics from visual preference.
6. Test keyboard reading/focus order and screen-reader announcement for the view row on both viewports.

Release guardrails:

- ≥90% correct certainty classification overall;
- 0 false-guarantee readings in the property-photo-only fixture;
- ≥80% unaided and ≥90% explained accuracy for **Ocean View King** with no structured evidence;
- 100% preservation of qualifiers such as “partial” in participant recall or visible evidence checking;
- no material increase in task time at 375px compared with the generic handoff baseline.

## Scope boundary and handoff to UXDES

UXDES should specify every visual/interaction state around this evidence model, but it must not design a room selector, gallery, or populated guaranteed state as though Hotellook supplies the necessary data. The implementation-ready spec should cover:

- current-provider unsupported/unconfirmed as the default production state;
- future fixtures for guaranteed, request-only, qualified term, stale, malformed, and conflict states;
- loading/error behavior only if a future async room-evidence check is explicitly part of the provider contract;
- 375px and 1280px hierarchy, screen-reader text, and focus order;
- exact fallback and request copy from the directives above;
- continuity through `HotelOffer` and `BookingHotelContext`, with the provider/data dependency called out for DEV rather than inferred in UI.

## Blockers and out-of-scope findings

### Blockers

- **Provider data:** Hotellook supplies no room/rate-level inventory or structured room-view evidence. Only **View not confirmed** is shippable with current data.
- **Behavioral evidence:** no production baseline or user study was available. The label thresholds above must be validated before treating the candidates as proven copy.
- **Outcome measurement:** expaify does not observe provider-side room selection, completed bookings, or post-stay outcomes.
- **Analytics defect:** `hotel_handoff_return_reason_selected` is emitted but absent from the internal analytics allowlist, so current mismatch feedback does not persist. Repair belongs in a separate instrumentation/DEV ticket.

### Out of scope

- adding or changing provider integrations;
- scraping room content or images;
- image recognition or inferring a view from pixels;
- building a room selector or gallery;
- changing the property-photo work;
- adding free-text requests or confirmation capture;
- claiming the exact floor, room number, or unobstructed quality of a view;
- repairing the analytics sink in this research ticket.

## Research conclusion

The exact trust gap is not “missing a view badge.” It is missing scoped evidence. Mature lodging contracts distinguish property, room, rate, view, media, and confirmation; expaify currently has only the property, a lowest-price amount, and property imagery. The repair is to make **View not confirmed** explicit at the handoff, ensure supplier names and photos never masquerade as proof, and reserve stronger labels for a future provider contract that can bind the exact view term to the same room and live rate the traveler is evaluating.
