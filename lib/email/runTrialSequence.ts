import { query } from '../db/client'
import { sendFreeTrustD3 } from './sendFreeTrustD3'
import { sendTrialNudgeD7 } from './sendTrialNudgeD7'

type TrialSequenceRecipient = {
  userId: string
  email: string
  city: string
  unsubscribeToken: string
  d3EmailSentAt: Date | null
  d7EmailSentAt: Date | null
}

async function releaseClaim(userId: string, column: 'd3_email_sent_at' | 'd7_email_sent_at', claimedAt: Date): Promise<void> {
  await query(`UPDATE subscriptions SET ${column} = NULL, updated_at = NOW() WHERE user_id = $1 AND ${column} = $2`, [userId, claimedAt]).catch(() => undefined)
}

export async function runTrialSequencePass(): Promise<{ d3Sent: number; d7Sent: number; failed: number }> {
  if (!process.env.RESEND_API_KEY) return { d3Sent: 0, d7Sent: 0, failed: 0 }
  const recipients = await query<TrialSequenceRecipient>(
    `SELECT s.user_id AS "userId", u.email, s.watchlist[1] AS city,
            s.alert_unsubscribe_token::TEXT AS "unsubscribeToken",
            s.d3_email_sent_at AS "d3EmailSentAt", s.d7_email_sent_at AS "d7EmailSentAt"
     FROM subscriptions s JOIN users u ON u.id = s.user_id
     WHERE s.status = 'free' AND u.email IS NOT NULL
       AND COALESCE(array_length(s.watchlist, 1), 0) > 0
       AND ((s.d3_email_sent_at IS NULL AND s.created_at <= NOW() - INTERVAL '3 days')
         OR (s.d7_email_sent_at IS NULL AND s.d3_email_sent_at <= NOW() - INTERVAL '4 days' AND s.created_at <= NOW() - INTERVAL '7 days'))`,
  )
  let d3Sent = 0
  let d7Sent = 0
  let failed = 0

  for (const recipient of recipients.rows) {
    const isD3 = recipient.d3EmailSentAt === null
    const column = isD3 ? 'd3_email_sent_at' : 'd7_email_sent_at'
    const claimed = await query<{ claimed_at: Date }>(
      `UPDATE subscriptions SET ${column} = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND status = 'free' AND ${column} IS NULL
       RETURNING ${column} AS claimed_at`,
      [recipient.userId],
    )
    const claimedAt = claimed.rows[0]?.claimed_at
    if (!claimedAt) continue
    try {
      if (isD3) {
        await sendFreeTrustD3(recipient)
        d3Sent++
      } else {
        await sendTrialNudgeD7(recipient)
        d7Sent++
      }
    } catch {
      await releaseClaim(recipient.userId, column, claimedAt)
      failed++
    }
  }
  return { d3Sent, d7Sent, failed }
}
