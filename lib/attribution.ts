export const ATTRIBUTION_STORAGE_KEY = 'expaify.attribution.v1'

export const UTM_FIELDS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const

export const UTM_VALUE_MAX_LENGTH = 200

export type UtmAttribution = Partial<Record<(typeof UTM_FIELDS)[number], string>>

function parseStoredUtm(value: string | null): UtmAttribution {
  if (!value) return {}

  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

  const utm: UtmAttribution = {}
  for (const field of UTM_FIELDS) {
    const candidate = (parsed as Record<string, unknown>)[field]
    if (typeof candidate === 'string' && candidate.trim()) {
      utm[field] = candidate.slice(0, UTM_VALUE_MAX_LENGTH)
    }
  }
  return utm
}

export function getStoredUtm(): UtmAttribution {
  if (typeof window === 'undefined') return {}

  try {
    return parseStoredUtm(window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY))
  } catch {
    return {}
  }
}

export function captureUtmAttribution(): UtmAttribution {
  if (typeof window === 'undefined') return {}

  try {
    const storedValue = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY)
    if (storedValue !== null) return parseStoredUtm(storedValue)

    const params = new URLSearchParams(window.location.search)
    const utm: UtmAttribution = {}
    for (const field of UTM_FIELDS) {
      const value = params.get(field)
      if (value?.trim()) utm[field] = value.slice(0, UTM_VALUE_MAX_LENGTH)
    }

    if (Object.keys(utm).length > 0) {
      window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(utm))
    }
    return utm
  } catch {
    return {}
  }
}
