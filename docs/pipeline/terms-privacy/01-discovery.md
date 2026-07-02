---
id: UXD-TERMS-PRIVACY-001
stage: UXD
---

# Discovery: Terms of Service + Privacy Policy

## Problem Statement
expaify has no Terms of Service or Privacy Policy. This blocks paid signups legally — Stripe requires ToS before charging users, and any EU/California visitor triggers GDPR/CCPA obligations the moment we collect an email address.

## Who Is Affected
Every user who signs up or purchases. Also affects app store listings, affiliate program applications, and any investor/partner due diligence.

## Measurable Signal
- No /terms or /privacy routes exist
- Footer has no legal links
- Stripe checkout has no ToS URL configured
- Google OAuth consent screen requires a Privacy Policy URL

## Constraints
1. Must accurately describe what expaify does: deal discovery, no booking, prices confirmed by third-party marketplaces
2. Must not over-promise: we are not a booking agent, not a price guarantee service
3. Must reference Stripe, Resend, Neon (data processors) without naming them as security guarantees

## Success Statement
This is solved when a user completing Stripe checkout has read-accessible Terms and Privacy pages, and Google OAuth consent screen links to /privacy without a warning.
