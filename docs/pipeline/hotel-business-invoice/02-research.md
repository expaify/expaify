# UXR-HOTEL-BUSINESS-INVOICE-01: Hotel Business Invoice Eligibility Research

Date: 2026-08-03  
Stage: UX Research  
Priority: P1  
Upstream: `docs/pipeline/hotel-business-invoice/01-discovery.md`  
Inherited shipped contract: `docs/pipeline/hotel-invoice-readiness/`

## Research conclusion

The residual problem is confirmed. The shipped invoice-readiness flow can disclose whether an invoice or receipt is expected, who is expected to issue it, when generic billing details are supplied, and where to verify an incomplete answer. It cannot disclose the two facts that make that document useful to many business travelers: whether the issuer accepts the required business/tax identifier and whether the requested individual or legal-entity name may appear on the document.

Those facts cannot be derived from document availability, issuer, payment collector, booker, guest, cardholder, property policy, or partner brand. First-party supplier references model those concepts separately and limit them by integration, payment method, document type, or issuer action. The current expaify providers supply no selected-rate evidence for either eligibility dimension. The honest current state is therefore independently `not_provided` for tax/business-identifier support and document-name eligibility, even when a future source confirms document availability.

The repair should extend the existing selected-rate disclosure, not replace it or introduce an overall “business ready” verdict. It should add two separately sourced fact rows, preserve an independent unknown/conflict state for each, and direct the traveler to the responsible issuer for only the unanswered or conditional question. It must not collect billing values, validate tax identifiers, or promise that a document will satisfy an employer or tax authority.

## Scope and method

This brief keeps three evidence classes separate:

1. **Current-code evidence:** direct inspection of the shared types, provider normalizer and adapters, booking-context continuity, `/book` disclosure, analytics emission, analytics allowlist, and the shipped invoice-readiness pipeline in this worktree.
2. **Supplier capability evidence:** first-party Booking.com Demand API and Expedia Rapid documentation. These are reference capabilities for contracted booking integrations, not claims about current expaify or redirect-only offers.
3. **Interaction-pattern guidance:** the minimum state and hierarchy implications supported by the code and supplier evidence. No supplier visual styling is proposed.

No production analytics, user interviews, supplier contract review, jurisdiction-specific tax review, or live booked-rate validation was available. The comprehension and behavioral measures below are therefore proposed tests, not reported outcomes.

## Current implementation audit

### Shipped contract that must remain authoritative

The prior invoice-readiness pipeline is implemented end to end:

- `HotelDocumentReadiness` preserves selected `rate` or `selected_stay` scope, document status and type, per-document issuer, one billing-detail step, supplier provenance, conflicts, and a verification target (`lib/types.ts:338-374`).
- The normalizer degrades malformed positive, negative, conditional, and conflicting claims to `not_provided`; explicit unavailability requires both scope and source (`lib/providers/hotelDocumentReadiness.ts:52-147`).
- Booking context carries the normalized disclosure through the `/book` boundary, including issuer, source policy/timestamp, conflicts, and verification target (`lib/booking/config.ts:1206-1323`).
- The review UI asks for invoice intent and renders document-specific facts before provider handoff, with loading, error, confirmed, conditional, unavailable, conflicting, and not-provided states (`app/components/HotelDocumentReadiness.tsx:208-360`; `app/book/BookingFlow.tsx:816-883`, `:1235-1248`).

These are inherited requirements. This ticket does not reopen invoice/receipt availability, issuer, timing, provenance, retry, conflict, accessibility, or affiliate-handoff decisions.

### Exact residual gap

