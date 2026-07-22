# UXDES-TRAVELER-DETAILS-01: Hotel Booking Traveler-Detail Readiness

Date: 2026-07-22  
Stage: UX Design  
Priority: P0  
Upstream: `docs/pipeline/traveler-details/02-research.md`

## Decision

Add one non-interactive readiness disclosure to the existing hotel handoff review. It prepares a guest for possible downstream identity and contact questions without collecting, validating, storing, or sending traveler details.

The current Hotellook affiliate redirect has no stable, versioned downstream requirement schema. It must use the `unknown` requirement state and qualified language only. The interface must not call any traveler field “required,” identify a contact owner, claim that the list is complete, or render a hotel traveler form.

This specification is implementation-ready for the current no-form disclosure. The `reference_only` and `partner_verified` definitions are governance rules for later integrations; they do not approve a direct or embedded hotel checkout.

## User Outcome

A guest reviewing a hotel can understand, before leaving expaify:

- whose name “lead guest” refers to;
- which basic details may be useful to have ready;
- that the booking partner, not expaify, determines and collects the actual details; and
- that continuing opens an external site and does not submit traveler information.

## Scope and Non-Goals

### In scope

- One readiness block in `HotelHandoffReview` on `/book`.
- Copy and rendering rules for `unknown`, `reference_only`, and `partner_verified` requirement confidence.
- Default, loading, empty/invalid, error, responsive, focus/keyboard, and edge-case behavior.
- Honest handoff analytics semantics.
- Accessibility and privacy guardrails for any separately approved future direct form.

### Explicitly out of scope

- Hotel name, email, phone, address, guest-count, or “booking for someone else” inputs.
- Any hotel traveler-detail submit action, provider request, local persistence, profile prefill, or new shared traveler type.
- Calling the Hotellook redirect, Booking.com, Expedia, or any hotel vendor to infer requirements.
- Stay dates, occupancy, room allocation, selected-room continuity, final-price continuity, or booking confirmation callbacks.
- Payment, billing address, identity documents, date of birth, title, gender, nationality, loyalty, arrival time, special requests, or additional guest collection.
- Changes to the separate Duffel flight traveler form.

## Information Architecture and Hierarchy

The existing page order remains:

1. **Primary context — selected hotel and rate.** Hotel identity, location confidence, nightly rate, rate restrictions, rate source, price basis, and offer reference remain the first review surface.
2. **Primary action context — booking partner handoff.** Partner identity (generic when unresolved), ownership of payment, and the two-column “expaify shows / booking partner confirms” facts remain above supporting guidance.
3. **Secondary guidance — traveler-detail readiness.** Insert the new readiness block immediately after the partner-confirmation facts and immediately before “Special requests.” It is supporting information, not a form step or gate.
4. **Tertiary guidance — special requests.** Preserve the existing section and disclosure behavior unchanged.
5. **Primary action — continue externally.** Keep the full-width provider CTA and new-tab cue after all guidance, followed by the secondary “Back to search” action.

The readiness block must not visually resemble a required alert, error, checklist completion control, or input group. No warning icon, success check, numbered step, checkbox, “required” marker, or completion status is permitted.

## Requirement Confidence Model

Use an internal discriminated state. The names below are product/content governance states, not user-facing labels.

```ts
type HotelTravelerRequirementConfidence =
  | { state: 'unknown' }
  | {
      state: 'reference_only'
      referencePartnerKey: string
      referenceSchemaVersion: string
    }
  | {
      state: 'partner_verified'
      partnerKey: string
      requirementSchemaVersion: string
      selectedProductKey: string
      verifiedAt: string
    }
```

Do not add this type to shared production code solely for the current Hotellook flow. A local constant or equivalent render decision is sufficient until a provider-owned, versioned profile exists.

