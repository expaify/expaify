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
    expect(String(db.query.mock.calls[3][0])).toContain('ON CONFLICT (user_id, deal_id) DO NOTHING')
    expect(db.query.mock.calls[3][1]).toEqual(['user-1', 'deal-2'])
  })
})
