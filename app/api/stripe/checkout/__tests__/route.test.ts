import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { auth } from '@/auth'
import { getSubscription } from '@/lib/subscription'
import { POST } from '../route'

const mockCreateCheckoutSession = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockCreateCheckoutSession,
      },
    },
  }))
})

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}))

jest.mock('@/lib/subscription', () => ({
  getSubscription: jest.fn(),
}))

const mockAuth = auth as unknown as jest.Mock
const mockGetSubscription = getSubscription as jest.MockedFunction<typeof getSubscription>
const MockStripe = Stripe as unknown as jest.Mock

function checkoutRequest(body: unknown): NextRequest {
  return new NextRequest('https://expaify.test/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/stripe/checkout', () => {
  const originalEnv = {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PRICE_MONTHLY: process.env.STRIPE_PRICE_MONTHLY,
    STRIPE_PRICE_ANNUAL: process.env.STRIPE_PRICE_ANNUAL,
  }

  beforeEach(() => {
    process.env.NEXTAUTH_URL = 'https://expaify.com'
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    process.env.STRIPE_PRICE_MONTHLY = 'price_monthly_123'
    process.env.STRIPE_PRICE_ANNUAL = 'price_annual_123'

    mockCreateCheckoutSession.mockReset()
    mockCreateCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.test/session_123' })
    mockAuth.mockReset()
    mockAuth.mockResolvedValue({
      user: { id: 'user_123', email: 'traveler@example.com' },
      expires: '2099-01-01T00:00:00.000Z',
    })
    mockGetSubscription.mockReset()
    mockGetSubscription.mockResolvedValue(null)
    MockStripe.mockClear()
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    jest.restoreAllMocks()
  })

  it('creates a Stripe Checkout session for a signed-in free user from account', async () => {
    const response = await POST(checkoutRequest({ plan: 'annual' }))
    const body = (await response.json()) as { url?: string; error?: string }

    expect(response.status).toBe(200)
    expect(body).toEqual({ url: 'https://checkout.stripe.test/session_123' })
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith({
      mode: 'subscription',
      line_items: [{ price: 'price_annual_123', quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { user_id: 'user_123', plan: 'annual' },
      },
      success_url: 'https://expaify.com/account?checkout=success',
      cancel_url: 'https://expaify.com/account',
      metadata: { user_id: 'user_123', plan: 'annual' },
      customer_email: 'traveler@example.com',
    })
  })

  it('uses an existing Stripe customer when the account already has one', async () => {
    mockGetSubscription.mockResolvedValue({
      id: 'sub_123',
      userId: 'user_123',
      stripeCustomerId: 'cus_existing',
      stripeSubscriptionId: null,
      status: 'free',
      plan: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      alertPreference: 'daily',
      watchlist: [],
      alertMinDiscount: 40,
      alertTimezone: 'America/New_York',
      alertUnsubscribeToken: 'token',
      minDiscountPct: 40,
      onboardingDone: false,
    })

    const response = await POST(checkoutRequest({ plan: 'monthly' }))

    expect(response.status).toBe(200)
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_monthly_123', quantity: 1 }],
        customer: 'cus_existing',
        metadata: { user_id: 'user_123', plan: 'monthly' },
      })
    )
    expect(mockCreateCheckoutSession.mock.calls[0][0]).not.toHaveProperty('customer_email')
  })

  it('returns unauthorized without creating checkout when the user is signed out', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await POST(checkoutRequest({ plan: 'annual' }))
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: 'Unauthorized' })
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
  })

  it('returns a public configuration error when Stripe prices are missing', async () => {
    delete process.env.STRIPE_PRICE_ANNUAL

    const response = await POST(checkoutRequest({ plan: 'annual' }))
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(503)
    expect(body).toEqual({
      error: 'Billing is not configured yet. Contact support and we will finish your upgrade.',
    })
    expect(mockCreateCheckoutSession).not.toHaveBeenCalled()
  })

  it('returns a retryable error when Stripe rejects the session creation', async () => {
    mockCreateCheckoutSession.mockRejectedValue(new Error('Stripe account not activated'))

    const response = await POST(checkoutRequest({ plan: 'annual' }))
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(502)
    expect(body).toEqual({ error: 'Checkout could not start. Try again in a moment.' })
  })

  it('returns a retryable error when Stripe does not provide a Checkout URL', async () => {
    mockCreateCheckoutSession.mockResolvedValue({})

    const response = await POST(checkoutRequest({ plan: 'annual' }))
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(502)
    expect(body).toEqual({ error: 'Checkout could not start. Try again in a moment.' })
  })
})