| State | Meaning | Current eligibility | User-facing behavior |
| --- | --- | --- | --- |
| `unknown` | The downstream form owner or selected-product requirements are not contractually known. | Required for Hotellook and opaque `tp.media` redirects. Also the safe fallback for missing, malformed, stale, mismatched, or unsupported profiles. | Render the qualified “What you may need” disclosure specified below. Never say a field is required. |
| `reference_only` | A named platform documents a pattern, but it is not the contract for this selected expaify offer. | Research and internal comparison only. | Never render reference requirements, partner names, field lists, or requiredness to the user. Resolve to the `unknown` disclosure. Do not expose a “reference-only” badge; it would add internal jargon without helping the guest. |
| `partner_verified` | The actual selected product is mapped to a stable partner identity and a versioned requirement profile supplied or contractually confirmed by that partner. | Not available in the current integration. | May render selected-product-specific readiness content only after the gate below passes. “You’ll need” is allowed only for fields explicitly required in that exact profile. This state does not itself approve an expaify-hosted form. |

### Partner-verified gate

All of the following must be true before a renderer can select `partner_verified`:

1. `partnerKey` identifies the actual downstream booking party, not an affiliate redirect host.
2. `requirementSchemaVersion` is stable, versioned, and supplied or contractually confirmed by that partner.
3. `selectedProductKey` maps the chosen room/rate product to the profile.
4. Stay/occupancy and per-room guest allocation needed to interpret the profile are present and valid.
5. The profile distinguishes staying-guest and booker/contact roles and states conditional logic.
6. Product, legal/privacy, security, and accessibility review approve the resulting copy and any measurement.
7. Automated tests prove that missing, stale, or mismatched keys fall back to `unknown`.

A recognizable URL hostname, a provider display-name map, or documentation from Booking.com/Expedia is not sufficient evidence. Current `tp.media` URLs always resolve to `unknown` even if their nested redirect URL contains a recognizable hotel brand.

## Current-State Component Specification

### Placement and semantics

Add a `<section>` between the handoff fact grid and the existing Special requests section.

- Associate its heading with `aria-labelledby="hotel-traveler-readiness-title"`.
- Do not give it `role="alert"`, `role="status"`, `aria-live`, `aria-busy`, or a tab stop. Its content is stable supporting guidance.
- Keep semantic reading order identical to visual order.
- Do not use inputs, buttons, links, `<details>`, or selectable controls inside it.
- Do not add an icon whose meaning is required to understand the copy.

### Exact copy — `unknown` and `reference_only` fallback

**Heading**  
`What you may need`

**Primary guidance**  
`Have the lead guest’s full name, a confirmation email, and a reachable phone number ready. The booking partner will show exactly what is required.`

**Booking-for-another-person guidance**  
`Booking for someone else? Use the name of the person checking in as the lead guest. The booking partner will tell you whose email and phone it needs.`

No additional readiness strings are permitted in the current integration. In particular, do not append “These details are required,” “expaify will send these details,” “This is everything you need,” or partner-specific validation rules.

### Tailwind pattern — current disclosure

Use only existing tokens from `app/globals.css`:

```tsx
<section
  aria-labelledby="hotel-traveler-readiness-title"
  className="mt-5 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3.5 py-3 sm:px-4 sm:py-4"
>
  <h3
    id="hotel-traveler-readiness-title"
    className="text-sm font-bold leading-5 text-[color:var(--text-1)]"
  >
    What you may need
  </h3>
  <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
    Have the lead guest’s full name, a confirmation email, and a reachable phone number ready. The booking partner will show exactly what is required.
  </p>
  <p className="mt-2 text-sm leading-6 text-[color:var(--text-2)]">
    Booking for someone else? Use the name of the person checking in as the lead guest. The booking partner will tell you whose email and phone it needs.
  </p>
</section>
```

Do not introduce a new color, shadow, font size, or token. The neutral `--border`, `--bg-raised`, `--text-1`, and `--text-2` treatment keeps the disclosure secondary and avoids falsely signaling warning or verification.

### Exact copy — future `partner_verified` content rules

No final field list can be written until an eligible versioned profile exists. A future implementation must generate copy from that profile under these rules:

- Heading may be `What you’ll need` only when every item shown is required for the selected product.
- Name the actual staying-guest cardinality: for example, “the lead guest for each room” only when the profile and room allocation require it.
- Name the owner of each contact item: “booking contact email,” “lead guest phone,” or equivalent only when the schema defines that role.
- Put conditional items in a separate sentence beginning `You may also need…`; never mix required and conditional items in one unqualified list.
- End with a sentence that names the verified partner and states that the guest enters the details there while expaify neither collects nor sends them.
- If the verified identity or profile becomes stale/missing at render time, use the complete `unknown` copy. Do not partially combine verified and unknown content.

