import { NextRequest } from 'next/server'
import { POST } from '../route'
import { expireDueComps } from '@/lib/admin/entitlement'

jest.mock('@/lib/admin/entitlement', () => ({ expireDueComps: jest.fn() }))

const mockExpireDueComps = expireDueComps as jest.Mock

function request(secret = 'test-secret') {
  return new NextRequest('https://expaify.test/api/admin/comp-expiry', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  })
}

describe('POST /api/admin/comp-expiry', () => {
  const originalSecret = process.env.PIPELINE_SECRET
  beforeEach(() => {
    process.env.PIPELINE_SECRET = 'test-secret'
    mockExpireDueComps.mockReset()
  })
  afterAll(() => {
    if (originalSecret === undefined) delete process.env.PIPELINE_SECRET
    else process.env.PIPELINE_SECRET = originalSecret
  })

  it('rejects a missing or incorrect pipeline secret without touching the DB', async () => {
    const response = await POST(request('wrong'))
    expect(response.status).toBe(401)
    expect(mockExpireDueComps).not.toHaveBeenCalled()
  })

  it('expires due comps and reports the real count', async () => {
    mockExpireDueComps.mockResolvedValue({ expiredCount: 2, expiredUserIds: ['user-1', 'user-2'] })

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, expiredCount: 2, expiredUserIds: ['user-1', 'user-2'] })
  })
})
