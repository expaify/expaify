type AnalyticsProps = Record<string, string | number | boolean>

const SESSION_KEY = 'expaify.analytics.session.v1'

function sessionId(): string {
  const existing = window.sessionStorage.getItem(SESSION_KEY)
  if (existing) return existing
  const created = crypto.randomUUID()
  window.sessionStorage.setItem(SESSION_KEY, created)
  return created
}

export function track(event: string, props?: AnalyticsProps): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event, props ?? {})
  }

  if (typeof window === 'undefined' || !/^[a-z][a-z0-9_]{1,79}$/.test(event)) return
  try {
    const body = JSON.stringify({
      eventId: crypto.randomUUID(),
      sessionId: sessionId(),
      event,
      occurredAt: new Date().toISOString(),
      path: window.location.pathname,
      props: props ?? {},
    })
    if (navigator.sendBeacon?.('/api/analytics', new Blob([body], { type: 'application/json' }))) return
    void fetch('/api/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => undefined)
  } catch {
    // Measurement must never block a search, edit, or provider handoff.
  }
}
