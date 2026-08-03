# UXR-HOTEL-SUSTAINABILITY-CREDENTIALS-01: Hotel Sustainability Credential Confidence

**Ticket:** UXR-HOTEL-SUSTAINABILITY-CREDENTIALS-01 · **Stage:** UX Research · **Priority:** P0  
**Date:** 2026-08-03 · **Feature slug:** `hotel-sustainability-credentials`  
**Upstream:** `docs/pipeline/hotel-sustainability-credentials/01-discovery.md`

## Research decision

The discovery problem is valid, but expaify cannot truthfully ship a positive sustainability credential claim from its current data path.

The active hotel search uses a third-party Booking.com RapidAPI search endpoint and normalizes only identity, location, hotel class, guest score, price, and photo. The normalized `HotelOffer`, saved-deal schema, `/api/deals` response, result card, and saved detail have no credential fields. The two other checked-in hotel adapters also discard all sustainability information. A generic green badge, a sustainability filter, or a claim that a property is certified would therefore be unsupported.

Provider research establishes a feasible future direction, not launch-ready ground truth:

- Booking.com's official Demand API exposes `programmes.sustainable_offerings.certifications` on accommodation details, but expaify does not use that API and the public example does not establish issuer, status, validity dates, verification URL, or display rights for each returned item.
- Expedia Rapid exposes named property sustainability certification/award/program attributes, but the documented attribute record is an ID and name. It does not establish property credential status, validity, level, issuer verification, or a credential URL.
- Travalyst is building a scheme list and optional certified-property data channel, but property contribution is voluntary, Travalyst does not verify or endorse scheme declarations, and no access, matching, or display contract exists in this repo.

UXDES should therefore specify an evidence-gated prototype and every honest state, but UI/DEV must not expose a positive production claim until a provider sample, commercial/display terms, property-match rule, and freshness policy pass the gate in § 4 and D1. The recommended pattern is a short, textual result cue only for qualifying positive evidence, followed by a named credential-evidence region on saved detail. Missing evidence belongs on detail after inspection, not repeated across every result.

This is desk research and code audit, not participant validation. No moderated sessions or product analytics were available in this ticket, so comprehension, no-data interpretation, and selection impact remain hypotheses with a concrete validation protocol in § 8. No selection uplift is claimed.

## Method and evidence boundary

This brief separates four evidence classes:

1. **Current-code evidence:** direct inspection of the active search adapter, shared types, saved-deal persistence/API, production result card, saved detail, and alternate checked-in hotel adapters.
2. **Provider-contract evidence:** current official Booking.com Demand API, Expedia Rapid, and Travalyst documentation. Public documentation demonstrates fields, not expaify's commercial entitlement or display permission.
3. **Reference-pattern guidance:** official explanations of Booking.com and Google Hotels interactions, plus the regulatory failure of Booking.com's former ordinal leaf/level treatment. These patterns guide hierarchy and wording; they are not reusable data.
4. **Unvalidated research hypotheses:** proposed copy and placement to take into moderated comparison. They must not be reported as observed user behavior.

No vendor call was made. Credentials, partner terms, representative payloads, and a contractually displayable evidence URL were not available in this ticket.

## 1. Current implementation audit

### 1.1 The normalized hotel contract cannot represent a credential

`HotelOffer` contains property identity, location, price, class/rating evidence, amenities, and several policy evidence objects, but no sustainability or credential object (`lib/types.ts:687-711`). `HotelAmenityEvidence` has a status, scope, source, fetch time, and confidence (`lib/types.ts:120-148`), but it cannot preserve:

- credential scheme and issuing organization as separate values;
- credential status or level;
- valid-from or valid-through dates;
- issuer-confirmed versus provider-reported provenance;
- a credential evidence reference;
- stale, expired, conflicting, unmatched, or check-failed states.

Treating a certification as an amenity would erase the exact distinctions this ticket exists to protect. `HotelProvider` also has no credential/detail lookup method (`lib/types.ts:748-757`), so a detail check cannot currently occur behind the provider boundary.

### 1.2 Active live search supplies no credential evidence

`/api/search` calls only `bookingComHotels.searchHotels()` for hotels (`app/api/search/route.ts:172-180`). That adapter uses `booking-com15.p.rapidapi.com`, not Booking.com's official Demand API (`lib/providers/bookingComHotelsRapidApi.ts:12-20`). Its response shape accepts name, coordinates, review values, class, photo, and gross price only (`bookingComHotelsRapidApi.ts:34-53`); the normalization maps exactly those fields (`:160-200`).

