'use client'

import { useRef, useState } from 'react'
import { CopyButton } from './CopyButton'
import { ConflictBannerList } from './ConflictBanner'
import { AuditLogTable } from './AuditLogTable'
import { AdminMutationDialog, StripeHandoffDialog, type AdminMutationDialogConfig } from './AdminMutationDialog'
import {
  alertPreferenceLabel,
  computeConflictBanners,
  deliveryTypeLabel,
  entitlementSourceLabel,
  formatAdminDate,
  isPremiumStatus,
  planLabel,
  privacyRequestStatusLabel,
  statusBadgeLabel,
} from '@/lib/admin/uiPresentation'
import { formatMoney } from '@/lib/money'
import type { AdminDossier } from '@/lib/admin/dossier'
import type { Result } from '@/lib/types'

type DialogKind = 'grant-comp' | 'remove-access' | 'stripe-handoff' | 'export-request' | 'deletion-request' | null

interface AdminAccountDossierProps {
  initialDossier: AdminDossier
  userId: string
  adminEmail: string
}

async function postJson(url: string, body: unknown): Promise<Result<unknown>> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return (await res.json()) as Result<unknown>
  } catch {
    return { ok: false, reason: 'Network error' }
  }
}

export function AdminAccountDossier({ initialDossier, userId, adminEmail }: AdminAccountDossierProps) {
  const [dossier, setDossier] = useState(initialDossier)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [refetchError, setRefetchError] = useState(false)

  const subscriptionHeadingRef = useRef<HTMLHeadingElement>(null)
  const privacyHeadingRef = useRef<HTMLHeadingElement>(null)
  const grantTriggerRef = useRef<HTMLButtonElement>(null)
  const removeTriggerRef = useRef<HTMLButtonElement>(null)
  const stripeTriggerRef = useRef<HTMLButtonElement>(null)
  const exportTriggerRef = useRef<HTMLButtonElement>(null)
  const deletionTriggerRef = useRef<HTMLButtonElement>(null)

  const { identity, subscription, alerts, publicPriceAlerts, exportRequests, deletionRequests, auditLog } = dossier
  const email = identity.email ?? 'this account'

  const banners = computeConflictBanners({
    subscription,
    alerts: alerts ? { alertPreference: alerts.alertPreference } : null,
    publicPriceAlertCount: publicPriceAlerts.length,
  })

  async function refetch() {
    try {
      const res = await fetch(`/api/admin/users/${userId}`)
      const body = (await res.json()) as Result<AdminDossier>
      if (body.ok) {
        setDossier(body.data)
        setRefetchError(false)
      } else {
        setRefetchError(true)
      }
    } catch {
      setRefetchError(true)
    }
  }

  function closeDialog(triggerRef?: React.RefObject<HTMLButtonElement | null>) {
    setDialog(null)
    if (triggerRef) window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  function handleSuccess(message: string, headingRef: React.RefObject<HTMLHeadingElement | null>) {
    setDialog(null)
    setSuccessBanner(message)
    void refetch()
    window.requestAnimationFrame(() => headingRef.current?.focus())
  }

  const grantCompConfig: AdminMutationDialogConfig = {
    title: 'Grant comp access',
    body: `This gives ${email} expaify premium access without a Stripe subscription. It does not create a Stripe subscription and does not charge anyone.`,
    fieldKind: 'reason',
    fieldLabel: 'Reason for comp access',
    fieldPlaceholder: 'e.g. Support ticket #4821 — refunded customer, restoring access as goodwill',
    errorActionPhrase: 'granting access',
    includeExpiry: true,
    beforeText: `Before: ${subscription ? statusBadgeLabel(subscription.status, subscription.entitlementSource) : 'Free'}, entitlement source ${
      subscription ? entitlementSourceLabel(subscription.entitlementSource) : 'None'
    }`,
    afterText: (expiresAt) =>
      `After: Comp access, entitlement source Comp, granted by ${adminEmail}, ${expiresAt ? formatAdminDate(new Date(expiresAt).toISOString()) : 'no expiry'}`,
    stripeImpact: 'No Stripe billing impact. This does not create, modify, or cancel any Stripe subscription.',
    confirmLabel: 'Grant comp access',
    confirmingLabel: 'Granting…',
    failureMessage: "Couldn't grant comp access. Nothing changed — try again.",
    onConfirm: ({ text, expiresAt }) => postJson(`/api/admin/users/${userId}/comp`, { reason: text, expiresAt }),
  }

  const removeAccessConfig: AdminMutationDialogConfig = {
    title: 'Remove local access',
    body: `This ends ${email}'s premium access in expaify. It does not cancel or change anything in Stripe.`,
    warning:
      subscription?.entitlementSource === 'stripe'
        ? "This customer's premium access comes from an active Stripe subscription. Removing local access will not stop Stripe from billing them — cancel the Stripe subscription separately."
        : undefined,
    fieldKind: 'reason',
    fieldLabel: 'Reason for removing access',
    fieldPlaceholder: 'e.g. Support ticket #4821 — customer requested downgrade',
    errorActionPhrase: 'removing access',
    beforeText: `Before: ${subscription ? statusBadgeLabel(subscription.status, subscription.entitlementSource) : 'Free'} (${
      subscription ? entitlementSourceLabel(subscription.entitlementSource) : 'None'
    })`,
    afterText: 'After: Free — local access removed',
    stripeImpact: "No Stripe billing impact. If a Stripe subscription is still active, it keeps billing until it's canceled in Stripe.",
    confirmLabel: 'Remove local access',
    confirmingLabel: 'Removing…',
    failureMessage: "Couldn't remove local access. Nothing changed — try again.",
    onConfirm: ({ text }) => postJson(`/api/admin/users/${userId}/remove-access`, { reason: text }),
  }

  const exportConfig: AdminMutationDialogConfig = {
    title: 'Create data export request',
    body: `This creates a tracked request to export ${email}'s account data. It does not send the export — it queues the request for review.`,
    fieldKind: 'source',
    fieldLabel: 'Request source',
    fieldPlaceholder: 'e.g. Support ticket #4821, or "customer emailed questions@expaify.com on Jul 18"',
    errorActionPhrase: 'creating this request',
    beforeText:
      exportRequests.length === 0 ? 'Before: No open export request.' : `Before: ${exportRequests.length} existing export request(s).`,
    afterText: 'After: New export request — status Requested.',
    stripeImpact: 'No Stripe billing impact.',
    confirmLabel: 'Create export request',
    confirmingLabel: 'Creating…',
    failureMessage: "Couldn't create the export request. Nothing changed — try again.",
    onConfirm: ({ text }) => postJson(`/api/admin/users/${userId}/export-request`, { source: text }),
  }

  const deletionConfig: AdminMutationDialogConfig = {
    title: 'Create account deletion request',
    body: `This creates a tracked request to delete ${email}'s account data. Nothing is deleted now — deletion happens in a separate reviewed step.`,
    fieldKind: 'source',
    fieldLabel: 'Request source',
    fieldPlaceholder: 'e.g. Support ticket #4821, or "customer emailed questions@expaify.com on Jul 18"',
    errorActionPhrase: 'creating this request',
    beforeText:
      deletionRequests.length === 0
        ? 'Before: No open deletion request.'
        : `Before: ${deletionRequests.length} existing deletion request(s).`,
    afterText: 'After: New deletion request — status Requested.',
    stripeImpact:
      'No Stripe billing impact. If a Stripe subscription is still active, cancel it in Stripe separately — deleting local data does not stop Stripe billing.',
    confirmLabel: 'Create deletion request',
    confirmingLabel: 'Creating…',
    failureMessage: "Couldn't create the deletion request. Nothing changed — try again.",
    onConfirm: ({ text }) => postJson(`/api/admin/users/${userId}/deletion-request`, { source: text }),
  }

  const canGrantComp = !subscription || subscription.entitlementSource !== 'comp'
  const canRemoveAccess = !!subscription && isPremiumStatus(subscription.status)
  const canCancelStripe = !!subscription?.stripeSubscriptionId

  return (
    <div className="mx-auto max-w-full px-4 py-6 sm:max-w-[960px] sm:px-5 sm:py-10">
      <a href="/admin/users" className="text-sm font-medium text-[var(--brand)] no-underline">
        ← Back to user lookup
      </a>

      {successBanner && (
        <div className="mt-4 flex items-start justify-between gap-4 rounded-[var(--radius-control)] border border-[var(--success)] bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--text-1)]">
          <span>{successBanner}</span>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            aria-label="Dismiss message"
            className="shrink-0 text-lg leading-none text-[var(--text-2)] hover:text-[var(--text-1)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
          >
            ×
          </button>
        </div>
      )}

      {refetchError && (
        <div className="mt-4 rounded-[var(--radius-control)] border border-[var(--error)] bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--text-1)]">
          Couldn&apos;t refresh account data.{' '}
          <button type="button" onClick={() => void refetch()} className="font-medium underline">
            Retry
          </button>
        </div>
      )}

      <div className="mt-6">
        <ConflictBannerList banners={banners} />
      </div>

      {/* Identity */}
      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] p-6">
        <h2 className="text-h3 text-[var(--text-1)]">Identity</h2>
        <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-[180px_1fr] sm:gap-y-2">
          <Field label="Name" value={identity.name || 'No name on file'} />
          <Field label="Email" value={identity.email || 'Not set'} copy={identity.email ?? undefined} copyLabel="email" />
          <Field label="User ID" value={identity.userId} copy={identity.userId} copyLabel="user ID" />
          <Field
            label="Auth providers"
            value={identity.authProviders.length > 0 ? identity.authProviders.join(', ') : 'Email link'}
          />
          <Field label="Email verified" value={identity.emailVerified ? `Verified ${formatAdminDate(identity.emailVerified)}` : 'Not verified'} />
          <Field label="Account created" value="Not tracked" />
        </dl>
      </section>

      {/* Subscription */}
      <section className="mt-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] p-6">
        <h2 ref={subscriptionHeadingRef} tabIndex={-1} className="text-h3 text-[var(--text-1)] focus-visible:outline-none">
          Subscription
        </h2>

        {!subscription ? (
          <p className="mt-3 text-sm text-[var(--text-2)]">
            This account has no subscription record. Granting comp access creates one with premium access and no
            Stripe billing.
          </p>
        ) : (
          <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-[180px_1fr] sm:gap-y-2">
            <Field label="Status" value={statusBadgeLabel(subscription.status, subscription.entitlementSource)} />
            <Field
              label="Premium access right now"
              value={isPremiumStatus(subscription.status) ? 'Yes' : 'No'}
              helper="This is what the app checks when gating premium features."
            />
            <Field label="Entitlement source" value={entitlementSourceLabel(subscription.entitlementSource)} />
            <Field label="Plan" value={planLabel(subscription.plan)} />
            <Field label="Trial ends" value={subscription.trialEndsAt ? formatAdminDate(subscription.trialEndsAt) : 'Not set'} />
            <Field label="Current period end" value={subscription.currentPeriodEnd ? formatAdminDate(subscription.currentPeriodEnd) : 'Not set'} />
            <Field
              label="Stripe customer ID"
              value={subscription.stripeCustomerId || 'Not set'}
              copy={subscription.stripeCustomerId ?? undefined}
              copyLabel="Stripe customer ID"
            />
            <Field
              label="Stripe subscription ID"
              value={subscription.stripeSubscriptionId || 'Not set'}
              copy={subscription.stripeSubscriptionId ?? undefined}
              copyLabel="Stripe subscription ID"
            />
            {subscription.entitlementSource === 'comp' && (
              <>
                <Field label="Comp reason" value={subscription.compReason || 'Not set'} />
                <Field label="Granted by" value={subscription.compGrantedBy || 'Not set'} />
                <Field label="Expires" value={subscription.compExpiresAt ? formatAdminDate(subscription.compExpiresAt) : 'Not set'} />
              </>
            )}
            <Field label="Last updated" value={subscription.updatedAt ? formatAdminDate(subscription.updatedAt) : 'Not set'} />
          </dl>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {canGrantComp && (
            <button
              ref={grantTriggerRef}
              type="button"
              onClick={() => setDialog('grant-comp')}
              className="min-h-11 rounded-[var(--radius-control)] bg-[var(--brand)] px-4 text-sm font-medium text-[var(--text-inverse)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              Grant comp access
            </button>
          )}
          {canRemoveAccess && (
            <button
              ref={removeTriggerRef}
              type="button"
              onClick={() => setDialog('remove-access')}
              className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 text-sm font-medium text-[var(--text-1)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              Remove local access
            </button>
          )}
          {subscription?.stripeSubscriptionId && (
            <div>
              <button
                ref={stripeTriggerRef}
                type="button"
                disabled={!subscription.stripeCustomerId}
                onClick={() => setDialog('stripe-handoff')}
                className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 text-sm font-medium text-[var(--text-1)] disabled:opacity-60 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
              >
                Cancel in Stripe
              </button>
              {!subscription.stripeCustomerId && (
                <p className="mt-1 text-xs text-[var(--text-3)]">No Stripe customer ID on file, so there&apos;s nothing to open in Stripe.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Alerts & Watchlist */}
      <section className="mt-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] p-6">
        <h2 className="text-h3 text-[var(--text-1)]">Alerts & Watchlist</h2>
        <p className="mt-1 text-xs text-[var(--text-3)]">
          Read-only. Alert settings are changed by the customer in their account, or by a future admin tool with the
          same audit rules.
        </p>

        {!alerts ? (
          <p className="mt-3 text-sm text-[var(--text-2)]">Not set.</p>
        ) : (
          <>
            <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-[180px_1fr] sm:gap-y-2">
              <Field label="Alert preference" value={alertPreferenceLabel(alerts.alertPreference)} />
              <Field label="Minimum discount" value={`${alerts.alertMinDiscount}%`} />
              <Field label="Timezone" value={alerts.alertTimezone} />
              <Field
                label="Watchlist"
                value={alerts.watchlist.length > 0 ? alerts.watchlist.join(', ') : 'All destinations'}
                helper={alerts.watchlist.length === 0 ? 'An empty watchlist means every destination, not none.' : undefined}
              />
              <Field label="Unsubscribe token" value="Token active (hidden)" />
              <Field label="Last alerted" value={alerts.lastAlertedAt ? formatAdminDate(alerts.lastAlertedAt) : 'Never'} />
            </dl>

            <h3 className="mt-5 text-sm font-medium text-[var(--text-1)]">Recent deliveries</h3>
            {alerts.recentDeliveries.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--text-2)]">No deal alerts delivered yet.</p>
            ) : (
              <div className="mt-2 overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-strong)] text-xs text-[var(--text-3)]">
                      <th scope="col" className="px-3 py-2 font-medium">Deal ID</th>
                      <th scope="col" className="px-3 py-2 font-medium">Type</th>
                      <th scope="col" className="px-3 py-2 font-medium">Delivered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.recentDeliveries.map((d, i) => (
                      <tr key={i} className="border-b border-[var(--border)] last:border-b-0">
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-2 break-all">
                            {d.dealId.slice(0, 8)}
                            <CopyButton value={d.dealId} fieldLabel="deal ID" />
                          </span>
                        </td>
                        <td className="px-3 py-2">{deliveryTypeLabel(d.deliveryType)}</td>
                        <td className="px-3 py-2">{formatAdminDate(d.deliveredAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* Public Price Alerts */}
      <section className="mt-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] p-6">
        <h2 className="text-h3 text-[var(--text-1)]">Public Price Alerts</h2>
        <p className="mt-1 text-xs text-[var(--text-3)]">
          Public price alerts are created by email without an account. They are a separate system from this
          customer&apos;s watchlist.
        </p>
        {publicPriceAlerts.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-2)]">No public price alerts for this email.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {publicPriceAlerts.map((a) => (
              <div key={a.id} className="rounded-[var(--radius-control)] border border-[var(--border)] px-4 py-3 text-sm">
                <p className="font-medium text-[var(--text-1)]">
                  {a.hotelId ? `Hotel ${a.hotelId}` : `${a.origin ?? '—'} → ${a.destination ?? '—'}`}
                </p>
                <p className="mt-1 text-[var(--text-2)]">
                  Target {formatMoney({ priceCents: a.targetCents, currency: a.currency })} ·{' '}
                  {a.active ? 'Active' : 'Inactive'} · Created {formatAdminDate(a.createdAt)} ·{' '}
                  {a.lastCheckedAt ? `Last checked ${formatAdminDate(a.lastCheckedAt)}` : 'Never checked'} ·{' '}
                  {a.triggeredAt ? `Triggered ${formatAdminDate(a.triggeredAt)}` : 'Not triggered'}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Privacy Requests */}
      <section className="mt-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] p-6">
        <h2 ref={privacyHeadingRef} tabIndex={-1} className="text-h3 text-[var(--text-1)] focus-visible:outline-none">
          Privacy Requests
        </h2>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-[var(--text-1)]">Export requests</h3>
            <button
              ref={exportTriggerRef}
              type="button"
              onClick={() => setDialog('export-request')}
              className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-sm font-medium text-[var(--text-1)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              Create export request
            </button>
          </div>
          {exportRequests.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-2)]">No export requests for this account.</p>
          ) : (
            <PrivacyRequestList rows={exportRequests} />
          )}
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-[var(--text-1)]">Deletion requests</h3>
            <button
              ref={deletionTriggerRef}
              type="button"
              onClick={() => setDialog('deletion-request')}
              className="min-h-11 rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-sm font-medium text-[var(--text-1)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              Create deletion request
            </button>
          </div>
          {deletionRequests.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-2)]">No deletion requests for this account.</p>
          ) : (
            <PrivacyRequestList rows={deletionRequests} />
          )}
        </div>
      </section>

      {/* Audit Log */}
      <section className="mt-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-surface)] p-6">
        <h2 className="text-h3 text-[var(--text-1)]">Audit Log</h2>
        <p className="mt-1 text-xs text-[var(--text-3)]">
          Opening this page added a &quot;Viewed account&quot; entry below. Account views are logged.
        </p>
        <div className="mt-4">
          <AuditLogTable rows={auditLog} />
        </div>
      </section>

      {dialog === 'grant-comp' && (
        <AdminMutationDialog
          config={grantCompConfig}
          onClose={() => closeDialog(grantTriggerRef)}
          onSuccess={() => handleSuccess(`Comp access granted for ${email}.`, subscriptionHeadingRef)}
        />
      )}
      {dialog === 'remove-access' && (
        <AdminMutationDialog
          config={removeAccessConfig}
          onClose={() => closeDialog(removeTriggerRef)}
          onSuccess={() => handleSuccess(`Local access removed for ${email}.`, subscriptionHeadingRef)}
        />
      )}
      {dialog === 'stripe-handoff' && subscription?.stripeCustomerId && (
        <StripeHandoffDialog
          email={email}
          stripeCustomerId={subscription.stripeCustomerId}
          onClose={() => closeDialog(stripeTriggerRef)}
        />
      )}
      {dialog === 'export-request' && (
        <AdminMutationDialog
          config={exportConfig}
          onClose={() => closeDialog(exportTriggerRef)}
          onSuccess={() => handleSuccess(`Export request created for ${email}. Status: Requested.`, privacyHeadingRef)}
        />
      )}
      {dialog === 'deletion-request' && (
        <AdminMutationDialog
          config={deletionConfig}
          onClose={() => closeDialog(deletionTriggerRef)}
          onSuccess={() => handleSuccess(`Deletion request created for ${email}. Status: Requested.`, privacyHeadingRef)}
        />
      )}
    </div>
  )
}

function Field({
  label,
  value,
  helper,
  copy,
  copyLabel,
}: {
  label: string
  value: string
  helper?: string
  copy?: string
  copyLabel?: string
}) {
  return (
    <>
      <dt className="text-xs text-[var(--text-3)] sm:text-sm sm:text-[var(--text-2)]">{label}</dt>
      <dd className="mb-2 break-all text-[var(--text-1)] sm:mb-0">
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>{value}</span>
          {copy && copyLabel && <CopyButton value={copy} fieldLabel={copyLabel} />}
        </span>
        {helper && <span className="mt-0.5 block text-xs text-[var(--text-3)]">{helper}</span>}
      </dd>
    </>
  )
}

function PrivacyRequestList({
  rows,
}: {
  rows: { id: string; status: string; source: string | null; actorUserId: string; createdAt: string }[]
}) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.id} className="rounded-[var(--radius-control)] border border-[var(--border)] px-4 py-3 text-sm">
          <span className="rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--bg-muted)] px-2 py-0.5 text-xs font-medium text-[var(--text-1)]">
            {privacyRequestStatusLabel(r.status)}
          </span>
          <span className="ml-2 text-[var(--text-2)]">{formatAdminDate(r.createdAt)}</span>
          {r.source && <p className="mt-1 text-[var(--text-2)]">{r.source}</p>}
        </div>
      ))}
    </div>
  )
}
