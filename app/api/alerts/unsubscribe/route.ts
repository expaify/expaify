export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { query } from '@/lib/db/client'

function html(message: string, status = 200, recovery = ''): NextResponse {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>expaify alerts</title>
    <style>
      body{margin:0;background:#FAF7F2;color:#141210;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      main{max-width:520px;margin:0 auto;padding:48px 20px}
      .logo{font-family:Georgia,serif;font-weight:700;font-size:22px;color:#0E5A54;margin-bottom:28px}
      .dot{color:#FF6B4A}
      section{background:#fff;border:1px solid #E8E2D8;border-radius:16px;padding:24px}
      h1{font-family:Georgia,serif;font-size:24px;line-height:1.2;margin:0 0 8px}
      p{font-size:14px;line-height:1.6;color:#5C5852;margin:0}
      a{color:#0E5A54;font-weight:600}
      .recovery{border-top:1px solid #E8E2D8;margin-top:16px;padding-top:16px}
      .recovery p{margin:0 0 8px}
      .recovery a{display:block;line-height:2}
    </style>
  </head>
  <body>
    <main>
      <div class="logo">expaify<span class="dot">.</span></div>
      <section>
        <h1>Deal alerts are off</h1>
        <p>${message}</p>
        ${recovery}
      </section>
    </main>
  </body>
</html>`,
    {
      status,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }
  )
}

export async function GET(req: Request): Promise<NextResponse> {
  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (!/^[0-9a-fA-F-]{36}$/.test(token)) {
    return html('This unsubscribe link is invalid. You can still manage alerts from your <a href="https://expaify.com/account#alerts">account settings</a>.', 400)
  }

  const result = await query(
    `UPDATE subscriptions
     SET alert_preference = 'off', updated_at = NOW()
     WHERE alert_unsubscribe_token = $1`,
    [token]
  ).catch(() => null)

  if (!result || result.rowCount === 0) {
    return html('This unsubscribe link has expired or was already removed. You can still manage alerts from your <a href="https://expaify.com/account#alerts">account settings</a>.', 404)
  }

  return html(
    'You will no longer receive expaify deal alerts. Transactional account and billing emails may still be sent.',
    200,
    `<div class="recovery">
          <p>Too much email, but don&rsquo;t want to miss a real deal?</p>
          <a href="/alerts/manage?token=${token}&amp;action=daily">Get one daily email instead</a>
          <a href="https://expaify.com/account#alerts">Manage alert settings</a>
        </div>`
  )
}
