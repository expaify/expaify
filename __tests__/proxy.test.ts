import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { proxy } from '../proxy'

jest.mock('@/auth', () => ({ auth: jest.fn() }))

const mockAuth = auth as jest.MockedFunction<typeof auth>

describe('proxy', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('redirects www.expaify.com to the apex domain with a 308, preserving path and query', async () => {
    const request = new NextRequest('https://www.expaify.com/deals?city=paris', {
      headers: { host: 'www.expaify.com' },
    })

    const response = await proxy(request)

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe('https://expaify.com/deals?city=paris')
    expect(mockAuth).not.toHaveBeenCalled()
  })

  it('redirects www even for a protected path, before the auth check runs', async () => {
    const request = new NextRequest('https://www.expaify.com/account', {
      headers: { host: 'www.expaify.com' },
    })

    const response = await proxy(request)

    expect(response.headers.get('location')).toBe('https://expaify.com/account')
    expect(mockAuth).not.toHaveBeenCalled()
  })

  it('passes an unprotected apex-domain request through unchanged', async () => {
    const request = new NextRequest('https://expaify.com/deals', {
      headers: { host: 'expaify.com' },
    })

    const response = await proxy(request)

    expect(response.headers.get('location')).toBeNull()
  })

  it('redirects to /login when a protected route has no session', async () => {
    mockAuth.mockResolvedValue(null as never)
    const request = new NextRequest('https://expaify.com/account', {
      headers: { host: 'expaify.com' },
    })

    const response = await proxy(request)

    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location') as string)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('callbackUrl')).toBe('/account')
  })

  it('passes a protected route through when a session exists', async () => {
    mockAuth.mockResolvedValue({ user: { id: '1' } } as never)
    const request = new NextRequest('https://expaify.com/account', {
      headers: { host: 'expaify.com' },
    })

    const response = await proxy(request)

    expect(response.headers.get('location')).toBeNull()
  })
})