The adapter does not request a property-details endpoint, declare any sustainability response fields, retain a certification record, or expose affiliate booking links. The cache therefore cannot contain a supported credential either. Calling the response source “Booking.com” does not turn an undocumented aggregator field into an issuer-confirmed record.

### 1.3 Alternate checked-in providers do not repair the gap

| Adapter | Current checked-in input | Credential result |
| --- | --- | --- |
| `bookingComHotelsRapidApi.ts` | Search result only: identity, price, location, review, class, photo | None; active live-search path |
| `hotelbeds.ts` | Availability shape plus a content request limited to images (`lib/providers/hotelbeds.ts:36-65,245-281`) | None normalized; adapter is not active in `/api/search` |
| `hotellook.ts` | Cached price feed with hotel identity, class, location, price, and optional amenity/policy compatibility fields (`lib/providers/hotellook.ts:18-42,494-542`) | None; used by alerts/document checks, not current live search |

None can populate even the discovery taxonomy's **provider-reported credential** state today.

### 1.4 Production result comparison has no place for credential state

The production `/deals` surface renders `DealCard`, not the richer `HotelCard`. `DealCardDeal` contains identity, class, price history, discount, dates, links, and price timestamps only (`app/components/ui/DealCard.tsx:26-43`). Its visible hierarchy is property identity/class/date, supplier/disruption cues, price and Deal Score-adjacent savings, photo, and CTA (`DealCard.tsx:78-158`).

`ApiDeal` likewise has no credential state (`app/api/deals/route.ts:12-32`), and `DealFeed` passes no such evidence into `DealCard` (`app/deals/DealFeed.tsx:1792-1816`). A result-level sustainability cue therefore requires end-to-end data continuity; it is not a local badge addition.

### 1.5 Saved detail loses the evidence before the provider handoff

The `deals` table persists hotel identity, class, price history, dates, links, and editorial fields, but no credential record or evidence revision (`lib/db/schema.sql:125-147`). Saved detail's **Hotel fit** section shows class and an explicit missing guest-rating state, then disruption/quiet-stay ledgers (`app/deals/[dealId]/page.tsx:416-435`). The provider handoff immediately follows (`:437-456`).

This is the correct decision location for a future **Sustainability credential evidence** region: after price/Deal Score and hotel fit context, before **Check rooms with provider**. Placing it only in later **Supporting evidence** would make it easy to miss after the booking decision. Placing it above price would incorrectly compete with expaify's primary deal proposition.

### 1.6 Existing trust patterns are reusable, but the taxonomy is not

The repo already uses explicit absence, conflict, source, scope, and fetch-time states for hotel policies and evidence. That interaction language is reusable. The credential model must remain separate because:

- a current credential is property-level evidence about participation in a named scheme, not a stay-scoped amenity;
- a provider's report and an issuer-linked record have different provenance;
- missing credential evidence is not an unavailable amenity and is not a negative hotel attribute;
- unlike schemes and their internal levels are not comparable on one ordinal scale.

## 2. Provider ground truth and realistic plug-in paths

### 2.1 Booking.com: a plausible provider-reported source, not current issuer verification

Booking.com's official Demand API accommodation-details example contains:

```text
programmes.sustainable_offerings.chain_programmes[]
programmes.sustainable_offerings.certifications[]
programmes.sustainable_offerings.practices[]
```

