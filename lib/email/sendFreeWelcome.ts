import { render } from '@react-email/components'
import { query } from '../db/client'
import { getResend, FROM } from './resend'
import { FreeWelcome, type FreeWelcomeDeal } from './templates/FreeWelcome'

const BASE_URL = process.env.AUTH_URL ?? 'https://expaify.com'

export async function sendFreeWelcome({ email, city, unsubscribeToken }: { email: string; city: string; unsubscribeToken: string }): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  const result = await query<{
    id: string; hotel_name: string; city: string; photo_url: string | null; discount_pct: number; deal_price_cents: number
  }>(
    `SELECT d.id, d.hotel_name, m.city, d.photo_url, d.discount_pct, d.deal_price_cents
     FROM deals d JOIN tracked_markets m ON m.id = d.market_id
     WHERE d.status = 'active' AND d.is_mock = false
       AND (d.expires_at IS NULL OR d.expires_at > NOW()) AND d.check_in_date >= CURRENT_DATE
       AND d.discount_pct >= 30 AND d.snapshot_count >= 8
       AND ($1::TEXT = 'Everywhere' OR m.city = $1)
     ORDER BY d.discount_pct DESC, d.first_seen DESC LIMIT 1`,
    [city],
  ).catch(() => ({ rows: [] }))
  const row = result.rows[0]
  const deal: FreeWelcomeDeal | null = row ? { id: row.id, hotelName: row.hotel_name, city: row.city, photoUrl: row.photo_url, discountPct: row.discount_pct, dealPriceCents: row.deal_price_cents, dealUrl: `${BASE_URL}/deals/${row.id}?ref=free-welcome` } : null
  const html = await render(FreeWelcome({ city, deal, premiumUrl: `${BASE_URL}/join?utm_source=free_welcome&utm_medium=email`, manageUrl: `${BASE_URL}/account#alerts`, unsubscribeUrl: `${BASE_URL}/api/alerts/unsubscribe?token=${unsubscribeToken}` }))
  const sent = await getResend().emails.send({ from: FROM, to: email, subject: `You're watching ${city}. Here's how drops work.`, html })
  if ('error' in sent && sent.error) throw new Error('Free welcome email delivery was rejected')
}
