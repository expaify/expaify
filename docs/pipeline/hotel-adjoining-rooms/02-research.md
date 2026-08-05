# UXR-HOTEL-ADJOINING-ROOMS-01: Connecting-Room Request Confidence — Research

Date: 2026-08-05
Stage: UX Research (UXR)
Persona: Senior UX Researcher
Ticket: UXR-HOTEL-ADJOINING-ROOMS-01 (P1)
Upstream: `docs/pipeline/hotel-adjoining-rooms/01-discovery.md`

Files read for this brief (verified, not assumed):
`lib/hotels/searchCriteria.ts`, `app/components/HotelSearchCriteria.tsx`,
`lib/types.ts`, `lib/providers/hotellook.ts`, `app/book/BookingFlow.tsx`,
`app/components/HotelRoomViewConfidence.tsx`,
`app/components/__tests__/HotelRoomViewConfidence.test.tsx`,
`app/components/HotelDecisionAnalytics.tsx`, `app/api/analytics/route.ts`,
`app/deals/[dealId]/page.tsx`,
`docs/pipeline/hotel-guest-count-clarity/01-discovery.md` +
`02-research.md`, `docs/pipeline/hotel-detail-decision-order/01-discovery.md`
+ `02-research.md` + `03-design.md`, `docs/pipeline/hotel-room-view-confidence/`
(all three docs), `docs/pipeline/hotel-special-requests/01-discovery.md`,
`docs/pipeline/hotel-bed-configuration/01-discovery.md`.

---

## 1. Discovery Claims: Verification Status

Every structural claim in the discovery doc reproduces against current code.

| Discovery claim | Status | Verified at |
|---|---|---|
| `occupancy.applied` has no producer anywhere in mounted code | **Confirmed** | `searchCriteria.ts:11-13` declares it; both constructors (`hotelCriteriaFromDraft:120`, `resolveHotelSearchCriteria:182`) hardcode `{ state: 'not_captured' }`. Grep for `state: 'applied'` across `app/` and `lib/` returns zero matches outside the type declaration and its own comments. |
| Editor renders a static, non-interactive "Not captured" block | **Confirmed** | `HotelSearchCriteria.tsx:229-233` — three `<p>` elements, no input, no control |
| `HotelOffer` has no room, rate, or connection field | **Confirmed** | `lib/types.ts:751-778` — property identity, stars, price, ratings, and evidence objects only; no `roomId`, `rateId`, `roomCount`, or adjacency field |
| `hotellook.ts` is property-scoped and cannot answer this | **Confirmed** | `HotelLookCacheEntry` (`hotellook.ts:22-38`) carries `hotelId`/`hotelName`/`stars`/`location`/`priceFrom` only — no room or rate identity of any kind |
| Special requests block is the only adjacency-adjacent surface, and is scoped to one room, fires post-selection, has no guaranteed branch | **Confirmed** | `BookingFlow.tsx:1281-1310`; four-item preference prompt at `:1289-1291`; "not a change to your booked room or rate" at `:1298`; Selected/Sent/Acknowledged/Guaranteed vocabulary at `:1305-1308` |
| Analytics allow-list has no room-count or adjacency dimension | **Confirmed** | `app/api/analytics/route.ts:12-61` — `hotel_request_guidance_viewed` (`:52`) carries `capabilityState`/`eligibleRequestCount`, no adjacency field; no event in the allow-list carries a room-count dimension |
| `HotelRoomViewConfidence` is the applicable house pattern | **Confirmed, with a caveat** | The component (`app/components/HotelRoomViewConfidence.tsx`) is well-formed, but its only mount site, `BookingFlow.tsx:1190`, calls it with **zero props** — `presentation` defaults to `{ state: 'not_confirmed' }` unconditionally (`:79`). No caller ever supplies real evidence. The pattern is sound; its only live instance is inert. This is a warning for D1/D2 below: adding a new evidence type is not sufficient — it must actually be threaded from `HotelOffer`/`BookingHotelContext` into the component, not left to default. |

---

## 2. Critical Cross-Ticket Finding (changes the §6 resolution)

The discovery doc's §6 asks UXR to choose between treating party-setup capture
of `rooms` as an in-scope prerequisite for this ticket, or explicitly
downgrading the abandonment metric. A finding from an adjacent, already-run
UXR stage resolves this decisively.

