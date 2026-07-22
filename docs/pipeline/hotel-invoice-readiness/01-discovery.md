# UXD-HOTEL-INVOICE-READINESS-01: Hotel Invoice And Receipt Readiness Discovery

Date: 2026-07-22  
Stage: UX Discovery  
Priority: P1  
Persona: Senior UX Strategist

## Problem Statement

A business traveler can reach an external hotel booking partner without knowing whether a usable invoice or receipt will be available, who will issue it, or when and where required billing details must be supplied, so they must risk an unreimbursable stay or abandon the rate to investigate outside expaify.

## Who Is Affected And Where

Travelers who need documentation for employer reimbursement, expense reporting, or business accounting are affected across the last three decision steps of the hotel flow:

1. **Hotel detail:** the expanded result explains price scope, rate source, provider handoff, and selected access evidence, but says nothing about invoice or receipt availability.
2. **Rate review:** `/book` identifies the rate source and the external booking partner, then explains that the partner confirms price, taxes, fees, availability, and cancellation policy. It does not state whether the partner or property issues the transaction document.
3. **Booking handoff:** **Continue to {partner}** opens the partner in a new tab. Only after leaving expaify might the traveler learn whether an invoice can be requested, whether only a payment receipt or booking confirmation is supplied, whether the property issues the document after the stay, and which billing details are required.
4. **Escalation or exit:** when the information remains unknown, expaify provides no invoice-specific confirmation path. The traveler can continue anyway or return to search, but cannot tell whom to contact or record that billing documentation caused the exit.

The problem is not that expaify must issue or validate tax documents. expaify does not take hotel payment in this flow. The problem is that an invoice-sensitive traveler cannot assess documentation readiness before crossing the external handoff boundary.

## Current-State Evidence

- **Invoice information is not representable.** `HotelOffer` in `lib/types.ts` carries hotel identity, location and quality evidence, nightly price, source, deeplink, and selected amenity evidence. It has no invoice availability, document type, issuer, billing-detail requirements, request timing, or contact-path field.
- **The active hotel adapter has no invoice evidence to normalize.** `HotelLookCacheEntry` in `lib/providers/hotellook.ts` contains property identity, location, starting price, photo, property type, and amenity evidence. It does not return a room-rate invoice policy or receipt issuer.
- **Invoice context is dropped from the review boundary because none exists upstream.** `BookingHotelContext` in `lib/booking/config.ts` preserves offer/provider identity, hotel name/location, nightly price, currency, price basis, and provider URL only.
- **The UI names the payment party but not the document issuer.** `HotelHandoffReview` in `app/book/BookingFlow.tsx` says that expaify hands the traveler off and the booking partner takes payment. Its confirmation summary covers total, taxes, fees, availability, and cancellation policy, but not invoices, receipts, booking confirmations, issuer identity, or required billing details.
- **Hotel detail has no earlier signal.** `HotelCard` in `app/components/HotelCard.tsx` enables **Review hotel** from valid money and a valid provider URL. Its expanded provider-handoff disclosure contains no billing-document status or escalation path.
- **Business intent is not captured.** The hotel search, offer, and booking-context contracts contain no trip-purpose or invoice-needed state, so business-intent stays cannot currently be segmented without asking the traveler at the point the information is useful.

Invoice-information coverage is therefore **0% of normalized hotel offers**: the product cannot distinguish “invoice available,” “receipt only,” “property-issued after stay,” “not available,” and “provider did not supply this information.” This is a coverage finding, not evidence that invoices are unavailable for every rate.

## Behavioral Baseline And Measurement Gap

The repository contains handoff events for page view, continue click, back click, and return after the provider tab was opened. However, `lib/analytics.ts` only writes them to `console.debug` in development. There is no production event destination, invoice-needed segment, billing-related reason capture, or provider booking-completion callback.

| Signal | Defensible current baseline | What must be measured before and after repair |
| --- | --- | --- |
| Invoice-information coverage | 0% representable | Share of reviewed hotel offers with a supplier-attributed availability state, issuer state, billing-detail timing, and escalation path; segment by provider |
| Billing-related exits | Not identifiable | Invoice-sensitive review views followed by **Back to search** or an explicit “billing information unavailable” response; never infer the reason from a generic exit alone |
| Handoff completion | Continue clicks exist only as development logs | `hotel_handoff_continue_clicked / hotel_handoff_viewed` for users who indicate invoice need, segmented by disclosure state and provider |
| Handoff return | Coarse return event exists only as a development log | Return after handoff plus an optional explicit reason; a return alone may mean comparison, price change, availability, policy, or invoice uncertainty |
| External booking/document outcome | Not observable | Provider callback or voluntary post-handoff confirmation, if a future partner contract supports it; do not label an outbound click as a completed booking or issued invoice |

