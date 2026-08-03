export type HousekeepingFixtureId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8' | 'F9'
export type HousekeepingState = 'reported' | 'ambiguous' | 'conflicting' | 'not_returned' | 'error' | 'loading'
export type HousekeepingScope = 'property' | 'room' | 'rate' | 'selected_stay' | 'none'

export interface HousekeepingStatement {
  id: string
  sourceLabel: string
  sourceText: string
  fetchedAt: string
  kind?: 'statement' | 'exception'
  label?: string
}

export interface HousekeepingFixture {
  id: HousekeepingFixtureId
  label: string
  state: HousekeepingState
  scope: HousekeepingScope
  propertyId: string
  roomId?: string
  rateId?: string
  nightCount?: number
  evidenceRevision: string
  primary: string
  supporting?: string
  action?: string
  towels: string
  bedLinen: string
  evidence: string
  verification: string
  statements: readonly HousekeepingStatement[]
}

export interface HousekeepingPresentation extends Omit<HousekeepingFixture, 'label'> {
  canDisclose: boolean
}

const SOURCE = 'Prototype Hotel Partner'
const CHECKED = '2026-08-03T12:00:00.000Z'
const base = {
  propertyId: 'research-property-01',
  roomId: 'research-room-01',
  rateId: 'research-rate-01',
  nightCount: 4,
  towels: 'Schedule not provided.',
  bedLinen: 'Schedule not provided.',
  verification: 'Check the room and rate terms with the provider before booking; service can change.',
} as const

const statement = (id: string, sourceText: string, sourceLabel = SOURCE, fetchedAt = CHECKED, extras: Partial<HousekeepingStatement> = {}): HousekeepingStatement => ({
  id, sourceLabel, sourceText, fetchedAt, ...extras,
})

const FIXTURES: Record<HousekeepingFixtureId, HousekeepingFixture> = {
  F1: { ...base, id: 'F1', label: 'F1 — Automatic daily, property scope', state: 'reported', scope: 'property', evidenceRevision: 'research-hk-f1-v1', primary: 'Room cleaning: daily.', action: 'No request is needed for the reported schedule.', evidence: `Property policy reported by ${SOURCE} · checked Aug 3, 2026.`, statements: [statement('f1-cleaning', 'Daily housekeeping service is provided automatically.')] },
  F2: { ...base, id: 'F2', label: 'F2 — Request only, room scope', state: 'reported', scope: 'room', evidenceRevision: 'research-hk-f2-v1', primary: 'Room cleaning: only when requested.', action: 'Request through the hotel app by 6 p.m. the day before.', evidence: `Room policy reported by ${SOURCE} · checked Aug 3, 2026.`, statements: [statement('f2-cleaning', 'Stayover cleaning for this room is available on request through the hotel app by 6 p.m. the day before.')] },
  F3: { ...base, id: 'F3', label: 'F3 — Separate cleaning, towel, and linen rules', state: 'reported', scope: 'selected_stay', evidenceRevision: 'research-hk-f3-v1', primary: 'Room cleaning: every 2 nights.', action: 'No request is needed for the reported schedule.', towels: 'Available when requested.', bedLinen: 'Changed every 4 nights.', evidence: `Reported for this room and 4-night stay by ${SOURCE} · checked Aug 3, 2026.`, verification: 'The provider reported this policy for the selected stay. Service can still change.', statements: [statement('f3-cleaning-linen', 'For this room and stay, cleaning is scheduled after every 2 nights and bed linen after every 4 nights.'), statement('f3-towels', 'Fresh towels are available on request.')] },
  F4: { ...base, id: 'F4', label: 'F4 — No stayover cleaning, rate scope', state: 'reported', scope: 'rate', evidenceRevision: 'research-hk-f4-v1', primary: 'No stayover room cleaning is reported for this policy.', towels: 'Available when requested.', evidence: `Rate policy reported by ${SOURCE} · checked Aug 3, 2026.`, statements: [statement('f4-cleaning', 'This rate does not include stayover room cleaning.'), statement('f4-towels', 'Fresh towels are available on request.')] },
  F5: { ...base, id: 'F5', label: 'F5 — Ambiguous property wording', state: 'ambiguous', scope: 'property', evidenceRevision: 'research-hk-f5-v1', primary: 'Schedule unclear', supporting: 'We found housekeeping information, but it does not establish one clear schedule.', evidence: `Property policy reported by ${SOURCE} · checked Aug 3, 2026.`, statements: [statement('f5-cleaning', 'Limited housekeeping is provided regularly during your stay.')] },
  F6: { ...base, id: 'F6', label: 'F6 — Conflicting room statements', state: 'conflicting', scope: 'room', evidenceRevision: 'research-hk-f6-v1', primary: 'Housekeeping information conflicts', supporting: 'Current provider statements do not establish one cleaning schedule. Verify before booking.', evidence: 'Room policy sources checked Aug 2–Aug 3, 2026.', statements: [statement('f6-a', 'Room cleaning is provided daily.'), statement('f6-b', 'Stayover cleaning is available every third night.', 'Prototype Property Content', '2026-08-02T12:00:00.000Z')] },
  F7: { ...base, id: 'F7', label: 'F7 — Schedule not returned', state: 'not_returned', scope: 'none', evidenceRevision: 'research-hk-f7-v1', primary: 'Schedule not returned', supporting: 'This provider did not return a housekeeping schedule.', evidence: `Housekeeping policy checked with ${SOURCE} · Aug 3, 2026.`, verification: 'Check the room and rate terms with the provider before booking.', statements: [] },
  F8: { ...base, id: 'F8', label: 'F8 — Retrieval failure', state: 'error', scope: 'none', evidenceRevision: 'research-hk-f8-v1', primary: 'Could not check schedule', supporting: 'We could not check the room-cleaning, towel, or bed-linen schedules.', evidence: '', verification: 'Check the room and rate terms with the provider before booking.', statements: [] },
  F9: { ...base, id: 'F9', label: 'F9 — Narrower room policy', state: 'reported', scope: 'room', evidenceRevision: 'research-hk-f9-v1', primary: 'Room cleaning: only when requested.', action: 'The provider does not state how or when to request it.', evidence: `Room policy reported by ${SOURCE} · checked Aug 3, 2026.`, statements: [statement('f9-room', 'Stayover cleaning for this room is available on request.'), statement('f9-property', 'The property generally provides daily housekeeping.', SOURCE, CHECKED, { kind: 'exception', label: 'Broader property information' })] },
}