**`docs/pipeline/hotel-guest-count-clarity/02-research.md`** (dated
2026-07-29, five days before this discovery doc) is the UXR brief for the
ticket discovery explicitly names as the owner of party-sizing
(`01-discovery.md:33`, `:242`). Its own audit of `lib/pipeline/snapshot.ts`
establishes that every live price in this product is acquired at a
**hardcoded 2-adult, 1-room occupancy** (`snapshot.ts:80,112,114,153`), across
all three acquisition paths, and that the only hotel adapter mounted at
request time (`hotellook.ts`) returns no room or rate data at all. Its
resolution, Directive D1 (`02-research.md:169-202`), is explicit:

> **"No rooms input."** ... offering the field implies a capability that does
> not exist. `rooms` stays in the type, pinned to `1`.

This is not a stylistic choice by that ticket — it is the same structural
fact this ticket's own discovery documents independently at §2.2–2.3 (no live
provider, no room/rate identity anywhere in `HotelOffer`). Two independent
audits of two different tickets, five days apart, converge on the same
architectural ceiling: **this codebase has no path today for a user-declared
room count to affect what is fetched, priced, or shown.**

**Consequence for this ticket:** building a "how many rooms do you need, and
do they need to connect" input in party setup — the discovery's §5 "minimum
successful treatment" first bullet — is not merely undone work, it is work
this codebase's own architecture rejects for the same reason
`hotel-guest-count-clarity` rejected a rooms stepper. Adding it here would
directly contradict a decision already made for the same field
(`occupancy.applied.rooms`) by the ticket that owns it.

**Resolution: discovery's option (b).** The abandonment metric is downgraded
to a post-dependency, currently-unreachable measure (full detail in §5 below).
Party-setup capture of a connection *need* is explicitly **out of scope** for
this ticket, not deferred silently — it is blocked on `hotel-guest-count-clarity`
shipping `rooms` capture first, and that ticket's own research has queried
whether `rooms` should ever be user-settable at all, independent of
adjoining-rooms.

This also reframes the problem productively: if expaify cannot ask "how many
rooms do you need," the connection-confidence treatment must not be gated
behind that question. It must be a **property-level fact**, surfaced
unconditionally per offer — exactly like every other `Hotel*Evidence` type in
this codebase (funds policy, admission policy, rate eligibility all render for
every viewer, not only for viewers who indicated they care). This is
consistent with, not a workaround of, the discovery's constraint 5 ("no
dead-end") and its house-pattern reference (`HotelRoomViewConfidence`, which
also renders unconditionally per offer with no user opt-in).

---

## 3. Reference Patterns (interaction level, not visual style)

### 3.1 Booking.com — the guarantee is sold as a room type, not requested as an add-on

Where a property genuinely sells connecting rooms as bookable inventory,
Booking.com surfaces this **inside the room-selection list itself**, as a
named, separately priced row (commonly labelled with "connecting" or
"interconnected" in the room-type name), selected the same way any other room
type is selected — an act of purchase, not a checkbox. When a property does
not sell it as a room type, Booking.com does not offer a synthetic "request
connecting rooms" control; the attribute is silent. There is no visible
"request, unconfirmed" tier in the main booking flow for this specific
attribute — the guarantee-or-silence split is closer to binary than the
generic special-requests free-text field (which does exist, separately, for
low-stakes preferences and explicitly is not fulfillment-guaranteed).

**What this validates for expaify:** a `guaranteed` state must be
represented by a genuine bookable unit, not a soft preference; the discovery's
constraint 2 (guaranteed only from explicit, room/rate-scoped provider
evidence) is the correct bar, and expaify has no provider that can meet it
today (§2.2 of discovery), so `guaranteed` will be **unreachable in
production** at ship time. That is not a deficiency in the spec — it is the
honest state of the only mounted adapter.

**What does not transfer:** Booking's binary (sellable room type vs. silence)
works because Booking has room-level inventory to be silent or explicit
*about*. expaify has no room-level inventory at all — its silence is total,
covering every property, not a per-property fact. This is why `unknown` must
be a distinct, first-class, honestly-labelled state here rather than
indistinguishable silence: discovery constraint 2 already requires this, and
this reference pattern does not contradict it, it just doesn't need the state
itself (Booking's silence is legible as "this property doesn't sell it," not
as "we don't know" — expaify cannot make that claim because it never asked).

