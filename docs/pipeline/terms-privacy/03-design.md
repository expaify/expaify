---
id: UXDES-TERMS-PRIVACY-001
stage: UXDES
---

# Design Spec: Terms of Service + Privacy Policy

## Layout (both pages identical structure)
- Nav: same LandingNav component
- Max-width: 760px centered, px-5, py-12
- h1: font-display 36px bold, ink
- Last updated caption: 13px ink-faint, mt-1 mb-10
- Sections: h2 font-display 20px bold ink, mt-10 mb-3
- Body: 15px ink-soft, leading-relaxed
- Links within prose: teal color, underline
- Footer: same site footer with legal links

## Sections — Terms of Service (/terms)

**h1:** Terms of Service  
**Last updated:** July 2, 2026

1. **What expaify is** — We track hotel prices across 20 destinations and alert members when a price drops significantly below its historical average. We are a deal discovery service. We do not sell hotel rooms, process bookings, or hold any payment for travel.

2. **Your subscription** — Premium membership is billed monthly ($12/mo) or annually ($96/yr). A 7-day free trial applies to new subscribers. Your card is not charged during the trial. Cancel before day 7 and you owe nothing. After the trial, your subscription renews automatically until canceled. Cancel anytime from your account page.

3. **Prices and availability** — Prices shown on expaify are detected from third-party data sources and reflect prices observed at the time of detection. Prices change frequently. expaify makes no guarantee that a price shown will be available when you visit the booking site. Always confirm price and availability at checkout on the provider site.

4. **Affiliate relationships** — expaify earns a commission when you click through to partner booking sites (Expedia, Booking.com, Kiwi, Trip.com). This does not affect the price you pay. We only surface deals we believe are genuine based on historical data.

5. **Acceptable use** — You may not scrape, resell, or reproduce expaify deal data. One account per person. We may suspend accounts that abuse the service or attempt to circumvent the paywall.

6. **Termination** — We may terminate your account for violations of these terms. You may cancel at any time. Upon termination, your data is retained for 30 days then deleted.

7. **Disclaimer of warranties** — expaify is provided as-is. We make no warranty of uninterrupted service, price accuracy, or deal availability.

8. **Contact** — questions@expaify.com

---

## Sections — Privacy Policy (/privacy)

**h1:** Privacy Policy  
**Last updated:** July 2, 2026

1. **What we collect** — Email address (for auth and alerts), subscription status, alert preferences, city watchlist, and basic usage data (pages visited, deals clicked).

2. **How we use it** — To send deal alerts you opted into, to manage your subscription, and to improve the service. We do not use your data for advertising.

3. **Data processors** — We use Stripe (payments), Resend (email), and Neon (database hosted on AWS). Each has their own privacy policy. We do not sell your data to any third party.

4. **Cookies** — We use a single session cookie for authentication. No advertising cookies, no third-party trackers.

5. **Your rights** — You may request a copy of your data or ask for deletion by emailing questions@expaify.com. We will respond within 30 days.

6. **Retention** — We retain your data while your account is active and for 30 days after deletion.

7. **Children** — expaify is not directed at users under 16. We do not knowingly collect data from minors.

8. **Changes** — We will notify you of material changes via email before they take effect.

9. **Contact** — questions@expaify.com

---

## Footer update
Add to existing footer (both columns):
- "Terms" → /terms
- "Privacy" → /privacy

## Stripe ToS URL
Set `terms_of_service_url: 'https://expaify.com/terms'` in Stripe checkout session config.
