import { render } from '@react-email/components'
import { getResend, FROM } from './resend'
import { DailyDigest } from './templates/DailyDigest'
import { query, withTransaction } from '../db/client'
import { isPremium, type SubscriptionStatus } from '../subscription'
import { sendQuietDay } from './sendQuietDay'

const BASE_URL = process.env.AUTH_URL ?? 'https://expaify.com'
const DEFAULT_MIN_DISCOUNT = 40
const MAX_DIGEST_DEALS_FREE = 2
const MAX_DIGEST_DEALS_PREMIUM = 8

export function maxDigestDeals(status: SubscriptionStatus): number {
  return isPremium(status) ? MAX_DIGEST_DEALS_PREMIUM : MAX_DIGEST_DEALS_FREE
}

type DigestRecipient = {
  userId: string
  email: string
  unsubscribeToken: string
  status: SubscriptionStatus
  watchlist: string[]
}

async function sendQuietDayIfEligible(recipient: DigestRecipient, city: string): Promise<boolean> {
  return withTransaction(async client => {
    const eligibility = await client.query<{ eligible: boolean; reset_window: boolean }>(
      `SELECT
         (last_quiet_day_sent_at IS NULL
           OR last_quiet_day_sent_at <= NOW() - INTERVAL '7 days'
           OR quiet_day_sent_count_7d < 2) AS eligible,
         (last_quiet_day_sent_at IS NULL
           OR last_quiet_day_sent_at <= NOW() - INTERVAL '7 days') AS reset_window
       FROM subscriptions
       WHERE user_id = $1 AND status = 'free'
         AND (last_quiet_day_sent_at IS NULL OR
           (last_quiet_day_sent_at AT TIME ZONE COALESCE(alert_timezone, 'America/New_York'))::DATE <
           (NOW() AT TIME ZONE COALESCE(alert_timezone, 'America/New_York'))::DATE)
       FOR UPDATE`,
      [recipient.userId],
    )
    const row = eligibility.rows[0]
    if (!row?.eligible) return false

    await sendQuietDay({ email: recipient.email, city, unsubscribeToken: recipient.unsubscribeToken })
    await client.query(
      `UPDATE subscriptions
       SET last_quiet_day_sent_at = NOW(),
           quiet_day_sent_count_7d = CASE WHEN $2 THEN 1 ELSE quiet_day_sent_count_7d + 1 END,
           updated_at = NOW()
       WHERE user_id = $1 AND status = 'free'`,
      [recipient.userId, row.reset_window],
    )
    return true
  })
}

export type DigestDealRow = {
  id: string
  hotel_name: string
  city: string
  stars: number | null
  photo_url: string | null
  discount_pct: number
  deal_price_cents: number
  median_price_cents: number
  check_in_window: string
  snapshot_count: number
}

export type DigestDelivery = {
  userId: string
  email: string
  unsubscribeToken: string
  status: SubscriptionStatus
  deals: DigestDealRow[]
  analyticsPath?: string
}

function cityProperty(cities: string[]): string {
  return cities.length > 0 ? [...new Set(cities)].sort().join(',') : 'everywhere'
}

export async function recordDigestSkipped(input: {
  status: SubscriptionStatus
  cities: string[]
  path?: string
}): Promise<void> {
  try {
    await query(
      `INSERT INTO analytics_events
        (event_id, session_id, event_name, occurred_at, path, properties)
       VALUES ($1, $2, 'alert_skipped', NOW(), $3, $4::jsonb)`,
      [
        crypto.randomUUID(),
        crypto.randomUUID(),
        input.path ?? '/cron/daily-digest',
        JSON.stringify({
          tier: isPremium(input.status) ? 'premium' : 'free',
          cities: cityProperty(input.cities),
          reason: 'no_qualifying_deals',
        }),
      ],
    )
  } catch (error) {
    console.warn('Daily digest skip analytics unavailable', error)
  }
}

