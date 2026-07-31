export type StorageServiceState =
  | 'reported_available'
  | 'explicitly_unavailable'
  | 'not_returned'
  | 'conflicting'

export type StoragePeriodState =
  | 'reported_available'
  | 'explicitly_unavailable'
  | 'not_specified'
  | 'conflicting'

export type StorageCharge =
  | { state: 'included' }
  | { state: 'paid'; amount?: { priceCents: number; currency: string }; basis?: 'per_bag' | 'per_hour' | 'per_day' | 'per_stay' | 'other' }
  | { state: 'unknown' }

export type PrototypeLuggageStorageEvidence = {
  state: 'ready' | 'loading' | 'error'
  serviceState: StorageServiceState
  beforeCheckin: StoragePeriodState
  afterCheckout: StoragePeriodState
  schedule?: { providerWording: string; localTimeZone?: string }
  charge: StorageCharge
  conditions: Array<{ id: string; providerWording: string }>
  source: { label: string; observedAt?: string }
  evidenceRevision: string
  conflicts?: Array<{ sourceLabel: string; statement: string }>
}

export const LUGGAGE_STORAGE_FIXTURE_IDS = [
  'complete-included',
  'complete-paid',
  'partial-before',
  'partial-after',
  'before-unavailable',
  'after-unavailable',
  'service-unavailable',
  'conflicting-timing',
  'not-returned',
  'loading',
  'error',
  'revision-mismatch',
] as const

export type LuggageStorageFixtureId = typeof LUGGAGE_STORAGE_FIXTURE_IDS[number]

const READY_REVISION = 'research-storage-r7'
const source = { label: 'Research Stay Data Cooperative', observedAt: '2026-07-29T12:00:00.000Z' }
const unknownCharge: StorageCharge = { state: 'unknown' }

function base(overrides: Partial<PrototypeLuggageStorageEvidence>): PrototypeLuggageStorageEvidence {
  return {
    state: 'ready',
    serviceState: 'reported_available',
    beforeCheckin: 'reported_available',
    afterCheckout: 'reported_available',
    charge: unknownCharge,
    conditions: [],
    source,
    evidenceRevision: READY_REVISION,
    ...overrides,
  }
}

export function createLuggageStorageFixture(id: LuggageStorageFixtureId): PrototypeLuggageStorageEvidence {
  switch (id) {
    case 'complete-included':
      return base({
        charge: { state: 'included' },
        schedule: { providerWording: '8:00 AM–10:00 PM local property time.' },
        conditions: [{ id: 'registered-guests', providerWording: 'For registered guests on arrival and departure days.' }],
      })
    case 'complete-paid':
      return base({ charge: { state: 'paid', amount: { priceCents: 1200, currency: 'USD' }, basis: 'per_bag' } })
    case 'partial-before':
      return base({ afterCheckout: 'not_specified' })
    case 'partial-after':
      return base({ beforeCheckin: 'not_specified' })
    case 'before-unavailable':
      return base({ beforeCheckin: 'explicitly_unavailable' })
    case 'after-unavailable':
      return base({ afterCheckout: 'explicitly_unavailable' })
    case 'service-unavailable':
      return base({ serviceState: 'explicitly_unavailable', beforeCheckin: 'not_specified', afterCheckout: 'not_specified' })
    case 'conflicting-timing':
      return base({
        serviceState: 'conflicting',
        beforeCheckin: 'conflicting',
        afterCheckout: 'not_specified',
        conflicts: [
          { sourceLabel: 'Synthetic property policy', statement: 'Bags may be stored before check-in.' },
          { sourceLabel: 'Synthetic provider listing', statement: 'Storage is not available before check-in.' },
        ],
      })
    case 'not-returned':
      return base({ serviceState: 'not_returned', beforeCheckin: 'not_specified', afterCheckout: 'not_specified' })
    case 'loading':
      return base({ state: 'loading' })
    case 'error':
      return base({ state: 'error' })
    case 'revision-mismatch':
      return base({ evidenceRevision: 'research-storage-detail-r8' })
  }
}

export function evidenceForSurface(
  id: LuggageStorageFixtureId,
  surface: 'detail' | 'handoff',
): PrototypeLuggageStorageEvidence {
  const evidence = createLuggageStorageFixture(id)
  if (id !== 'revision-mismatch' || surface === 'detail') return evidence
  return { ...evidence, state: 'error', evidenceRevision: 'research-storage-handoff-r7' }
}
