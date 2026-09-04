export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { query } from '@/lib/db/client'

const BASE_URL = process.env.AUTH_URL ?? 'https://expaify.com'

function html(title: string, message: string, status = 200, actions = ''): NextResponse {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>expaify alerts</title>
    <style>
      *{box-sizing:border-box}
      body{margin:0;background:#FAF7F2;color:#141210;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      main{max-width:520px;margin:0 auto;padding:48px 20px}
      .logo{font-family:"Space Grotesk",Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:700;font-size:22px;color:#0E5A54;margin-bottom:28px}
      .dot{color:#FF6B4A}
      section{background:#fff;border:1px solid #E8E2D8;border-radius:16px;padding:24px}
      h1{font-family:"Space Grotesk",Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:700;font-size:24px;line-height:1.2;margin:0 0 8px}
      p{font-size:14px;line-height:1.6;color:#5C5852;margin:0}
      a{color:#0E5A54;font-weight:500}
      .actions{margin-top:20px}
      .actions button{display:inline-block;min-height:44px;background:#0E5A54;color:#fff;font-weight:500;font-size:14px;padding:12px 24px;border-radius:999px;border:none;cursor:pointer;outline-offset:2px}
      .secondary{display:block;margin-top:12px}
      .recovery{border-top:1px solid #E8E2D8;margin-top:16px;padding-top:16px}
      .recovery p{margin:0 0 8px}
      .recovery a{display:block;line-height:2}
    </style>
  </head>
  <body>
    <main>
      <div class="logo">expaify<span class="dot">.</span></div>
      <section>
        <h1>${title}</h1>
        <p>${message}</p>
        ${actions}
      </section>
    </main>
  </body>
</html>`,
    {
      status,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    }
  )
}

function isValidToken(token: string): boolean {
  return /^[0-9a-fA-F-]{36}$/.test(token)
}

function invalidTokenPage(status: 400 | 404): NextResponse {
  const message = status === 400
    ? 'This unsubscribe link is invalid.'
    : 'This unsubscribe link has expired or was already removed.'
  return html(
    'Link not working',
    `${message} You can still manage alerts from your <a href="${BASE_URL}/account#alerts">account settings</a>.`,
    status
  )
}

function confirmForm(token: string): string {
  return `<form method="post" action="/api/alerts/unsubscribe" class="actions">
    <input type="hidden" name="token" value="${token}">
    <button type="submit">Turn off deal alerts</button>
  </form><a class="secondary" href="${BASE_URL}/deals">Keep things as they are</a>`
}

// GET only renders a confirmation page and never mutates anything -- a plain
// GET that unsubscribed on load (the previous behavior) is unsafe against
// automated link prefetching (Microsoft Defender Safe Links, Apple Mail
// Privacy Protection, and similar corporate/consumer email scanners routinely
// fetch every link in a delivered email before the recipient ever opens it),
// which would silently unsubscribe a real user who never clicked anything.
// Mirrors the pattern app/alerts/manage/route.ts already uses correctly for
// the daily-digest/stop-city actions: GET confirms, POST mutates.
export async function GET(req: Request): Promise<NextResponse> {
  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (!isValidToken(token)) return invalidTokenPage(400)

  const result = await query<{ alert_preference: string }>(
    `SELECT alert_preference FROM subscriptions WHERE alert_unsubscribe_token = $1 LIMIT 1`,
    [token]
  ).catch(() => null)

  if (!result || result.rows.length === 0) return invalidTokenPage(404)

  if (result.rows[0].alert_preference === 'off') {
    return html(
      'Alerts are already off',
      `You are not currently receiving expaify deal alerts. You can turn them back on from your <a href="${BASE_URL}/account#alerts">account settings</a>.`
    )
  }

  return html(
    'Turn off deal alerts?',
    'You will stop receiving expaify deal alert emails. Transactional account and billing emails may still be sent.',
    200,
    confirmForm(token)
  )
}

export async function POST(req: Request): Promise<NextResponse> {
  const form = await req.formData().catch(() => null)
  const token = String(form?.get('token') ?? '')
  if (!isValidToken(token)) return invalidTokenPage(400)

  const result = await query(
    `UPDATE subscriptions
     SET alert_preference = 'off', updated_at = NOW()
     WHERE alert_unsubscribe_token = $1`,
    [token]
  ).catch(() => null)

  if (!result || result.rowCount === 0) return invalidTokenPage(404)

  return html(
    'Deal alerts are off',
    'You will no longer receive expaify deal alerts. Transactional account and billing emails may still be sent.',
    200,
    `<div class="recovery">
          <p>Too much email, but don&rsquo;t want to miss a real deal?</p>
          <a href="/alerts/manage?token=${token}&amp;action=daily">Get one daily email instead</a>
          <a href="${BASE_URL}/account#alerts">Manage alert settings</a>
        </div>`
  )
}