### 3.2 Full-service chain direct sites (Marriott/Hilton pattern) — the request lives at property/room selection, decided at check-in, named plainly

Full-service chain direct-booking sites that support a connecting-room
*request* (as distinct from a sellable connecting room type) place the
request control at **room selection**, before rate confirmation, and the
copy is consistently explicit about two things: (1) it is a request, not a
booking change, and (2) confirmation happens **at the property**, typically
at check-in, subject to availability, and is never promised online. The
copy pattern is close to expaify's own shipped Special Requests block
(`BookingFlow.tsx:1297-1298`) almost verbatim — "not a change to your booked
room" and "depends on availability" are the same two disclaimers.

**What this validates:** expaify's existing Selected/Sent/
Acknowledged/Guaranteed vocabulary (`BookingFlow.tsx:1305-1308`) is already
industry-standard framing for a request-only state and should be reused
verbatim for `request_only`, per discovery §5's own instruction, rather than
inventing new copy.

**The interaction-level gap this exposes:** on these reference sites, the
request/guarantee distinction is decided **at room selection**, i.e. before
the traveler has committed to a rate — matching the discovery's claim (§2.3
point 2) that expaify's only adjacent surface "fires too late," at handoff
review, after property selection. expaify has no room-selection step of its
own (room selection happens at the provider, off-site, per
`hotel-detail-decision-order`'s established boundary), so expaify's earliest
possible moment to state connection confidence is **detail-page view**, not
handoff — which is what discovery's success statement ("before choosing a
property") already requires.

### 3.3 The delta

| Job | Booking.com | Chain direct sites | expaify today | Honest target |
|---|---|---|---|---|
| Represent a real guarantee | Bookable room type, purchased like any room | N/A (these sites mostly don't sell it as inventory) | No representation possible — no room/rate identity exists (`lib/types.ts:751-778`) | `guaranteed` defined in the type, **unreachable** until a provider returns room/rate identity |
| Represent a request | Not offered as separate control for this attribute; folded into general special requests | Explicit control at room selection, pre-rate, decided at check-in, plainly disclaimed | Absorbed into 4-item generic preference list, no per-attribute distinction (`BookingFlow.tsx:1289-1291`) | Distinct `request_only` state reusing the shipped Selected/Sent/Acknowledged/Guaranteed vocabulary |
| Represent "we don't know" | Effectively silent (property has no such inventory) | Rare; usually assumed requestable | No representation; silently dropped | `unknown` first-class, non-embarrassing, with a truthful next action (discovery constraint 5) |
| Where in the funnel | Room list (mid-funnel) | Room selection (mid-funnel, pre-rate) | Handoff review (**post**-property-selection) — too late per discovery §2.3.2 | Detail page (`hotel_fit` decision-order section, position 3, **pre**-provider-handoff) |

---

## 4. State Model

The connecting-room analogue of `HotelRoomViewConfidence`
(`app/components/HotelRoomViewConfidence.tsx:1-10`), following the same
supplier/`fetchedAt`/scope/capability shape used by
`HotelRateEligibilityEvidence` (`lib/types.ts:585-603`) and
`HotelAdmissionPolicyEvidence` (`lib/types.ts:633-656`):

```ts
// lib/types.ts — proposed addition, not yet implemented (UXDES/UI/DEV own the file edit)

export type HotelRoomAdjacencyState =
  | 'guaranteed'
  | 'request_only'
  | 'unavailable'
  | 'unknown'
  | 'provider_error'

/** Property-fit evidence: can two or more rooms at this property be booked
 * physically connected/adjacent. Never answers occupancy or bed layout —
 * those are hotel-room-occupancy and hotel-bed-configuration's surfaces. */
export interface HotelRoomAdjacencyEvidence {
  /** Must match the rendered offer's id; mismatch degrades to 'unknown'. */
  offerId: string
  /** Must match HotelOffer.source; mismatch degrades to 'unknown'. */
  supplier: string
  /** Adjacency is a function of specific inventory on specific dates —
   * always stay-scoped. There is no property-only-scoped variant, unlike
   * HotelAdmissionPolicyEvidence's literal 'property' scope. */
  scope: 'stay'
  fetchedAt?: string
  state: HotelRoomAdjacencyState
  /** Present only when state is 'guaranteed' or 'request_only': the
   * provider's own room/rate label(s), reproduced verbatim, never
   * paraphrased or inferred from a room name substring match. */
  roomLabel?: string
  /** Present only when state is 'request_only': who confirms and when.
   * Drives the "names who decides" requirement in discovery §5. */
  decidesAt?: 'property_at_checkin' | 'property_before_arrival'
}

/** Declares whether an adapter's contract can explicitly return each
 * non-default state. Absence of a capability means that state can never be
 * produced by this adapter — evidence normalizes to 'unknown', never to
 * 'unavailable' (discovery constraint 2 and success-statement bullet 3). */
export interface HotelRoomAdjacencyCapability {
  canReturnGuaranteed: boolean
  canReturnRequestOnly: boolean
  canReturnUnavailable: boolean
}
```

`hotellook.ts` — the only mounted adapter — declares
`{ canReturnGuaranteed: false, canReturnRequestOnly: false, canReturnUnavailable: false }`,
which means **every property in production renders `unknown` today.** This
is the correct, honest outcome per discovery §4's success statement bullet 3
("If no adapter can produce it, the state is unreachable in production, and
that is the correct outcome — not a reason to soften the bar"), and it must
not be treated as a bug to work around by inferring state from room-name
substrings, amenity strings, or star rating — discovery constraint 2
explicitly forbids exactly that inference.

`provider_error` is distinct from `unavailable`: it means the adapter
attempted to resolve adjacency and failed or returned conflicting data (mirrors
`HotelRoomViewPresentation`'s `error`/`conflict`/`stale` states, collapsed to
one state here because expaify has no adjacency adapter yet to distinguish
sub-failure-modes against).

---

## 5. Resolution of Discovery §6 (measurement conflict)

Discovery's requested metric — "reduced multi-room booking abandonment" —
requires a denominator (sessions declaring multi-room intent) that does not
exist and, per §2 above, **cannot be built by this ticket** without
contradicting `hotel-guest-count-clarity`'s own architectural conclusion
that no rooms input should exist while pricing stays occupancy-fixed.

**Ruling, explicit:**

- **Reachable now:** state-distribution observability (what share of viewed
  offers show `guaranteed` / `request_only` / `unavailable` / `unknown` /
  `provider_error`) and a static no-false-confirmation copy audit (§6/D4
  below). Both are achievable without any party-declaration capability.
- **Reachable only after `hotel-guest-count-clarity` ships `rooms` capture,
  and only if that ticket's own scope is later revisited to allow `rooms >
  1`** (its current D1 pins `rooms` to `1` — `02-research.md:188-191` — so
  even post-ship, the abandonment metric stays unreachable until that pin is
  revisited by that ticket's own owners): "multi-room booking abandonment."
  This ticket must not claim credit for, or be blocked by, that future
  decision.
- **Never reachable via a proxy:** discovery §3.2 already forbids substituting
  a handoff-click proxy. This brief reaffirms that; DEV/TEST must not invent
  a `hotel_room_adjacency_handoff_clicked`-minus-`_viewed` funnel and call it
  abandonment.
- **Comprehension** (do users correctly restate guaranteed vs. request vs.
  unknown) remains, as discovery states, unmeasurable by any event this
  ticket can ship — it requires moderated or unmoderated testing outside the
  product. TEST stage should not attempt to fabricate a proxy for this either;
  it should assert the static no-false-confirmation rule (D4) as the
  ship-time substitute for comprehension testing, exactly as discovery §5's
  closing bullet specifies ("A copy audit confirms zero strings...").

---

## 6. Design Directives

Five directives, each testable.

### D1 — Add the data contract; thread it for real, do not repeat `HotelRoomViewConfidence`'s inert-mount mistake

Add `HotelRoomAdjacencyState`, `HotelRoomAdjacencyEvidence`, and
`HotelRoomAdjacencyCapability` to `lib/types.ts` per §4. Add
`roomAdjacency?: HotelRoomAdjacencyEvidence` and
`roomAdjacencyCapability?: HotelRoomAdjacencyCapability` to `HotelOffer`
(alongside `rateEligibility`/`rateEligibilityCapability` at
`lib/types.ts:771-772`, same optional-pair pattern). `hotellook.ts` must
construct the evidence object explicitly (state `unknown`, all capability
flags `false`) rather than leaving the field `undefined` — an `undefined`
field is indistinguishable from "forgot to wire it" at review time, whereas
an explicit `unknown` evidence object is auditable. **Test-gate:** the new
component (D2/D3) must receive its `presentation` prop from real
`HotelOffer` data on every call site — UI stage must not merge a change that
leaves it defaulting, the way `BookingFlow.tsx:1190` currently does for
`HotelRoomViewConfidence`.

### D2 — Render unconditionally in the detail page's `hotel_fit` section (position 3), before the provider-handoff section (position 4)

Per §2's resolution, this cannot be gated behind a party declaration, so it
renders for every property, every viewer, exactly like
`HotelPoolEvidenceLedger`, `HotelDisruptionEvidenceLedger`,
`QuietStayEvidenceLedger`, and `HotelSustainabilityCredentialEvidence`
already do at `app/deals/[dealId]/page.tsx:438-445`. Add a new
`HotelRoomAdjacencyEvidenceLedger` component to that list, inside the
`data-hotel-decision-section="hotel_fit"` section
(`page.tsx:425`), so it satisfies discovery's "before choosing a property"
requirement — this section renders before `provider_handoff` (position 4),
matching the funnel position both reference patterns use (§3.3).

Exact copy per state, reusing the shipped vocabulary per discovery §5:

- `guaranteed`: **"Connecting rooms available"** / *"\[provider\] lists {roomLabel} as a bookable connecting-room option for this stay."*
- `request_only`: **"Connecting rooms: request only"** / *"\[provider\] has not committed to a specific connecting-room assignment. The property decides at check-in, based on availability. Reuses Selected/Sent/Acknowledged/Guaranteed language: 'Until the property confirms it, treat this as a preference.'"*
- `unavailable`: **"Connecting rooms not offered"** / *"\[provider\] states this property does not offer connecting or adjacent rooms."*
- `unknown`: **"Connecting-room availability not confirmed"** / *"expaify has no evidence about connecting rooms at this property. Ask the property directly before booking if this matters for your trip."* (never "not available" — discovery constraint 2)
- `provider_error`: **"Connecting-room details could not be checked"** / *"Ask the property directly before booking."*

Never use `--success` color, a check icon, or the words *confirmed*,
*secured*, or *reserved* for anything other than `guaranteed` (discovery
constraint 1) — this is the assertable rule D4 turns into a test.

### D3 — Mirror the same evidence at handoff, next to `HotelRoomViewConfidence`, as a separately labeled statement; leave Special Requests untouched

Add a sibling `HotelRoomAdjacencyConfidence` component, rendered immediately
after `HotelRoomViewConfidence` at `BookingFlow.tsx:1190`, receiving
`hotelContext.roomAdjacency` as a real prop (see D1's test-gate). This
satisfies discovery constraint 3 — adjacency renders as its own labeled
statement, never merged into the room-view block's copy, never implying an
occupancy or bed-configuration fact.

**Do not extend the Special Requests block's four-item list**
(`BookingFlow.tsx:1289-1291`, "quiet room, high floor, preferred bed setup,
or early check-in") **with a fifth "connecting rooms" bullet.** Discovery
§2.3 point 3 already rules this out — a flat "treat it as a preference"
would understate the `guaranteed` case and misrepresent adjacency's
trip-breaking asymmetry (discovery §1) at the same tier as a high-floor
preference. The new block owns this topic exclusively; the Special Requests
block's copy, scope, and four-item list are unchanged by this ticket.

### D4 — No-false-confirmation rule, expressed as an assertable test condition

Assertable condition, to be written as a unit test in UI/DEV stage,
following the existing render-tree-walk pattern in
`app/components/__tests__/HotelRoomViewConfidence.test.tsx`:

> For every `HotelRoomAdjacencyState` other than `'guaranteed'`, the
> component's rendered text content must not match
> `/\b(confirmed|guaranteed|secured|reserved)\b/i`, and must not apply any
> class token containing `--success` or `--brand-positive` (whatever the
> success-color token is named in `app/globals.css`).

Because this is a text/class assertion on the render tree (not a screenshot),
it is breakpoint-independent by construction — Tailwind's responsive
utilities in this codebase change layout classes (`sm:`, `min-[420px]:`),
never text content or color-conveying classes, so one assertion covers both
375px and 1280px per discovery constraint 1's requirement that the
distinction "survive being read aloud with no styling." TEST stage should
still manually confirm no responsive variant introduces a color-only cue
(e.g. a `sm:hidden` icon) that the text-only assertion wouldn't catch.

### D5 — Analytics: observe state distribution, not abandonment; do not touch party-setup capture in this ticket

Add one event to the allow-list in `app/api/analytics/route.ts`, mirroring
the shape of `resilience_summary_impression`
(`:56`, `['dealId', 'evidenceState', 'signalTypes', 'scope']`):

```
hotel_room_adjacency_evidence_viewed: ['deal_id', 'hotel_id', 'state', 'surface']
```

`surface` distinguishes `'detail'` (D2) from `'handoff'` (D3) — the two
mount points are different funnel stages and must be distinguishable in the
data, matching the existing `surface` dimension convention used elsewhere in
this file (e.g. `hotel_criteria_summary_viewed:14`). This event answers "what
share of impressions are each state" (reachable now, per §5) and must not be
extended with a room-count or party-size dimension — no such value exists to
attach (per §2, `occupancy.applied` stays unreachable in this ticket).

**Explicitly out of scope for this ticket, stated so DEV does not
improvise it:** no changes to `lib/hotels/searchCriteria.ts`,
`HotelSearchCriteriaV1`, or the criteria editor. `occupancy.applied` remains
unconstructed. This is a deliberate boundary, cross-referenced to
`hotel-guest-count-clarity`'s D1, not an oversight — restated here so UXDES
does not attempt to satisfy discovery §5's "party setup can express..."
bullet by inventing a parallel, ticket-local occupancy field.

---

## 7. States UXDES Must Specify

- **`HotelRoomAdjacencyEvidenceLedger`** (detail page, `hotel_fit` section):
  `guaranteed | request_only | unavailable | unknown | provider_error`, each
  at 375px and 1280px, plus how it stacks relative to the existing
  `HotelPoolEvidenceLedger` / `HotelDisruptionEvidenceLedger` /
  `QuietStayEvidenceLedger` / `HotelSustainabilityCredentialEvidence` siblings
  (`page.tsx:438-445`) — ordering within the section, not just the new
  component in isolation.
- **`HotelRoomAdjacencyConfidence`** (handoff, next to `HotelRoomViewConfidence`
  at `BookingFlow.tsx:1190`): same five states, plus how it visually separates
  from the room-view block immediately above it (discovery constraint 3 —
  "a separate labeled statement").
- **Loading state** for both mounts, matching `HotelRoomViewConfidence`'s
  `aria-busy` + `role="status"` skeleton pattern (`HotelRoomViewConfidence.tsx:93-100`),
  for the (currently hypothetical, since `hotellook.ts` resolves
  synchronously to `unknown`) case a future async adapter needs it — spec it
  now so DEV does not have to invent it later.
- **Keyboard/focus:** neither mount introduces an interactive control (no
  button, no expand/collapse) in the `unknown`/`unavailable`/`provider_error`
  states per this brief; UXDES must confirm whether `guaranteed` or
  `request_only` warrant a "Learn how requests work" disclosure link
  (reusing the existing `<details>` pattern at `BookingFlow.tsx:1300-1310`)
  and, if so, specify its exact focus/`aria-expanded` behavior.
- **Screen reader:** exact `sr-only` or `aria-label` string per state,
  satisfying discovery constraint 1's "read aloud with no styling" bar —
  this cannot be left to UI stage's judgment given the trust stakes discovery
  describes.

---

## 8. Handoff

Next stage: **UXDES-HOTEL-ADJOINING-ROOMS-01** (UX Design, Claude Fable 5).

Design must consume D1–D5 and produce `03-design.md` covering every state in
§7 with final copy (D2's copy strings are a first pass; UXDES may refine
wording but must not weaken the no-false-confirmation rule in D4), Tailwind
class patterns against the tokens in `app/globals.css`, and exact interaction
rules. The §6 measurement conflict is resolved in §5 above and is not
reopened at design: abandonment is unmeasurable and out of scope; state
distribution and a static copy audit are the ship-time success signals.
Party-setup capture of room count/connection need is explicitly out of scope
for this ticket per §2 and D5 — UXDES must not reintroduce it.
