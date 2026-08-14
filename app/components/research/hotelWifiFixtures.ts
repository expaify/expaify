export type WifiEvidenceCheckState = 'loading' | 'ready' | 'not_returned' | 'stale' | 'error'

export type WifiAccessStatus = 'confirmed' | 'unavailable' | 'unknown' | 'conflict'
export type WifiCostStatus = 'included' | 'paid' | 'not_specified' | 'conflict'
export type WifiCoverageScope =
  | 'property'
  | 'public_areas'
  | 'guest_rooms'
  | 'room_type'
  | 'rate'
  | 'selected_stay'
  | 'not_specified'
  | 'conflict'

export type WifiSource = {
  sourceId: string
  sourceLabel: string
  observedAt?: string
  fetchedAt: string
}

export type WifiAccessEvidence = {
  status: WifiAccessStatus
  scope: WifiCoverageScope
  source: WifiSource
}

export type WifiRateCostEvidence = {
  status: WifiCostStatus
  scope: 'rate' | 'selected_stay' | 'not_specified'
  money?: { priceCents: number; currency: string }
  billingBasis?: 'per_stay' | 'per_night' | 'per_device' | 'per_day'
  source: WifiSource
}

export type WifiMeasurementMetric = {
  kind: 'download' | 'upload' | 'latency' | 'uptime'
  value: number
  unit: 'Mbps' | 'ms' | 'percent'
}

export type WifiMeasuredEvidence = {
  kind: 'measured'
  metrics: WifiMeasurementMetric[]
  method: string
  locationLabel: string
  scope: WifiCoverageScope
  observationWindow: { start: string; end: string }
  sampleCount?: number
  frequency?: string
  source: WifiSource
}

export type WifiReviewEvidence = {
  kind: 'review_signal'
  summary: string
  qualifyingReviewCount: number
  reviewWindow: { start: string; end: string }
  consistency: 'consistent' | 'mixed' | 'conflicting'
  source: WifiSource
}

export type WifiConflictStatement = {
  dimension: 'access' | 'cost' | 'coverage' | 'measured_vs_review'
  sourceLabel: string
  statement: string
}

export type HotelWifiEvidence = {
  checkState: WifiEvidenceCheckState
  access?: WifiAccessEvidence
  cost?: WifiRateCostEvidence
  coverage: WifiCoverageScope
  measuredEvidence?: WifiMeasuredEvidence
  reviewEvidence?: WifiReviewEvidence
  conflicts: WifiConflictStatement[]
  staleAsOf?: string
}

export type WifiFixtureId =
  | 'control'
  | 'loading'
  | 'wf-01'
  | 'wf-02'
  | 'wf-03'
  | 'wf-04'
  | 'wf-05'
  | 'wf-06'
  | 'wf-07a'
  | 'wf-07b'
  | 'wf-08'
  | 'wf-09'
  | 'wf-10'

const WIFI_FIXTURE_IDS = new Set<WifiFixtureId>([
  'control',
  'loading',
  'wf-01',
  'wf-02',
  'wf-03',
  'wf-04',
  'wf-05',
  'wf-06',
  'wf-07a',
  'wf-07b',
  'wf-08',
  'wf-09',
  'wf-10',
])

const HOTEL_SOURCE: WifiSource = {
  sourceId: 'research-hotel-source',
  sourceLabel: 'Research Hotel Source',
  observedAt: '2026-07-18T12:00:00.000Z',
  fetchedAt: '2026-07-20T12:00:00.000Z',
}

const RATE_SOURCE: WifiSource = {
  sourceId: 'research-rate-source',
  sourceLabel: 'Research Rate Source',
  observedAt: '2026-07-19T12:00:00.000Z',
  fetchedAt: '2026-07-20T12:00:00.000Z',
}

const MEASUREMENT_SOURCE: WifiSource = {
  sourceId: 'research-measurement-source',
  sourceLabel: 'Research Measurement Source',
  observedAt: '2026-06-30T12:00:00.000Z',
  fetchedAt: '2026-07-20T12:00:00.000Z',
}

const REVIEW_SOURCE: WifiSource = {
  sourceId: 'research-review-source',
  sourceLabel: 'Research Review Source',
  fetchedAt: '2026-07-20T12:00:00.000Z',
}

const PROPERTY_ACCESS: WifiAccessEvidence = {
  status: 'confirmed',
  scope: 'property',
  source: HOTEL_SOURCE,
}

const GUEST_ROOM_ACCESS: WifiAccessEvidence = {
  status: 'confirmed',
  scope: 'guest_rooms',
  source: HOTEL_SOURCE,
}

const INCLUDED_RATE: WifiRateCostEvidence = {
  status: 'included',
  scope: 'rate',
  source: RATE_SOURCE,
}

