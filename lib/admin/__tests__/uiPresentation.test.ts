import { computeConflictBanners, statusBadgeLabel } from '@/lib/admin/uiPresentation'

describe('statusBadgeLabel', () => {
  it('prioritizes canceled over everything else', () => {
    expect(statusBadgeLabel('canceled', 'comp')).toBe('Canceled')
  })
  it('shows comp access when entitlement source is comp', () => {
    expect(statusBadgeLabel('active', 'comp')).toBe('Comp access')
  })
  it('shows premium trial for trialing status', () => {
    expect(statusBadgeLabel('trialing', 'stripe')).toBe('Premium trial')
  })
  it('shows premium for active status', () => {
    expect(statusBadgeLabel('active', 'stripe')).toBe('Premium')
  })
  it('defaults to free', () => {
    expect(statusBadgeLabel('free', 'none')).toBe('Free')
  })
})

describe('computeConflictBanners', () => {
  it('flags stripe ids on file with free status as an error', () => {
    const banners = computeConflictBanners({
      subscription: {
        status: 'free',
        entitlementSource: 'none',
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        compExpiresAt: null,
      },
      alerts: null,
      publicPriceAlertCount: 0,
    })
    expect(banners[0].tone).toBe('error')
    expect(banners[0].text).toMatch(/webhook update may have failed/)
  })

  it('flags premium with no stripe customer as a warning when not comp', () => {
    const banners = computeConflictBanners({
      subscription: {
        status: 'active',
        entitlementSource: 'none',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        compExpiresAt: null,
      },
      alerts: null,
      publicPriceAlertCount: 0,
    })
    expect(banners.some((b) => b.tone === 'warning' && /no Stripe customer on file/.test(b.text))).toBe(true)
  })

  it('does not flag premium-with-no-stripe when entitlement source is comp', () => {
    const banners = computeConflictBanners({
      subscription: {
        status: 'active',
        entitlementSource: 'comp',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        compExpiresAt: null,
      },
      alerts: null,
      publicPriceAlertCount: 0,
    })
    expect(banners.some((b) => /no Stripe customer on file/.test(b.text))).toBe(false)
  })

  it('flags canceled status with a future period end', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    const banners = computeConflictBanners({
      subscription: {
        status: 'canceled',
        entitlementSource: 'stripe',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        currentPeriodEnd: future,
        compExpiresAt: null,
      },
      alerts: null,
      publicPriceAlertCount: 0,
    })
    expect(banners.some((b) => /current period runs until/.test(b.text))).toBe(true)
  })

  it('flags expired comp access still showing premium', () => {
    const past = new Date(Date.now() - 86400000).toISOString()
    const banners = computeConflictBanners({
      subscription: {
        status: 'active',
        entitlementSource: 'comp',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        compExpiresAt: past,
      },
      alerts: null,
      publicPriceAlertCount: 0,
    })
    expect(banners.some((b) => /Comp access expired on/.test(b.text))).toBe(true)
  })

  it('flags alerts off for a premium customer', () => {
    const banners = computeConflictBanners({
      subscription: {
        status: 'active',
        entitlementSource: 'stripe',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        currentPeriodEnd: null,
        compExpiresAt: null,
      },
      alerts: { alertPreference: 'off' },
      publicPriceAlertCount: 0,
    })
    expect(banners.some((b) => /deal alerts turned off/.test(b.text))).toBe(true)
  })

  it('shows an info banner when there is no subscription record', () => {
    const banners = computeConflictBanners({ subscription: null, alerts: null, publicPriceAlertCount: 0 })
    expect(banners).toHaveLength(1)
    expect(banners[0].tone).toBe('info')
    expect(banners[0].text).toMatch(/never started checkout/)
  })

  it('shows an info banner when public price alerts exist for the email', () => {
    const banners = computeConflictBanners({
      subscription: { status: 'free', entitlementSource: 'none', stripeCustomerId: null, stripeSubscriptionId: null, currentPeriodEnd: null, compExpiresAt: null },
      alerts: null,
      publicPriceAlertCount: 2,
    })
    expect(banners.some((b) => b.tone === 'info' && /2 public price alert\(s\)/.test(b.text))).toBe(true)
  })

  it('orders banners error, then warning, then info', () => {
    const past = new Date(Date.now() - 86400000).toISOString()
    const banners = computeConflictBanners({
      subscription: {
        status: 'free',
        entitlementSource: 'comp',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        compExpiresAt: past,
      },
      alerts: null,
      publicPriceAlertCount: 1,
    })
    const tones = banners.map((b) => b.tone)
    const sorted = [...tones].sort((a, b) => ({ error: 0, warning: 1, info: 2 }[a] - { error: 0, warning: 1, info: 2 }[b]))
    expect(tones).toEqual(sorted)
  })

  it('returns no banners for a clean premium-via-stripe account', () => {
    const banners = computeConflictBanners({
      subscription: {
        status: 'active',
        entitlementSource: 'stripe',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        currentPeriodEnd: null,
        compExpiresAt: null,
      },
      alerts: { alertPreference: 'instant' },
      publicPriceAlertCount: 0,
    })
    expect(banners).toHaveLength(0)
  })
})
