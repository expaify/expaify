import { render } from '@react-email/components'
import { getResend, FROM } from './resend'
import { DailyDigest } from './templates/DailyDigest'
import { query } from '../db/client'
import { getActiveDeals } from '../pipeline/dealDetection'

const BASE_URL = process.env.AUTH_URL ?? 'https://expaify.com'

type DigestRecipient = {
  userId: string
  email: string
}

export async function runDailyDigest(): Promise<{ recipients: number; skipped: number }> {
  if (!process.env.RESEND_API_KEY) return { recipients: 0, skipped: 0 }

  // Users with daily alerts who haven't been alerted today
  const res = await query<DigestRecipient>(
    `SELECT s.user_id AS "userId", u.email
     FROM subscriptions s
     JOIN "user" u ON u.id = s.user_id
     WHERE s.alert_preference = 'daily'
       AND u.email IS NOT NULL
       AND s.status IN ('trialing', 'active')
       AND (s.last_alerted_at IS NULL OR s.last_alerted_at::DATE < CURRENT_DATE)`,
    []
  )

  if (res.rows.length === 0) return { recipients: 0, skipped: 0 }

  // Fetch top 5 active deals for the digest
  const deals = await getActiveDeals({ limit: 5, sort: 'discount', includeMock: false })

  // Fall back to mock deal names if no real deals yet
  const digestDeals = deals.map(d => ({
    hotelName: d.hotel_name,
    city: d.city,
    discountPct: d.discount_pct,
    dealPriceCents: d.deal_price_cents,
    dealUrl: `${BASE_URL}/deals`,
  }))

  if (digestDeals.length === 0) return { recipients: 0, skipped: res.rows.length }

  const resend = getResend()
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  let sent = 0

  for (const recipient of res.rows) {
    try {
      const html = await render(
        DailyDigest({
          deals: digestDeals,
          date,
          unsubscribeUrl: `${BASE_URL}/account`,
        })
      )

      await resend.emails.send({
        from: FROM,
        to: recipient.email,
        subject: `Your expaify deals for ${date} — ${digestDeals.length} hotel drops`,
        html,
      })

      await query(
        `UPDATE subscriptions SET last_alerted_at = NOW() WHERE user_id = $1`,
        [recipient.userId]
      )

      sent++
    } catch {
      // Don't fail the whole batch if one email errors
    }
  }

  return { recipients: sent, skipped: res.rows.length - sent }
}