const MEASURED: WifiMeasuredEvidence = {
  kind: 'measured',
  metrics: [
    { kind: 'download', value: 84, unit: 'Mbps' },
    { kind: 'upload', value: 21, unit: 'Mbps' },
    { kind: 'latency', value: 32, unit: 'ms' },
  ],
  method: 'automated in-room network test',
  locationLabel: 'sample guest room on the fourth floor',
  scope: 'guest_rooms',
  observationWindow: {
    start: '2026-06-28T00:00:00.000Z',
    end: '2026-06-30T00:00:00.000Z',
  },
  sampleCount: 18,
  source: MEASUREMENT_SOURCE,
}

const REVIEWS: WifiReviewEvidence = {
  kind: 'review_signal',
  summary: 'mixed experiences with in-room connection consistency.',
  qualifyingReviewCount: 27,
  reviewWindow: {
    start: '2026-01-01T00:00:00.000Z',
    end: '2026-06-30T00:00:00.000Z',
  },
  consistency: 'mixed',
  source: REVIEW_SOURCE,
}

function ready(overrides: Partial<HotelWifiEvidence> = {}): HotelWifiEvidence {
  return {
    checkState: 'ready',
    access: PROPERTY_ACCESS,
    coverage: 'property',
    conflicts: [],
    ...overrides,
  }
}

export function parseWifiFixture(value: string | string[] | undefined): WifiFixtureId {
  const candidate = Array.isArray(value) ? value[0] : value
  return candidate && WIFI_FIXTURE_IDS.has(candidate as WifiFixtureId)
    ? candidate as WifiFixtureId
    : 'control'
}

export function isWifiResearchPrototypeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.HOTEL_WIFI_RESEARCH === 'true'
}

/**
 * Static, source-attributed research records only. These fixtures are deliberately
 * disconnected from hotel/provider models and cannot influence cards or scoring.
 */
export function createWifiFixture(fixtureId: WifiFixtureId): HotelWifiEvidence | null {
  switch (fixtureId) {
    case 'control':
      return null
    case 'loading':
      return { checkState: 'loading', coverage: 'not_specified', conflicts: [] }
    case 'wf-01':
      return ready()
    case 'wf-02':
      return ready({ access: GUEST_ROOM_ACCESS, cost: INCLUDED_RATE, coverage: 'guest_rooms' })
    case 'wf-03':
      return ready({ access: GUEST_ROOM_ACCESS, cost: INCLUDED_RATE, coverage: 'guest_rooms', measuredEvidence: MEASURED })
    case 'wf-04':
      return ready({ access: GUEST_ROOM_ACCESS, coverage: 'guest_rooms', reviewEvidence: REVIEWS })
    case 'wf-05':
      return ready({
        access: GUEST_ROOM_ACCESS,
        coverage: 'guest_rooms',
        measuredEvidence: MEASURED,
        reviewEvidence: REVIEWS,
        conflicts: [
          { dimension: 'measured_vs_review', sourceLabel: MEASUREMENT_SOURCE.sourceLabel, statement: 'Measurements recorded the displayed performance during the observation window.' },
          { dimension: 'measured_vs_review', sourceLabel: REVIEW_SOURCE.sourceLabel, statement: 'Wi-Fi-specific guest reports describe mixed connection consistency.' },
        ],
      })
    case 'wf-06':
      return { checkState: 'not_returned', coverage: 'not_specified', conflicts: [] }
    case 'wf-07a':
      return { checkState: 'error', coverage: 'not_specified', conflicts: [] }
    case 'wf-07b':
      return {
        checkState: 'stale',
        access: PROPERTY_ACCESS,
        cost: INCLUDED_RATE,
        coverage: 'guest_rooms',
        measuredEvidence: MEASURED,
        conflicts: [],
        staleAsOf: '2025-12-15T12:00:00.000Z',
      }
    case 'wf-08':
      return ready({
        access: { status: 'unavailable', scope: 'selected_stay', source: RATE_SOURCE },
        coverage: 'selected_stay',
      })
    case 'wf-09':
      return ready({
        access: { status: 'conflict', scope: 'conflict', source: HOTEL_SOURCE },
        cost: { status: 'conflict', scope: 'rate', source: RATE_SOURCE },
        coverage: 'conflict',
        conflicts: [
          { dimension: 'access', sourceLabel: 'Research Hotel Source', statement: 'Wi-Fi is listed for the property.' },
          { dimension: 'access', sourceLabel: 'Research Rate Source', statement: 'Wi-Fi is not listed for the selected stay.' },
          { dimension: 'cost', sourceLabel: 'Research Hotel Source', statement: 'Property information describes Wi-Fi as free.' },
          { dimension: 'cost', sourceLabel: 'Research Rate Source', statement: 'The selected rate does not specify Wi-Fi inclusion.' },
        ],
      })
    case 'wf-10':
      return ready({
        access: GUEST_ROOM_ACCESS,
        coverage: 'guest_rooms',
        measuredEvidence: {
          ...MEASURED,
          metrics: [{ kind: 'download', value: Number.NaN, unit: 'Mbps' }],
          source: {
            sourceId: 'malformed-research-source',
            sourceLabel: '   ',
            observedAt: 'not-a-date',
            fetchedAt: '2026-07-20T12:00:00.000Z',
          },
        },
      })
  }
}
