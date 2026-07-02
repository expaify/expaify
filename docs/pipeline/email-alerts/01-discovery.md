# UXD: Email Alerts — Discovery

## Pain point
Premium users have no way to receive deal notifications — they must manually check /deals. The account page shows an alert preference selector (instant/daily/off) but nothing actually sends email. A subscriber who set "instant alerts" gets nothing when a new deal appears.

## Who is affected
All premium users (trialing or active) with alert_preference ≠ 'off'. The break is at the delivery step: preference is saved to DB but no job reads it.

## Measurable signal
- `subscriptions.alert_preference` column exists and is set by users via /account
- No email template exists
- No job reads the deals table and sends alerts
- Resend API key is configured but never called

## Constraints
1. Credentials env-only: `RESEND_API_KEY`, `EMAIL_FROM`
2. Never send to free users (check `isPremium(status)` before send)
3. Daily digest: send at most once per day per user — track `last_alerted_at`
4. Instant: send within the pipeline run when a new deal is flagged
5. No third-party template engine — React Email via Resend's SDK

## Success statement
Solved when a premium user with `alert_preference='instant'` receives a clean email within minutes of a new deal being detected, and a `daily` user receives a digest email once per day listing all active deals.
