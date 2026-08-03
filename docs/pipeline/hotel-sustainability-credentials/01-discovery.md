# UXD-HOTEL-SUSTAINABILITY-CREDENTIALS-01: Hotel Sustainability Credential Confidence

**Ticket:** UXD-HOTEL-SUSTAINABILITY-CREDENTIALS-01 · **Stage:** UX Discovery · **Priority:** P2  
**Date:** 2026-08-03 · **Feature slug:** `hotel-sustainability-credentials`

## User pain point

A traveler trying to choose a lower-impact hotel cannot tell which properties have a current, independently identifiable sustainability credential—or compare the meaning and limits of credentials across properties—because expaify shows no sustainability evidence and an unsupported “green” claim would be indistinguishable from a verified one.

## Who is affected and where

The primary user is a hotel shopper who wants environmental practice to influence the shortlist but still needs price and fit to remain legible. The problem is most acute for a first-time traveler evaluating unfamiliar properties; they have little prior knowledge with which to challenge a vague badge or program name.

The affected decision spans two expaify-owned steps:

1. **Result discovery and comparison.** On `/deals`, the traveler compares hotel name, class, price, discount, and Deal Score. There is no sustainability evidence in the `ApiDeal` contract, no sustainability filter, and no way to distinguish a property with a traceable credential from one with no returned evidence.
2. **Hotel detail evaluation.** On `/deals/[dealId]`, “Hotel fit” shows hotel class, guest-rating availability, and separate evidence ledgers, then the traveler reaches **Check rooms with provider**. There is no sustainability row, credential provenance, verification boundary, or explicit no-data state before that handoff.

This is a confidence and comparability problem, not permission to label a hotel environmentally superior. A credential can establish that a named scheme reports the property as meeting its standard at a known point in time. It does not, by itself, prove lower emissions, quantify impact, or establish that one differently certified property outperforms another.

## Current implementation evidence

The repository establishes a structural zero and a useful trust pattern:

- `HotelOffer` in `lib/types.ts` has no sustainability, certification, environmental-impact, or credential field. Its general `HotelAmenityEvidence` model covers sourced amenity status but does not represent an issuer, scheme, credential level, validity period, or verification URL.
- The `deals` table in `lib/db/schema.sql` persists hotel identity, class, price history, dates, links, and editorial copy, but no sustainability evidence. The live `/deals` `ApiDeal` shape likewise carries none.
- `DealFeed.tsx`, `HotelCard.tsx`, and the saved-deal detail page contain no sustainability presentation. Therefore there is no current supported claim to repair and no existing user interaction from which to infer demand.
- Existing hotel evidence work already separates `confirmed`, `unavailable`, `not_returned`, and `unknown`, plus source and scope. Sustainability evidence should preserve that honesty boundary, but it needs its own credential semantics rather than being inferred from or flattened into amenities.

Because the current behavioral baseline is zero exposure, zero inspection, and zero comparison support, this discovery does **not** claim that adding a badge will change selection. That is the hypothesis UXR must test.

## Research hypothesis

If expaify shows a compact, source-attributed credential summary during result comparison and the credential’s issuer, scheme, status, scope, and recency on hotel detail, then travelers who care about lower-impact choices will more accurately distinguish documented participation from missing evidence and use that distinction in selection—without interpreting the credential as a universal environmental-performance score.

The hypothesis fails if travelers cannot explain what is verified, assume amenity-like practices prove certification, treat “no data” as “not sustainable,” or choose based on a prominent badge while ignoring that its scope or validity is unknown.

## Pragmatic credential taxonomy for UXR validation

This taxonomy defines the minimum evidence classes to test. It is deliberately small and non-ordinal: the rows must not become “best / better / good” tiers.

| Evidence class | Minimum evidence required | Permitted meaning | Honest presentation boundary |
| --- | --- | --- | --- |
| **Current third-party credential** | Property identity match; named scheme and issuer; credential/certification status; property-level scope; validity end date or issuer-confirmed current status; provider or issuer provenance; observed/verified time | A named independent scheme reports that this property currently meets or participates under its stated standard | Do not translate it into emissions saved, “eco-friendly,” or superiority over a different scheme |
| **Provider-reported credential** | Property identity match; named scheme; provider source; reported status; property scope; fetched time; no issuer confirmation available | The booking provider reports this named credential | Label it as provider-reported; do not style or word it as independently verified by expaify |
| **Incomplete, stale, or conflicting record** | Some credential fields exist, but identity, issuer, scope, status, validity, or source records are missing, stale, malformed, or disagree | There may be a credential requiring confirmation | Do not show a positive credential badge; expose “could not verify” only at a decision-useful surface if research shows it aids comprehension |
| **No verifiable evidence returned** | Provider explicitly returned no qualifying credential evidence, or no credential-capable source was checked | expaify has no verifiable credential evidence for this property | Say that evidence was not provided or not checked; never say “not sustainable,” “not certified,” or rank the property down as if absence were negative proof |

Candidate records outside this taxonomy do not qualify as sustainability credentials: recycling, towel reuse, EV charging, vegan breakfast, refill stations, solar panels, efficient lighting, or other amenities/practices without a traceable credential record. They may be useful facts in a separately approved evidence model, but none may be used to infer environmental performance or certification.

## Provenance and comparability treatment

For UXR and UXDES to treat a credential as decision-grade, the evidence model must preserve these fields independently:

