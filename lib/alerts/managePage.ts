import { NextResponse } from 'next/server'
import { CITY_SLUGS } from '@/lib/cities'

export type ManageAction = 'daily' | 'stop-city'

export type ManageRequest = {
  token: string
  action: ManageAction
  citySlug: string | null
  city: string | null
}

const BASE_URL = process.env.AUTH_URL ?? 'https://expaify.com'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function parseManageRequest(params: URLSearchParams): ManageRequest | null {
  const token = params.get('token') ?? ''
  const action = params.get('action')
  if (!/^[0-9a-fA-F-]{36}$/.test(token) || (action !== 'daily' && action !== 'stop-city')) {
    return null
  }

  if (action === 'daily') {
    return { token, action, citySlug: null, city: null }
  }

  const citySlug = params.get('city') ?? ''
  const city = CITY_SLUGS[citySlug]
  if (!city) return null
  return { token, action, citySlug, city }
}

function links(items: Array<{ href: string; label: string }>): string {
  return `<div class="actions links">${items.map(item =>
    `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`
  ).join('<span aria-hidden="true"> · </span>')}</div>`
}

function confirmationForm(request: ManageRequest, label: string, secondary: string): string {
  return `<form method="post" action="/api/alerts/manage" class="actions">
    <input type="hidden" name="token" value="${escapeHtml(request.token)}">
    <input type="hidden" name="action" value="${request.action}">
    ${request.citySlug ? `<input type="hidden" name="city" value="${escapeHtml(request.citySlug)}">` : ''}
    <button type="submit">${escapeHtml(label)}</button>
  </form>${secondary}`
}

export function managePage(title: string, body: string, actions = '', status = 200): NextResponse {
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
      .logo{font-family:Georgia,serif;font-weight:700;font-size:22px;color:#0E5A54;margin-bottom:28px}
      .dot{color:#FF6B4A}
      section{background:#fff;border:1px solid #E8E2D8;border-radius:16px;padding:24px}
      h1{font-family:Georgia,serif;font-size:24px;line-height:1.2;margin:0 0 8px}
      p{font-size:14px;line-height:1.6;color:#5C5852;margin:0}
      a{color:#0E5A54;font-size:14px;font-weight:600}
      .actions{margin-top:20px}
      .actions button{display:inline-block;min-height:44px;background:#0E5A54;color:#fff;font-weight:600;font-size:14px;padding:12px 24px;border-radius:999px;border:none;cursor:pointer;outline-offset:2px}
      .links{line-height:2}
      .links span{color:#8A857D;padding:0 4px}
      .secondary{display:block;margin-top:12px}
    </style>
  </head>
  <body>
    <main>
      <div class="logo">expaify<span class="dot">.</span></div>
      <section>
        <h1>${title}</h1>
        <p>${body}</p>
        ${actions}
      </section>
    </main>
  </body>
</html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } }
  )
}

export function invalidManagePage(status: 400 | 404 = 400): NextResponse {
  return managePage(
    'This link isn&rsquo;t working',
    `It may have expired or been copied incompletely. You can still manage alerts from your <a href="${BASE_URL}/account#alerts">account settings</a>.`,
    '',
    status
  )
}

export function errorManagePage(): NextResponse {
  return managePage(
    'Something went wrong',
    `Your alert settings were not changed. Please try the link again in a minute, or use your <a href="${BASE_URL}/account#alerts">account settings</a>.`,
    '',
    500
  )
}

export function dailyPage(request: ManageRequest, state: 'confirm' | 'confirm-off' | 'already' | 'success'): NextResponse {
  if (state === 'already') {
    return managePage(
      'You&rsquo;re already on the daily digest',
      'This address gets one morning email with the best new deals. Nothing to change.',
      links([
        { href: `${BASE_URL}/account#alerts`, label: 'Manage alert settings' },
        { href: `${BASE_URL}/deals`, label: 'Browse deals' },
      ])
    )
  }
  if (state === 'success') {
    return managePage(
      'You&rsquo;re on the daily digest',
      'One email each morning with the best new deals — no more instant alerts.',
      links([
        { href: `${BASE_URL}/account#alerts`, label: 'Manage alert settings' },
        { href: `${BASE_URL}/deals`, label: 'Browse deals' },
      ])
    )
  }

  const body = state === 'confirm-off'
    ? 'Deal alerts are currently off for this address. Confirming turns them back on as a single morning digest.'
    : 'Instead of an email per deal, you&rsquo;ll get a single morning digest with the best new deals for your cities.'
  return managePage(
    'Switch to one daily email?',
    body,
    confirmationForm(
      request,
      'Switch to daily digest',
      `<a class="secondary" href="${BASE_URL}/deals">Keep things as they are</a>`
    )
  )
}

export function stopCityPage(
  request: ManageRequest,
  state: 'confirm' | 'confirm-last' | 'not-watching' | 'success' | 'success-off'
): NextResponse {
  const city = request.city as string
  const slug = request.citySlug as string
  if (state === 'not-watching') {
    return managePage(
      `You&rsquo;re not watching ${city}`,
      `This address doesn&rsquo;t get city-specific alerts for ${city}, so there&rsquo;s nothing to stop.`,
      links([
        { href: `${BASE_URL}/account#alerts`, label: 'Manage alert settings' },
        { href: `${BASE_URL}/deals`, label: 'Browse deals' },
      ])
    )
  }
  if (state === 'success') {
    return managePage(
      `Done — no more ${city} alerts`,
      `You&rsquo;ll keep getting alerts for your other watched cities. Changed your mind? You can re-add ${city} anytime.`,
      links([
        { href: `${BASE_URL}/account#alerts`, label: 'Manage alert settings' },
        { href: `${BASE_URL}/destinations/${slug}`, label: `Browse ${city} deals` },
      ])
    )
  }
  if (state === 'success-off') {
    return managePage(
      'Deal alerts are off',
      `We removed ${city} and turned off deal alerts. Transactional account and billing emails may still be sent.`,
      links([
        { href: `${BASE_URL}/alerts/manage?token=${request.token}&action=daily`, label: 'Turn on the daily digest' },
        { href: `${BASE_URL}/account#alerts`, label: 'Manage alert settings' },
      ])
    )
  }
  if (state === 'confirm-last') {
    return managePage(
      `${city} is your only watched city`,
      'Stopping it turns off deal alerts entirely, since you&rsquo;re not watching any other cities.',
      confirmationForm(
        request,
        'Stop all alerts',
        links([
          { href: `${BASE_URL}/alerts/manage?token=${request.token}&action=daily`, label: 'Switch to daily digest instead' },
          { href: `${BASE_URL}/account#alerts`, label: 'Pick different cities' },
        ])
      )
    )
  }
  return managePage(
    `Stop alerts for ${city}?`,
    `You&rsquo;ll stop getting deal alerts for ${city}. Alerts for your other watched cities keep coming.`,
    confirmationForm(
      request,
      `Stop ${city} alerts`,
      `<a class="secondary" href="${BASE_URL}/deals">Keep ${city} alerts</a>`
    )
  )
}
