import type { ReactElement } from 'react'
import { auth } from '@/auth'
import { getSubscription } from '@/lib/subscription'
import OnboardingPage from '../page'
import { OnboardingClient } from '../OnboardingClient'

jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/subscription', () => ({ getSubscription: jest.fn(), isPremium: jest.fn(() => false) }))

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockGetSubscription = getSubscription as jest.MockedFunction<typeof getSubscription>

function clientProps(tree: ReactElement): Record<string, unknown> {
  const main = (tree.props as { children?: ReactElement }).children as ReactElement<Record<string, unknown>>
  if (main.type !== OnboardingClient) throw new Error('OnboardingClient not found')
  return main.props
}

describe('/onboarding seeds the city a user actually clicked', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } } as never)
    mockGetSubscription.mockResolvedValue({ onboardingDone: false, status: 'free' } as never)
  })

  it('passes a real tracked-market city through as initialCity', async () => {
    const tree = await OnboardingPage({ searchParams: Promise.resolve({ city: 'Nashville' }) }) as ReactElement
    expect(clientProps(tree).initialCity).toBe('Nashville')
  })

  it('drops an unknown/untracked city rather than seeding garbage into the watchlist', async () => {
    const tree = await OnboardingPage({ searchParams: Promise.resolve({ city: 'Atlantis' }) }) as ReactElement
    expect(clientProps(tree).initialCity).toBeUndefined()
  })

  it('is undefined with no city param', async () => {
    const tree = await OnboardingPage({ searchParams: Promise.resolve({}) }) as ReactElement
    expect(clientProps(tree).initialCity).toBeUndefined()
  })
})