export async function sendDigest(input: DigestDelivery): Promise<void> {
  const digestDeals = input.deals.map(d => ({
    id: d.id,
    hotelName: d.hotel_name,
    city: d.city,
    stars: d.stars,
    photoUrl: d.photo_url,
    discountPct: d.discount_pct,
    dealPriceCents: d.deal_price_cents,
    medianPriceCents: d.median_price_cents,
    checkInWindow: d.check_in_window,
    snapshotCount: d.snapshot_count,
    dealUrl: `${BASE_URL}/deals/${d.id}?ref=digest`,
  }))
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const html = await render(DailyDigest({
    deals: digestDeals,
    date,
    manageUrl: `${BASE_URL}/account#alerts`,
    unsubscribeUrl: `${BASE_URL}/api/alerts/unsubscribe?token=${input.unsubscribeToken}`,
  }))
  const sendResult = await getResend().emails.send({
    from: FROM,
    to: input.email,
    subject: `Your expaify deals for ${date} — ${digestDeals.length} hotel drops`,
    html,
  })
  if ('error' in sendResult && sendResult.error) throw new Error('Digest email delivery was rejected')

  try {
    await query(
      `INSERT INTO analytics_events
        (event_id, session_id, event_name, occurred_at, path, properties)
       VALUES ($1, $2, 'alert_sent', NOW(), $3, $4::jsonb)`,
      [crypto.randomUUID(), crypto.randomUUID(), input.analyticsPath ?? '/cron/daily-digest', JSON.stringify({
        tier: isPremium(input.status) ? 'premium' : 'free',
        cities: cityProperty(digestDeals.map(deal => deal.city)),
        deal_count: digestDeals.length,
        resend_message_id: sendResult.data?.id,
      })],
    )
  } catch (error) {
    console.warn('Daily digest analytics unavailable', error)
  }

  await query(
    `INSERT INTO deal_alert_deliveries (user_id, deal_id, delivery_type)
     SELECT $1, unnest($2::uuid[]), 'digest'
     ON CONFLICT (user_id, deal_id) DO NOTHING`,
    [input.userId, digestDeals.map(d => d.id)]
  )
  await query(`UPDATE subscriptions SET last_alerted_at = NOW(), updated_at = NOW() WHERE user_id = $1`, [input.userId])
}

export async function runDailyDigest(): Promise<{ recipients: number; skipped: number }> {
  if (!process.env.RESEND_API_KEY) return { recipients: 0, skipped: 0 }

  const res = await query<DigestRecipient>(
    `SELECT s.user_id AS "userId",
            u.email,
            s.alert_unsubscribe_token::TEXT AS "unsubscribeToken",
            s.status
            , s.watchlist
     FROM subscriptions s
     JOIN users u ON u.id = s.user_id
     WHERE s.alert_preference IN ('daily', 'instant')
       AND u.email IS NOT NULL
       AND (
         s.status IN ('trialing', 'active')
         OR (s.status = 'free' AND s.alert_preference = 'daily')
       )
       AND EXTRACT(HOUR FROM (NOW() AT TIME ZONE COALESCE(s.alert_timezone, 'America/New_York'))) = 9
       AND (
         s.last_alerted_at IS NULL OR
         (s.last_alerted_at AT TIME ZONE COALESCE(s.alert_timezone, 'America/New_York'))::DATE <
         (NOW() AT TIME ZONE COALESCE(s.alert_timezone, 'America/New_York'))::DATE
       )`,
    []
  )

  if (res.rows.length === 0) return { recipients: 0, skipped: 0 }

  let sent = 0
  let skipped = 0

  for (const recipient of res.rows) {
    try {
      const maxDeals = maxDigestDeals(recipient.status)
      const deals = await query<DigestDealRow>(
        `SELECT
           d.id,
           d.hotel_name,
           m.city,
           d.stars,
           d.photo_url,
           d.discount_pct,
           d.deal_price_cents,
           d.median_price_cents,
           d.check_in_window,
           d.snapshot_count
         FROM deals d
         JOIN tracked_markets m ON m.id = d.market_id
         JOIN subscriptions s ON s.user_id = $1
         WHERE d.status = 'active'
           AND d.is_mock = false
           AND (d.expires_at IS NULL OR d.expires_at > NOW())
           AND d.check_in_date >= CURRENT_DATE
           AND d.discount_pct >= COALESCE(s.alert_min_discount, $2)
           AND (COALESCE(array_length(s.watchlist, 1), 0) = 0 OR m.city = ANY(s.watchlist))
           AND NOT EXISTS (
             SELECT 1 FROM deal_alert_deliveries dad
             WHERE dad.user_id = $1 AND dad.deal_id = d.id
           )
         ORDER BY d.discount_pct DESC, d.first_seen DESC
         LIMIT $3`,
        [recipient.userId, DEFAULT_MIN_DISCOUNT, maxDeals]
      )

      if (deals.rows.length === 0) {
        await recordDigestSkipped({ status: recipient.status, cities: recipient.watchlist, path: '/cron/daily-digest' })
        const city = recipient.watchlist[0]
        if (!isPremium(recipient.status) && city) {
          if (await sendQuietDayIfEligible(recipient, city)) {
            sent++
            continue
          }
        }
        skipped++
        continue
      }
      await sendDigest({ ...recipient, deals: deals.rows })

      sent++
    } catch {
      // Don't fail the whole batch if one email errors
      skipped++
    }
  }

  return { recipients: sent, skipped }
}
