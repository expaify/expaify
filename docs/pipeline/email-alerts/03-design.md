# UXDES: Email Alerts — Design Spec

## Schema migration
```sql
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_alerted_at TIMESTAMPTZ;
```

## New files
- `lib/email/resend.ts` — Resend client singleton
- `lib/email/templates/DealAlert.tsx` — React Email template (single deal)
- `lib/email/templates/DailyDigest.tsx` — React Email template (deal list)
- `lib/email/sendDealAlert.ts` — send instant alert to one user for one deal
- `lib/email/sendDailyDigest.ts` — send digest to one user
- `app/api/alerts/digest/route.ts` — POST endpoint, bearer-protected, sends digests
- `.github/workflows/snapshot.yml` — add daily digest trigger (already exists, check it)

## Modified files
- `app/api/pipeline/run/route.ts` — call sendInstantAlerts after detectDealsForMarket
- `lib/db/schema.sql` — add last_alerted_at column

## Email template spec

### Subject lines

> **SUPERSEDED (2026-07-19).** The subject lines below, and the CTA specs in the body diagrams ("See this deal", per-card "Book now →", coral "See all deals"), are superseded by `docs/pipeline/email-alert-template/03-design.md` (UXDES-EMAIL-ALERT-TEMPLATE-01). Do not implement from this section.

- ~~Instant: `{hotelName} — {discountPct}% off in {city} 🏨`~~
- ~~Daily: `Your expaify deals for {date} — {n} hotel drops`~~

### DealAlert email body
```
[expaify.] (teal brand, Space Grotesk)

We found a deal for you

{hotelName}                    [−{n}%]
{city} · {checkInWindow}
★★★★

${dealPrice}/night   usually ${medianPrice}

[  See this deal  ]   (coral CTA button, full width)

Based on {snapshotCount} price checks · expaify never adds fees

─────────────────────────────
Manage alerts · Unsubscribe
expaify.com · © 2026 expaify
```

### DailyDigest email body
```
[expaify.]

Your deals for {date}
{n} hotel prices dropped today

For each deal (up to 5):
  {hotelName} — {city} — {discountPct}% off — ${dealPrice}/night
  [Book now →]

[  See all deals  ]  (coral CTA)

─────────────────────────────
Manage alerts · Unsubscribe
```

## Colors in email
- Background: #FAF7F2
- Brand teal: #0E5A54
- CTA coral: #FF6B4A (text white)
- Discount chip: #D9A441 bg, #412402 text
- Body text: #141210
- Muted text: #5C5852

## Rate limiting logic
- Instant: skip user if `last_alerted_at > NOW() - INTERVAL '4 hours'`
- Daily: skip user if `last_alerted_at::DATE = CURRENT_DATE`
- After send: `UPDATE subscriptions SET last_alerted_at = NOW() WHERE user_id = $1`

## Digest trigger
- `app/api/alerts/digest/route.ts` — same bearer auth as pipeline (`PIPELINE_SECRET`)
- `snapshot.yml` cron already exists — add digest call after snapshot job
