# UXD-HOTEL-CHECKIN-METHOD-01 — Check-In Method & Desk-Hours Confidence Discovery

**Date:** 2026-08-03 · **Stage:** UX Discovery · **Priority:** P1
**Feature slug:** `hotel-checkin-method`
**Downstream ticket:** `UXR-HOTEL-CHECKIN-METHOD-01`

---

## 1. Pain point

**A traveler cannot learn how they will actually get into the room — whether a person hands them a key, a keypad or app admits them, or a key must be collected somewhere other than the property — nor what they must do beforehand to make that work, so an arrival that requires a code nobody sent, a desk nobody is staffing, or a key office across town looks identical at booking time to one where someone is waiting at the door.**

The distinguishing property of this pain is that it is a **capability** question, not a timing question. "Can I be let in at 23:40?" is a schedule problem, and it is owned elsewhere (§4). "By what mechanism does the door open, and do I already possess what it needs?" is a different failure, and it fails just as hard at 14:00 as at midnight: a traveler standing at an unstaffed lobby with a booking confirmation and no code is locked out at any hour.

---

## 2. Who is affected, and at what step

| Segment | Why the method is the deciding fact |
|---|---|
| **Late arrivals** (last leg lands after ~21:00) | Highest stakes. If the method is staffed-desk-only and the desk is dark, the room is unreachable. Named by the ticket as the abandonment-measurement population. |
| **Travelers without working local connectivity or a smartphone** | An app-based smart lock or an emailed code is a hard dependency they may not be able to satisfy on arrival. This segment cannot be identified by arrival time at all. |
| **Bookers of apartment-style and small independent properties** | Off-site key collection and lockboxes concentrate here, and this is precisely the inventory where a hotel-shaped mental model ("there will be a desk") is wrong. |
| **Travelers whose plans changed after booking** | Needs to know whether a pre-arrival action (send flight number, confirm ETA, receive a code) is still outstanding. |
| **Everyone else** | Low-salience confirmation. Must not crowd out price, location, or Deal Score. |

**Where in the flow — the three pre-payment hotel surfaces, all of which carry zero method content today:**

| Surface | File | Current state re: check-in method |
|---|---|---|
| Hotel result card, expanded **Details** panel | `app/components/HotelCard.tsx:1073`–`1210` | Renders `QualityEvidencePanel`, `RoomRateDetailsPanel`, location, `HotelPetPolicyDetails`, smoking, `AccessEvidencePanel` (`:279` — elevator / step-free / room requests, i.e. *physical* access), `HotelFundsPolicyPanel`. **No entry method, no key handover, no desk staffing.** |
| Hotel detail page | `app/deals/[dealId]/page.tsx:417`–`483` | Deal Score, `HotelCancellationChoicesUnavailable` (`:423`), pool / disruption / sustainability ledgers, criteria handoff. **No method content.** |
| Booking review / handoff | `app/book/BookingFlow.tsx` | Carries admission policy (`deriveAdmissionPolicyPresentation`, `:20`), rate eligibility, funds policy, price composition. **No method content.** |

**Data layer:** `HotelOffer` in `lib/types.ts` has no entry-method, key-handover, or desk-staffing field. No provider adapter returns one. A repo-wide search for `reception`, `front desk`, `self-check`, `keyless`, `lockbox`, and `key pickup` returns **zero production hits** — the only matches are an unrelated standby-generator fixture string and `HotelTransport`'s shuttle-hours model. Coverage today is **0%, by absence of the field rather than by provider silence.**

---

## 3. Measurable signal that the problem exists

The ticket names three measures. Only the first is observable today; the other two require instrumentation that does not exist, and the research stage must not assume otherwise.