UI implementation for this ticket should not invent partner-verified strings or render a test-only verified variant in production.

## State Specification

### 1. Default — valid hotel, unknown requirements

- Render selected hotel/rate review as it works today.
- Render generic booking-partner language for opaque Hotellook/`tp.media` handoffs.
- Render the exact unknown readiness disclosure before Special requests.
- Keep CTA label `Continue to booking partner` for an unresolved partner.
- Keep cue `Opens the booking partner’s site in a new tab. Your expaify search stays open here.`
- Continuing does not validate readiness and is never disabled by the disclosure.

### 2. Default — valid hotel, named partner but no verified schema

- A safely parsed hostname may still name the destination in the existing handoff copy and CTA.
- Requirement confidence remains `unknown` unless the full partner-verified gate passes.
- Render the same generic unknown readiness disclosure. Do not substitute the hostname into traveler requirements or say that the named partner requires an item.
- A named partner URL and a verified requirement profile are independent facts.

### 3. Reference-only requirements

- Do not expose the reference partner or reference field statuses.
- Render the exact unknown disclosure.
- Log no “required fields shown” or partner-verification event.
- Automated coverage must confirm that a Booking.com or Expedia reference record cannot produce “You’ll need” on a Hotellook offer.

### 4. Partner-verified requirements — future governed state

- Not implemented for this ticket.
- When separately approved, render only after every gate condition passes and only for the selected product/profile pair.
- On any runtime disagreement, stale version, unknown cardinality, or missing role owner, fail closed to `unknown`; do not hide the entire readiness block.
- A verified disclosure remains informational in the current redirect architecture and does not become a form.

### 5. Loading

The existing `/book` Suspense fallback remains the only loading UI. Do not render guessed traveler guidance or traveler skeleton fields while booking context is unresolved.

Use the existing strings:

- Eyebrow: `Checkout review`
- Heading: `Loading booking review`
- Body: `Preparing the selected fare and recovery options.`

The fallback remains `role="status"`, `aria-live="polite"`, and `aria-busy="true"`. Its three decorative bars remain `aria-hidden="true"`. When valid hotel context resolves, replace the fallback with the complete hotel review and unknown disclosure without moving focus.

### 6. Empty / invalid hotel selection

If hotel context is absent or invalid, preserve `InvalidHotelState`. Do not render the readiness block, any field list, a provider CTA, or partner-required claims because there is no selected offer to hand off.

The recovery action remains a return to search. The readiness disclosure must not be used to fill an otherwise empty review.

### 7. Error

There is no traveler-readiness request and therefore no traveler-readiness network error state.

- A malformed or unsupported requirement profile falls back silently to `unknown`; the user still receives useful qualified guidance.
- A malformed provider URL is handled by the existing hotel-context validator/invalid-selection state. Do not render a broken external CTA.
- If the external partner fails after a new tab opens, expaify must not claim an error occurred because it cannot observe that page. Returning to the expaify tab leaves the review intact and actionable.
- Do not show “Your details were not submitted”; expaify never collected them. Existing copy already communicates collection ownership.

### 8. Return from partner

- Preserve the hotel review, readiness guidance, special-request guidance, and CTA exactly as before navigation.
- Do not display completion, abandonment, validation-error, or retry messaging based only on tab visibility.
- Do not move focus or announce an inferred status when the expaify tab becomes visible.

## Interaction Rules

### Pointer/tap

- The readiness block has no tap target and no hover state.
- Tapping the provider CTA retains existing behavior: emit the bounded click signal and open the attributed provider URL in a new tab with `noopener noreferrer sponsored`.
- The disclosure never prevents or delays navigation.
- “Back to search” retains existing behavior.

### Keyboard

- The disclosure adds no stop to tab order.
- Tab order remains document order: existing interactive content above, Special requests summary, provider CTA, Back to search.
- `Enter` or `Space` on the focused Special requests `<summary>` retains native expand/collapse behavior.
- `Enter` on the provider link opens the partner in a new tab. Do not attach keyboard behavior to the readiness section.
- Existing global `:focus-visible` outline and `--focus-ring` styling must remain unobscured.

