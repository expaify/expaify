---
id: UXR-TERMS-PRIVACY-001
stage: UXR
---

# Research: Terms of Service + Privacy Policy

## Current State
No legal pages exist. Footer renders no privacy/terms links. Stripe checkout URL for ToS is not set.

## Reference Patterns
**Triips.com:** Single-page ToS + Privacy, plain language, short. "Prices may change — always confirm at checkout" mirrors their disclaimer.
**Scott's Cheap Flights:** Clear "we find deals, you book elsewhere" positioning throughout ToS — directly applicable to expaify.

## Key legal points expaify must cover

### Terms of Service
1. Service description: deal discovery tool, not a booking agent
2. Subscription: 7-day trial, monthly/annual, auto-renew, cancel anytime
3. Price disclaimer: prices shown are detected from third-party data and may change — always confirm at checkout on the provider site
4. Affiliate disclosure: expaify earns commission on clicks to partner sites
5. No guarantee: we do not guarantee price availability, room availability, or deal accuracy
6. Account termination: we may suspend accounts that abuse the service

### Privacy Policy
1. Data collected: email, usage data, subscription status
2. Data processors: payment (Stripe), email (Resend), database (Neon/AWS)
3. Cookies: session cookie for auth only — no ad tracking
4. User rights: access, deletion on request via email
5. No sale of personal data
6. Retention: active accounts + 30 days after deletion

## Design directives
1. Single page each — no accordion, no tabs. Readable prose.
2. Last updated date at top
3. Contact email: legal@expaify.com (or dev@expaify.com until alias set)
4. Effective immediately
5. Link both from footer and from Stripe checkout config
