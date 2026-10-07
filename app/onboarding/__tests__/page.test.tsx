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

function redirectTarget(error: unknown): string {
  const digest = (error as { digest?: string })?.digest ?? ''
  const parts = digest.split(';')
  if (parts[0] !== 'NEXT_REDIRECT') throw new Error(`not a redirect error: ${digest || String(error)}`)
  return parts.slice(2, -2).join(';')
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

describe('/onboarding bounces an unauthenticated visitor back to itself after sign-in', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue(null as never)
  })

  it('sends a bare visit to a callbackUrl of plain /onboarding', async () => {
    const error = await OnboardingPage({ searchParams: Promise.resolve({}) }).catch(e => e)
    expect(redirectTarget(error)).toBe('/login?callbackUrl=%2Fonboarding')
  })

  it('preserves a deep-linked city in the callbackUrl so it survives the sign-in round trip', async () => {
    const error = await OnboardingPage({ searchParams: Promise.resolve({ city: 'Nashville' }) }).catch(e => e)
    expect(redirectTarget(error)).toBe(`/login?callbackUrl=${encodeURIComponent('/onboarding?city=Nashville')}`)
  })
})
