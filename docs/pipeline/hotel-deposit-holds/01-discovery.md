# UXD-HOTEL-DEPOSIT-HOLDS-01: Hotel Deposit And Incidental-Hold Clarity

Date: 2026-07-22  
Stage: UX Discovery  
Priority: P0  
Feature slug: `hotel-deposit-holds`

## User Pain Point

A traveler can choose a hotel and leave expaify without knowing that the property may require money beyond the displayed stay price as a refundable deposit or temporary incidental authorization hold, so the amount, card impact, and uncertain return timing can become a financially material surprise at booking or check-in.

## Who Is Affected And Where

This affects travelers whose available card balance or cash flow is constrained, travelers using debit cards, families or groups booking multiple rooms, and anyone comparing properties whose similar room prices conceal materially different deposit requirements.

The decision starts in hotel detail, becomes rate- or room-specific during room selection, and ends at the outbound booking handoff. In the current product, those conceptual steps map imperfectly to:

- the expanded details in `app/components/HotelCard.tsx`, which is the last hotel-detail surface before review;
- `/book?kind=hotel` in `app/book/BookingFlow.tsx`, which reviews the selected hotel and sends the traveler to an external booking partner; and
- the external provider, because expaify does not currently have an on-platform room-selection surface or bookable room-rate contract.

The harm occurs when a traveler interprets “per night before taxes and fees” as the main available-funds requirement, then learns later that a property will also authorize or collect a separate amount. A refundable deposit and an authorization hold are not part of the stay price in the same way as a mandatory fee, but both can temporarily make funds unavailable and therefore affect whether the stay is viable.

## Current, Measurable Signal

This is a source-verifiable evidence and disclosure gap:

1. `HotelOffer` in `lib/types.ts` cannot represent a deposit, incidental hold, charge mechanism, amount and basis, collection timing, payment-method applicability, release wording, policy scope, or an explicit not-returned state. It only carries a nightly `{ priceCents, currency }` and labels it `per_night_before_taxes_fees`.
2. `HotellookProvider` in `lib/providers/hotellook.ts` normalizes the HotelLook cache response into price, property identity, location, quality, and selected amenity/access evidence. Its upstream shape and normalized offer contain no deposit or incidental-hold facts. The current provider-data coverage for these facts is therefore **0% of normalized hotel offers**.
3. `HotelCard` tells travelers that the provider confirms the final total, taxes, fees, room availability, cancellation policy, and terms, but does not name deposits or authorization holds. Neither its collapsed nor expanded state distinguishes a refundable or temporary funds restriction from the nightly stay price.
4. `BookingHotelContext` in `lib/booking/config.ts` carries the hotel, provider, nightly price basis, location, and outbound URL into `/book`; it carries no hold policy. `HotelHandoffReview` consequently repeats only the nightly rate and generic taxes-and-fees boundary immediately before the partner CTA.
5. Existing handoff analytics (`hotel_handoff_viewed`, `hotel_handoff_continue_clicked`, `hotel_handoff_back_clicked`, and `hotel_handoff_returned`) can describe the general outbound funnel, but there is no deposit-disclosure exposure/engagement event or explicit deposit-related help intent. Current abandonment cannot honestly be attributed to deposit uncertainty.

## Measurement Plan

Establish a baseline before judging disclosure success. Metrics must preserve the difference between missing evidence and a provider-confirmed absence of a hold.

- **Policy-data coverage (primary supply metric):** among normalized hotel offers, report the share with provider-sourced evidence for each required field: obligation type, amount/currency and basis, when it is applied, and release/return wording. Report complete, partial, explicit-none, and not-returned states separately; segment by provider and by property-level versus selected-room/rate/stay scope. “No policy returned” must never count as “no deposit.”
- **Material-hold identification (primary traveler metric):** in a comprehension task or event-backed confirmation, measure the share of first-time travelers who can correctly identify before handoff (a) whether an additional deposit/hold is documented, (b) its amount and basis when returned, (c) whether it is collected or only authorized, and (d) that any stated release window is not a guaranteed funds-availability date. A correct “provider did not return this policy” counts as safe comprehension.
- **Disclosure engagement:** among travelers exposed to a concise hold summary, measure policy-detail opens and meaningful review of the expanded evidence before the outbound CTA. Break this down by complete, partial, explicit-none, and not-returned states; a high open rate caused by unclear summary copy is diagnostic, not automatically success.
- **Support intent:** measure clicks on a policy-specific “confirm with property/provider” or help action after disclosure, labeled by evidence state. Do not infer support intent from dwell time or page exit alone.
- **Abandonment and refinement:** measure `hotel_handoff_back_clicked`, return to hotel comparison, property/rate change, or a handoff view with no outbound continue after policy exposure. Compare these signals by policy state and material amount band, but describe them as correlated behavior unless the traveler explicitly gives a reason.

## Minimum Evidence And Placement To Validate

The smallest useful disclosure is not a generic “deposit may apply” disclaimer. For each provider-returned obligation, the traveler needs:

1. **What it is:** a temporary card authorization hold, a collected refundable deposit, or another mandatory charge. These labels cannot be interchanged.
2. **How much and on what basis:** integer minor-unit money `{ priceCents, currency }` plus the documented basis, such as per stay, per night, per room, or per person. If the provider gives a range or variable rule rather than an exact amount, preserve that limitation instead of manufacturing a single number.
3. **When it affects funds:** the documented collection/authorization moment and any payment-method condition returned by the provider.
4. **What the provider says about return or release:** preserve the provider's conditional or estimated timing and clearly separate property release from bank/card-issuer processing. Never translate it into a guaranteed calendar date. If timing is not returned, say so.
5. **Evidence boundary:** source, property-versus-rate scope, and an explicit not-returned/unclear state. A property-level rule cannot be presented as confirmed for the selected room or rate.

Placement is part of the minimum viable trust repair: a material amount must be visible as a concise, separate-from-price signal in hotel detail before its primary CTA, with full evidence available in that detail state. The same evidence must persist beside the selected rate during any future on-platform room selection and be repeated on the `/book` outbound review before “Continue to booking partner.” It must not first appear after the outbound click. When no policy evidence is returned, those decision surfaces need an honest unknown state rather than silence or a “no deposit” claim.

“Material” should be validated in UXR rather than guessed as one universal dollar threshold. At minimum, any returned hold/deposit amount must be discoverable; research should test whether prominence should respond to absolute amount, the ratio to the stay price, multi-room multiplication, or debit-card applicability.

## Constraints

1. **Separate funds restrictions from the stay price.** A refundable deposit or authorization hold must not be added to Deal Score, described as a tax/fee, or implied to be a final charge. Any monetary value must use `{ priceCents, currency }` with a documented basis; the UI must explain that a hold can reduce available funds even when it is not ultimately charged.
2. **Provider-sourced evidence only, with explicit unknowns.** Every fact must enter through `lib/providers` as normalized evidence. Do not infer a policy from hotel class, brand, location, generic terms, or another property's practice. Missing data means not returned, not “none”; conflicting, variable, and property-level evidence must retain those limitations.
3. **No guaranteed release date.** Display only the provider's documented release/return wording and distinguish the property's action from financial-institution processing. Do not promise when funds will become available, and do not collapse conditional refund rules into a certainty. The evidence and CTA hierarchy must remain understandable by keyboard and assistive technology and usable at 375px and 1280px.

## Scope Boundary

This ticket owns clarity about **additional refundable deposits and temporary incidental authorization holds that affect available funds**, from hotel evaluation through outbound handoff.

It does not own:

- general taxes, resort/destination fees, or total-stay price composition (`hotel-price-visibility`);
- cancellation penalties, refundability of the room rate, or prepayment terms (`cancellation-policy` and `room-rate-clarity`);
- payment collection, deposit authorization, release processing, dispute handling, or a release-date guarantee;
- a new hotel supplier, property-policy scraping, or direct vendor calls from UI;
- building an on-platform room inventory or room-selection flow. If such a surface is introduced separately, this policy evidence must persist into it without expanding this ticket into that feature;
- changing Deal Score, hotel ranking, or affiliate routing.

## Success Statement

This is solved when a first-time traveler can identify, before outbound booking handoff, whether provider evidence documents a financially material deposit or incidental hold for the property or selected rate, distinguish that temporary/refundable funds restriction from the stay price, understand its amount/basis and application timing when supplied, and recognize that release timing is conditional rather than guaranteed—without mistaking missing provider data for “no hold.”

## Handoff Requirements For UXR

`UXR-HOTEL-DEPOSIT-HOLDS-01` must read this report and produce `docs/pipeline/hotel-deposit-holds/02-research.md`. It must:

1. Audit `HotelOffer`, `HotellookProvider`, cache normalization, `HotelCard`, `BookingHotelContext`, `HotelHandoffReview`, and existing handoff analytics to locate the smallest compatible provider-neutral evidence contract.
2. Verify which available provider response, if any, can source obligation type, amount/currency/basis, application timing, payment-method applicability, policy scope, and release/return wording. Quantify complete, partial, explicit-none, and not-returned coverage; do not use generic industry practice as property evidence.
3. Compare one or two established hotel-booking patterns at the interaction level, focusing on how they separate deposits/holds from stay totals and where they disclose them across property detail, room/rate selection, and final handoff.
4. Define 3–5 testable design directives for complete, partial, explicit-none, not-returned, conflicting, and variable-policy states, including 375px/1280px and accessible disclosure behavior.
5. Operationalize the measurement definitions above, including a defensible materiality treatment and event boundaries that never label unexplained abandonment as deposit-related support intent.

## Handoff

Create `UXR-HOTEL-DEPOSIT-HOLDS-01` with this report path and the one-sentence problem statement embedded. Research must preserve the separation between stay price, refundable deposit, temporary authorization hold, and mandatory fee, and must not imply a guaranteed release date.
