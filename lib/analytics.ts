type AnalyticsProps = Record<string, string | number | boolean>

export function track(event: string, props?: AnalyticsProps): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event, props ?? {})
    return
  }

  if (process.env.NODE_ENV !== 'production' || typeof window === 'undefined') return
  const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT
  if (!endpoint) return

  const body = JSON.stringify({ event, properties: props ?? {}, occurredAt: new Date().toISOString() })
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const queued = navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))
      if (queued) return
    }
    void fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined)
  } catch {
    // Analytics must never block navigation or an in-progress booking handoff.
  }
}
