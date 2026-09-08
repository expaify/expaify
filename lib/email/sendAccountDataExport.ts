import { render } from '@react-email/components'
import { getResend, FROM } from './resend'
import { AccountDataExport, type ExportedUnlock } from './templates/AccountDataExport'

export type AccountDataExportInput = {
  email: string
  name: string | null
  createdAt: string
  planStatus: string
  plan: string | null
  alertPreference: string
  alertMinDiscount: number
  alertTimezone: string
  watchlist: string[]
  unlocks: ExportedUnlock[]
}

export async function sendAccountDataExport(input: AccountDataExportInput): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const html = await render(AccountDataExport(input))
  const sent = await getResend().emails.send({
    from: FROM,
    to: input.email,
    subject: 'Your expaify account data',
    html,
  })
  return !sent.error
}
