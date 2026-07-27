// Client-safe presentation helpers for the admin console. No server-only
// imports here (no `pg`, no `@/lib/db/*`) so this module can be used from
// both server components and 'use client' components.

export function isPremiumStatus(status: string): boolean {
  return status === 'trialing' || status === 'active'
}

export function statusBadgeLabel(status: string, entitlementSource: string): string {
  if (status === 'canceled') return 'Canceled'
  if (entitlementSource === 'comp') return 'Comp access'
  if (status === 'trialing') return 'Premium trial'
  if (status === 'active') return 'Premium'
  return 'Free'
}

export function planLabel(plan: string | null): string {
  if (plan === 'monthly') return 'Monthly'
  if (plan === 'annual') return 'Annual'
  return 'Not set'
}

export function entitlementSourceLabel(source: string): string {
  if (source === 'stripe') return 'Stripe'
  if (source === 'comp') return 'Comp'
  return 'None'
}

export function alertPreferenceLabel(pref: string): string {
  if (pref === 'instant') return 'Instant'
  if (pref === 'daily') return 'Daily'
  return 'Off'
}

export function deliveryTypeLabel(type: string): string {
  return type === 'digest' ? 'Digest' : 'Instant'
}

export function privacyRequestStatusLabel(status: string): string {
  switch (status) {
    case 'requested':
      return 'Requested'
    case 'verifying':
      return 'Verifying'
    case 'in_progress':
      return 'In progress'
    case 'completed':
      return 'Completed'
    case 'rejected':
      return 'Rejected'
    default:
      return status
  }
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  account_viewed: 'Viewed account',
  account_searched: 'Searched',
  admin_access_denied: 'Access denied',
  comp_granted: 'Granted comp access',
  local_access_removed: 'Removed local access',
  stripe_handoff_opened: 'Opened Stripe Dashboard handoff',
  export_request_created: 'Created export request',
  deletion_request_created: 'Created deletion request',
}

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action
}

const MUTATION_ACTIONS = new Set([
  'comp_granted',
  'local_access_removed',
  'export_request_created',
  'deletion_request_created',
])

export function isMutationAction(action: string): boolean {
  return MUTATION_ACTIONS.has(action)
}

export function formatAdminDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
}

export function formatAdminDateOnly(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(d)
}

export type ConflictBannerTone = 'error' | 'warning' | 'info'

export interface ConflictBannerData {
  tone: ConflictBannerTone
  text: string
}

export interface ConflictBannerSubscriptionInput {
  status: string
  entitlementSource: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  currentPeriodEnd: string | null
  compExpiresAt: string | null
}

export interface ConflictBannerAlertsInput {
  alertPreference: string
}

export interface ConflictBannerInput {
  subscription: ConflictBannerSubscriptionInput | null
  alerts: ConflictBannerAlertsInput | null
  publicPriceAlertCount: number
}

// Mirrors design spec §8.2. Note: the "more than one subscriptions row"
// condition is not computable here — GET /api/admin/users/[userId] only
// ever returns a single subscription row (LIMIT 1 in lib/admin/dossier.ts),
// so that specific rule cannot be evaluated from this payload. Flagged as a
// backend gap; see handoff notes.
export function computeConflictBanners(input: ConflictBannerInput): ConflictBannerData[] {
  const banners: ConflictBannerData[] = []
  const sub = input.subscription
  const now = Date.now()

  if (sub) {
    if ((sub.stripeCustomerId || sub.stripeSubscriptionId) && sub.status === 'free') {
      banners.push({
        tone: 'error',
        text: 'Stripe IDs are on file, but local status is "free". A webhook update may have failed to apply — check Stripe before taking any action here.',
      })
    }

    const premium = isPremiumStatus(sub.status)

    if (premium && sub.entitlementSource !== 'comp' && !sub.stripeCustomerId) {
      banners.push({
        tone: 'warning',
        text: "Premium access with no Stripe customer on file. If this wasn't granted as comp access, billing is misconfigured.",
      })
    }

    if (sub.status === 'canceled' && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd).getTime() > now) {
      banners.push({
        tone: 'warning',
        text: `Status is canceled, but the current period runs until ${formatAdminDate(sub.currentPeriodEnd)}. Access may continue until then.`,
      })
    }

    if (
      sub.entitlementSource === 'comp' &&
      sub.compExpiresAt &&
      new Date(sub.compExpiresAt).getTime() < now &&
      premium
    ) {
      banners.push({
        tone: 'warning',
        text: `Comp access expired on ${formatAdminDate(sub.compExpiresAt)} but this account still shows premium. Remove local access or grant a new comp period.`,
      })
    }

    if (input.alerts && input.alerts.alertPreference === 'off' && premium) {
      banners.push({
        tone: 'warning',
        text: "This customer pays for premium but has deal alerts turned off. If they're asking why alerts stopped, this is why.",
      })
    }
  } else {
    banners.push({
      tone: 'info',
      text: 'No subscription record exists yet. This account has never started checkout or been granted comp access.',
    })
  }

  if (input.publicPriceAlertCount > 0) {
    banners.push({
      tone: 'info',
      text: `This email also has ${input.publicPriceAlertCount} public price alert(s) that aren't linked to this account. See Public Price Alerts below.`,
    })
  }

  const order: Record<ConflictBannerTone, number> = { error: 0, warning: 1, info: 2 }
  return [...banners].sort((a, b) => order[a.tone] - order[b.tone])
}
