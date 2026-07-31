# UXR-HOTEL-WIFI-RELIABILITY-01: Hotel Wi-Fi Reliability Research Brief

Date: 2026-07-31  
Stage: UX Research (UXR)  
Priority: P0  
Upstream: `docs/pipeline/hotel-wifi-reliability/01-discovery.md`  
Decision surface: live deal card → deal detail → expaify review (`/book`) → provider handoff

## Executive decision

**STOP production UI for Wi-Fi reliability; NARROW the next stage to an evidence-validation prototype and provider-contract specification.** The current integrated hotel source has zero representable Wi-Fi availability, charge, room-coverage, measured-reliability, or Wi-Fi-review evidence. A plausible richer content provider can distinguish property/room/rate amenity scope and free-versus-surcharge status, but the audited reference contracts still do not establish speed, uptime, latency, measurement method, or Wi-Fi-specific review strength. A visible positive reliability treatment would therefore be unsupported; a results-card fallback on every hotel would add scan cost without helping users distinguish options.

UXDES should design and comprehension-test one details-first evidence ledger using fixtures, not authorize a shipped badge, filter, sort, ranking change, “work-ready” verdict, or Deal Score input. Production work may proceed only after a representative provider sample passes the go thresholds in this brief.

## Method and limitations

This brief used:

1. Static audit of the discovery-named types, active deal card/detail path, the unmounted `HotelCard`, booking context, Hotellook live/cache normalization, tests, and analytics allowlist.
2. Contract-level review of official Google Hotels, Booking.com Connectivity, and Expedia Rapid documentation. These are interaction and data-capability references, not claims that expaify is licensed or configured to use those providers.
3. Reconciliation with `hotel-amenity-provenance`, `hotel-rate-inclusions`, `hotel-workspace-fit`, `hotel-review-relevance`, and `hotel-power-outage-resilience` research.

No traveler interviews, usability sessions, production Wi-Fi payload sample, provider credentials, licensed review-topic feed, or network measurements were available. Consequently, the comprehension and reversal thresholds below are a validation plan, not observed user-research results. The provider coverage table is a **contract-capability audit**, not a prevalence estimate across real hotels.

## Current-code evidence

### 1. The shared primitives are close, but Wi-Fi reliability is not representable

`HotelAmenityEvidence` already separates `status`, `scope`, `sourceLabel`, optional `fee`, freshness, confidence, and certainty (`lib/types.ts:120-148`). That can represent a conservative availability/charge/coverage fact. It cannot represent:

- a conflict between two retained sources;
- measured download/upload speed, latency, uptime, method, location, window, or sample size;
- a Wi-Fi-specific review signal with qualifying review count, recency window, or consistency;
- a provider capability declaration saying which Wi-Fi dimensions the source can answer.

`HotelRatingEvidence` carries only an aggregate score, review count, fetch time, source, and confidence (`lib/types.ts:97-118`). It has no Wi-Fi topic or review-window field. General guest rating must not be used as connectivity evidence.

### 2. The active normalizer discards Wi-Fi and erases its distinctions

The allowlist in `lib/providers/hotelAmenityEvidence.ts:18-26` contains elevator, parking, step-free route, and four room-request facts. An unknown id is discarded at `:113-117`; therefore `wifi`, `free_wifi`, or `internet` never survives. Fee is retained only for `on_site_parking` at `:143-147`. The normalizer emits synthetic `not_returned` rows only for its seven allowlisted facts (`:151-175`), so the absence of a Wi-Fi row does not even become an explicit Wi-Fi missing state.

The normalizer also chooses one item by status precedence (`unavailable` before `unknown`, `not_returned`, and `confirmed`) at `:29-34` and `:163-170`. That protects against false positive duplication, but it does not retain both sources or explain a conflict. A provider saying “free Wi-Fi in public areas” and a rate source saying “Wi-Fi surcharge” would collapse rather than remain auditable.

### 3. Hotellook supplies no decision-grade Wi-Fi field on either path

The live entry type exposes identity, class, location, price, property type, and an untyped `amenityEvidence` passthrough (`lib/providers/hotellook.ts:23-42`). The live path sends that passthrough through the restrictive normalizer (`:494-535`); the cached path does the same (`:370-406`). The implemented endpoint contract contains no native Wi-Fi field, fee, room/rate binding, measurement, or review topic.

