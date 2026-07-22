export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { query } from '@/lib/db/client'
import {
  dailyPage,
  errorManagePage,
  invalidManagePage,
  parseManageRequest,
  stopCityPage,
} from '@/lib/alerts/managePage'

type AlertState = {
  alert_preference: 'instant' | 'daily' | 'off'
  watchlist: string[]
}

export async function GET(req: Request): Promise<Response> {
  const request = parseManageRequest(new URL(req.url).searchParams)
  if (!request) return invalidManagePage(400)

  const result = await query<AlertState>(
    `SELECT alert_preference, watchlist
     FROM subscriptions
     WHERE alert_unsubscribe_token = $1
     LIMIT 1`,
    [request.token]
  ).catch(() => null)
  if (!result) return errorManagePage()

  const state = result.rows[0]
  if (!state) return invalidManagePage(404)

  if (request.action === 'daily') {
    if (state.alert_preference === 'daily') return dailyPage(request, 'already')
    return dailyPage(request, state.alert_preference === 'off' ? 'confirm-off' : 'confirm')
  }

  if (!state.watchlist.includes(request.city as string)) return stopCityPage(request, 'not-watching')
  return stopCityPage(request, state.watchlist.length === 1 ? 'confirm-last' : 'confirm')
}
