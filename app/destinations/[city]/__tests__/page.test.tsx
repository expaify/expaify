import { renderToStaticMarkup } from 'react-dom/server'
import { auth } from '@/auth'
import { query } from '@/lib/db/client'
import { getActiveDeals } from '@/lib/pipeline/dealDetection'
import { getFreeUnlockedDealIds, getPaywallContext } from '@/lib/paywall'
import { getSubscription, type Subscription } from '@/lib/subscription'
import CityPage from '../page'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db/client', () => ({ query: jest.fn() }))
jest.mock('@/lib/pipeline/dealDetection', () => ({ getActiveDeals: jest.fn() }))
jest.mock('@/lib/paywall', () => ({
  getFreeUnlockedDealIds: jest.fn(),
  getPaywallContext: jest.fn(),
}))
jest.mock('@/lib/subscription', () => ({
  getSubscription: jest.fn(),
  isPremium: (status: string) => status === 'active' || status === 'trialing',
}))

const mockAuth = auth as unknown as jest.Mock
const mockQuery = jest.mocked(query)
const mockGetActiveDeals = jest.mocked(getActiveDeals)
const mockGetFreeUnlockedDealIds = jest.mocked(getFreeUnlockedDealIds)
const mockGetPaywallContext = jest.mocked(getPaywallContext)
const mockGetSubscription = jest.mocked(getSubscription)

function subscription(
  status: Subscription['status'],
  watchlist: string[],
): Subscription {
  return {
    id: 'sub-1',
    userId: 'user-1',
    stripeCustomerId: 'cus-1',
    stripeSubscriptionId: 'stripe-sub-1',
    status,
    plan: 'monthly',
    trialEndsAt: null,
    currentPeriodEnd: null,
    alertPreference: 'daily',
    watchlist,
    alertMinDiscount: 40,
    alertTimezone: 'America/New_York',
    alertUnsubscribeToken: 'token',
    minDiscountPct: 40,
    onboardingDone: true,
  }
}

async function renderPage(sub: Subscription | null, signedIn = true): Promise<string> {
  mockAuth.mockResolvedValue(signedIn ? { user: { id: 'user-1' } } : null)
  mockQuery.mockResolvedValue({
    command: 'SELECT',
    rowCount: 1,
    oid: 0,
    fields: [],
    rows: [{ id: 1 }],
  })
  mockGetActiveDeals.mockResolvedValue([])
  mockGetFreeUnlockedDealIds.mockResolvedValue(new Set())
  mockGetPaywallContext.mockResolvedValue({
    userId: signedIn ? 'user-1' : null,
    premium: sub?.status === 'active' || sub?.status === 'trialing',
    freeUnlockedThisWeek: 0,
    freeUnlockLimit: 3,
  })
  mockGetSubscription.mockResolvedValue(sub)

  return renderToStaticMarkup(await CityPage({ params: Promise.resolve({ city: 'miami' }) }))
}

describe('destination empty-state watch control', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    {
      label: 'not watching',
      sub: subscription('active', []),
      expectedLabel: 'Watch Miami',
      pressed: 'false',
      disabled: false,
    },
    {
      label: 'watching',
      sub: subscription('trialing', ['Miami']),
      expectedLabel: 'Watching Miami',
      pressed: 'true',
      disabled: false,
    },
    {
      label: 'at cap',
      sub: subscription('active', [
        'New York',
        'Cancún',
        'Paris',
        'Rome',
        'Barcelona',
        'Lisbon',
        'London',
        'Tokyo',
        'Bangkok',
        'Dubai',
      ]),
      expectedLabel: 'Watch Miami',
      pressed: 'false',
      disabled: true,
    },
  ])('renders one Premium control when empty and $label', async ({
    sub,
    expectedLabel,
    pressed,
    disabled,
  }) => {
    const html = await renderPage(sub)

    expect(html).toContain('No Miami deals right now.')
    expect(html.match(/Watch(?:ing)? Miami/g)).toHaveLength(1)
    expect(html).toContain(expectedLabel)
    expect(html).toContain(`aria-pressed="${pressed}"`)
    expect(html.includes('aria-disabled="true"')).toBe(disabled)
    expect(html).not.toContain('Premium members get an email')
    expect(html).not.toContain('Get Miami deal alerts')
    expect(html).not.toContain('Get Miami alerts with Premium')
  })

  it.each([
    {
      label: 'free',
      sub: subscription('free', []),
      signedIn: true,
      expected: 'Get Miami alerts with Premium',
    },
    {
      label: 'anonymous',
      sub: null,
      signedIn: false,
      expected: 'Get Miami deal alerts',
    },
  ])('preserves the $label empty-state upsell', async ({ sub, signedIn, expected }) => {
    const html = await renderPage(sub, signedIn)

    expect(html).toContain(expected)
    expect(html).not.toContain('aria-pressed=')
  })

  it('keeps the empty page usable at 375px and constrained at 1280px', async () => {
    const html = await renderPage(subscription('active', []))

    expect(html).toContain('max-w-[1200px]')
    expect(html).toContain('px-4')
    expect(html).toContain('sm:px-6')
    expect(html).toContain('lg:px-8')
    expect(html).toContain('min-h-[36px]')
    expect(html).toContain('min-h-[44px]')
  })
})