1. **Check-in-method evidence coverage** — share of rendered hotel offers carrying a confirmed entry-method fact. **Measurable now: it is exactly 0/N.** There is no field to populate, so this is a structural zero, not a provider-coverage finding. Post-implementation this becomes the primary coverage metric, and it must be reported **split by method family**, because a provider that reliably returns `staffed_desk` and never returns `self_check_in` produces a misleadingly healthy aggregate.
2. **Late-arrival abandonment** — booking-handoff drop-off for sessions whose stay begins on the day of a late arrival. **Not currently measurable.** expaify holds no traveler arrival time; there is no arrival-time input anywhere in the hotel flow. This cannot be measured without either a stated-arrival input (out of scope here, adjacent to `hotel-checkin-time-fit`) or a proxy. Research must either propose a defensible proxy or drop the metric — **it must not fabricate an arrival time from the check-in date.**
3. **Clarification interactions** — expansions of the method disclosure, and outbound clicks to provider/property detail from it. Measurable once built, using the established `track()` pattern in `app/components/hotelAdmissionPolicyAnalytics.ts` (per-surface, per-source, with a `mobile_375 | desktop_1280 | other` viewport group).

**The supporting qualitative signal is the strongest evidence available today:** the surfaces render five separate policy panels covering pets, smoking, funds, admission, and physical access. A traveler who reads five policy disclosures and finds nothing about entry method reasonably concludes there is nothing unusual to know. **Silence here is read as reassurance**, which is why absence is worse than a stated `unknown`.

---

## 4. Scope boundary — read before proceeding

This is the single most important section of this discovery. **Four adjacent features already exist in this pipeline, and one of them has already specified most of what this ticket's title names.** Downstream stages must not re-open any of them.

| Slug | Owns | Furthest stage |
|---|---|---|
| `hotel-checkin-logistics` | The evidence model for **standard times, front-desk availability (`HotelDeskAccessFact` / `HotelDeskAccessMode`, incl. `staffed_24h` and `self_check_in`), late-arrival obligation, checkout deadline**, and `resolveLateArrivalAnswer` | `02-research.md` — **not implemented** |
| `hotel-checkin-time-fit` | Fit interpretation: does a stated arrival/departure fit the published standard times | `03-design.md`, gated to `app/components/research/HotelCheckinTimeFitPrototype.tsx` — **not in production** |
| `hotel-checkin-checkout-flexibility` | The exception layer: does a paid/free/request-only early check-in or late checkout exist | `01-discovery.md` |
| `hotel-noshow-policy` | Same-day arrival guarantee and **no-show forfeiture** | `01-discovery.md` |
| **this ticket** | The **entry mechanism**: what opens the door, who or what hands it over, where, and what the traveler must already possess or have done | discovery (here) |

### 4.1 The overlap, stated plainly

This ticket's brief names four facts: *staffed reception, self-check-in, key pickup, front-desk hours*. **Three of the four are already specified by `hotel-checkin-logistics/02-research.md`.** Its directive D2 defines a `Front desk` row with the exact copy `"Front desk open 24 hours."` / `"Front desk staffed 07:00–23:00."` / `"Self check-in."`, and its `HotelDeskAccessMode` union already carries `staffed_24h` and `self_check_in`.

**Resolution — this is the discovery finding, not a blocker.** The residual, genuinely unowned problem is the one fact none of the four adjacent features model: **the entry credential and its handover.** `hotel-checkin-logistics` treats "self check-in" as an adjective describing desk staffing — a single display string in a hours row. It never asks *what the self-check-in consists of*, *whether the traveler will have received it before they arrive*, or *whether the key is even at the property*. A traveler told "Self check-in" has been told the desk is unstaffed; they have not been told how to get in, which is the thing they actually need.

So this feature owns three questions, none of which any adjacent feature answers:

- **Credential** — what admits the traveler: a physical key or card issued in person, a keypad code, a smart-lock app, or a lockbox.
- **Handover point** — where the credential is obtained: at the property, or at a stated off-site address. Off-site key collection is a distinct and severe failure mode with no representation anywhere in expaify today.
- **Precondition** — what the traveler must possess or have done first: a code delivered in advance, an app installed, ID presented, or advance contact made.

### 4.2 Dependency and sequencing — a real finding for the monitor

Desk *hours* and desk *staffing mode* remain owned by `hotel-checkin-logistics`. **This feature must consume `HotelDeskAccessFact`, never redefine it.** Two consequences follow, and research must carry both:

