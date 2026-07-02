import { render } from '@react-email/components'
import { getResend, FROM } from './resend'
import { WelcomeEmail } from './templates/WelcomeEmail'

export async function sendWelcomeEmail(email: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  try {
    const html = await render(WelcomeEmail({ email }))
    await getResend().emails.send({
      from: FROM,
      to: email,
      subject: "You're in — expaify",
      html,
    })
  } catch {
    // Don't crash auth if email fails
  }
}
