import { reconcileCheckoutSession } from '../reconcileCheckout'
import { upsertSubscription } from '@/lib/subscription'

const mockRetrieveSession = jest.fn()
const mockRetrieveSubscription = jest.fn()

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: { sessions: { retrieve: mockRetrieveSession } },
    subscriptions: { retrieve: mockRetrieveSubscription },
  }))
})

jest.mock('@/lib/subscription', () => ({
  upsertSubscription: jest.fn(),
}))

const mockUpsert = upsertSubscription as jest.MockedFunction<typeof upsertSubscription>

describe('reconcileCheckoutSession', () => {
  const originalKey = process.env.STRIPE_SECRET_KEY

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_123'
    mockRetrieveSession.mockReset()
    mockRetrieveSubscription.mockReset()
    mockUpsert.mockReset()
    mockUpsert.mockResolvedValue(undefined)
  })

  afterAll(() => {
    process.env.STRIPE_SECRET_KEY = originalKey
  })

  it('backfills an active subscription that the webhook has not written yet', async () => {
    mockRetrieveSession.mockResolvedValue({
      metadata: { user_id: 'user_123', plan: 'annual' },
      customer: 'cus_123',
      subscription: {
        id: 'sub_123',
        status: 'active',
        trial_end: null,
        items: { data: [{ current_period_end: 1_800_000_000 }] },
      },
    })

    await reconcileCheckoutSession('cs_test_123', 'user_123')

    expect(mockUpsert).toHaveBeenCalledWith('user_123', expect.objectContaining({
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      status: 'active',
      plan: 'annual',
    }))
  })

  it('treats a trialing subscription as trialing, not active', async () => {
    mockRetrieveSession.mockResolvedValue({
      metadata: { user_id: 'user_123', plan: 'monthly' },
      customer: 'cus_123',
      subscription: { id: 'sub_123', status: 'trialing', trial_end: 1_800_000_000, items: { data: [] } },
    })

    await reconcileCheckoutSession('cs_test_123', 'user_123')

    expect(mockUpsert).toHaveBeenCalledWith('user_123', expect.objectContaining({ status: 'trialing' }))
  })

  it('refuses to reconcile a session belonging to a different user (never trust the query param alone)', async () => {
    mockRetrieveSession.mockResolvedValue({
      metadata: { user_id: 'someone_else' },
      customer: 'cus_123',
      subscription: { id: 'sub_123', status: 'active', items: { data: [] } },
    })

    await reconcileCheckoutSession('cs_test_123', 'user_123')

    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('is a no-op, never throws, when Stripe retrieval fails', async () => {
    mockRetrieveSession.mockRejectedValue(new Error('network error'))

    await expect(reconcileCheckoutSession('cs_test_123', 'user_123')).resolves.toBeUndefined()
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('does nothing when the session has no customer', async () => {
    mockRetrieveSession.mockResolvedValue({ metadata: { user_id: 'user_123' }, customer: null, subscription: null })

    await reconcileCheckoutSession('cs_test_123', 'user_123')

    expect(mockUpsert).not.toHaveBeenCalled()
  })
})
