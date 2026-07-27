import { evaluateDeal, DEAL_THRESHOLD, EXPIRE_THRESHOLD, MIN_SNAPSHOTS } from '../dealRules'

describe('evaluateDeal', () => {
  describe('minimum snapshot floor (below 8 never flags)', () => {
    it('never flags with 7 snapshots, even at a huge discount', () => {
      const decision = evaluateDeal({ latestPriceCents: 5000, medianPriceCents: 20000, snapshotCount: 7 })
      expect(decision.action).not.toBe('flag')
    })

    it('expires an active deal when history is below the floor', () => {
      const decision = evaluateDeal({ latestPriceCents: 5000, medianPriceCents: 20000, snapshotCount: 7 })
      expect(decision.action).toBe('expire')
    })

    it.each([0, 1, 2, 7])('never flags with %i snapshots', (snapshotCount) => {
      const decision = evaluateDeal({ latestPriceCents: 1000, medianPriceCents: 100000, snapshotCount })
      expect(decision.action).not.toBe('flag')
    })

    it('flags with exactly 8 snapshots when the price qualifies', () => {
      const decision = evaluateDeal({ latestPriceCents: 5000, medianPriceCents: 20000, snapshotCount: MIN_SNAPSHOTS })
      expect(decision).toEqual({ action: 'flag', discountPct: 75 })
    })
  })

  describe('flag threshold (≤ 70% of median)', () => {
    it('flags at exactly 70% of median', () => {
      const decision = evaluateDeal({ latestPriceCents: 7000, medianPriceCents: 10000, snapshotCount: 10 })
      expect(decision).toEqual({ action: 'flag', discountPct: 30 })
    })

    it('does not flag just above 70% of median', () => {
      const decision = evaluateDeal({ latestPriceCents: 7001, medianPriceCents: 10000, snapshotCount: 10 })
      expect(decision.action).not.toBe('flag')
    })

    it('computes discount_pct from the stored snapshot stats', () => {
      const decision = evaluateDeal({ latestPriceCents: 9000, medianPriceCents: 20000, snapshotCount: 12 })
      expect(decision).toEqual({ action: 'flag', discountPct: 55 })
    })
  })

  describe('expiry threshold (> 85% of median)', () => {
    it('expires when the price recovers above 85% of median', () => {
      const decision = evaluateDeal({ latestPriceCents: 8600, medianPriceCents: 10000, snapshotCount: 10 })
      expect(decision.action).toBe('expire')
    })

    it('holds at exactly 85% of median', () => {
      const decision = evaluateDeal({ latestPriceCents: 8500, medianPriceCents: 10000, snapshotCount: 10 })
      expect(decision.action).toBe('hold')
    })

    it('holds inside the hysteresis band (between 70% and 85%)', () => {
      const decision = evaluateDeal({ latestPriceCents: 7500, medianPriceCents: 10000, snapshotCount: 10 })
      expect(decision.action).toBe('hold')
    })
  })

  describe('degenerate inputs', () => {
    it('never flags on a zero median (no divide-by-zero flag)', () => {
      const decision = evaluateDeal({ latestPriceCents: 5000, medianPriceCents: 0, snapshotCount: 10 })
      expect(decision.action).toBe('expire')
    })

    it('never flags on a zero latest price', () => {
      const decision = evaluateDeal({ latestPriceCents: 0, medianPriceCents: 10000, snapshotCount: 10 })
      expect(decision.action).toBe('expire')
    })
  })

  it('exposes the contract constants from the ticket', () => {
    expect(DEAL_THRESHOLD).toBe(0.70)
    expect(EXPIRE_THRESHOLD).toBe(0.85)
    expect(MIN_SNAPSHOTS).toBe(8)
  })
})