| Boundary | Current-code evidence | Residual eligibility delta |
| --- | --- | --- |
| Shared model | `HotelDocumentReadiness` has `billingDetailsStep`, but no supported billing-field categories, identifier state, addressee type, name relationship, or correction boundary (`lib/types.ts:355-374`). | The system cannot distinguish “tax ID accepted,” “not accepted,” “conditional,” and “not provided”; it also cannot answer whether an individual or legal entity can be named or whether that name may differ from guest/booker/cardholder. |
| Normalization | The normalizer validates one document-level status and a generic timing value, with one shared source (`lib/providers/hotelDocumentReadiness.ts:67-147`). | A confirmed invoice can mask two missing eligibility dimensions. A shared status/source cannot represent “VAT number supported by provider policy; legal-entity name unknown from property.” |
| Provider coverage | Hotellook always returns `notProvidedHotelDocumentReadiness('Hotellook')`; Booking.com Rapid API and Hotelbeds adapters do the same (`lib/providers/hotellook.ts:558-563`; `lib/providers/bookingComHotelsRapidApi.ts:211-214`; `lib/providers/hotelbeds.ts:298-303`). | Current sourced coverage is 0% for both tax-ID and document-name eligibility. Provider omission is not explicit non-support. |
| Review UI | The third fact row is **Billing details** and only states when/where unspecified details are supplied (`app/components/HotelDocumentReadiness.tsx:70-94`, `:319-322`). Not-provided guidance asks generally what billing details are needed (`:188-198`). | The user cannot tell whether the unknown concerns timing, identifier support, document name, or all three, and cannot verify only the missing fact. |
| Role separation | Document issuer is separate from partner identity, and payment responsibility elsewhere in the handoff is not used as issuer evidence. | No model separates requested document addressee from guest, booker, or cardholder. Reusing any of those identities would create an unsupported eligibility claim. |
| Analytics | The client emits invoice-need, retry, readiness-view, verification, and augmented handoff events (`app/book/BookingFlow.tsx:816-845`, `:853-883`, `:971-986`). | `app/api/analytics/route.ts:12-50` does not allowlist invoice events, and the handoff event does not allow `invoiceNeeded` or `invoiceReadinessStatus`; `parseBody` rejects unknown events/properties (`:245-257`). There is no invoice-specific return reason. No production eligibility baseline is defensible. |

### Coverage verdict

For every currently inspected hotel provider path:

| Dimension | Safe current value | Why |
| --- | --- | --- |
| Invoice/receipt readiness | `not_provided` | Existing provider adapters explicitly preserve omission. |
| Business/tax-identifier support | `not_provided` | No adapter returns an accepted identifier category or an explicit selected-rate negative. |
| Document-name eligibility | `not_provided` | No adapter returns an allowed addressee type or relationship to guest, booker, or cardholder. |
| Entry/correction boundary | Entry timing `unknown`; correction rule `not_provided` | The generic timing field does not prove a field is supported, and no inspected contract states whether document identity can be corrected. |

This is an evidence-coverage finding, not a claim that the hotel or issuer refuses business details.

## Reference-pattern comparison

### Booking.com Demand API: identity fields and eligibility are integration-specific

Booking.com's order-creation model keeps `booker.company`, guest names, and payment-card `cardholder` separate. It also provides a distinct `payment.business_information` object with company and billing VAT fields. This is direct evidence that booker, guest, cardholder, billing company, and tax identifier are not interchangeable concepts. [Booking.com Demand API v3 migration mapping](https://developers.booking.com/demand/docs/migration-guide/v3/processbooking-v3-migration-guide), [Booking.com Demand API reference](https://developers.booking.com/demand/docs/open-api/3.2/demand-api)

Booking.com's Voxel invoice-collection integration requires an active Voxel setup, supported Online Payments or Payment Instructions, a data-sharing agreement, and business information submitted at order creation; pay-at-property bookings are not supported by that integration. The required business information includes company, country, VAT number, and billing email. Booking.com also states that partners are responsible for VAT-number validity and that invalid values can prevent invoice creation. [Booking.com: Voxel invoice collection](https://developers.booking.com/demand/docs/payments/models/voxel-integration)

**Guidance, not a current expaify claim:** identifier support must be conditional when it depends on payment method or contracted integration; “field can be sent” is not the same as “identifier is valid” or “invoice is guaranteed.” Entry timing belongs to the supported field itself. No current provider adapter exposes this evidence.

### Expedia Rapid: receipt configuration and supplier invoice requests are different outcomes

Expedia Rapid lets enabled partners configure a booking receipt with a client company name/address and a partner legal-entity display name. Separately, its Booking API `invoicing` object can carry a corporate client company name and VAT number for a property invoice request. Expedia says those invoice fields are passed to the property but do not themselves notify it; on Property Collect and Updated Expedia Collect, actioning the request and making the invoice available remain the property's responsibility. [Expedia Rapid: invoices and booking receipts](https://developers.expediagroup.com/rapid/lodging/manage-booking/booking-receipts?locale=en_US)

