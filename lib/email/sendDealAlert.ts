import { render } from '@react-email/components'
import { getResend, FROM } from './resend'
import { DealAlert } from './templates/DealAlert'
import { query } from '../db/client'

const BASE_URL = process.env.AUTH_URL ?? 'https://expaify.com'
const MAX_INSTANT_PER_DAY = 3
const DEFAULT_MIN_DISCOUNT = 40

type Deal = {
  id: string
  hotelName: string
  city: string
  stars: number | null
  photoUrl?: string | null
  checkInWindow: string
  discountPct: number
  dealPriceCents: number
  medianPriceCents: number
  snapshotCount: number
}

type AlertRecipient = {
  userId: string
  email: string
  unsubscribeToken: string
}

export async function sendInstantAlerts(deal: Deal): Promise<number> {
  if (!process.env.RESEND_API_KEY) return 0

  const activeDeal = await query<{ id: string }>(
    `SELECT id
     FROM deals
     WHERE id = $1
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > NOW())
       AND check_in_date >= CURRENT_DATE
     LIMIT 1`,
    [deal.id]
  )
  if (activeDeal.rows.length === 0) return 0

  const res = await query<AlertRecipient>(
    `SELECT s.user_id AS "userId",
            u.email,
            s.alert_unsubscribe_token::TEXT AS "unsubscribeToken"
     FROM subscriptions s
     JOIN users u ON u.id = s.user_id
     WHERE s.alert_preference = 'instant'
       AND u.email IS NOT NULL
       AND s.status IN ('trialing', 'active')
       AND $2 >= COALESCE(s.alert_min_discount, $3)
       AND (COALESCE(array_length(s.watchlist, 1), 0) = 0 OR $4 = ANY(s.watchlist))
       AND NOT EXISTS (
         SELECT 1 FROM deal_alert_deliveries dad
         WHERE dad.user_id = s.user_id AND dad.deal_id = $1
       )
       AND (
         SELECT COUNT(*)::INT
         FROM deal_alert_deliveries dad
         WHERE dad.user_id = s.user_id
           AND dad.delivery_type = 'instant'
           AND dad.delivered_at >= date_trunc('day', NOW())
       ) < $5`,
    [deal.id, deal.discountPct, DEFAULT_MIN_DISCOUNT, deal.city, MAX_INSTANT_PER_DAY]
  )

  if (res.rows.length === 0) return 0

  const resend = getResend()
  let sent = 0

  for (const recipient of res.rows) {
    try {
      const html = await render(
        DealAlert({
          hotelName: deal.hotelName,
          city: deal.city,
          stars: deal.stars ?? 4,
          photoUrl: deal.photoUrl ?? null,
          checkInWindow: deal.checkInWindow,
          discountPct: deal.discountPct,
          dealPriceCents: deal.dealPriceCents,
          medianPriceCents: deal.medianPriceCents,
          snapshotCount: deal.snapshotCount,
          dealUrl: `${BASE_URL}/deals/${deal.id}`,
          manageUrl: `${BASE_URL}/account`,
          unsubscribeUrl: `${BASE_URL}/api/alerts/unsubscribe?token=${recipient.unsubscribeToken}`,
        })
      )

      await resend.emails.send({
        from: FROM,
        to: recipient.email,
        subject: `${deal.hotelName} — ${deal.discountPct}% off in ${deal.city}`,
        html,
      })

      await query(
        `INSERT INTO deal_alert_deliveries (user_id, deal_id, delivery_type)
         VALUES ($1, $2, 'instant')
         ON CONFLICT (user_id, deal_id) DO NOTHING`,
        [recipient.userId, deal.id]
      )

      sent++
    } catch {
      // Don't fail the pipeline if one email errors
    }
  }

  return sent
}
