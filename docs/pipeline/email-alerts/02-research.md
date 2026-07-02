# UXR: Email Alerts — Research

## Current state
- `subscriptions` table has `alert_preference TEXT` (instant/daily/off) and `watchlist TEXT[]`
- No `last_alerted_at` column exists — need to add
- Resend SDK not installed — need `npm install resend`
- No email templates in codebase
- `/api/pipeline/run` exists — instant alerts should fire from there after deal detection
- A cron/scheduled job is needed for daily digests

## Email pattern analysis (Booking.com, Airbnb, Google Flights)
- Subject: clear deal identity + savings amount ("Hotel Miramar Rooftop — 54% off in Lisbon")
- Body: single deal card per instant alert, list for digest
- CTA: one big button → deal on /deals
- Footer: unsubscribe link, "why am I getting this" explanation
- Plain but branded — not heavy HTML, loads fast on mobile

## Directives
1. **Instant alert** — triggered inside `app/api/pipeline/run/route.ts` after `detectDealsForMarket`. For each newly-active deal: find all premium users with `alert_preference='instant'` and email them. Rate-limit: skip users who received an instant in the last 4 hours.
2. **Daily digest** — separate `app/api/alerts/digest/route.ts` endpoint (POST, bearer-protected). Finds all premium users with `alert_preference='daily'` who haven't been alerted today, sends top 5 active deals, updates `last_alerted_at`.
3. **Email template** — plain React Email: expaify logo, deal name + city + discount, price row, single "See deal" CTA button, footer.
4. **Schema addition** — `last_alerted_at TIMESTAMPTZ` on `subscriptions` table.
5. **Unsubscribe** — CTA in footer links to `/account` where preference can be changed to 'off'.
