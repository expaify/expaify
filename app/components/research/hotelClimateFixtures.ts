import type {
  HotelClimateDimension,
  HotelClimateEvidence,
  HotelClimateRow,
  HotelClimateScope,
  HotelClimateStatement,
  HotelClimateValue,
} from '@/lib/types'
import { createUnsupportedHotelClimateEvidence } from '@/lib/hotels/climateEvidence'

export const HOTEL_CLIMATE_FIXTURE_IDS = [
  'selected_room_rate',
  'room_category',
  'property_only',
  'explicit_negative',
  'missing_failed_conflict',
  'unsupported_current_contract',
  'stale_refresh_failed',
] as const

export type HotelClimateFixtureId = typeof HOTEL_CLIMATE_FIXTURE_IDS[number]

const observedAt = '2026-01-15T12:00:00.000Z'
const base = {
  schemaVersion: 1 as const,
  capability: 'supported' as const,
  loadState: 'ready' as const,
  providerId: 'synthetic-provider',
  providerPropertyId: 'synthetic-property',
  offerId: 'synthetic-offer',
  evidenceRevision: 'fixture-revision-1',
}

function statement(
  id: string,
  value: HotelClimateStatement['value'],
  scope: HotelClimateScope,
  extras: Partial<HotelClimateStatement> = {},
): HotelClimateStatement {
  return {
    id,
    value,
    scope,
    sourceLabel: 'Synthetic provider',
    observedAt,
    ...(scope === 'room_category' ? { roomCategoryId: 'deluxe-king', roomCategoryLabel: 'Deluxe King Room' } : {}),
    ...(scope === 'selected_room_rate' ? {
      roomId: 'room-1', rateId: 'rate-1', checkIn: '2026-09-10', checkOut: '2026-09-13',
    } : {}),
    ...extras,
  }
}

function row(
  dimension: HotelClimateDimension,
  value: HotelClimateValue,
  statements: HotelClimateStatement[] = [],
  extras: Partial<HotelClimateRow> = {},
): HotelClimateRow {
  const rank: Record<HotelClimateScope, number> = { property: 0, room_category: 1, selected_room_rate: 2 }
  const mostSpecificScope = statements.reduce<HotelClimateScope | undefined>((current, item) => (
    !current || rank[item.scope] > rank[current] ? item.scope : current
  ), undefined)
  return { dimension, value, statements, isStale: false, ...(mostSpecificScope ? { mostSpecificScope } : {}), ...extras }
}

export function createHotelClimateFixture(id: HotelClimateFixtureId): HotelClimateEvidence {
  if (id === 'unsupported_current_contract') return createUnsupportedHotelClimateEvidence(base.offerId, base.providerId, base.providerPropertyId)
  if (id === 'selected_room_rate') return {
    ...base,
    rows: [
      row('cooling', 'present', [statement('cooling-selected', 'present', 'selected_room_rate')]),
      row('heating', 'not_provided'),
      row('guest_control', 'guest_adjustable', [statement('control-selected', 'guest_adjustable', 'selected_room_rate')]),
    ],
  }
  if (id === 'room_category') return {
    ...base,
    rows: [
      row('cooling', 'not_provided'),
      row('heating', 'present', [statement('heating-category', 'present', 'room_category')]),
      row('guest_control', 'not_provided'),
    ],
  }
  if (id === 'property_only') return {
    ...base,
    rows: [
      row('cooling', 'present', [statement('cooling-property', 'present', 'property')]),
      row('heating', 'not_provided'),
      row('guest_control', 'not_provided'),
    ],
  }
  if (id === 'explicit_negative') return {
    ...base,
    rows: [
      row('cooling', 'explicitly_absent', [statement('cooling-absent', 'explicitly_absent', 'room_category', { roomCategoryId: 'standard-twin', roomCategoryLabel: 'Standard Twin Room' })]),
      row('heating', 'not_provided'),
      row('guest_control', 'not_provided'),
    ],
  }
  if (id === 'missing_failed_conflict') return {
    ...base,
    rows: [
      row('cooling', 'not_provided'),
      row('heating', 'check_failed'),
      row('guest_control', 'conflicting', [
        statement('control-property', 'property_controlled', 'property'),
        statement('control-room', 'guest_adjustable', 'room_category'),
      ]),
    ],
  }
  return {
    ...base,
    rows: [
      row('cooling', 'present', [statement('cooling-stale', 'present', 'property')], { isStale: true, refreshFailed: true }),
      row('heating', 'not_provided'),
      row('guest_control', 'not_provided'),
    ],
  }
}

