import { render } from '@react-email/components'
import { getResend, FROM } from './resend'
import { DailyDigest } from './templates/DailyDigest'
import { query } from '../db/client'

const BASE_URL = process.env.AUTH_URL ?? 'https://expaify.com'
const DEFAULT_MIN_DISCOUNT = 40
const MAX_DIGEST_DEALS = 8

type DigestRecipient = {
  userId: string
  email: string
  unsubscribeToken: string
}

type DigestDealRow = {
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

export async function runDailyDigest(): Promise<{ recipients: number; skipped: number }> {
  if (!process.env.RESEND_API_KEY) return { recipients: 0, skipped: 0 }

  const res = await query<DigestRecipient>(
    `SELECT s.user_id AS "userId",
            u.email,
            s.alert_unsubscribe_token::TEXT AS "unsubscribeToken"
     FROM subscriptions s
     JOIN users u ON u.id = s.user_id
     WHERE s.alert_preference IN ('daily', 'instant')
       AND u.email IS NOT NULL
       AND s.status IN ('trialing', 'active')
       AND EXTRACT(HOUR FROM (NOW() AT TIME ZONE COALESCE(s.alert_timezone, 'America/New_York'))) = 9
       AND (
         s.last_alerted_at IS NULL OR
         (s.last_alerted_at AT TIME ZONE COALESCE(s.alert_timezone, 'America/New_York'))::DATE <
         (NOW() AT TIME ZONE COALESCE(s.alert_timezone, 'America/New_York'))::DATE
       )`,
    []
  )

  if (res.rows.length === 0) return { recipients: 0, skipped: 0 }

  const resend = getResend()
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  let sent = 0
  let skipped = 0

  for (const recipient of res.rows) {
    try {
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
           AND d.first_seen >= NOW() - INTERVAL '24 hours'
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
        [recipient.userId, DEFAULT_MIN_DISCOUNT, MAX_DIGEST_DEALS]
      )

      const digestDeals = deals.rows.map(d => ({
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
        dealUrl: `${BASE_URL}/deals/${d.id}`,
      }))

      if (digestDeals.length === 0) {
        skipped++
        continue
      }

      const html = await render(
        DailyDigest({
          deals: digestDeals,
          date,
          manageUrl: `${BASE_URL}/account#alerts`,
          unsubscribeUrl: `${BASE_URL}/api/alerts/unsubscribe?token=${recipient.unsubscribeToken}`,
        })
      )

      await resend.emails.send({
        from: FROM,
        to: recipient.email,
        subject: `Your expaify deals for ${date} — ${digestDeals.length} hotel drops`,
        html,
      })

      await query(
        `INSERT INTO deal_alert_deliveries (user_id, deal_id, delivery_type)
         SELECT $1, unnest($2::uuid[]), 'digest'
         ON CONFLICT (user_id, deal_id) DO NOTHING`,
        [recipient.userId, digestDeals.map(d => d.id)]
      )

      await query(
        `UPDATE subscriptions SET last_alerted_at = NOW(), updated_at = NOW() WHERE user_id = $1`,
        [recipient.userId]
      )

      sent++
    } catch {
      // Don't fail the whole batch if one email errors
      skipped++
    }
  }

  return { recipients: sent, skipped }
}
