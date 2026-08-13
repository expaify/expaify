import { render } from '@react-email/components'
import { getResend, FROM } from './resend'
import { FreeTierTeaser } from './templates/FreeTierTeaser'
import { query } from '../db/client'
import { getFreeUnlockedDealIds } from '../paywall'

const BASE_URL = process.env.AUTH_URL ?? 'https://expaify.com'

type TeaserRecipient = {
  userId: string
  email: string
  unsubscribeToken: string
}

type TeaserDealRow = {
  hotel_name: string
  city: string
  photo_url: string | null
  discount_pct: number
  locked_deal_count: number
}

export async function runFreeTierTeaser(): Promise<{ recipients: number; skipped: number }> {
  if (!process.env.RESEND_API_KEY) return { recipients: 0, skipped: 0 }

  // A subscription timestamp fits this campaign better than deal_alert_deliveries:
  // that table's unique (user_id, deal_id) key would make a teaser collide with a
  // premium alert and cannot represent the campaign's once-per-week cadence.
  const res = await query<TeaserRecipient>(
    `SELECT s.user_id AS "userId",
            u.email,
            s.alert_unsubscribe_token::TEXT AS "unsubscribeToken"
     FROM subscriptions s
     JOIN users u ON u.id = s.user_id
     WHERE s.status = 'free'
       AND u.email IS NOT NULL
       AND s.alert_preference <> 'off'
       AND (s.last_teaser_sent_at IS NULL OR s.last_teaser_sent_at <= NOW() - INTERVAL '7 days')`,
    []
  )

  if (res.rows.length === 0) return { recipients: 0, skipped: 0 }

  const resend = getResend()
  const unlockedDealIds = Array.from(await getFreeUnlockedDealIds())
  let sent = 0
  let skipped = 0

  for (const recipient of res.rows) {
    try {
      const deals = await query<TeaserDealRow>(
        `SELECT
           d.hotel_name,
           m.city,
           d.photo_url,
           d.discount_pct,
           COUNT(*) OVER ()::INT AS locked_deal_count
         FROM deals d
         JOIN tracked_markets m ON m.id = d.market_id
         WHERE d.status = 'active'
           AND d.is_mock = false
           AND (d.expires_at IS NULL OR d.expires_at > NOW())
           AND d.check_in_date >= CURRENT_DATE
           AND NOT (d.id = ANY($1::uuid[]))
         ORDER BY d.discount_pct DESC, d.first_seen DESC
         LIMIT 1`,
        [unlockedDealIds]
      )

      const topDealRow = deals.rows[0]
      if (!topDealRow) {
        skipped++
        continue
      }

      const topDeal = {
        discountPct: topDealRow.discount_pct,
        city: topDealRow.city,
        hotelName: topDealRow.hotel_name,
        photoUrl: topDealRow.photo_url,
      }
      const lockedDealCount = topDealRow.locked_deal_count

      const html = await render(
        FreeTierTeaser({
          lockedDealCount,
          topDeal,
          manageUrl: `${BASE_URL}/account`,
          unsubscribeUrl: `${BASE_URL}/api/alerts/unsubscribe?token=${recipient.unsubscribeToken}`,
        })
      )

      await resend.emails.send({
        from: FROM,
        to: recipient.email,
        subject: `Unlock ${lockedDealCount} hotel deals now`,
        html,
      })

      await query(
        `UPDATE subscriptions SET last_teaser_sent_at = NOW(), updated_at = NOW() WHERE user_id = $1`,
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
