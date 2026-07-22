# UXR-HOTEL-INVOICE-READINESS-01: Hotel Invoice And Receipt Readiness Research

Date: 2026-07-22  
Stage: UX Research  
Priority: P1  
Upstream: `docs/pipeline/hotel-invoice-readiness/01-discovery.md`

## Research conclusion

The discovery problem is confirmed. expaify's active hotel path can name a rate source and, sometimes, the destination booking partner, but it cannot represent whether the selected rate produces an invoice or receipt, which party issues each document, when billing details are supplied, or how an invoice-sensitive traveler should verify an unknown. The current disclosure therefore stops one decision short of a safe business-travel handoff.

This is a data-provenance gap before it is a presentation gap. Invoice readiness varies by the selected rate's payment/collection model and booking stage. It must not be inferred from the hotel, provider brand, deeplink host, or the presence of a confirmation page. The current Hotellook aggregate response provides none of the evidence needed to make a positive or negative claim, so every current offer is `not_provided`, not `unavailable`.

The repair should add a just-in-time, supplier-attributed disclosure on hotel review for travelers who say documentation matters. It should preserve the provider CTA, distinguish invoice from receipt, identify the expected issuer only when supplied, and give an explicit verification path for every incomplete or conflicting state. It must not make expaify an invoice issuer, collect company/tax details, or promise tax validity or employer acceptance.

## Scope and method

This brief uses three evidence classes and does not merge them:

1. **Current-code evidence:** direct inspection of the active search adapter, normalized types, hotel card, booking-context serializer, handoff UI, analytics helper, and relevant tests in this worktree.
2. **Supplier capability evidence:** first-party Booking.com Demand API and Expedia Rapid documentation. These are prospective capability references, not claims about data available through the current Hotellook integration.
3. **Interaction-pattern guidance:** implications that can be defensibly derived from those supplier models. No live consumer checkout was treated as stable API evidence, and no visual-style imitation is proposed.

No user interviews, production analytics, supplier contract review, or live partner checkout instrumentation were available. Behavioral impact remains a measurement hypothesis.

## Current implementation audit

### End-to-end evidence path

| Boundary | What current code does | Invoice-readiness delta |
| --- | --- | --- |
| Provider selection | `app/api/search/route.ts:172-180` calls only `hotellook.searchHotels`; successful hotel data is labeled `hotellook` at `app/api/search/route.ts:396-407`. | There is no second active hotel supplier or rate-detail call from which to reconcile document evidence. |
| Raw provider shape | `HotelLookCacheEntry` in `lib/providers/hotellook.ts:10-31` contains property identity, location, price-from, photo, property type, and amenity evidence. | No payment model, document type, issuer, billing-detail timing, request channel, or claim provenance exists in the response shape. |
| Normalization | `lib/providers/hotellook.ts:460-501` maps an aggregate `priceFrom` record to a `HotelOffer`, then builds an affiliate redirect to a Hotellook hotel page (`:417-419`, `:486`). | The offer is not a room/rate booking contract. Nothing supports a selected-rate invoice claim, and the eventual booking partner may remain unresolved until redirect. |
| Shared contract | `HotelOffer` in `lib/types.ts:190-206` carries property, price, deeplink, source, quality, location, and amenity evidence. Existing evidence states at `:119-147` apply to amenities, not billing documents. | Invoice readiness cannot survive provider normalization because it is not representable. Reusing amenity semantics would blur document type, issuer, and payment-model scope. |
| Result card | `HotelCard` enables review from valid money plus a valid URL (`app/components/HotelCard.tsx:715-725`). Its confirmation copy covers final total, taxes, fees, availability, cancellation, and terms (`:729-732`). | No earlier indication tells invoice-sensitive travelers that readiness is known, unknown, or needs verification. Eligibility currently says nothing about billing documentation. |
| Review context | `BookingHotelContext` in `lib/booking/config.ts:31-43`, validation at `:377-415`, and serialization at `:470-506` preserve offer/provider identity, location, nightly price, basis, and provider URL. | Even if a future adapter obtained invoice evidence, the local `/book` boundary would drop it. Query-string transport also requires a deliberate minimal/provenance-safe shape. |
| Responsibility disclosure | `HotelHandoffReview` says the booking partner takes payment (`app/book/BookingFlow.tsx:695-704`) and separates “expaify shows” from what the partner confirms (`:725-733`). | This is a strong reusable hierarchy, but payment collector is not necessarily invoice issuer. The page must not derive issuer from `takes payment`. |
| Verification pattern | Special-request guidance at `app/book/BookingFlow.tsx:735-765` explains what expaify does not send and directs the traveler to the partner/property confirmation path. | The interaction pattern is reusable, but there is no invoice-specific status, timing, or responsible-party contact path. A generic confirmation/itinerary is not evidence a usable invoice exists. |
| Handoff | The CTA opens the affiliate URL in a new tab with sponsored rel metadata (`app/book/BookingFlow.tsx:766-780`). | The handoff remains usable, but it happens without a billing-document readiness check. Affiliate behavior must remain unchanged. |
| Measurement | Handoff view, continue, back, and return events exist (`app/book/BookingFlow.tsx:628-693`, `:718`), but `lib/analytics.ts:1-7` emits only `console.debug` in development. Existing tests cover non-sensitive handoff/request events. | There is no production baseline, invoice-needed segment, readiness exposure, verification action, or explicit billing-related exit/return reason. A return cannot be interpreted as invoice failure. |