The minimum viable measurement must identify invoice sensitivity without turning the search form into a business-travel profile or collecting legal billing data. A just-in-time, non-sensitive intent signal such as “I need an invoice or receipt” is sufficient for segmentation; company name, address, tax identifier, and payment details are not.

## Minimum Pre-Handoff Disclosure Boundary

Before the external CTA, an invoice-sensitive traveler needs four answers for the selected rate, each attributed to the party that supplied it:

1. **Document availability:** whether an invoice is confirmed available, another document such as a receipt is supplied instead, it is unavailable, or the provider did not provide the information.
2. **Expected issuer:** whether the booking provider or the property is expected to issue the document, or whether the issuer is unknown. expaify must be explicitly distinguishable as the comparison/handoff platform, not presented as the booking-document issuer.
3. **Billing-detail step:** whether the known issuer says billing details are entered during booking, requested from the property/provider later, or the requirement and timing are unknown. The disclosure may name supplier-documented categories, but expaify must not collect the values during search or review.
4. **Escalation path:** when any answer is unknown or conditional, a clear next step to verify with the responsible booking provider or property before committing, with the selected hotel/rate context preserved where the partner supports it.

These are decision requirements for UXR to validate against supplier capabilities and reference patterns, not permission to claim invoice validity, deductibility, recoverable tax, or jurisdiction-specific compliance.

## Constraints The Solution Must Respect

1. **No tax or acceptance guarantee.** Describe only supplier-provided document availability and process. Do not call a document tax-valid, VAT-compliant, reimbursable, deductible, or accepted by an employer; preserve an explicit `not_provided`/unknown state instead of inferring from silence.
2. **Issuer and provenance must stay distinct.** Keep expaify, booking provider, and property roles visibly separate; preserve the source and scope of every invoice claim through `lib/providers`, `Result<T>`, the selected `HotelOffer`, and the booking context. Existing integer-minor-unit money and affiliate-marked deeplink contracts must remain intact.
3. **Just-in-time, privacy-conscious disclosure.** Ask only whether documentation matters when that signal is needed to reveal or measure the disclosure. Do not collect company name, billing address, tax/VAT identifier, payment details, or other billing values before the responsible issuer requires them; keep the result, review, and escalation usable at 375px and desktop and understandable without color alone.

## Success Statement

This is solved when a first-time business traveler can determine before **Continue to {partner}** whether an invoice or alternative receipt is known to be available, who is expected to issue it, when billing details will be requested, and how to verify any unknown answer, without assuming expaify guarantees tax treatment or submitting billing data prematurely.

## UXR Handoff Focus

`UXR-HOTEL-INVOICE-READINESS-01` should:

1. Audit which invoice, receipt, issuer, and billing-detail fields current or prospective hotel suppliers actually return at property versus room/rate level, including how omission differs from confirmed unavailability.
2. Compare Booking.com and one similar external-booking flow at the interaction-pattern level: where invoice availability, issuer, billing-entry timing, and contact/escalation appear before payment.
3. Test the four-part minimum disclosure boundary against common models: provider collects payment and issues the document; property collects payment and issues it; provider supplies a receipt while the property supplies an invoice; issuer or availability is unknown.
4. Produce 3–5 testable directives for known, unavailable, conditional, conflicting, loading/error, and not-provided states, including exact provenance and non-guarantee copy rules.
5. Define a privacy-minimal measurement design for invoice-information coverage, invoice-sensitive exits, outbound handoff completion, and explicit post-handoff reasons without treating generic return behavior as proof of a billing failure.

## Out-Of-Scope Findings

- Determining tax deductibility, VAT/GST recovery, local fiscal-document validity, or employer reimbursement acceptance requires jurisdiction and organization-specific rules and is outside expaify's role.
- Collecting or transmitting company legal name, billing address, tax identifiers, payment details, or invoice instructions is outside this discovery and should remain with the responsible issuer unless a separately approved booking integration requires it.
- Building property messaging, document upload/storage, expense export, post-stay invoice retrieval, or a customer-support operation is not authorized by this repair ticket. UXR may identify an external provider/property verification path, but not expand it into a new support product.
- Existing handoff analytics are not production-backed. This discovery defines the necessary signals but does not implement analytics or claim a behavioral baseline that the repository cannot support.
