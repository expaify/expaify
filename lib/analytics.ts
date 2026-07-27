type AnalyticsProps = Record<string, string | number | boolean>

const SESSION_KEY = 'expaify.analytics.session.v1'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EVENT_NAME = /^[a-z][a-z0-9_]{1,79}$/
let inMemorySessionId: string | null = null

function sessionId(): string {
  if (inMemorySessionId && UUID.test(inMemorySessionId)) return inMemorySessionId
  const created = crypto.randomUUID()
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY)
    if (existing && UUID.test(existing)) {
      inMemorySessionId = existing
      return existing
    }
    window.sessionStorage.setItem(SESSION_KEY, created)
  } catch {
    // Storage can be disabled; retain a tab-lifetime in-memory session instead.
  }
  inMemorySessionId = created
  return created
}

/** The validated, always-on production sink: `/api/analytics` writes to Postgres. */
function sendToInternalSink(event: string, props?: AnalyticsProps): void {
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
}

/** Optional secondary delivery to an externally approved collector, production only. */
function sendToExternalSink(event: string, props?: AnalyticsProps): void {
  if (process.env.NODE_ENV !== 'production') return
  const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT
  if (!endpoint) return

  const body = JSON.stringify({ event, properties: props ?? {}, occurredAt: new Date().toISOString() })
  if (navigator.sendBeacon?.(endpoint, new Blob([body], { type: 'application/json' }))) return
  void fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
    credentials: 'omit',
  }).catch(() => undefined)
}

export function track(event: string, props?: AnalyticsProps): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event, props ?? {})
    return
  }

  if (typeof window === 'undefined' || !EVENT_NAME.test(event)) return

  try {
    sendToInternalSink(event, props)
  } catch {
    // Measurement must never block a search, edit, or provider handoff.
  }
  try {
    sendToExternalSink(event, props)
  } catch {
    // Measurement must never block a search, edit, or provider handoff.
  }
}