### Screen reader

- The section heading identifies the block; paragraphs read once in source order.
- Do not duplicate the full readiness copy inside the provider CTA accessible name. The CTA name should continue to identify destination, hotel, new-tab behavior, and rate context.
- “Lead guest” is immediately defined in the second paragraph as the person checking in; no tooltip is needed.

## Responsive Layout

### Mobile — 375px viewport

- Maintain page side padding from the existing shell; the block occupies the available card width.
- Use a single-column reading order and `px-3.5 py-3`; no horizontal scrolling.
- Paragraphs wrap naturally. Do not truncate, clamp, or place the name/email/phone concepts in side-by-side columns.
- Keep at least `mt-5` separation from the partner fact grid and the following Special requests block.
- Provider and Back actions remain full width and at least 44px high.
- At 320px minimum supported body width, apostrophes and long partner labels must wrap without overflow.

### Desktop — 1280px viewport

- Keep the disclosure within the same handoff panel width; do not create a sidebar or compete with the selected rate.
- Keep paragraphs left-aligned with a readable line length determined by the existing review container.
- The two-column handoff facts may remain two columns; readiness stays one unified block below them.
- Preserve the CTA below guidance so users encounter the disclosure before continuing in both visual and DOM order.

## Edge Cases and Content Safety

| Case | Required behavior |
| --- | --- |
| Booking for oneself | Do not assume or state that the lead guest owns the email/phone. The generic copy remains accurate. |
| Booking for someone else | Define lead guest as the person checking in; say the partner determines whose email/phone it needs. |
| Multiple rooms or guests | Do not promise that one lead guest is sufficient. Do not mention or collect additional names. Remain in `unknown`. |
| International or mononym name | Do not prescribe first/family-name structure, ASCII characters, titles, or formatting in generic guidance. “Full name” is readiness language, not a validation rule. |
| International phone | Do not provide a country-code format or example until a selected partner schema defines it. |
| Shared or monitored email | Say “a confirmation email,” not “the lead guest’s email,” because ownership is unknown. |
| Opaque redirect with recognizable nested URL | Treat as unknown. Do not inspect nested redirect parameters to create requirement claims. |
| Known display hostname without schema | It may remain named in existing destination copy; traveler requirements stay unknown. |
| Stale/mismatched profile | Fall back completely to unknown and do not mix verified fragments into the block. |
| Missing analytics | Render normally. Analytics must never block or alter the handoff. |
| JavaScript or observer unavailable | Render normally. The disclosure is static content and needs no observation to function. |
| Very long hotel/partner name | Existing break-word behavior remains; readiness copy contains no interpolated hotel or unverified partner name. |

## Analytics and Privacy Contract

The disclosure does not create a form funnel. Existing signals retain these narrow meanings:

| Signal | Allowed interpretation | Prohibited inference |
| --- | --- | --- |
| `hotel_handoff_viewed` | A valid expaify hotel review mounted. | A provider form or readiness block was read. |
| `hotel_handoff_continue_clicked` | The external CTA was activated. | The external page loaded, traveler details started, or a booking began. |
| `hotel_handoff_returned` | The expaify tab became visible after the existing hide/show sequence. | Abandonment, field failure, cancellation, or booking completion. |
| `hotel_handoff_back_clicked` | The user selected Back before continuing. | Why the user left. |

No new disclosure-exposure event is required by this UI ticket. If one is separately approved, it may record only fixed enums such as `requirementConfidence: 'unknown'` and a coarse viewport class. It must not include names, email, phone, raw/free text, hashes of personal values, full URLs/query strings, inferred email domains, inferred phone countries, or exact value lengths.

Only a partner-confirmed callback may produce a booking-completed signal. Before durable analytics ships, the privacy notice, lawful basis/consent behavior, processors, and retention must be reviewed and updated.

## Future Direct-Form Accessibility Appendix — Not Approved for Implementation

If a contracted direct/embedded hotel form is later approved, it must satisfy all of the following in addition to a versioned selected-product profile:

