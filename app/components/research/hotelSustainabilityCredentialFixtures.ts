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
  evidenceUrl: 'https://example.com/research/green-key',
  evidenceUrlDisplayPermitted: true,
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
  }
}

// Research-only. Never pass this cue into a production DealCard until the launch gates pass.
export function getPrototypeHotelCredentialResultCue(evidence: HotelCredentialEvidence): string | null {
  if (evidence.loadState !== 'ready') return null
  if (evidence.state !== 'current_issuer_linked' && evidence.state !== 'current_provider_reported') return null
  const records = evidence.records.filter(record => record.schemeName?.trim() && record.scope === 'property')
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
  const date = new Date(record.validThrough)
  if (!Number.isFinite(date.getTime())) return null
  const through = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
  return `Credential: ${record.schemeName?.trim()} · current through ${through}`
}