1. **Neither feature has shipped, so whichever ships first must land the shared `HotelDeskAccessFact` type.** If both ship independently, expaify will carry two incompatible desk-staffing models and two contradictory front-desk strings on the same card. This is the concrete regression risk of this ticket.
2. **If only one of the two can ship, `hotel-checkin-logistics` should ship first.** Method without staffing context is under-determined: "Key collected at the front desk" is reassuring or useless depending entirely on whether the desk is open when the traveler arrives.

Method data must also stay **separate from no-show forfeiture** (`hotel-noshow-policy`), per the ticket's explicit constraint. The two share the late-arrival population but answer opposite questions: method asks *can I get in*, forfeiture asks *do I still have a room and was I charged*. Colocating them in one panel would imply that a documented entry method protects the reservation. It does not.

---

## 5. Constraints the solution must respect

1. **No fabrication, no defaults, no inference.** An entry method may be stated only when a provider or property document states it. It must never be derived from star class, property type, price, chain brand, or the presence of any other field. Apartment-style inventory must not be defaulted to self-check-in, and hotel-class inventory must not be defaulted to a staffed desk — those are exactly the two guesses that would be wrong most expensively. Absent evidence renders as an explicit "not documented", never as an empty row and never as silence.
2. **No promise of late check-in availability** (ticket constraint, and it survives contact with this feature). Stating a method is not stating that admission is available at any given hour. Copy must never combine a method fact with a time claim — no "self check-in, so you can arrive any time." A confirmed keypad code says nothing about whether the code works at 02:00, and the disclosure must not let a traveler infer that it does.
3. **Data integrity — one desk model, not two.** Front-desk hours and staffing mode are consumed from `hotel-checkin-logistics`'s `HotelDeskAccessFact`. No parallel desk-hours field, no duplicate front-desk string, no re-derivation. Per the non-negotiable contract, any method data reaching the app arrives through `lib/providers` returning `Result<T>`, and never throws to callers.
4. **Compact, and subordinate to price.** These surfaces already carry five policy panels. The disclosure must be a small number of rows at scan level with detail behind the existing Details expansion — not a sixth full-height panel. It must not displace price, location, or Deal Score, and it must hold at 375px without overlap and without horizontal scroll.
5. **Accessible.** Any expansion is a real button with correct `aria-expanded` and a visible focus ring, matching `HotelFundsPolicyPanel` / `HotelAdmissionPolicy`. Method state is never conveyed by colour or icon alone.

---

## 6. Success statement

**This is solved when a first-time user evaluating a hotel can tell, before paying, what will open the door, where they collect it, and what they must already have or do — and can distinguish a documented method from an undocumented one — without inferring it from property type, and without being led to believe that a documented method guarantees admission at their arrival hour.**

Secondary: check-in-method evidence coverage becomes reportable and non-zero, split by method family; clarification interactions are instrumented on all three surfaces; and no second front-desk model enters the codebase.

---

## 7. Open questions for research

1. **Provider reality check.** Which of the configured hotel adapters actually return an entry-method or key-handover field? `hotellook.ts` is a dead API returning empty. If **no** live provider supplies this, the honest outcome is an evidence model whose only production state is `not_documented` — that is still worth shipping (it converts misleading silence into a stated unknown) but it changes the design brief substantially, and research must determine this from the adapters rather than assume it.
2. **Reference patterns.** How do Booking.com and one apartment-inventory reference express entry method as an interaction pattern — where it sits in the hierarchy, and how it is worded when unknown.
3. **Off-site key collection.** Does it warrant escalated prominence over other method families, given that it is the only one imposing a physical detour?
4. **Late-arrival abandonment metric.** Propose a defensible proxy or recommend dropping it (§3.2). Do not invent an arrival time.

---

## 8. Handoff

`UXR-HOTEL-CHECKIN-METHOD-01` created. Research must read this document **and** `docs/pipeline/hotel-checkin-logistics/02-research.md` before starting, and must carry forward the §4 boundary, the §4.2 sequencing dependency, and the five §5 constraints unchanged.
