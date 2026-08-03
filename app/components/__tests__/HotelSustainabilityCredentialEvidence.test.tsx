import fs from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  HotelSustainabilityCredentialEvidence,
  NOT_CHECKED_HOTEL_CREDENTIAL_EVIDENCE,
} from '../HotelSustainabilityCredentialEvidence'
import {
  createHotelSustainabilityCredentialFixture,
  getPrototypeHotelCredentialResultCue,
  HOTEL_SUSTAINABILITY_CREDENTIAL_FIXTURE_IDS,
} from '../research/hotelSustainabilityCredentialFixtures'

function render(id: Parameters<typeof createHotelSustainabilityCredentialFixture>[0]): string {
  return renderToStaticMarkup(<HotelSustainabilityCredentialEvidence evidence={createHotelSustainabilityCredentialFixture(id)} />).replaceAll('&#x27;', "'")
}

describe('HotelSustainabilityCredentialEvidence', () => {
  it('provides every research-only state fixture without changing the production default', () => {
    expect(HOTEL_SUSTAINABILITY_CREDENTIAL_FIXTURE_IDS).toHaveLength(11)
    expect(NOT_CHECKED_HOTEL_CREDENTIAL_EVIDENCE).toEqual(expect.objectContaining({ state: 'not_checked', records: [] }))
  })

  it.each([
    ['cred-issuer-current', 'Current credential evidence was found for this property.'],
    ['cred-provider-current', 'A booking provider reports credential evidence for this property.'],
    ['cred-expired', 'This credential record expired Nov 2025.'],
    ['cred-incomplete', 'We could not verify this credential record.'],
    ['cred-conflict-status', "Sources disagree about this credential's status."],
    ['cred-not-returned', 'No verifiable credential evidence was returned for this property.'],
    ['cred-not-checked', 'Sustainability credential evidence has not been checked for this property.'],
    ['cred-check-failed', "We couldn't check sustainability credential evidence right now."],
    ['cred-loading', 'Checking sustainability credential evidence…'],
    ['cred-refreshing', 'Checking sustainability credential evidence…'],
  ] as const)('renders exact state copy for %s', (id, copy) => {
    expect(render(id)).toContain(copy)
  })

  it('keeps provider reports explicit, levels non-ordinal, records alphabetical, and links safe', () => {
    const provider = render('cred-provider-current')
    const multiple = render('cred-multiple')
    expect(provider).toContain('Reported by Research Rooms; not confirmed through the issuer')
    expect(provider).toContain('Validity date not provided')
    expect(multiple).toContain('Silver (scheme wording)')
    expect(multiple.indexOf('EarthCheck')).toBeLessThan(multiple.indexOf('Green Key'))
    expect(multiple).toContain('It is not an environmental impact score or a comparison with other schemes.')
    expect(multiple).not.toMatch(/leaf|medal|verified by expaify/i)
  })

  it('renders missing evidence in the required order and suppresses stale records while refreshing', () => {
    expect(render('cred-incomplete')).toContain('Missing evidence: issuing organization and validity.')
    const refreshing = render('cred-refreshing')
    expect(refreshing).not.toContain('Green Key')
    expect(refreshing).toContain('aria-busy="true"')
    expect(refreshing).not.toContain('animate-pulse')
  })

  it('exposes retry as a native controlled button without gating the provider flow', () => {
    const failed = createHotelSustainabilityCredentialFixture('cred-check-failed')
    const retry = renderToStaticMarkup(<HotelSustainabilityCredentialEvidence evidence={failed} onRetry={() => undefined} />)
    const retrying = renderToStaticMarkup(<HotelSustainabilityCredentialEvidence evidence={{ ...failed, loadState: 'loading' }} onRetry={() => undefined} retrying />)
    expect(retry).toContain('<button type="button"')
    expect(retry).toContain('Try again')
    expect(retrying).toContain('disabled=""')
    expect(retrying).toContain('Checking…')
  })

  it('keeps all result cues in research code and silent for suppressed states', () => {
    expect(getPrototypeHotelCredentialResultCue(createHotelSustainabilityCredentialFixture('cred-issuer-current'))).toBe('Credential: Green Key · current through Dec 2026')
    expect(getPrototypeHotelCredentialResultCue(createHotelSustainabilityCredentialFixture('cred-provider-current'))).toBe('Credential reported: Green Key')
    expect(getPrototypeHotelCredentialResultCue(createHotelSustainabilityCredentialFixture('cred-multiple'))).toBe('2 sustainability credentials')
    expect(getPrototypeHotelCredentialResultCue(createHotelSustainabilityCredentialFixture('cred-expired'))).toBeNull()
    expect(fs.readFileSync('app/components/ui/DealCard.tsx', 'utf8')).not.toContain('getPrototypeHotelCredentialResultCue')
  })

  it('mounts the production not-checked renderer last in Hotel fit before provider handoff', () => {
    const saved = fs.readFileSync('app/deals/[dealId]/page.tsx', 'utf8')
    const handoff = fs.readFileSync('app/book/BookingFlow.tsx', 'utf8')
    for (const [source, fit, credential, provider] of [
      [saved, 'saved-hotel-fit-title', '<HotelSustainabilityCredentialEvidence />', 'saved-provider-title'],
      [handoff, 'hotel-fit-title', '<HotelSustainabilityCredentialEvidence />', 'function StatusPanel'],
    ]) {
      expect(source.indexOf(fit)).toBeLessThan(source.indexOf(credential))
      expect(source.indexOf(credential)).toBeLessThan(source.indexOf(provider))
    }
  })
})