The same reference distinguishes invoice/receipt issuer by payment model and treats “may issue” as discretionary for some Expedia Collect cases. This confirms that document type, issuer, accepted identity fields, and fulfillment confidence need separate states. [Expedia Rapid: invoices and booking receipts](https://developers.expediagroup.com/rapid/lodging/manage-booking/booking-receipts?locale=en_US)

**Guidance, not a current expaify claim:** a supplier-confirmed input channel may support a company name and VAT number while actual property issuance remains conditional. The UI should say the issuer accepts or receives specified details, not that the stay is compliant or reimbursement-ready.

### Exact current-versus-reference delta

| Decision question | Current expaify | Reference capability pattern | Delta to close |
| --- | --- | --- | --- |
| Can I provide a business/tax identifier? | Not representable | Explicit VAT field exists only in particular booking/payment integrations | Add independent support state plus supplier-named identifier category and conditions; omission stays unknown. |
| Whose name can appear? | Not representable | Company/client/legal-entity display fields are distinct from booker, guest, and cardholder fields | Add independent document-addressee state and allowed addressee types; never infer from adjacent identity fields. |
| Can the document name differ from traveler/payment identities? | Not representable | Supplier request models carry those identities separately | Represent each stated relationship independently; absence of a restriction is not permission. |
| When must each detail be entered or corrected? | One generic timing field | Business information is supplied at specific booking stages; post-booking fulfillment may remain with the property | Attach entry and sourced correction boundaries to each eligibility dimension, not to “billing details” globally. |
| What proves the claim? | One document-level source | Eligibility may come from integration rules, payment model, and property action | Preserve source, scope, observed/policy reference, and verification target per dimension. |

## Required evidence semantics for UXDES

Exact implementation names may change, but UXDES must design for two independent evidence objects rather than one overall business-invoice status.

| Evidence | Required semantics |
| --- | --- |
| `taxIdentifierEligibility` | State: `supported`, `unsupported`, `conditional`, `not_provided`, or `conflicting`; supplier-provided identifier label/category where present (for example, VAT number); displayable condition; entry step; explicitly sourced correction boundary; per-dimension provenance and verification target. Never store the identifier value. |
| `documentNameEligibility` | Same independent state set; allowed addressee types limited to supplier-supported `individual` and/or `legal_entity`; relationships to `guest`, `booker`, and `cardholder` represented separately as `same_required`, `different_allowed`, or `not_provided` only when the supplier actually states them; entry/correction boundary; per-dimension provenance and verification target. Never store the requested name. |
| Provenance | Supplier label plus `rate`/`selected_stay` scope; policy/reference identifier and observed timestamp when available. A property-level policy may be context but cannot produce a positive selected-rate state. |
| Conflict | Conflict is dimension-specific and retains at least two normalized attributed statements. A conflict about the tax ID must not turn a known name rule into “unclear,” or vice versa. |
| Default | Missing, malformed, over-broad, property-only, or unsupported evidence becomes `not_provided` for that dimension. It must not change the inherited document status. |

`supported` means only that the identified issuer/source explicitly says the named category can be supplied for this selected rate/stay and flow. `unsupported` requires an explicit scoped negative. `conditional` requires a short displayable supplier condition. None of these states means tax-valid, reimbursable, deductible, employer-approved, or guaranteed to appear on the issued document.

## Testable design directives

### 1. Extend the shipped disclosure with two independent facts; do not add an overall verdict

When invoice intent is selected, retain the existing hierarchy and insert two rows after **Billing details** and before provenance/verification:

1. **Business or tax ID**
2. **Name on document**

Each row renders its own state even when the inherited invoice state differs. A confirmed invoice with both new fields missing must still say the invoice is expected and show both new rows as unknown. Do not add “business ready,” “expense ready,” a combined eligibility badge, or ranking/filter effects.

Acceptance test: a fixture with invoice `confirmed`, tax ID `supported`, and document name `not_provided` shows all three truths without collapsing them; changing one eligibility state does not change document availability, issuer, Deal Score, price, or CTA availability. At 375px rows remain one column with long source/identifier labels wrapping without horizontal overflow; at 1280px reading order remains identical.

### 2. Use exact independent state copy and reserve negative language for explicit evidence

UXDES must provide final copy using this matrix:

| State | Business or tax ID | Name on document |
| --- | --- | --- |
| Supported | **{Source} says you can provide {identifierLabel} {entryStep}.** | **{Source} says the document can name {individual / a legal entity / either an individual or legal entity} {entryStep}.** |
| Conditional | **{identifierLabel} support depends on {condition}.** | **The name allowed on the document depends on {condition}.** |
| Unsupported | **{Source} says {identifierLabel / a business or tax ID} cannot be added for this selected rate.** | **{Source} says {requested addressee type} cannot be named for this selected rate.** |
| Not provided | **The provider did not say whether a business or tax ID can be added.** | **The provider did not say whose name can appear on the document.** |
| Conflicting | **Supplied business or tax ID details conflict.** | **Supplied document-name details conflict.** |

For name relationships, show only sourced statements such as **The legal-entity name may differ from the guest name.** Unknown relationships use **The provider did not say whether this name may differ from the guest, booker, or cardholder.** Do not compress unknown relationships into “any name,” and do not use “payer name” unless the supplier itself defines that role.

Acceptance test: omission never produces `unsupported`; an unsupported tax-ID fixture does not negate a supported legal-entity-name fixture; a conflict in one row leaves the other row intact; all states remain understandable without color.

### 3. Attach timing, correction, provenance, and verification to the fact they qualify

Do not reuse the existing document-level `billingDetailsStep` as proof that either new field is accepted. Show entry timing in a row only when that row is `supported` or `conditional` and its source supplies the timing. Show correction copy only from an explicit sourced rule:

- **Provide this during booking; the provider did not say whether it can be changed later.**
- **The provider says this can be changed until {supplier-defined boundary}.**
- **The provider says this cannot be changed after {supplier-defined boundary}.**

Every eligibility row must retain its own source and selected-rate/stay scope. When a row is unknown, conditional, conflicting, or explicitly unsupported, its secondary instruction asks only the unanswered question and targets the responsible provider/property from sourced evidence: **Ask {issuer} whether it can add {identifierLabel} and use {requested name type} on the document before booking.** If no safe distinct destination exists, explain that the primary Continue action opens the external flow; do not create a second competing CTA or invent property contact details.

Acceptance test: two rows with different sources/timestamps remain separately attributed; a stale or property-only source cannot silently upgrade selected-rate eligibility; verification preserves the affiliate-marked provider URL byte for byte and does not send a request on the user's behalf.

### 4. Keep identity values out of expaify and test comprehension before handoff

This repair discloses categories only. Do not add inputs for company/legal name, personal name, address, VAT/tax number, email, cardholder, document upload, or free-text invoice instructions. The disclosure must not repeat any such values from a provider URL or analytics payload.

Run a moderated or unmoderated task with at least these four synthetic selected-rate cases:

1. invoice confirmed; VAT number and legal-entity name supported during booking;
2. invoice confirmed; tax ID unknown; individual-name support known;
3. receipt confirmed; property invoice and both eligibility dimensions conditional;
4. invoice confirmed; tax-ID sources conflict; document-name rule explicitly unsupported.

After each case, ask: (a) which document is expected and who issues it, (b) whether the required identifier can be supplied, (c) whose name may appear and whether it may differ from guest/booker/cardholder, (d) what remains unknown, and (e) whom to verify with. Primary success is the proportion answering all five from visible evidence without interpreting unknown as no or invoice availability as eligibility. Guardrails are time to answer, false “business-ready” conclusions, and disclosure-caused handoff abandonment. Keyboard-only completion and 375px readability are required, not separate optional studies.

Acceptance test: test fixtures contain categories and fictional supplier labels only, no real tax IDs or legal names; the correct response for every omitted dimension is “not provided,” not a guess.

### 5. Measure dimension coverage and explicit support intent with a privacy-safe allowlist

The analytics contract must be repaired before reporting production results. Extend readiness exposure with categorical fields only:

| Signal | Fire rule | Allowed properties |
| --- | --- | --- |
| Eligibility exposure | Existing sustained readiness-view rule (50% for 1 second, once per review) | inherited document status/source/scope; `taxIdState`; `documentNameState`; coarse `taxIdSourceClass`; coarse `documentNameSourceClass`; no values or URLs |
| Dimension verification | Immediately before a real verification destination opens | `dimension` (`tax_id` or `document_name`), dimension state, target role, coarse source; no hotel/property/person/company identifiers |
| Handoff | Existing continue click | `invoiceNeeded`, inherited readiness status, `taxIdState`, `documentNameState` after server allowlisting |
| Explicit return reason | Optional response after provider return or Back | fixed enum including `tax_id_unclear` and `document_name_unclear`; never free text and never inferred from return/abandonment |

Primary metric: independently sourced coverage for document availability, issuer, tax-ID eligibility, and document-name eligibility among invoice-sensitive review exposures, segmented by provider and dimension. Secondary metrics: correct comprehension in task testing, verification rate by missing dimension, and handoff rate after exposure. Guardrails: analytics rejection rate, explicit uncertainty return reasons, check errors, and false-ready comprehension. Generic return, back, or abandonment remains ambiguous.

Acceptance test: server tests prove every new event/property is explicitly allowlisted and enum-validated; payload tests reject company/person names, tax-ID values, email, hotel/offer IDs, full URLs, query strings, and free text. Until that repair ships, report no production baseline from the existing client emissions.

## State-model stress test

| Supplier evidence combination | Safe disclosure |
| --- | --- |
| Invoice confirmed; company and VAT fields supported during booking | Preserve invoice fact; show tax ID `supported` with supplier label/timing and legal-entity name `supported` only if separately stated. |
| Invoice confirmed; company field present; no tax-ID field | Document name may be `supported`; tax ID remains `not_provided`. |
| Tax-ID field accepted; no statement that it will appear on the issued document | Say the supplier accepts the field; do not say the document will contain it or is tax-valid. Verify fulfillment with the issuer. |
| Receipt can display client company; property invoice request is separate | Scope the name claim to the receipt only; do not transfer it to the property invoice. |
| Property may issue an invoice at its discretion | Inherited invoice status is conditional/not provided as sourced; eligibility fields do not upgrade availability. |
| Company name may differ from guest; cardholder relationship omitted | Show the guest relationship; keep cardholder relationship `not_provided`. |
| Tax-ID support explicitly denied; legal-entity name supported | Show the negative and positive independently; no combined verdict. |
| Supplier and property disagree about tax-ID support | Tax-ID `conflicting`; preserve any independently sourced document-name state. |
| Property-level policy says VAT IDs accepted; selected rate is silent | Selected-rate tax-ID state remains `not_provided`; property policy may appear only as clearly scoped context. |
| Evidence request errors | Transport/check error; do not replace either supplier eligibility state with `unsupported`. |

## Handoff to UXDES

UXDES should extend the shipped `/book` **Invoice & receipt** specification with the two independent rows above and cover: intent off; inherited loading/error; each eligibility dimension in supported, conditional, unsupported, not-provided, and conflicting states; mixed-state combinations; independent sources/timestamps; unknown guest/booker/cardholder relationships; long supplier-provided identifier labels; no correction rule; safe and absent verification destinations; 375px and 1280px layouts; keyboard/focus/live-region behavior; and malformed evidence degrading to unknown.

The design must provide final visible and accessible copy without adding data-entry fields, property-level claims, ranking/filter behavior, a business-readiness badge, tax guidance, or a new support product. DEV work will later be required for normalized per-dimension evidence, provider support, booking-context continuity, safe validation, and analytics allowlisting. Until a contracted supplier exposes selected-rate evidence, both new production dimensions remain `not_provided`.

## Blockers and out-of-scope findings

- **Supplier evidence blocker:** Hotellook, Booking.com Rapid API, and Hotelbeds adapters currently return no selected-rate business/tax-ID or document-name evidence. Positive or negative states cannot ship from current data without a contracted, approved capability.
- **Measurement blocker:** the production analytics endpoint rejects the shipped invoice events and augmented handoff properties because they are absent from its allowlist. Current client emissions do not establish a baseline.
- **Contract distinction:** Booking.com and Expedia references show prospective booking-integration capabilities. They do not authorize claims for current redirect/search offers, and an input field or transmitted request does not guarantee issuer fulfillment.
- Tax/VAT validity, jurisdiction rules, employer reimbursement, deductibility, invoice guarantees, billing-value collection/transmission, document storage/retrieval, property messaging, expense export, provider selection, and implementation are out of scope.
- No conflict was found with the non-negotiable provider, `Result<T>`, money, secrets, or affiliate contracts. This UXR brief changes documentation only.
