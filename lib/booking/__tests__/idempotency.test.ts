import { computeBookingIdempotencyKey } from '../idempotency'

const passenger = {
  email: 'Alex@Example.com',
  born_on: '1990-01-01',
  given_name: 'Alex',
  family_name: 'Rivera',
}

describe('computeBookingIdempotencyKey', () => {
  it('is deterministic for identical inputs (a resubmit after refresh must match the original)', () => {
    const a = computeBookingIdempotencyKey('off_123', passenger)
    const b = computeBookingIdempotencyKey('off_123', passenger)
    expect(a).toBe(b)
  })

  it('is case/whitespace-insensitive on email and name so trivial client formatting differences do not create a new key', () => {
    const a = computeBookingIdempotencyKey('off_123', passenger)
    const b = computeBookingIdempotencyKey('off_123', {
      ...passenger,
      email: '  alex@example.com  ',
      given_name: 'ALEX',
      family_name: '  rivera',
    })
    expect(a).toBe(b)
  })

  it('differs for a different offer', () => {
    const a = computeBookingIdempotencyKey('off_123', passenger)
    const b = computeBookingIdempotencyKey('off_456', passenger)
    expect(a).not.toBe(b)
  })

  it('differs for a different passenger on the same offer (two travelers should not collide)', () => {
    const a = computeBookingIdempotencyKey('off_123', passenger)
    const b = computeBookingIdempotencyKey('off_123', { ...passenger, email: 'jordan@example.com', given_name: 'Jordan' })
    expect(a).not.toBe(b)
  })

  it('produces a key namespaced for the booking idempotency cache, not colliding with other cache uses', () => {
    const key = computeBookingIdempotencyKey('off_123', passenger)
    expect(key).toMatch(/^booking:idempotency:[0-9a-f]{64}$/)
  })
})
