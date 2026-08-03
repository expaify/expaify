import type {
  HotelCredentialEvidence,
  HotelCredentialRecord,
} from '@/app/components/HotelSustainabilityCredentialEvidence'

export const HOTEL_SUSTAINABILITY_CREDENTIAL_FIXTURE_IDS = [
  'cred-issuer-current',
  'cred-provider-current',
  'cred-multiple',
  'cred-expired',
  'cred-incomplete',
  'cred-conflict-status',
  'cred-not-returned',
  'cred-not-checked',
  'cred-check-failed',
  'cred-loading',
  'cred-refreshing',
  'cred-property-mismatch',
  'cred-malformed-date',
  'cred-unsafe-url',
  'cred-long-strings',
  'cred-cue-removed-pair',
] as const

export type HotelSustainabilityCredentialFixtureId = typeof HOTEL_SUSTAINABILITY_CREDENTIAL_FIXTURE_IDS[number]

const issuerRecord: HotelCredentialRecord = {
  id: 'research-green-key',
  schemeName: 'Green Key',
  issuerName: 'Foundation for Environmental Education',
  sourceClass: 'issuer_linked',
  sourceLabel: 'Green Key research registry',
  scope: 'property',
  statusLabel: 'Current',
  validFrom: '2026-01-01',
  validThrough: '2026-12-31',
  observedAt: '2026-08-01',
  evidenceUrl: 'https://credentials.expaify.test/research/green-key',
  evidenceUrlDisplayPermitted: true,
  propertyMatch: 'stable_id',
  displayRightsConfirmed: true,
  freshnessPolicyPassed: true,
}

function ready(state: HotelCredentialEvidence['state'], records: HotelCredentialRecord[]): HotelCredentialEvidence {
  return { loadState: 'ready', state, records, evidenceRevision: `research-${state}` }
}

export function createHotelSustainabilityCredentialFixture(id: HotelSustainabilityCredentialFixtureId): HotelCredentialEvidence {
  switch (id) {
    case 'cred-issuer-current': return ready('current_issuer_linked', [issuerRecord])
    case 'cred-provider-current': return ready('current_provider_reported', [{
      ...issuerRecord,
      id: 'research-provider-green-key',
      issuerName: undefined,
      sourceClass: 'provider_reported',
      sourceLabel: 'Research Rooms',
      validThrough: undefined,
    }])
    case 'cred-multiple': return ready('current_issuer_linked', [issuerRecord, {
      ...issuerRecord,
      id: 'research-earthcheck',
      schemeName: 'EarthCheck',
      issuerName: 'EarthCheck Research Issuer',
      sourceLabel: 'EarthCheck research registry',
      levelLabel: 'Silver',
    }])
    case 'cred-expired': return ready('expired', [{ ...issuerRecord, statusLabel: 'Expired', validThrough: '2025-11-30' }])
    case 'cred-incomplete': return ready('incomplete', [{
      id: 'research-incomplete',
      schemeName: 'Green Key',
      sourceClass: 'issuer_linked',
      sourceLabel: 'Research registry',
      scope: 'property',
      statusLabel: 'Current',
      missingFields: ['issuer', 'validity'],
    }])
    case 'cred-conflict-status': return ready('conflicting', [{
      ...issuerRecord,
      statusLabel: undefined,
      sourceLabel: 'Research registry A',
      evidenceUrl: undefined,
      conflictDimension: 'status',
    }, {
      ...issuerRecord,
      id: 'research-conflict-b',
      statusLabel: undefined,
      sourceLabel: 'Research registry B',
      evidenceUrl: undefined,
      conflictDimension: 'status',
    }])
    case 'cred-not-returned': return ready('not_returned', [])
    case 'cred-not-checked': return ready('not_checked', [])
    case 'cred-check-failed': return { ...ready('check_failed', []), retryable: true }
    case 'cred-loading': return { loadState: 'loading', state: 'not_checked', records: [], evidenceRevision: 'research-loading' }
    case 'cred-refreshing': return { loadState: 'refreshing', state: 'current_issuer_linked', records: [issuerRecord], evidenceRevision: 'research-refreshing' }
    case 'cred-property-mismatch': return ready('incomplete', [{
      ...issuerRecord,
      id: 'research-property-mismatch',
      missingFields: ['property_match'],
      propertyMatch: undefined,
    }])
    case 'cred-malformed-date': return ready('incomplete', [{
      ...issuerRecord,
      id: 'research-malformed-date',
      validThrough: '2026-02-30',
      missingFields: ['validity'],
    }])
    case 'cred-unsafe-url': return ready('current_issuer_linked', [{
      ...issuerRecord,
      id: 'research-unsafe-url',
      evidenceUrl: 'https://unapproved.example/record',
    }])
    case 'cred-long-strings': return ready('current_issuer_linked', [{
      ...issuerRecord,
      id: 'research-long-strings',
      schemeName: 'International Accommodation Credential for Measurable Property-Level Environmental Practice',
      issuerName: 'Independent Foundation for Transparent Accommodation Sustainability Credential Administration',
    }])
    case 'cred-cue-removed-pair': return ready('not_checked', [])
  }
}

// Research-only. Never pass this cue into a production DealCard until the launch gates pass.
export function getPrototypeHotelCredentialResultCue(evidence: HotelCredentialEvidence): string | null {
  if (evidence.loadState !== 'ready') return null
  if (evidence.state !== 'current_issuer_linked' && evidence.state !== 'current_provider_reported') return null
  const records = evidence.records.filter(record => isPrototypeCueEligible(record, evidence.state))
  if (!records.length) return null
  if (records.length > 1) {
    return records.some(record => record.sourceClass === 'provider_reported')
      ? `${records.length} sustainability credentials reported`
      : `${records.length} sustainability credentials`
  }
  const record = records[0]
  if (evidence.state === 'current_provider_reported') return `Credential reported: ${record.schemeName?.trim()}`
  if (record.sourceClass !== 'issuer_linked') return null
  if (!record.validThrough) return `Credential: ${record.schemeName?.trim()} · current`
  const date = parseFixtureDate(record.validThrough)
  if (!date) return null
  const through = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
  return `Credential: ${record.schemeName?.trim()} · current through ${through}`
}

function parseFixtureDate(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.+)?$/.exec(value)
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const calendarDate = new Date(Date.UTC(year, month - 1, day))
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) return undefined
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : undefined
}

function isPrototypeCueEligible(record: HotelCredentialRecord, state: HotelCredentialEvidence['state']): boolean {
  if (!record.schemeName?.trim() || record.scope !== 'property' || !record.statusLabel?.trim() || !record.sourceLabel?.trim()) return false
  if (!record.displayRightsConfirmed || !record.freshnessPolicyPassed || !record.propertyMatch) return false
  if (record.validFrom && !parseFixtureDate(record.validFrom)) return false
  if (record.validThrough && !parseFixtureDate(record.validThrough)) return false
  if (record.observedAt && !parseFixtureDate(record.observedAt)) return false
  if (state === 'current_issuer_linked') return record.sourceClass === 'issuer_linked' && Boolean(record.issuerName?.trim())
  return record.sourceClass === 'provider_reported' && Boolean(record.observedAt)
}
