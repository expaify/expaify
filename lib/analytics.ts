type AnalyticsProps = Record<string, string | number | boolean>

export function track(event: string, props?: AnalyticsProps): void {
  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event, props ?? {})
  }

  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return

  void fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, props: props ?? {} }),
    keepalive: true,
    credentials: 'same-origin',
  }).catch(() => {
    // Analytics delivery is best-effort and must never alter a user flow.
  })
}
