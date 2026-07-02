import { render } from '@react-email/components'
import { getResend, FROM } from './resend'
import { DealAlert } from './templates/DealAlert'
import { query } from '../db/client'
import { isPremium } from '../subscription'

const BASE_URL = process.env.AUTH_URL ?? 'https://expaify.com'
const INSTANT_COOLDOWN_HOURS = 4

type Deal = {
  id: string
  hotelName: string
  city: string
  stars: number | null
  checkInWindow: string
  discountPct: number
  dealPriceCents: number
  medianPriceCents: number
  snapshotCount: number
}

type AlertRecipient = {
  userId: string
  email: string
  lastAlertedAt: Date | null
}

export async function sendInstantAlerts(deal: Deal): Promise<number> {
  if (!process.env.RESEND_API_KEY) return 0

  // Find all premium users with instant alerts who haven't been alerted recently
  const res = await query<AlertRecipient>(
    `SELECT s.user_id AS "userId", u.email, s.last_alerted_at AS "lastAlertedAt"
     FROM subscriptions s
     JOIN "user" u ON u.id = s.user_id
     WHERE s.alert_preference = 'instant'
       AND u.email IS NOT NULL
       AND s.status IN ('trialing', 'active')
       AND (s.last_alerted_at IS NULL OR s.last_alerted_at < NOW() - INTERVAL '${INSTANT_COOLDOWN_HOURS} hours')`,
    []
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
          checkInWindow: deal.checkInWindow,
          discountPct: deal.discountPct,
          dealPriceCents: deal.dealPriceCents,
          medianPriceCents: deal.medianPriceCents,
          snapshotCount: deal.snapshotCount,
          dealUrl: `${BASE_URL}/deals`,
          unsubscribeUrl: `${BASE_URL}/account`,
        })
      )

      await resend.emails.send({
        from: FROM,
        to: recipient.email,
        subject: `${deal.hotelName} — ${deal.discountPct}% off in ${deal.city}`,
        html,
      })

      await query(
        `UPDATE subscriptions SET last_alerted_at = NOW() WHERE user_id = $1`,
        [recipient.userId]
      )

      sent++
    } catch {
      // Don't fail the pipeline if one email errors
    }
  }

  return sent
}
