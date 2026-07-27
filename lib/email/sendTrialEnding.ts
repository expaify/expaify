import { render } from '@react-email/components'
import { getResend, FROM } from './resend'
import { TrialEndingEmail } from './templates/TrialEndingEmail'
import { query } from '../db/client'

const BASE_URL = process.env.AUTH_URL ?? 'https://expaify.com'

type TrialEndingRecipient = {
  userId: string
  email: string
  unsubscribeToken: string
  trialEndsAt: Date
}

export async function runTrialEndingReminders(): Promise<{ recipients: number; skipped: number }> {
  if (!process.env.RESEND_API_KEY) return { recipients: 0, skipped: 0 }

  const res = await query<TrialEndingRecipient>(
    `SELECT s.user_id AS "userId",
            u.email,
            s.alert_unsubscribe_token::TEXT AS "unsubscribeToken",
            s.trial_ends_at AS "trialEndsAt"
     FROM subscriptions s
     JOIN users u ON u.id = s.user_id
     WHERE s.status = 'trialing'
       AND u.email IS NOT NULL
       AND s.trial_ending_email_sent = false
       AND s.trial_ends_at IS NOT NULL
       AND s.trial_ends_at > NOW()
       AND s.trial_ends_at <= NOW() + INTERVAL '2 days'`,
    []
  )

  if (res.rows.length === 0) return { recipients: 0, skipped: 0 }

  const resend = getResend()
  let sent = 0
  let skipped = 0

  for (const recipient of res.rows) {
    try {
      const msRemaining = new Date(recipient.trialEndsAt).getTime() - Date.now()
      const daysLeft = Math.max(1, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)))

      const html = await render(
        TrialEndingEmail({
          email: recipient.email,
          daysLeft,
          manageUrl: `${BASE_URL}/account`,
          unsubscribeUrl: `${BASE_URL}/api/alerts/unsubscribe?token=${recipient.unsubscribeToken}`,
        })
      )

      await resend.emails.send({
        from: FROM,
        to: recipient.email,
        subject: `Your expaify trial ends in ${daysLeft} days`,
        html,
      })

      await query(
        `UPDATE subscriptions SET trial_ending_email_sent = true, updated_at = NOW() WHERE user_id = $1`,
        [recipient.userId]
      )

      sent++
    } catch {
      skipped++
    }
  }

  return { recipients: sent, skipped }
}
