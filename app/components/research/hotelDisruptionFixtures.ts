import type { HotelDisruptionEvidence, SupplierDisruptionStatement } from '@/lib/types'

export const HOTEL_DISRUPTION_FIXTURE_IDS = [
  'daytime_noise_full',
  'pool_closed_full',
  'lobby_partial',
  'access_timing_unknown',
  'cosmetic_back_office',
  'rooms_end_before_stay',
  'impact_unspecified',
  'conflicting_sources',
  'stale_noise',
  'not_returned',
  'check_failed',
  'malformed_missing_source',
  'missing_stay_dates',
  'until_further_notice',
  'loading',
  'refreshing',
] as const

export type HotelDisruptionFixtureId = typeof HOTEL_DISRUPTION_FIXTURE_IDS[number]

const observedAt = '2026-07-30T12:00:00.000Z'

function statement(overrides: Partial<SupplierDisruptionStatement> = {}): SupplierDisruptionStatement {
  return {
    id: 'fixture-statement-1',
    noticeType: 'renovation',
    impactClasses: ['guest_room_work', 'reported_noise'],
    affectedScopes: ['Guest rooms'],
    summaryImpactLabel: 'Construction noise',
    sourceLabel: 'Harbor Stay Supplier',
    sourceText: 'Guest-room renovation is scheduled Aug 1–31, with construction noise from 9:00 AM to 5:00 PM local property time.',
    reportedStart: '2026-08-01',
    reportedEnd: '2026-08-31',
    reportedHours: '9:00 AM–5:00 PM local property time',
    observedAt,
    ...overrides,
  }
}

function evidence(overrides: Partial<HotelDisruptionEvidence> = {}): HotelDisruptionEvidence {
  return {
    loadState: 'ready',
    state: 'reported',
    relation: 'overlap',
    material: true,
    promoted: true,
    statements: [statement()],
    evidenceRevision: 'fixture-daytime-noise-v1',
    ...overrides,
  }
}

