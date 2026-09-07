import { expireDueComps } from '../entitlement'
import { withTransaction } from '@/lib/db/client'

jest.mock('@/lib/db/client', () => ({ withTransaction: jest.fn() }))

const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>

describe('expireDueComps', () => {
  beforeEach(() => {
    mockWithTransaction.mockReset()
  })

  it('flips status/entitlement_source to free/none for every comp past its expiry, leaving comp history intact', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ user_id: 'user-1' }, { user_id: 'user-2' }] })
    mockWithTransaction.mockImplementation(async (fn) => fn({ query } as never))

    const result = await expireDueComps()

    expect(result).toEqual({ expiredCount: 2, expiredUserIds: ['user-1', 'user-2'] })
    expect(query).toHaveBeenCalledTimes(1)
    const [sql] = query.mock.calls[0]
    expect(sql).toContain("status = 'free'")
    expect(sql).toContain("entitlement_source = 'none'")
    expect(sql).toContain("entitlement_source = 'comp'")
    expect(sql).toContain("status = 'active'")
    expect(sql).toContain('comp_expires_at IS NOT NULL')
    expect(sql).toContain('comp_expires_at < NOW()')
    // Must not touch comp_reason/comp_granted_by/comp_granted_at/comp_expires_at --
    // this is a natural lapse, not an active admin revocation (removeLocalAccess
    // clears those; this function deliberately doesn't).
    expect(sql).not.toContain('comp_reason = NULL')
    expect(sql).not.toContain('comp_granted_by = NULL')
    expect(sql).not.toContain('comp_expires_at = NULL')
  })

  it('returns a zero count and does not touch subscriptions with no due comps', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] })
    mockWithTransaction.mockImplementation(async (fn) => fn({ query } as never))

    const result = await expireDueComps()

    expect(result).toEqual({ expiredCount: 0, expiredUserIds: [] })
  })
})