export const HOUSEKEEPING_FIXTURE_IDS = Object.keys(FIXTURES) as HousekeepingFixtureId[]
export const HOUSEKEEPING_FIXTURE_LABELS = Object.fromEntries(HOUSEKEEPING_FIXTURE_IDS.map(id => [id, FIXTURES[id].label])) as Record<HousekeepingFixtureId, string>

export function createHousekeepingFixture(id: HousekeepingFixtureId): HousekeepingFixture {
  return structuredClone(FIXTURES[id])
}

function validStatement(value: HousekeepingStatement): boolean {
  return Boolean(value.sourceLabel.trim() && value.sourceLabel.length <= 80 && value.sourceText.trim() && value.sourceText.length <= 300 && !Number.isNaN(Date.parse(value.fetchedAt)))
}

export function resolveHousekeepingPresentation(fixture: HousekeepingFixture): HousekeepingPresentation {
  const needsProvenance = ['reported', 'ambiguous', 'conflicting'].includes(fixture.state)
  const identityValid = fixture.propertyId === 'research-property-01'
  const provenanceValid = fixture.statements.length > 0 && fixture.statements.every(validStatement)
  if (needsProvenance && (!identityValid || !provenanceValid)) {
    return {
      ...fixture, state: 'ambiguous', scope: 'none', primary: 'Schedule unclear',
      supporting: 'We found housekeeping information, but it does not establish one clear schedule.',
      action: undefined, towels: 'Schedule not provided.', bedLinen: 'Schedule not provided.', evidence: '',
      verification: 'Check the room and rate terms with the provider before booking; service can change.', statements: [], canDisclose: false,
    }
  }
  return { ...fixture, statements: fixture.statements.slice(0, 2), canDisclose: fixture.statements.length > 0 && fixture.state !== 'loading' }
}