const fixtures: Record<HotelDisruptionFixtureId, HotelDisruptionEvidence> = {
  daytime_noise_full: evidence(),
  pool_closed_full: evidence({
    statements: [statement({
      noticeType: 'facility_closure',
      impactClasses: ['primary_facility_closure'],
      affectedScopes: ['Pool'],
      summaryImpactLabel: 'Pool closure',
      sourceLabel: 'Coast Rooms',
      sourceText: 'The pool will be closed from Aug 10 through Aug 20.',
      reportedStart: '2026-08-10',
      reportedEnd: '2026-08-20',
      reportedHours: undefined,
    })],
    evidenceRevision: 'fixture-pool-closed-v1',
  }),
  lobby_partial: evidence({
    relation: 'partial_overlap',
    statements: [statement({
      impactClasses: ['guest_area_work'],
      affectedScopes: ['Lobby'],
      summaryImpactLabel: 'Lobby work',
      sourceLabel: 'Stay Partner',
      sourceText: 'Lobby renovation work is scheduled Aug 14–15.',
      reportedStart: '2026-08-14',
      reportedEnd: '2026-08-15',
      reportedHours: undefined,
    })],
    evidenceRevision: 'fixture-lobby-partial-v1',
  }),
  access_timing_unknown: evidence({
    relation: 'timing_unknown',
    statements: [statement({
      noticeType: 'access_restriction',
      impactClasses: ['access_limitation'],
      affectedScopes: ['Main entrance'],
      summaryImpactLabel: 'Main entrance access limits',
      sourceLabel: 'Room Source',
      sourceText: 'Access through the main entrance is limited during renovation work.',
      reportedStart: undefined,
      reportedEnd: undefined,
      reportedHours: undefined,
    })],
    evidenceRevision: 'fixture-access-unknown-v1',
  }),
  cosmetic_back_office: evidence({
    material: false,
    promoted: false,
    statements: [statement({
      impactClasses: ['non_guest_cosmetic'],
      affectedScopes: ['Back office'],
      summaryImpactLabel: undefined,
      sourceLabel: 'Property Source',
      sourceText: 'Back-office repainting is scheduled Aug 1–31 with no reported guest impact.',
      reportedHours: undefined,
    })],
    evidenceRevision: 'fixture-cosmetic-office-v1',
  }),
  rooms_end_before_stay: evidence({
    relation: 'no_overlap',
    promoted: false,
    statements: [statement({
      sourceText: 'Guest-room renovation is scheduled Jul 1–Aug 12.',
      reportedStart: '2026-07-01',
      reportedEnd: '2026-08-12',
      reportedHours: undefined,
    })],
    evidenceRevision: 'fixture-rooms-before-v1',
  }),
  impact_unspecified: evidence({
    material: false,
    promoted: false,
    statements: [statement({
      impactClasses: ['impact_not_provided'],
      affectedScopes: [],
      summaryImpactLabel: undefined,
      sourceLabel: 'Property Source',
      sourceText: 'Renovation underway.',
      reportedHours: undefined,
    })],
    evidenceRevision: 'fixture-impact-unknown-v1',
  }),
  conflicting_sources: evidence({
    state: 'conflicting',
    statements: [
      statement({
        id: 'fixture-conflict-a',
        noticeType: 'facility_closure',
        impactClasses: ['primary_facility_closure'],
        affectedScopes: ['Pool'],
        summaryImpactLabel: 'Pool closure',
        sourceLabel: 'Source A',
        sourceText: 'The pool will be closed Aug 10–20.',
        reportedStart: '2026-08-10',
        reportedEnd: '2026-08-20',
        reportedHours: undefined,
      }),
      statement({
        id: 'fixture-conflict-b',
        noticeType: 'facility_restriction',
        impactClasses: ['primary_facility_restriction'],
        affectedScopes: ['Pool'],
        summaryImpactLabel: 'Pool access',
        sourceLabel: 'Source B',
        sourceText: 'The pool reopened Aug 13.',
        reportedStart: '2026-08-13',
        reportedEnd: '2026-08-13',
        reportedHours: undefined,
      }),
    ],
    evidenceRevision: 'fixture-conflict-v1',
  }),
  stale_noise: evidence({
    state: 'stale_unconfirmed',
    statements: [statement({ observedAt: '2025-12-01T12:00:00.000Z' })],
    evidenceRevision: 'fixture-stale-noise-v1',
  }),
  not_returned: evidence({
    state: 'not_returned',
    relation: undefined,
    material: false,
    promoted: false,
    statements: [],
    evidenceRevision: 'fixture-not-returned-v1',
  }),
  check_failed: evidence({
    state: 'check_failed',
    relation: undefined,
    material: false,
    promoted: false,
    statements: [],
    evidenceRevision: 'fixture-check-failed-v1',
  }),
  malformed_missing_source: evidence({
    state: 'malformed',
    relation: undefined,
    material: false,
    promoted: false,
    statements: [statement({ sourceLabel: '', sourceText: 'Unattributed fixture text must never render.' })],
    evidenceRevision: 'fixture-malformed-v1',
  }),
  missing_stay_dates: evidence({
    relation: 'timing_unknown',
    statements: [statement({
      noticeType: 'facility_closure',
      impactClasses: ['primary_facility_closure'],
      affectedScopes: ['Pool'],
      summaryImpactLabel: 'Pool closure',
      sourceLabel: 'Coast Rooms',
      sourceText: 'The pool will be closed from Aug 10 through Aug 20.',
      reportedStart: '2026-08-10',
      reportedEnd: '2026-08-20',
      reportedHours: undefined,
    })],
    evidenceRevision: 'fixture-missing-stay-v1',
  }),
  until_further_notice: evidence({
    relation: 'timing_unknown',
    statements: [statement({
      noticeType: 'facility_restriction',
      impactClasses: ['primary_facility_restriction'],
      affectedScopes: ['Lift'],
      summaryImpactLabel: 'Reduced lift access',
      sourceLabel: 'Stay Partner',
      sourceText: 'Lift access is reduced until further notice.',
      reportedStart: '2026-08-01',
      reportedEnd: undefined,
      reportedHours: undefined,
    })],
    evidenceRevision: 'fixture-lift-unknown-v1',
  }),
  loading: evidence({
    loadState: 'loading',
    state: 'not_returned',
    relation: undefined,
    material: false,
    promoted: false,
    statements: [],
    evidenceRevision: 'fixture-loading-v1',
  }),
  refreshing: evidence({
    loadState: 'refreshing',
    state: 'stale_unconfirmed',
    evidenceRevision: 'fixture-refreshing-v1',
  }),
}

export function parseHotelDisruptionFixture(value: string | string[] | undefined): HotelDisruptionFixtureId | null {
  const candidate = Array.isArray(value) ? value[0] : value
  return HOTEL_DISRUPTION_FIXTURE_IDS.includes(candidate as HotelDisruptionFixtureId)
    ? candidate as HotelDisruptionFixtureId
    : null
}

export function createHotelDisruptionFixture(id: HotelDisruptionFixtureId): HotelDisruptionEvidence {
  const fixture = fixtures[id]
  return {
    ...fixture,
    statements: fixture.statements.map(item => ({
      ...item,
      impactClasses: [...item.impactClasses],
      affectedScopes: [...item.affectedScopes],
    })),
  }
}