The official guide positions `/accommodations/details` as static property content used after a search result is selected. [Booking.com accommodation details](https://developers.booking.com/demand/docs/accommodations/look-accommodation-details)

This proves that Booking.com's official partner product can distinguish certifications from practices and chain programs. It does **not** prove that expaify's current RapidAPI endpoint returns that object, or that certification entries contain current status, validity, issuer, level, verification URL, and display permission. Booking.com's public migration guide also says the former sustainability query parameter is not available in the v3 mapping, so search-time filtering cannot be assumed from the details object. [Booking.com v3 hotel migration guide](https://developers.booking.com/demand/docs/migration-guide/v3/hotel-v3-migration-guide)

**Research classification:** realistically pluggable only through a separately approved official Demand API integration. Until representative production payloads and terms are reviewed, each named item is at most **provider-reported**, never issuer-confirmed. `chain_programmes` and `practices` must be excluded from credential claims.

### 2.2 Expedia Rapid: named property attributes, insufficient lifecycle evidence

Expedia Rapid documents nearly 80 sustainability attributes, with certifications/awards/programs separated from property and room practices. Named property attributes include Green Key, Green Globe, Travelife, EarthCheck, EU Ecolabel, Nordic Swan Ecolabel, and many regional schemes. The documented response example is an attribute ID and localized name. [Expedia Rapid sustainability attributes](https://developers.expediagroup.com/rapid/lodging/content/sustainability?locale=en_US)

That supports a reliable **credential versus practice** classification and a named provider-reported claim for an Expedia property ID. It does not expose, in the reviewed public contract, a status, level, validity date, certificate identifier, issuer verification timestamp, or evidence URL. Some entries are explicitly “awards and programs,” so an allowlist must not automatically call the whole category “certifications.”

**Research classification:** realistically pluggable as provider-reported named evidence after a separate provider decision and display-rights review. It cannot populate **current third-party credential** without a second issuer-linked record or richer contracted fields.

### 2.3 Travalyst: useful scheme registry and optional property data, not a universal verifier

Travalyst's current Certifications Initiative publishes schemes that self-declare compliance with the EU ECGT criteria. Travalyst explicitly says it does not assess, endorse, or verify those schemes; annual re-declaration is required. Its Data Hub is intended to include both scheme information and certified-property data, but property contribution is optional. [Travalyst Certifications Initiative](https://travalyst.org/work/certifications-initiative/)

This makes Travalyst a potentially useful scheme-identity and property-matching input, but not a blanket “verified by Travalyst” source. A listed scheme and a certified-property record are separate facts. Absence from the Data Hub cannot mean “not certified,” because schemes need not contribute property data.

**Research classification:** future issuer-linked/source-registry candidate only after access, terms, record fields, property matching, and update cadence are confirmed. No adapter exists.

### 2.4 Hotelbeds and Hotellook: no qualifying current evidence

The implemented Hotelbeds content request asks only for images, and the implemented availability response has no sustainability fields. The implemented Hotellook cached-price shape has no credential fields. Public documentation or code reviewed for this ticket does not establish a contractually displayable credential path for either integration.

**Research classification:** `not_checked_capable` / no qualifying evidence. Do not render **No credential** for their properties.

### 2.5 Field-level capability matrix

| Required field | Current RapidAPI adapter | Official Booking Demand | Expedia Rapid Content | Travalyst future data |
| --- | ---: | ---: | ---: | ---: |
| Stable source property ID | Yes | Yes | Yes | To validate |
| Named scheme/credential | No | Certification array exists; entry shape to validate | Yes, attribute name | Scheme records; property contribution optional |
| Issuing organization distinct from scheme | No | Not established in reviewed public example | Sometimes embedded in name; not a separate field | To validate |
| Property-level scope | No | Accommodation detail implies property, but must confirm per entry | Property attribute category | To validate |
| Status | No | Not established | No | To validate |
| Level exactly as supplied | No | Not established | No | To validate |
| Valid-from / valid-through | No | Not established | No | To validate |
| Issuer-confirmed provenance | No | No | No | Possible, not established |
| Provider fetched/observed time | Adapter can generate | Adapter could generate | Adapter could generate | Feed-dependent |
| Safe evidence reference | No | Not established | No | To validate |
| Display rights confirmed for expaify | No | No | No | No |

**Conclusion:** no reviewed source currently satisfies every field required for the discovery's **current third-party credential** class. Booking Demand and Expedia Rapid can potentially satisfy **provider-reported credential** after contract validation. Anything stronger is blocked.

## 3. Credential taxonomy and resolution rules

The discovery's non-ordinal taxonomy is validated with two changes: separate `expired` from generic incomplete data, and separate “source not checked” from “checked; nothing returned.” These distinctions change copy and prevent a missing-data halo.

| Normalized record state | Eligibility rule | Result surface | Detail surface |
| --- | --- | --- | --- |
| `current_issuer_linked` | Stable property match; named scheme and issuer; property scope; explicit current status plus valid-through or issuer observation; displayable provenance | Positive textual cue allowed | Full evidence ledger |
| `current_provider_reported` | Stable provider property ID; provider categorizes a named item as a certification; property scope; fetched time; no issuer linkage | Explicit “reported” cue allowed only in prototype until comprehension is validated | Full ledger, provider distinction in first two lines |
| `expired` | Valid-through is before current date or explicit expired status | No positive cue | “Credential record expired {date}” plus source |
| `incomplete` | Missing scheme/issuer/scope/status/validity required for its claimed source class | No positive cue | “We could not verify this credential record” only when a partial record exists |
| `conflicting` | Sources disagree on property, scheme, status, level, or validity | No positive cue | Name the conflicting dimension; no winner without source policy |
| `not_returned` | A credential-capable source was successfully checked and returned no qualifying item | No result copy | “No verifiable credential evidence was returned for this property.” |
| `not_checked` | No credential-capable source was queried | No result copy | “Sustainability credential evidence has not been checked for this property.” |
| `check_failed` | Credential-capable request failed or response was malformed | No result copy | “We couldn't check sustainability credential evidence right now.” + Retry if retriable |

### Property identity matching

A positive property-level claim requires the credential record to resolve to the same physical property, not only the same chain or similar name.

1. Accept a shared stable property identifier supplied by the same provider, or an issuer property identifier explicitly crosswalked to it.
2. If no shared ID exists, require a deterministic composite match: normalized property name **and** full street address, with country/postcode agreement; coordinates may resolve minor address formatting differences but cannot match a property by themselves.
3. Reject name-only, chain-only, city-only, and corporate-program matches. Near-duplicate properties in one complex remain unmatched until a unique address/unit is available.
4. Preserve each source record before resolving. If two qualifying records disagree, use `conflicting`; do not silently prefer the more positive one.
5. Never carry a credential across a provider-property ID change without rerunning the match.

### Freshness and validity

- `validThrough` controls expiry when supplied. Fetch time never extends credential validity.
- A provider's explicit “current” status without a validity date may support `current_provider_reported`, but not issuer-linked currency unless the issuer source itself confirms current status.
- A validity date with no status may support current status only when the source contract defines validity semantics.
- Expired records remain inspectable on detail but never generate a positive cue or filter match.
- A cached record may be displayed only inside its provider/source freshness policy; a provider refresh failure must transition to `check_failed` or a clearly stale state, not remain silently current.

## 4. Launch evidence gate

Before UI or DEV exposes a positive claim, the responsible provider stage must record all of the following for at least 20 representative properties across two markets, including positive, absent, malformed, duplicate-name, and expired examples:

1. raw provider field path and a redacted representative payload;
2. property identifier and match outcome;
3. scheme name, issuer, status, level, scope, validity, and evidence reference exactly as returned;
4. the provider's definition of certification versus practice/program;
5. cache/update cadence and expiration behavior;
6. contractual permission to display each field and link;
7. behavior when the field is empty, omitted, stale, malformed, or conflicting.

If the source provides only a named certification attribute, the maximum claim is **provider-reported**. If it provides no lifecycle/current-status evidence, UXDES must not use “current,” “valid,” “verified,” or “certified through.” If terms or matching are unresolved, remain at `not_checked` and do not launch a filter.

## 5. Comparable interaction patterns

### Booking.com: named third-party label and filter, with ordinal green levels removed

Booking.com announced in March 2024 that it would replace its “Travel Sustainable” name, logo, and levels with a label acknowledging third-party certification and a search filter. [Booking.com third-party certification update](https://news.booking.com/bookingcom--prioritizing-third-party-certifications/)

The change is important because the Netherlands Authority for Consumers and Markets found the former level/leaf treatment could imply a stay was sustainable, obscure what the score meant, and make unlabeled properties appear to have no sustainability efforts. Booking.com removed the claim, scores, and leaves. [ACM decision summary](https://www.acm.nl/en/publications/bookingcom-takes-travel-sustainable-program-offline-following-acm-action)

**Pattern to adopt:** a factual certification presence cue can help scanning; a filter must match qualifying evidence only; scheme identity belongs in the detail layer.

**Pattern not to copy:** generic green language, leaves, ordinal levels, or an unlabeled result interpreted as negative evidence. Booking.com's platform label is also not evidence that the current expaify adapter may reproduce the claim.

### Google Hotels: compact label near identity, detail disclosure, silent absence

Google documents an “eco-certified” label near the hotel name and a deeper Sustainability section under the property's About tab. Google separates self-reported practices from third-party certifications and discloses that it does not independently verify each hotel's certification status. If no Sustainability section is present, Google directs travelers to the hotel site rather than asserting the property lacks practices or certification. [Google Travel sustainability in hotels](https://support.google.com/travel/answer/10976106?hl=en)

**Pattern to adopt:** compact positive cue at comparison, fuller provenance and limitations on detail, and no negative result-row badge for absence.

**Pattern not to copy:** the broad phrase “eco-certified” without naming the actual scheme/source in expaify detail, or mixing hotel self-reported practices into credential evidence.

### Pattern conclusion for expaify

Both references use progressive disclosure: a small positive signal during scanning and deeper information after selection. Neither pattern justifies placing issuer, dates, limitations, and no-data prose on every result. The safe expaify adaptation is text-first, non-ordinal, and secondary to hotel identity, price, and Deal Score.

## 6. Placement and candidate comprehension treatment

### Result card: positive evidence only

Reserve one secondary line below property identity/location/date and before price. Do not use a leaf, green color, medal, score, or “eco-friendly” language.

- Issuer-linked candidate: **“Credential: Green Key · current through Dec 2026”**
- Provider-reported candidate: **“Credential reported: Green Key”**
- Multiple qualifying records: show one neutral count, **“2 sustainability credentials reported”**; detail names them. Do not select a “best” scheme.
- `expired`, `incomplete`, `conflicting`, `not_returned`, `not_checked`, `check_failed`: render no result line.

The whole card remains the detail trigger. The accessible name must include the credential cue only when visible. At 375px, the line may wrap to two lines but must not truncate the scheme name or displace the price/CTA below the initial viewport-sized card more than one text row relative to the no-credential fixture.

Why silence for no-data on results: repeating “no evidence” across most cards would add clutter and invite the exact false-negative inference identified by ACM. No result copy means “no positive cue available,” not “this hotel is worse.” Detail carries the explicit state for users who inspect it.

### Saved detail: one evidence region before provider handoff

Add **Sustainability credential evidence** inside **Hotel fit**, after the existing class/rating facts and before the provider handoff. The information order is:

1. record state in plain language;
2. scheme name and issuer as separate labeled values;
3. source class and source label;
4. property scope;
5. status and level exactly as supplied;
6. valid-from/valid-through, or explicit missing validity;
7. evidence checked/observed time;
8. evidence link only when safe and displayable;
9. fixed limitation: **“A credential reports participation in that scheme. It is not an environmental impact score or a comparison with other schemes.”**

For multiple records, use peer rows ordered alphabetically by scheme name. Never sort by level, presumed rigor, recency, or visual prominence.

### Exact candidate no-data/error copy for testing

- `not_returned`: **“No verifiable credential evidence was returned for this property.”** Supporting sentence: **“That does not mean the hotel has no credential or performs poorly.”**
- `not_checked`: **“Sustainability credential evidence has not been checked for this property.”**
- `incomplete`: **“We could not verify this credential record.”** Then name only the missing/conflicting fields safe to expose.
- `expired`: **“This credential record expired {Mon YYYY}.”**
- `conflicting`: **“Sources disagree about this credential's {status|property match|validity|level}.”**
- `check_failed`: **“We couldn't check sustainability credential evidence right now.”** Action: **“Try again.”**

These are prototype candidates, not validated winning copy. D5 defines the decision rule.

## 7. Specific, testable design directives

### D1 — Make every positive state evidence-gated

UXDES must define fixtures for all eight record states in § 3 and visibly mark positive fixtures as prototype data. A positive cue may render only after the normalized record passes property match, property scope, scheme/category classification, provenance, status/validity rule, freshness rule, and display-rights gate. Amenities, practices, chain programs, marketing descriptions, photos, class, reviews, and price never satisfy the gate.

**Test:** mutate one required field at a time (property match, scheme, scope, provenance, status/currentness, freshness, display permission). Each mutation suppresses the positive result cue and resolves to the expected detail state; no fixture falls back to generic “green” copy.

### D2 — Keep the result cue factual, textual, and subordinate

Use the result patterns in § 6 only for `current_issuer_linked` and the provider-reported prototype. Place the line after identity metadata and before price. Use existing text tokens, no green-specific token, icon, leaf, score, or badge shape. Never append credential state to Deal Score, price explanation, discount, default sort, or paywall state. Do not render negative/no-data cues on result cards.

**Test:** at 375px and 1280px, current issuer-linked, provider-reported, multiple, and every suppressed state preserve hotel name, price, Deal Score/discount information, photo, and CTA without overlap. Keyboard focus remains on the existing card link and screen-reader output states the exact visible scheme/source qualifier.

### D3 — Put complete provenance and limitations before handoff

Specify one **Sustainability credential evidence** region in saved detail's **Hotel fit** section before **Check rooms with provider**. Follow the order and copy rules in § 6. Use semantic headings and a `<dl>`/list structure; an evidence URL, when permitted, is a normally focused link with an accessible name containing the scheme. Loading uses a heading-preserving status skeleton; retry acts only on credential evidence and does not block provider handoff.

**Test:** default, loading, all eight record states, multiple records, long scheme/issuer names, missing optional fields, malformed dates, and safe/unsafe evidence URLs are usable at 375px and 1280px. No state communicates meaning by color alone or hides essential provenance behind hover.

### D4 — Preserve non-comparability across schemes and levels

Render scheme names and supplier-provided levels verbatim as peer facts. Do not translate levels into expaify tiers, stars, leaf counts, percentages, “stronger,” “better,” or a shared filter ordering. A future filter, if separately approved after provider validation, is binary **“Credential evidence available”** and includes only qualifying current states; it must include recovery copy explaining that excluded hotels may have unreturned or unchecked evidence.

**Test:** a Green Key record and an EarthCheck record with different source levels appear with equal hierarchy in alphabetical order; changing the level does not change result order, Deal Score, styling, or filter rank. `not_returned` and `not_checked` properties are never labeled “uncertified.”

### D5 — Do not choose result wording or ship the provider-reported cue without moderated validation

UXDES must produce the two result variants and full detail states needed by the protocol in § 8, using clearly fictional hotels and prototype evidence. Provider-reported evidence remains detail-only in production unless the study meets all comprehension gates. Instrumentation may be specified with bounded enums only; do not record free-text preferences, evidence URLs, scheme certificate IDs, or inferred traveler identity.

**Test:** the spec includes a traceability matrix mapping every study condition to a fixture and expected answer. If any launch gate in § 8 fails, the fallback spec is detail-only evidence with no result cue and no filter.

## 8. Moderated validation plan and decision thresholds

### Participants and setup

Recruit 12–15 hotel shoppers who say environmental practices sometimes affect their shortlist; include at least four who do not recognize the tested scheme names. This is formative comprehension research, not a statistically powered conversion study. Run half at a 375px mobile viewport and half at 1280px desktop; counterbalance property order and evidence order.

Use fictional but realistic properties with identical image quality and controlled variations in nightly price, Deal Score, location, and credential state. Never use actual hotels with fabricated credentials.

Conditions:

1. current issuer-linked credential;
2. current provider-reported credential;
3. incomplete/stale record;
4. conflicting record;
5. expired record;
6. no evidence returned;
7. evidence not checked;
8. same hotel pair with credential evidence removed, for within-participant selection comparison.

### Tasks

1. **Unaided scan:** “Which two hotels would you inspect, and why?” Record first inspected card and reasons without prompting about sustainability.
2. **Evidence interpretation:** after detail inspection, ask who supplied/reported the record, whether it is current, what property it covers, and what the credential does **not** prove.
3. **No-data interpretation:** ask what `not_returned` and `not_checked` say about the hotel's actual practices/certifications.
4. **Comparability:** present two unlike schemes/levels and ask whether one hotel can be called environmentally better from this information alone.
5. **Selection impact:** obtain a shortlist before and after evidence introduction; ask for the reason in the participant's own words. Code changes as credential-led, price-led, location-led, Deal-Score-led, or unclear. Do not infer causation from clicks.
6. **Source distinction:** compare issuer-linked and provider-reported result variants, then test a detail-only provider-reported fallback.

### Measures and launch gates

Report each item and the all-items result; do not collapse them into a single “trust score.” With 12–15 formative participants, use the thresholds as go/no-go heuristics and include raw counts.

| Measure | Passing gate |
| --- | --- |
| Issuer/source comprehension | At least 80% identify issuer-linked versus provider-reported correctly after detail inspection |
| Currentness comprehension | At least 80% correctly identify current, expired, and unknown-currentness records |
| Impact-limit comprehension | At least 80% state that a credential is not an impact score or proof one hotel is environmentally better |
| No-data comprehension | At least 80% interpret both absence states as unknown evidence, not “not sustainable” or “not certified” |
| Comparability accuracy | At least 80% refuse an unsupported ranking of unlike schemes/levels |
| Result-cue halo guardrail | No more than 20% select solely from the cue while misstating its source, scope, or limitation |
| Selection impact | Report count and direction only; a change qualifies as credential-led only when the stated reason accurately reflects the evidence |

**Decision rule:** ship a result cue only if all comprehension gates and the halo guardrail pass for that exact cue. If detail comprehension passes but a result cue fails, ship detail-only evidence. If `not_returned` wording fails, test the alternative **“Credential evidence wasn't provided for this property; this isn't a rating of the hotel.”** If provider-reported versus issuer-linked remains confused, suppress provider-reported evidence from results and label it only on detail.

### Future analytics, after evidence and event contracts exist

Use bounded values only:

- exposure: `surface=result|detail`, `state=current_issuer_linked|current_provider_reported|expired|incomplete|conflicting|not_returned|not_checked|check_failed`;
- interaction: detail open, evidence-link open, retry, back to results, provider handoff;
- context: coarse `viewport=mobile_375|desktop_1280|other` and a non-identifying experiment variant;
- selection sequence: same-session evidence state and subsequent detail/handoff, reported as association only.

Do not log scheme names, certificate identifiers, evidence URLs, property environmental profiles, or free-text reasons. An evidence open is inspection, not proof of trust or a lower-impact choice.

## 9. Answers to discovery handoff questions

1. **Provider ground truth:** no current adapter returns credential evidence. Official Booking Demand and Expedia Rapid are realistic provider-reported candidates after separate integration/terms work; neither reviewed public contract proves the full current issuer-linked record. Travalyst is a future registry/property-data candidate, not a universal verifier.
2. **Identity and conflict:** require shared/crosswalked property ID or a strict name-plus-full-address composite; reject name/chain/city-only matches. Expired stays expired, partial stays incomplete, and disagreement stays conflicting.
3. **Smallest result summary:** one text line naming the scheme and, only when supported, current-through date; no icon or score. It is a candidate requiring moderated validation at both viewports.
4. **Issuer versus provider placement:** distinguish them in detail unconditionally. Test both at result level; default production fallback is issuer-linked result cue and provider-reported detail-only until comprehension passes.
5. **No-data wording and placement:** use the candidate copy in § 6 on detail only. Do not repeat no-data on every result.
6. **Comparable patterns:** Booking.com and Google use compact positive result labels with deeper detail. Booking.com's removed ordinal leaf system demonstrates why expaify must avoid green levels and negative implications for unlabeled hotels.
7. **Selection impact:** not established. Use the controlled before/after task and code reasons; do not treat exposure, clicks, or evidence opens as beneficial selection.

## 10. UXDES handoff

UXDES should create an implementation-ready, evidence-gated prototype spec covering:

- result and saved-detail hierarchy at 375px and 1280px;
- all eight evidence states, plus loading and retry behavior;
- issuer-linked, provider-reported, and multiple-record presentation;
- exact final copy and semantic/accessibility behavior;
- property-match, freshness, malformed-field, unsafe-link, and long-name edge cases;
- the non-ordinal comparison and Deal Score separation rules;
- a fixture/traceability matrix for the moderated study;
- a visible launch dependency on provider payload/terms validation.

UXDES must not specify a production sustainability filter, green badge, leaf icon, scheme ranking, environmental impact claim, or Deal Score change. A future filter remains an approved-feature decision after the evidence and comprehension gates pass.

## Blockers and out-of-scope findings

1. **Provider evidence blocker:** no implemented provider supplies a qualifying credential; official candidate contracts do not yet establish the full field set or display rights.
2. **Research validation blocker:** no participant sessions or behavioral baseline were available, so the proposed copy, result prominence, source distinction, and selection impact are unvalidated.
3. **Data continuity dependency:** normalized types, provider methods, cached records, saved-deal persistence, API responses, and result/detail props would all require later DEV changes. Those changes are out of scope for UXR.
4. **Legal/compliance dependency:** Travalyst notes EU ECGT application from 27 September 2026 and places responsibility for compliant claims on schemes/accommodation providers. This brief is not legal advice; production language and labels need review before EU display.
5. **No adjacent repair performed:** provider selection, affiliate/booking-link gaps, ranking, Deal Score, money, and analytics persistence were not changed.

**Next stage:** `UXDES-HOTEL-SUSTAINABILITY-CREDENTIALS-01`.