- stable property identity match;
- credential scheme name and issuing organization;
- credential status and any level exactly as supplied, without normalizing unlike schemes onto a shared quality scale;
- scope (`property` only for this ticket; chain-level or corporate commitments do not qualify as property evidence);
- valid-from/valid-through dates when supplied, plus a separate provider fetch or verification timestamp;
- source class (`issuer-confirmed` or `provider-reported`), source label, and a safe evidence reference when contractually displayable;
- record state (`current`, `expired`, `not_returned`, `unknown`, `conflicting`, or `check_failed`).

Comparison is valid only on like facts. Users may compare whether each property has current, traceable evidence and inspect what scheme/level each record names. Expaify must not collapse different standards into one sustainability score, order schemes by implied rigor without a researched and governed basis, or combine sustainability with Deal Score. Credential status must not alter price percentile, verdict, or explanation.

## Measurable signal

### Structural baseline

- Sustainability fields in `HotelOffer`: **0**.
- Sustainability fields in the persisted `deals` record and `ApiDeal`: **0**.
- Sustainability evidence elements on live results and saved hotel detail: **0**.
- Dedicated no-data sustainability states: **0**.

### Validation measures

UXR should measure outcomes with scenarios containing current third-party, provider-reported, stale/incomplete, conflicting, and no-evidence properties. No launch target is defensible before that baseline exists.

- **Credential comprehension:** share of participants who can correctly state (a) who supplied or issued the credential, (b) whether it is current, and (c) that it is not an impact score. Report each item separately and all-three accuracy together.
- **No-data comprehension:** share who interpret “no verifiable evidence returned” as unknown evidence rather than proof that the hotel performs poorly or lacks every certification.
- **Evidence interaction:** result-summary exposure → detail/evidence open → provider handoff, back-to-results, or exit, segmented by evidence class. An open is evidence of inspection, not automatically improved trust.
- **Selection impact:** in controlled comparison tasks, change in shortlist or selected property when credential evidence is introduced, paired with the participant’s stated reason. Report credential-led changes separately from price-, location-, and Deal Score-led changes.
- **Comparability accuracy:** share who avoid ranking unlike schemes or credential levels when no common performance basis is supplied.
- **Confidence calibration:** stated confidence should rise for current, complete evidence relative to incomplete evidence, while confidence for no-data cases should remain explicitly uncertain rather than falsely positive or negative.

If product analytics are later approved, use bounded evidence-state enums and coarse viewport/surface context. Do not record free-text environmental preferences, full evidence URLs, or infer a traveler identity/profile from interaction.

## Constraints

1. **Verifiable evidence only.** Every positive credential claim must originate behind `lib/providers` from a contractually displayable provider or certification record and retain property match, source, scope, status, and time. Never infer performance or certification from amenities, marketing copy, images, hotel class, guest rating, price, or chain reputation. Missing or malformed evidence stays explicit.
2. **No synthetic ranking or Deal Score contamination.** Credentials from unlike standards are not interchangeable. Do not invent a sustainability score, “green” tier, environmental savings figure, or scheme hierarchy, and do not change Deal Score, price ordering, or its explanation based on credential evidence.
3. **Lightweight, accessible decision support.** Any result-level summary must remain secondary to property identity, price, and Deal Score; detail evidence must be readable at 375px and 1280px, keyboard and screen-reader accessible, and understandable without color, hover, logos, or unexplained acronyms. No-data must be available without adding decorative clutter to every result.

## Success statement

This is solved when a first-time traveler can compare two hotel candidates, identify which has current and traceable sustainability credential evidence, inspect who issued or reported it and when, and make a selection without mistaking a hotel amenity, an expired or incomplete record, or missing provider data for proof of environmental performance.

## Out of scope

- Estimating carbon, water, waste, energy, biodiversity, or social impact
- Creating a sustainability score, ranking certification schemes, or changing Deal Score
- Inferring a claim from amenities, descriptions, photos, hotel class, chain commitments, or guest reviews
- Collecting self-attested hotel claims without a provider/certification provenance contract
- Building an amenity-practices browser, carbon calculator, loyalty benefit, or award-travel feature
- Changing provider selection, hotel ranking, booking logic, money handling, or affiliate deeplinks
- Implementing UI, provider adapters, persistence, or analytics in this UXD ticket

## UXR handoff questions

1. Which active or realistically pluggable hotel providers can return property-level credential records, and for each record which scheme, issuer, status, level, scope, validity, source, and fetched/verified fields are contractually displayable?
2. Which named certification records can be identity-matched to a property reliably, and how must stale, expired, conflicting, chain-level, or unmatched records resolve?
3. In moderated comparison at 375px and 1280px, what is the smallest result-level summary that improves accurate evidence recognition without becoming an unsupported “green badge” or competing with price and Deal Score?
4. Can travelers correctly distinguish issuer-confirmed from provider-reported evidence, and do they need that distinction on the result row, detail only, or both?
5. What exact no-data wording prevents both false reassurance and false condemnation, and should no-data appear on every result or only after evidence inspection?
6. How do one or two comparable hotel products present certification identity, provenance, expiry, and missing evidence at the interaction-pattern level—not merely as visual badges?
7. Does complete credential evidence materially change shortlist/selection for the target traveler, and is that change accompanied by accurate comprehension rather than halo effects?

**Next stage:** `UXR-HOTEL-SUSTAINABILITY-CREDENTIALS-01` (UX Research, Claude Fable 5).