When no amenity payload exists, Hotellook produces the seven non-Wi-Fi `not_returned` rows and `ready`, not a Wi-Fi state. Cached payloads cannot smuggle a Wi-Fi id through because the same allowlist runs again. The six-hour cache (`CACHE_TTL = 21600`) is adequate for ordinary content experimentation but must not be presented as a live performance measurement without a measurement-specific timestamp and validity rule.

### 4. The user-facing surface is split, and neither active path carries Wi-Fi

The shipped landing/feed card is `app/components/ui/DealCard.tsx`. Its local deal shape (`:17-34`) contains hotel identity, price history, dates, links, and photo only. Its rendered hierarchy is identity/date → price/discount/freshness → photo → action → price-check basis (`:60-132`). It cannot receive or show Wi-Fi evidence.

The saved deal detail in `app/deals/[dealId]/page.tsx` is the active comparison/detail surface. It reads persisted deal rows rather than `HotelOffer`; no Wi-Fi evidence is persisted in that deal contract. The richer `app/components/HotelCard.tsx` has no non-test render site. Even there, its local fact allowlist excludes Wi-Fi (`HotelCard.tsx:63-74`), its evidence reducer skips unknown ids (`:124-142`), the collapsed summary recognizes only a confirmed property elevator (`:788-802`), and the expanded panel is physical-access evidence, not connectivity evidence (`:1030-1040`).

This means “add Wi-Fi to `HotelCard`” would ship to no current user and would still miss the live deal/detail path. UXDES must name the active target explicitly and treat remounting/replatforming `HotelCard` as out of scope.

### 5. Booking review continuity drops amenity evidence

`BookingHotelContext` is an explicit field list with no amenity or connectivity evidence (`lib/booking/config.ts:60-87`). Validation and construction enumerate supported fields (`:792-855`, `:1061-1092`); `buildBookingHotelContext` does not copy `HotelOffer.amenityEvidence`. The `/book` hotel summary shows identity, price/Deal Score, class, rating, and admission information, but no connectivity evidence (`app/book/BookingFlow.tsx:325-401`).

A traveler could therefore see future property evidence, select the hotel, and lose the evidence and its limitations before provider handoff. That is exactly the late-clarity reversal risk in discovery.

### 6. Feature-specific measurement does not exist

The analytics sink supports general hotel detail, section, handoff, return, and resilience events, but no Wi-Fi evidence impression, disclosure open, source open, confirmation action, comprehension result, or hotel-choice reversal. There is also no stored “previous selected hotel” to distinguish a considered choice from a reversal. Existing general handoff events can be extended later, but they cannot produce a current Wi-Fi baseline.

## Provider coverage audit

### Capability sample

| Source/contract inspected | Availability | Charge/inclusion | Coverage | Measured reliability | Wi-Fi-specific review strength | Result for this ticket |
|---|---|---|---|---|---|---|
| Current Hotellook implementation | **0% representable**; Wi-Fi ids are discarded | **0%** | **0%** | **0%** | **0%** | Cannot distinguish hotels on any required dimension. |
| Expedia Rapid Content reference contract (plausible, not integrated) | Supports `wifi` / `free_wifi` amenity categories | Amenities are complimentary unless surcharge/restriction is specified; rate-plan scope can bind inclusion | Explicit property, room, and rate-plan amenity levels | Not documented in the audited content reference | Not documented in the audited content reference | Could support presence/charge/scope after licensing, mapping, and live sampling; cannot support “reliable.” |
| Booking.com Facilities contract (reference, not integrated) | Structured property- and room-facility ids | Contract can carry facility-specific details, but this audit did not establish a normalized selected-rate Wi-Fi charge field | Explicit property-level and room-level facility identifiers | Not documented in the audited facilities references | Not documented in the audited facilities references | Useful scope precedent, not reliability evidence. |
| Google Hotels user-facing pattern (reference, not an expaify feed) | Shows Wi-Fi as an amenity from multiple sources | May expose amenity detail, but public help does not promise selected-rate inclusion | Separates hotel amenities from room information conceptually | No measurement method is disclosed in the reviewed pattern | Topic summaries may be third-party supplied; public help does not establish a Wi-Fi-specific sample/consistency contract | Validates separate amenity and review provenance; not a source expaify can transform into a claim. |

Official references:

