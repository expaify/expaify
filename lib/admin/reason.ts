// Shared validation for the reason/source field required on every audited
// admin mutation (grant comp, remove access, export/deletion requests).
export const MIN_REASON_LENGTH = 10

export function validateReason(raw: unknown): { ok: true; value: string } | { ok: false; reason: string } {
  if (typeof raw !== 'string') {
    return { ok: false, reason: `Reason must be at least ${MIN_REASON_LENGTH} characters` }
  }
  const trimmed = raw.trim()
  if (trimmed.length < MIN_REASON_LENGTH) {
    return { ok: false, reason: `Reason must be at least ${MIN_REASON_LENGTH} characters` }
  }
  return { ok: true, value: trimmed }
}
