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

async function readState(token: string) {
  return query<AlertState>(
    `SELECT alert_preference, watchlist
     FROM subscriptions
     WHERE alert_unsubscribe_token = $1
     LIMIT 1`,
    [token]
  )
}

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData().catch(() => null)
  if (!form) return invalidManagePage(400)

  const params = new URLSearchParams()
  for (const field of ['token', 'action', 'city']) {
    const value = form.get(field)
    if (typeof value === 'string') params.set(field, value)
  }
  const request = parseManageRequest(params)
  if (!request) return invalidManagePage(400)

  const currentResult = await readState(request.token).catch(() => null)
  if (!currentResult) return errorManagePage()
  const current = currentResult.rows[0]
  if (!current) return invalidManagePage(404)

  if (request.action === 'daily') {
    if (current.alert_preference === 'daily') return dailyPage(request, 'already')
    const updated = await query(
      `UPDATE subscriptions
       SET alert_preference = 'daily', updated_at = NOW()
       WHERE alert_unsubscribe_token = $1`,
      [request.token]
    ).catch(() => null)
    if (!updated) return errorManagePage()
    return dailyPage(request, 'success')
  }

  const city = request.city as string
  if (!current.watchlist.includes(city)) return stopCityPage(request, 'not-watching')

  const updated = await query<{ alert_preference: AlertState['alert_preference']; watchlist: string[] }>(
    `UPDATE subscriptions
     SET alert_preference = CASE
           WHEN COALESCE(array_length(watchlist, 1), 0) = 1 THEN 'off'
           ELSE alert_preference
         END,
         watchlist = array_remove(watchlist, $2),
         updated_at = NOW()
     WHERE alert_unsubscribe_token = $1
       AND $2 = ANY(watchlist)
     RETURNING alert_preference, watchlist`,
    [request.token, city]
  ).catch(() => null)
  if (!updated) return errorManagePage()

  const finalState = updated.rows[0]
  if (!finalState) return stopCityPage(request, 'not-watching')
  return stopCityPage(request, finalState.watchlist.length === 0 ? 'success-off' : 'success')
}
