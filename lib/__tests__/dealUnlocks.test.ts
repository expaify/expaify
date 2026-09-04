jest.mock('@/auth', () => ({ auth: jest.fn() }))
jest.mock('@/lib/db/client', () => ({ query: jest.fn() }))

import { unlockDealForUser } from '../dealUnlocks'

function client(existing: boolean, count: number) {
  const query = jest.fn()
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })
    .mockResolvedValueOnce({ rows: existing ? [{}] : [], rowCount: existing ? 1 : 0 })
    .mockResolvedValueOnce({ rows: [{ count }], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [], rowCount: 1 })
  return { query }
}

describe('personal deal unlock quota', () => {
  it('rejects a new deal at the weekly limit', async () => {
    const db = client(false, 3)
    await expect(unlockDealForUser(db as never, 'user-1', 'deal-4')).resolves.toEqual({ ok: false, reason: 'weekly_limit_reached' })
    expect(db.query).toHaveBeenCalledTimes(3)
  })

  it('makes re-unlocking an existing deal an idempotent success at the limit', async () => {
    const db = client(true, 3)
    await expect(unlockDealForUser(db as never, 'user-1', 'deal-1')).resolves.toEqual({ ok: true, alreadyUnlocked: true, remaining: 0 })
    expect(db.query).toHaveBeenCalledTimes(3)
  })

  it('inserts a new unlock and returns the exact remaining quota', async () => {
    const db = client(false, 1)
    await expect(unlockDealForUser(db as never, 'user-1', 'deal-2')).resolves.toEqual({ ok: true, alreadyUnlocked: false, remaining: 1 })
    expect(String(db.query.mock.calls[3][0])).toContain('ON CONFLICT (user_id, deal_id) DO UPDATE SET unlocked_at = NOW()')
    expect(db.query.mock.calls[3][1]).toEqual(['user-1', 'deal-2'])
  })

  it('re-unlocking a deal from a prior week refreshes unlocked_at instead of silently no-op-ing', async () => {
    // Regression guard: (user_id, deal_id) is lifetime-unique, but the quota
    // is weekly. A user re-unlocking a deal they'd already unlocked in an
    // earlier week has `existing` = false (the row is outside "this week"),
    // so this reaches the insert path with a real conflicting row already
    // present. DO NOTHING previously left unlocked_at frozen at the old
    // week, so the deal stayed outside every "this week" filter
    // (getFreeUnlockedDealIds) despite this function reporting success.
    const db = client(false, 0)
    await expect(unlockDealForUser(db as never, 'user-1', 'deal-old')).resolves.toEqual({ ok: true, alreadyUnlocked: false, remaining: 2 })
    expect(String(db.query.mock.calls[3][0])).not.toContain('DO NOTHING')
    expect(String(db.query.mock.calls[3][0])).toContain('DO UPDATE SET unlocked_at = NOW()')
  })
})
