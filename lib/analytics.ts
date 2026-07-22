type AnalyticsProps = Record<string, string | number | boolean>

const PRODUCTION_EVENTS = new Set([
  'hotel_smoking_policy_detail_viewed',
  'hotel_smoking_filter_explanation_viewed',
  'hotel_smoking_filter_option_selected',
  'hotel_smoking_filter_results_rendered',
  'hotel_smoking_policy_review_viewed',
  'hotel_handoff_return_reason_selected',
])

let inMemorySessionId: string | undefined

function analyticsSessionId(): string {
  if (inMemorySessionId) return inMemorySessionId
  const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  try {
    const stored = window.sessionStorage.getItem('expaify_analytics_session')
    if (stored) return (inMemorySessionId = stored)
    window.sessionStorage.setItem('expaify_analytics_session', generated)
  } catch {
    // Storage can be unavailable; the in-memory id still deduplicates this view.
  }
  return (inMemorySessionId = generated)
}

export function track(event: string, props?: AnalyticsProps): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event, props ?? {})
  }

  if (typeof window === 'undefined' || !PRODUCTION_EVENTS.has(event)) return
  try {
    void fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, props: props ?? {}, sessionId: analyticsSessionId() }),
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // Measurement must never alter product behavior.
  }
}