### Supplier coverage verdict

Current normalized invoice-information coverage is **0%**. This means “not supplied by the current provider,” not “no invoice available.”

| Provider or path | Current status in this repo | Invoice/receipt capability supported by inspected evidence | Safe normalized state today |
| --- | --- | --- | --- |
| Hotellook cache search | Only active `HotelProvider`; property-level aggregate/redirect path | None in the inspected adapter response shape; no selected room/rate payment model | `not_provided`, issuer `unknown`, timing `unknown` |
| Booking.com destination link | Possible downstream host in tests, not a direct Demand API integration | First-party Demand API can expose rate payment timing; receipt generation is a booking/order capability in specific payment flows | No claim from host alone; `not_provided` until selected-rate supplier evidence exists |
| Expedia Rapid | Not integrated as `HotelProvider` in this repo | First-party Rapid supports explicit collection-model flags and post-booking receipt/invoice workflows | Prospective only; no current expaify claim |
| Other redirect partner | Can be hidden behind the affiliate redirect | No inspected contract | `not_provided`; identify the partner only when the final destination can be safely resolved |

The code has no conflict with the non-negotiable money, `Result<T>`, provider-boundary, secret, or affiliate contracts. A future implementation must extend those contracts rather than bypass them.

## Reference-pattern comparison

### Booking.com Demand API: model payment first, receipt later

Booking.com's current Demand API treats payment timing and responsibility as structured rate/booking facts. Accommodation can be paid online or at the property, and payment timing can be at booking, later online, or at check-in. This is important because issuer guidance cannot be derived from a property name or generic “book with Booking.com” label. [Booking.com: payments overview](https://developers.booking.com/demand/docs/payments/overview), [payment timings](https://developers.booking.com/demand/docs/payments/payments-timings)

