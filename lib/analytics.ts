type AnalyticsProps = Record<string, string | number | boolean>

const OFFER_KEY_SALT_STORAGE_KEY = 'expaify:analytics-offer-key-salt'

function hashOfferKey(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36).padStart(7, '0')
}

function getSessionSalt(): string {
  if (typeof window === 'undefined') return 'server-render'
  try {
    const existing = sessionStorage.getItem(OFFER_KEY_SALT_STORAGE_KEY)
    if (existing) return existing
    const created = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
    sessionStorage.setItem(OFFER_KEY_SALT_STORAGE_KEY, created)
    return created
  } catch {
    return 'storage-unavailable'
  }
}

/** Session-scoped join key; never exposes the supplier's raw offer identifier. */
export function ephemeralOfferKey(offerId: string): string {
  const salt = getSessionSalt()
  return `offer_${hashOfferKey(`${salt}:${offerId}`)}${hashOfferKey(`${offerId}:${salt}`)}`
}

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
