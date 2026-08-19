import { render } from '@react-email/components'
import { query } from '../db/client'
import { getResend, FROM } from './resend'
import { TrialNudgeD7, type TrialNudgeDeal } from './templates/TrialNudgeD7'

const BASE_URL = process.env.AUTH_URL ?? 'https://expaify.com'

export async function sendTrialNudgeD7({ email, city, unsubscribeToken }: { email: string; city: string; unsubscribeToken: string }): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  const result = await query<{
    hotel_name: string; deal_price_cents: number; median_price_cents: number; discount_pct: number; snapshot_count: number
  }>(
    `SELECT d.hotel_name, d.deal_price_cents, d.median_price_cents, d.discount_pct, d.snapshot_count
     FROM deals d JOIN tracked_markets m ON m.id = d.market_id
     WHERE d.status = 'active' AND d.is_mock = false
       AND d.first_seen >= NOW() - INTERVAL '7 days'
       AND (d.expires_at IS NULL OR d.expires_at > NOW()) AND d.check_in_date >= CURRENT_DATE
       AND d.discount_pct >= 30 AND d.snapshot_count >= 8 AND m.city = $1
     ORDER BY d.discount_pct DESC, d.first_seen DESC LIMIT 1`,
    [city],
  ).catch(() => ({ rows: [] }))
  const row = result.rows[0]
  const deal: TrialNudgeDeal | null = row ? { hotelName: row.hotel_name, dealPriceCents: row.deal_price_cents, medianPriceCents: row.median_price_cents, discountPct: row.discount_pct, snapshotCount: row.snapshot_count } : null
  const html = await render(TrialNudgeD7({ city, deal, premiumUrl: `${BASE_URL}/join?utm_source=free_d7&utm_medium=email`, prefsUrl: `${BASE_URL}/account#alerts`, unsubscribeUrl: `${BASE_URL}/api/alerts/unsubscribe?token=${unsubscribeToken}` }))
  const sent = await getResend().emails.send({ from: FROM, to: email, subject: `One week in on ${city}, worth upgrading?`, html })
  if ('error' in sent && sent.error) throw new Error('Free D7 trial-nudge email delivery was rejected')

  if (sent.data?.id) {
    try {
      await query(
        `INSERT INTO analytics_events
          (event_id, session_id, event_name, occurred_at, path, properties)
         VALUES ($1, $2, 'free_d7_trial_nudge_sent', NOW(), $3, $4::jsonb)`,
        [crypto.randomUUID(), crypto.randomUUID(), '/api/alerts/trial-sequence', JSON.stringify({ resend_message_id: sent.data.id, city, included_deal: Boolean(deal) })],
      )
    } catch (error) {
      console.warn('Free D7 trial-nudge analytics unavailable', error)
    }
  }
}