- [Expedia Rapid content reference lists](https://developers.expediagroup.com/rapid/lodging/content/content-reference-lists) specify amenities at property, room, and rate-plan levels; they are complimentary unless a surcharge or restriction is stated and include `wifi` and `free_wifi` categories.
- [Booking.com Facilities metadata](https://developers.booking.com/connectivity/docs/content-api-modules/facilities-api/facilities-meta-endpoint) distinguishes property and room facility identifiers; [room facilities](https://developers.booking.com/connectivity/docs/content-api-modules/facilities-api/manage-room-facilities) are managed against a specific room.
- [Google Travel Help](https://support.google.com/travel/answer/6276008?hl=en) describes amenity-based comparison, hotel amenities gathered from multiple sources, separate room information, and third-party topic summaries. [Google lodging review onboarding](https://support.google.com/hotelprices/answer/14274025?hl=en) further shows that third-party review data arrives through a configured structured feed.

### Interpretation

Availability, charge, coverage, and reliability are four independent coverage denominators. A source that can answer three must not be reported as “75% reliable coverage,” and a property with Wi-Fi present but reliability unknown is not a fully evidenced property.

The current sample yields a production **STOP** because it cannot distinguish a single hotel. The plausible contracts justify **NARROW** research: an additive provider integration could make availability/charge/coverage useful while still presenting reliability as not established. They do not justify a reliability badge.

Before production design, Data/Partnerships must sample at least 200 bookable offers across at least 10 markets, including mobile/desktop-equivalent payloads and cached replays. Report, separately:

1. Wi-Fi availability returned and canonicalizable.
2. Charge known and bound to property versus selected rate.
3. Guest-room coverage known and bound to room/rate where applicable.
4. Qualifying measured evidence, including method, time window, sample size/frequency, location/scope, and observation date.
5. Qualifying Wi-Fi review signal, including source, Wi-Fi-specific review count, recency window, and consistency/conflict.
6. Conflict, stale, malformed, and source-missing rates.

Do not count generic “Wi-Fi,” `free_wifi` at property scope, stars, overall guest score, marketing prose, or ordinary traveler review snippets as measured reliability.

## Reference-pattern guidance and exact delta

### Expedia Rapid: scope and cost travel with the amenity

The transferable interaction principle is atomicity: amenity, cost condition, and scope stay attached. Property, room, and rate-plan evidence are not interchangeable. This directly supports expaify’s need to distinguish “property offers Wi-Fi” from “this room/rate includes it.”

Delta: expaify has the generic `scope` and `fee` words but its Wi-Fi fact is discarded, fee handling is parking-only, and no selected rate/room identity exists in the current deal path. Expedia’s content contract also does not establish performance reliability.

### Google Hotels: amenity facts and review summaries are separate evidence families

Google uses amenities to compare/narrow hotels, while review summaries are separately sourced and may be supplied by a third party. The transferable principle is to keep a structured facility claim distinct from what guests report. A general rating is not silently converted into an amenity-quality claim.

Delta: expaify has neither a retained Wi-Fi facility fact nor a Wi-Fi topic signal. Any future guest signal must say “Guests report…” and name source/count/window/consistency; it must not sit under a measured label or read as expaify verification.

### What does not transfer

Both reference ecosystems assume denser data and often omit an explicit unknown state in the primary scan. expaify’s sparse-provider reality requires first-class `not_returned`, `error`, `stale`, and `conflict` states. It also requires tighter claim language because Deal Score already creates an authoritative-looking evaluation context; Wi-Fi evidence must never be folded into that price score.

## Minimum evidence model to validate

The prototype should test a dedicated connectivity presentation derived from two source-bound families, not overload physical access evidence and not duplicate rate-inclusion ownership:

1. **Wi-Fi access fact** — availability (`confirmed`, `unavailable`, `not_returned`, `unknown/conflict`), scope (`property`, `room`, `rate`, `selected_stay`), charge (`included`, `paid`, `unknown`), source, observed/fetched date. Rate inclusion continues to be owned by `hotel-rate-inclusions`; this surface reads that answer and does not compute a second one.
2. **Reliability evidence** — exactly one of:
   - `measured`: method, observed window, sample size/frequency, location/scope, source, metrics and units, observed date;
   - `review_signal`: Wi-Fi-specific source, qualifying review count, recency window, consistency (`consistent`, `mixed`, `conflicting`), optional attributed summary;
   - `not_established`: no qualifying evidence, too thin/old, or unresolved conflict.

Measured evidence and review signal may coexist, but the UI must not collapse them into a score or select the more flattering one. Contradiction becomes a visible conflict. Download speed alone never earns “reliable,” “video-call ready,” or a suitability verdict.

## Comprehension and reversal validation

### Prototype conditions

Test the current active detail hierarchy first at 375px and 1280px, including keyboard and screen-reader review. Use otherwise comparable hotel pairs and randomize these conditions:

1. Property Wi-Fi confirmed; charge, room coverage, and reliability not established.
2. Wi-Fi included in selected rate and guest-room coverage confirmed; reliability not established.
3. Measured evidence with explicit scope/window/sample and no review signal.
4. Wi-Fi-specific review signal with count/window and mixed consistency; no measurement.
5. Measurement and reviews conflict.
6. Provider did not return Wi-Fi data.
7. Provider error or stale evidence.
8. Explicit Wi-Fi unavailable for the selected stay.

After an initial hotel choice using a compact summary, reveal the full evidence before handoff and record whether the choice changes. A reversal is healthy when it follows newly understood evidence and happens before provider exit; it is harmful when the compact state caused an unsupported assumption that the detail state merely corrects.

### Critical tasks

- **Available versus included:** “The property lists Wi-Fi; is it included in this price?” Correct: only when rate-scoped inclusion says so.
- **Property versus room:** “Does this prove Wi-Fi reaches your guest room?” Correct: only with room or selected-stay coverage.
- **Measured versus reported:** “Was this performance measured, or reported by guests?” Correct classification and source required.
- **Not established versus unreliable:** “Does ‘reliability not established’ mean the Wi-Fi is bad?” Correct: no; evidence is insufficient.
- **Conflict:** “Can you rely on either positive claim as a guarantee?” Correct: no; sources disagree and scope/time remain bounded.
- **Reversal:** Explain any choice change after expansion. Count as evidence-grounded only if the participant names charge, coverage, evidence strength, recency, or conflict—not badge color or hotel stars.

### Go / narrow / stop thresholds

Advance a production design only when all **GO** thresholds pass:

- **Coverage:** availability is answerable for at least 70% of sampled offers; charge and room coverage each for at least 50%; qualifying measured or Wi-Fi-review reliability evidence for at least 40%; stale/conflict/malformed combined no more than 20%. These are research gates, not assumed provider performance.
- **Comprehension:** at least 85% correctly distinguish available/included, property/room, measured/reported, and not-established/unreliable; no more than 5% interpret any state as a future-performance guarantee.
- **Compact-to-detail integrity:** at least 90% of participants give the same evidence-strength classification before and after expansion. Harmful late-clarity reversal is no more than 5%.
- **Decision value:** among participants passing comprehension, median confidence rises at least one point on a five-point scale or choices change for an evidence-grounded reason, without a material increase in median decision time.
- **Accessibility:** all states and source/scope limitations are understandable without color, and keyboard/screen-reader participants can reach them before the provider action.

Decision logic:

- **GO:** all thresholds pass; specify details plus a compact summary only for evidence-backed states.
- **NARROW:** availability/charge/room coverage pass but reliability coverage does not; ship only scoped access/inclusion facts under the existing amenity/rate systems and keep `Reliability not established` details-only. No reliability chip/filter.
- **STOP:** current source cannot distinguish properties, guarantee misread exceeds 5%, missing is routinely read as absence, measured/review evidence cannot be separated, or compact disclosure causes more than 5% harmful reversals.

**Current decision: STOP production and NARROW UXDES to prototype/specification.** Shipped coverage is 0% on every required dimension and no comprehension evidence exists.

## Design directives for UXDES

1. **Design a details-first validation prototype, not a production feature.** Place a single `Wi-Fi evidence` ledger on the active saved-deal detail path, after rate inclusions/review evidence and before provider handoff. Do not add a live card badge, filter, sort, ranking change, Deal Score input, “reliable,” “fast,” “good for calls,” or “work-ready” verdict. Prototype compact card treatment only after the detail state passes the comprehension thresholds. Test: the fixture with generic property Wi-Fi produces no positive reliability label anywhere.

2. **Answer four questions independently and preserve ownership.** The ledger order is `Access` → `Cost for this rate` → `Coverage` → `Reliability evidence`. Reuse amenity provenance for access, consume (do not duplicate) `hotel-rate-inclusions` for selected-rate cost, and keep outage continuity in `hotel-power-outage-resilience`. Final missing copy: `Wi-Fi details were not returned by this hotel source.` Final partial reliability copy: `Wi-Fi is listed, but reliability evidence is not available.` Test: property access can be confirmed while cost, room coverage, and reliability each remain explicitly unknown.

3. **Keep measured evidence, guest reports, and conflicts visibly separate.** Measured copy pattern: `Measured performance` followed by metric, method, location/scope, observation window, sample size/frequency, source, and date. Review copy pattern: `Guest-reported Wi-Fi` followed by `Guests report…`, Wi-Fi-specific count, recency window, consistency, and source. Conflict copy: `Wi-Fi evidence conflicts — confirm with the hotel.` Never infer either family from stars, overall rating, photos, brand, price, property type, or Deal Score. Test: users classify measured versus reported at ≥85%, and no summary appears without source/count/window.

4. **Specify every non-positive state without turning missing into failure.** Required text states: `Checking Wi-Fi evidence…` (loading), `Wi-Fi details were not returned by this hotel source.` (not returned), `Wi-Fi details could not be checked.` (error), `Wi-Fi information is out of date.` (stale), `Wi-Fi evidence conflicts — confirm with the hotel.` (conflict), `This source reports Wi-Fi is unavailable for the selected stay.` (confirmed unavailable), and `Wi-Fi is listed, but reliability evidence is not available.` (partial). State text, scope, and source must not rely on color. Test: participants distinguish not-returned/error/stale/conflict from confirmed unavailability at ≥85%.

5. **Preserve evidence through review and measure late reversals before handoff.** The prototype contract must carry the exact source-bound Wi-Fi state into `BookingHotelContext`; `/book` repeats the four answers and limitations before the provider action. Instrument exposure, disclosure open, source open, confirm-with-hotel action, provider exit, initial selection, and pre-handoff reversal with evidence state/scope/viewport—never free-text traveler needs. Test: results/detail and `/book` render the same state after serialization; analytics failure never blocks handoff; harmful late-clarity reversal stays at or below 5% before production approval.

## Acceptance criteria for UXDES

- The deliverable is explicitly labeled research prototype/provider-contingent, not approved production UI.
- It covers default, loading, partial, measured, review-signal, conflict, not-returned, unavailable, stale, error, mobile 375px, desktop 1280px, keyboard/focus, and screen-reader states with final copy.
- It names the active saved-deal detail and `/book` continuity path; an edit only to unmounted `HotelCard` does not satisfy the spec.
- Access, selected-rate cost, room coverage, and reliability are never collapsed into one badge.
- Measured and guest-reported evidence remain separate and source-bound; general rating and Deal Score are excluded.
- Card prominence is conditional on provider coverage plus detail comprehension; today’s fallback does not appear on every collapsed card.
- The go/narrow/stop thresholds above are copied into the validation plan and every fixture maps to a test case.

## Blockers and out-of-scope findings

### Blockers

- No representative live provider payload sample, credentials, licensed Wi-Fi review feed, or measurement source was available. Contract documentation cannot establish real-property coverage.
- Current Hotellook normalization discards Wi-Fi, and the live deal persistence/card contract has no evidence field.
- `BookingHotelContext` drops amenity evidence, so continuity requires coordinated data/validation work after an approved provider contract.
- No feature-specific analytics or baseline exists; comprehension and reversal rates require prototype testing or later instrumentation.

### Out of scope

- Provider procurement/integration, live speed tests, traveler speed-test collection, review-text licensing or summarization, filtering/ranking, saved preferences, and Deal Score changes.
- “Work fit” rollups belong to `hotel-workspace-fit`; Wi-Fi presence/fee remains coordinated with amenity provenance and rate inclusions; outage continuity remains in `hotel-power-outage-resilience`.
- The analytics validator contains pre-existing enum mismatches between some `HotelDecisionAnalytics` client values and server allowlists. This is not caused by Wi-Fi work and should be handled separately rather than repaired in this research ticket.

## Handoff

Create `UXDES-HOTEL-WIFI-RELIABILITY-01` for an implementation-ready **validation prototype and provider-contingent contract**, using the directives and stop/narrow/go gates above. It must not authorize production prominence until representative provider coverage and comprehension thresholds pass.