- Every control has a persistent visible label and visible `Required` or `Optional` status based on the verified profile.
- Guest and booker sections are separately titled; fields identify whose value belongs there.
- Phone includes a concise, partner-supported purpose note and does not use an unexplained restrictive mask.
- Legitimate international names are not rejected by invented ASCII-only or two-name rules.
- Validate format-sensitive fields on blur and again on submit, not on each keystroke.
- A field error is textual, adjacent to the control, programmatically associated with `aria-describedby`, and represented with `aria-invalid="true"`.
- On failed submit, keep all valid values, present a concise error summary, move focus to the first invalid field, and allow keyboard correction without surprise focus changes.
- Error copy identifies the problem and recovery action. It never exposes raw personal values in logs or analytics.
- Events use fixed `fieldKey`, `requiredState`, and `errorCode` enums only. `traveler_details_submitted` means the partner accepted that step; it does not mean payment or booking success.

These requirements are a guardrail, not permission to reuse the Duffel flight form or create hotel inputs in this ticket.

## UI Acceptance Criteria

1. A valid Hotellook hotel review at 375px and 1280px shows the exact unknown disclosure after partner-confirmation facts and before Special requests.
2. The rendered hotel branch contains no traveler input, checkbox, field validation, hotel traveler submit action, new storage, or provider call.
3. No current field is labeled partner-required, and the heading “What you’ll need” is absent. The only use of “required” is the approved qualified sentence stating that the booking partner will show exactly what it requires.
4. The booking-for-someone-else sentence identifies the lead guest as the person checking in and does not assign ownership of email or phone.
5. A named hostname without a versioned selected-product profile still renders unknown copy.
6. `reference_only` data cannot render named partner requirements or stronger requiredness language.
7. Missing, stale, invalid, or mismatched profile data falls back to the complete unknown disclosure.
8. Invalid hotel selection renders recovery only and no readiness disclosure or provider CTA.
9. The disclosure adds no focus target, alert/live-region announcement, hover behavior, or CTA gating.
10. Provider CTA behavior, affiliate relationship, `target="_blank"`, and `rel="noopener noreferrer sponsored"` remain unchanged.
11. Outbound click and tab return are not relabeled or interpreted as traveler-form start, failure, submission, abandonment, or booking completion.
12. Typecheck and test suites pass with no regressions to hotel, flight, search, or booking flows.

## QA Scenarios

| Scenario | Viewport/input | Expected result |
| --- | --- | --- |
| Current Hotellook offer | 375px, touch | Unknown disclosure is fully readable before Special requests and CTA; no horizontal overflow or form controls. |
| Current Hotellook offer | 1280px, pointer | Hotel/rate remains primary; neutral readiness block stays secondary; CTA remains below guidance. |
| Opaque `tp.media` redirect | Keyboard + screen reader | Generic booking-partner destination and exact unknown disclosure; disclosure is read in order and adds no tab stop. |
| Named hostname, no schema | 1280px | Existing destination may be named; readiness copy remains generic and qualified. |
| Reference-only Booking.com/Expedia record | Any | Same unknown disclosure; no reference partner or requiredness appears. |
| Invalid hotel query context | 375px and 1280px | Existing invalid-selection recovery; no readiness block and no external CTA. |
| Return from external tab | Keyboard/pointer | Review state is preserved; no inferred success, error, or abandonment announcement. |
| Observer/analytics unavailable | Any | Disclosure and handoff remain usable; navigation is not blocked. |
| Long translated-equivalent wrapping stress | 320px minimum | No clipping, overlap, or horizontal scrolling; CTA remains at least 44px high. |

## Blockers and Handoff Boundary

The no-form `unknown` disclosure is ready for UI implementation.

A partner-verified disclosure or hotel traveler form remains blocked by the absence of a stable downstream partner identity, selected room/product mapping, stay and occupancy context, a versioned requirements schema, role ownership rules, and approved privacy-safe callbacks. UI must not simulate those missing contracts with hostname inference or reference documentation.

The next stage may implement only the static current-state readiness block and tests that protect the confidence fallback. Any logic/API/provider/schema work requires a separately scoped DEV ticket after the partner gate is satisfied.