The API explicitly separates redirect, full booking, and post-booking integrations. In the booking tutorial, `include_receipt` is an order-creation option for a supported `pay_online_now` flow; order reporting may later expose `receipt_url`. Receipt evidence therefore appears at a specific payment/booking stage, not as a universal property amenity. [Booking.com: integration types](https://developers.booking.com/demand/docs/getting-started/overview), [accommodation tutorial](https://developers.booking.com/demand/docs/accommodations/accommodation-tutorial), [order details](https://developers.booking.com/demand/docs/orders-api/order-details)

**Pattern guidance, not a current-code fact:** show selected-rate payment/document evidence at the review boundary; preserve `not_provided` in redirect-only flows; never turn “Booking.com supports receipts in some order flows” into “this rate includes an invoice.”

### Expedia Rapid: distinguish document, collector, and issuer

Expedia Rapid explicitly separates booking receipts from invoices and maps their source to the payment model. For Property Collect, the property supplies both the booking receipt and tax invoice for its services. For Updated Expedia Collect, Expedia supplies a booking receipt while the property supplies an invoice. For Expedia Collect, Expedia supplies the booking receipt and a property invoice may be discretionary. [Expedia Group: invoices and booking receipts](https://developers.expediagroup.com/rapid/lodging/manage-booking/booking-receipts?locale=en_US)

Rapid also places optional company name/address and receipt-email configuration in its booking request, while document retrieval is post-booking. Its itinerary response can expose a receipt link, and its manage-booking flow can expose a property message-center link. This demonstrates that billing values belong with the responsible booking integration and that a later retrieval/contact path is a separate state from pre-handoff readiness. [Expedia Group: invoices and booking receipts](https://developers.expediagroup.com/rapid/lodging/manage-booking/booking-receipts?locale=en_US), [Rapid Lodging overview](https://developers.expediagroup.com/rapid/lodging)

**Pattern guidance, not a current-code fact:** render receipt and invoice as separate outcomes, name the responsible party per document, state when the traveler supplies billing details, and provide a supplier/property verification path when the outcome is conditional.

### Exact current-versus-reference delta

| Decision question | Current expaify | Reference capability pattern | Delta to close |
| --- | --- | --- | --- |
| What document is expected? | Not represented | Receipt and invoice are distinct outcomes | Preserve type; do not use “invoice/receipt” as if interchangeable once evidence is known |
| Who issues it? | Booking partner is said to take payment | Issuer varies by payment model and document | Add per-document expected issuer; keep collector and issuer separate |
| When are billing details supplied? | No state or instruction | Booking integrations accept billing details at a defined booking step; property-issued documents may require later contact/check-out action | Add timing/action enum; do not collect the details in expaify |
| What happens if unknown? | Continue or back | Supplier booking/retrieval/contact channels are stage-specific | Add a verification action tied to the responsible party while preserving the hotel/rate context |
| What does omission mean? | UI is silent | Capabilities are endpoint-, contract-, and payment-model-specific | Render “provider did not supply this information,” never “unavailable” |

## Required evidence model for UXDES/DEV

The design must assume a dedicated, rate-scoped model rather than stretching amenity fields. Exact implementation naming may change, but these semantics must survive end to end:

| Field | Required values/behavior |
| --- | --- |
| `scope` | `rate` or `selected_stay`; property-only evidence cannot confirm a selected-rate document outcome |
| `status` | `confirmed`, `conditional`, `unavailable`, `not_provided`, `conflicting`; transport/check failure is a separate UI state, not supplier `unavailable` |
| `documentTypes` | zero or more of `invoice`, `receipt`, `booking_confirmation`; never relabel one type as another |
| `issuerByDocument` | `booking_provider`, `property`, `split`, or `unknown`, with a displayable issuer name when supplied |
| `billingDetailsStep` | `during_partner_booking`, `after_booking_contact_provider`, `after_booking_contact_property`, `at_checkout`, `not_required`, or `unknown` |
| `source` | supplier/provider label, source record or policy identifier where available, fetched/observed timestamp, and evidence scope |
| `verificationTarget` | supplier/property URL or instruction that preserves selected hotel/rate context where the supplier supports it; never an invented expaify support promise |

`confirmed` means the supplier explicitly supports the stated document/process for the selected rate. `unavailable` requires an explicit supplier statement. `conditional` requires the condition to be displayable. `conflicting` means two attributed inputs disagree; expaify must show neither as authoritative. `not_provided` is the default for omission, including every current Hotellook offer.

## Testable design directives

### 1. Ask for intent at review, then expose one decision block before the CTA

Place a non-sensitive control on `/book`, after the selected hotel/rate summary and before **Continue to {partner}**: **I need an invoice or receipt for this stay**. It must be keyboard-operable, have a visible focus state, persist for the current review session, and default unchecked. Do not add company name, address, tax ID, email, payment, or expense-policy fields.

When selected, reveal an **Invoice & receipt** block before the provider CTA. Reading order is: document availability → expected issuer → when/where billing details are supplied → verification action → non-guarantee. On 375px these are one column with no side-by-side fact cards; the provider CTA remains reachable and full-width. The state must not be communicated by color alone.

Acceptance test: with the control off, no document claim is implied; with it on, all four decision questions are visible before the outbound CTA and focus remains on the control rather than jumping unexpectedly.

### 2. Render exact, exhaustive states and never promote omission to unavailability

UXDES must specify these visible states with final copy:

| State | Required lead copy | Required behavior |
| --- | --- | --- |
| Confirmed invoice | **Invoice expected from {issuer}.** | Name when details are supplied and the evidence source/scope. Do not say “tax-valid,” “reimbursable,” or “guaranteed accepted.” |
| Confirmed receipt only | **{issuer} provides a payment receipt; an invoice is not confirmed.** | Keep “receipt” and “invoice” distinct. Offer invoice verification if needed. |
| Conditional | **Invoice availability depends on {displayable condition}.** | State the known issuer/timing; give a verification action. If the condition cannot be explained, degrade to unclear/conflicting. |
| Explicitly unavailable | **{source} states that an invoice is not available for this rate.** | Render only from explicit rate-scoped supplier evidence; preserve CTA and offer a receipt/verification path if one is supplied. |
| Not provided | **{source} did not provide invoice or receipt information for this rate.** | This is the default for current Hotellook offers. Show **Check with {partner/property} before booking**; do not use a positive/negative status badge. |
| Conflicting | **Invoice information is unclear because the supplied details conflict.** | Attribute the conflicting parties without choosing a winner; direct verification to the party taking the booking/payment. |
| Loading | **Checking invoice and receipt information…** | Use `role="status"`; do not remove or disable the provider CTA solely because the check is pending. |
| Check error | **Invoice and receipt information could not be checked.** | Do not show `unavailable`; give retry when an actual check can be retried and retain a direct verification action. |

Acceptance tests must assert that missing fields never produce `available` or `unavailable`, loading/error never erase the selected hotel summary, and each state remains understandable in text with CSS colors disabled.

### 3. Separate expaify, payment collector, receipt issuer, and invoice issuer

Extend the existing two-party responsibility comparison into explicit roles only when evidence supports them:

- **expaify:** compares the rate and sends the traveler to the booking partner; does not take hotel payment or issue booking documents.
- **Booking/payment party:** named only from a resolved, trusted partner identity or supplier evidence.
- **Receipt issuer:** named per selected-rate payment model.
- **Invoice issuer:** named independently; it may be the property even when the provider supplies a receipt.

Required non-guarantee copy: **Document availability and issuer are based on information from {source}. Confirm required format and billing details with the issuer; expaify does not guarantee tax or employer acceptance.**

Acceptance test: no UI branch derives issuer from `partnerHost`, `source`, “takes payment,” property name, or receipt availability. Unknown parties render as **booking partner**, **property**, or **issuer not provided**, never as a guessed brand.

### 4. Make verification an actionable secondary path without blocking booking

For `not_provided`, `conditional`, `conflicting`, `unavailable`, and check-error states, show one contextual secondary action immediately above the primary provider CTA: **Check invoice details with {partner}** when a safe partner destination is known, otherwise **Check invoice details during booking**. Add supporting text for property-issued cases: **If the property issues the invoice, use the contact details in your booking confirmation before your stay or ask at checkout, as the provider instructs.**

The verification action may reuse the affiliate-marked provider deeplink and open in a new tab; it must not construct an unverified property contact URL, strip affiliate parameters, claim that expaify sent a request, or create a new support/messaging product. If the same URL serves both verify and continue, labels must explain that both enter the external booking flow rather than presenting two visually competing primary buttons.

Acceptance test: every incomplete state has a next step; keyboard activation appropriate to the rendered control and new-tab cues are announced; the original affiliate URL is byte-for-byte preserved; primary booking remains available unless existing price/link validation disables it.

### 5. Measure exposure and explicit intent, not inferred failure

Instrumentation must use only coarse, non-sensitive properties and a real production destination before any baseline is reported:

| Event | Fire rule | Allowed properties |
| --- | --- | --- |
| `hotel_invoice_need_changed` | User explicitly selects/deselects the intent control | `needed`, `source`, `partnerNamed` |
| `hotel_invoice_readiness_viewed` | Block is at least 50% visible for 1 second, once per review | `status`, `documentTypes`, `invoiceIssuerRole`, `receiptIssuerRole`, `billingDetailsStep`, `source`, `scope` |
| `hotel_invoice_verification_clicked` | Immediately before the verification destination opens | Same categorical fields plus `targetRole`; no URL, hotel name, offer ID, company data, or query string |
| Existing `hotel_handoff_continue_clicked` | Existing rule | Add only `invoiceNeeded` and `invoiceReadinessStatus` |
| `hotel_handoff_exit_reason_submitted` | Optional explicit response after Back/return | Enum including `invoice_information`; never infer from back/return alone |

Primary metric: readiness coverage among invoice-sensitive review views, segmented by supplier and state. Secondary metric: provider handoff rate after readiness exposure. Guardrails: billing-related explicit exits, check-error rate, and verification clicks that never reach a handoff. A generic tab return remains ambiguous and must not count as a billing failure or completed booking.

Acceptance test: analytics payloads contain no company name, billing address, tax ID, email, payment data, property name, full deeplink, query string, or free text; tests prove one sustained-exposure event and no event from simple render or brief visibility.

## State-model stress test

| Common model | Safe disclosure result |
| --- | --- |
| Provider collects and explicitly issues invoice | Confirm invoice, provider issuer, documented billing-detail step, supplier provenance |
| Property collects and explicitly issues invoice | Confirm invoice, property issuer, property-contact/checkout timing as supplied |
| Provider supplies receipt; property may supply invoice | Confirm receipt only; invoice `conditional` or `not_provided` based on evidence; name issuers separately |
| Provider and property evidence disagree | `conflicting`; show both attributions, choose neither, verify with booking/payment party |
| Supplier explicitly says no invoice | `unavailable`; do not generalize beyond selected rate and stay |
| Supplier omits the field | `not_provided`; never `unavailable` |
| Evidence request times out | UI check error; underlying supplier availability remains unknown |
| Property-level policy exists but rate differs/unknown | Do not confirm; show property policy as context only and selected-rate status `not_provided` or `conditional` |

## Handoff to UXDES

UXDES should turn these directives into every required state for `/book`: default intent-off, intent-on with all eight evidence/check states, mobile 375px, desktop 1280px, keyboard/focus, long partner/issuer names, unresolved partner identity, missing verification destination, and resolved partner/property paths. It should reuse existing review tokens and hierarchy, preserve the hotel summary and affiliate CTA, and provide final visible and accessible copy without adding a search-form business profile.

DEV work will be required after UI specification because invoice evidence needs a dedicated normalized type, provider adapter support, booking-context continuity, safe validation, and production analytics. Until a supplier contract supplies selected-rate evidence, the honest production state remains `not_provided`.

## Blockers and out-of-scope findings

- **Supplier evidence blocker:** the active Hotellook cache path does not provide selected-rate payment or document fields. Positive invoice/receipt states cannot be populated without a contracted supplier capability or an approved rate-detail integration.
- **Measurement blocker:** `lib/analytics.ts` has no production event sink, so current event counts cannot establish a behavioral baseline.
- **Partner-resolution limitation:** the Hotellook affiliate redirect may conceal the final booking party at review time; issuer must remain unknown unless a trusted source resolves it.
- Tax validity, VAT/GST recovery, deductibility, employer acceptance, legal document review, and jurisdiction-specific copy remain out of scope.
- Collecting/transmitting billing identity, building property messaging/support, storing documents, expense export, and post-stay document retrieval remain out of scope without a separately approved feature and supplier contract.
