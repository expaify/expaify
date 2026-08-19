import { render } from '@react-email/components'
import { query } from '../db/client'
import { getResend, FROM } from './resend'
import { QuietDay } from './templates/QuietDay'

const BASE_URL = process.env.AUTH_URL ?? 'https://expaify.com'
const SUBJECTS = [
  (city: string) => `${city} is quiet today. We're still checking.`,
  (city: string) => `No ${city} drop hit 30%+ today`,
  (city: string) => `What "usual rate" means for ${city}`,
]

export async function sendQuietDay({ email, city, unsubscribeToken }: { email: string; city: string; unsubscribeToken: string }): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  const subject = SUBJECTS[Math.floor(Date.now() / 86_400_000) % SUBJECTS.length](city)
  const html = await render(QuietDay({ city, dealsUrl: `${BASE_URL}/deals?utm_source=quiet_day&utm_medium=email`, premiumUrl: `${BASE_URL}/join?utm_source=quiet_day&utm_medium=email`, manageUrl: `${BASE_URL}/account#alerts`, unsubscribeUrl: `${BASE_URL}/api/alerts/unsubscribe?token=${unsubscribeToken}` }))
  const sent = await getResend().emails.send({ from: FROM, to: email, subject, html })
  if ('error' in sent && sent.error) throw new Error('Quiet-day email delivery was rejected')

  if (sent.data?.id) {
    try {
      await query(
        `INSERT INTO analytics_events
          (event_id, session_id, event_name, occurred_at, path, properties)
         VALUES ($1, $2, 'free_quiet_day_sent', NOW(), $3, $4::jsonb)`,
        [crypto.randomUUID(), crypto.randomUUID(), '/cron/daily-digest', JSON.stringify({ resend_message_id: sent.data.id, city })],
      )
    } catch (error) {
      console.warn('Quiet-day analytics unavailable', error)
    }
  }
}
