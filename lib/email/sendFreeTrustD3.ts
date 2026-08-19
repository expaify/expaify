import { render } from '@react-email/components'
import { query } from '../db/client'
import { getResend, FROM } from './resend'
import { FreeTrustD3 } from './templates/FreeTrustD3'

const BASE_URL = process.env.AUTH_URL ?? 'https://expaify.com'

export async function sendFreeTrustD3({ email, city, unsubscribeToken }: { email: string; city: string; unsubscribeToken: string }): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  const html = await render(FreeTrustD3({ city, dealsUrl: `${BASE_URL}/deals?utm_source=free_d3&utm_medium=email`, premiumUrl: `${BASE_URL}/join?utm_source=free_d3&utm_medium=email`, manageUrl: `${BASE_URL}/account#alerts`, unsubscribeUrl: `${BASE_URL}/api/alerts/unsubscribe?token=${unsubscribeToken}` }))
  const sent = await getResend().emails.send({ from: FROM, to: email, subject: `Why a "cheap" ${city} hotel sometimes isn't a deal`, html })
  if ('error' in sent && sent.error) throw new Error('Free D3 email delivery was rejected')

  if (sent.data?.id) {
    try {
      await query(
        `INSERT INTO analytics_events
          (event_id, session_id, event_name, occurred_at, path, properties)
         VALUES ($1, $2, 'free_d3_sent', NOW(), $3, $4::jsonb)`,
        [crypto.randomUUID(), crypto.randomUUID(), '/api/alerts/trial-sequence', JSON.stringify({ resend_message_id: sent.data.id, city })],
      )
    } catch (error) {
      console.warn('Free D3 analytics unavailable', error)
    }
  }
}
