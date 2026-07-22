import type { ReactElement } from 'react'
import type { HotelOffer } from '@/lib/types'
import type { HotelPetPolicyPresentation } from '../HotelPetPolicy'

type TestElement = ReactElement<Record<string, unknown>>
let expanded = false

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')
  return { ...actual, useState: jest.fn(() => [expanded, jest.fn()]) }
})

const { default: HotelCard } = jest.requireActual('../HotelCard') as typeof import('../HotelCard')

const hotel: HotelOffer = {
  id: 'pet-policy-hotel',
  name: 'Hotel Luna',
  area: 'Central district',
  stars: 4,
  pricePerNight: { priceCents: 17900, currency: 'USD' },
  deeplink: 'https://example.com/hotel?aid=expaify',
  source: 'Example Provider',
}

function childrenOf(node: TestElement): unknown[] {
  const children = node.props?.children
  return Array.isArray(children) ? children : [children].filter(Boolean)
}

function resolveFunctionElement(node: TestElement): TestElement {
  if (typeof node.type === 'function') return (node.type as (props: Record<string, unknown>) => TestElement)(node.props)
  return node
}

function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(collectText).join('')
  if (typeof node === 'object') return childrenOf(resolveFunctionElement(node as TestElement)).map(collectText).join('')
  return ''
}

function collectElements(node: unknown): TestElement[] {
  if (node === null || node === undefined || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(collectElements)
  const resolved = resolveFunctionElement(node as TestElement)
  return [resolved, ...childrenOf(resolved).flatMap(collectElements)]
}

function readyPolicy(overrides: Partial<Extract<HotelPetPolicyPresentation, { state: 'ready' }>> = {}): Extract<HotelPetPolicyPresentation, { state: 'ready' }> {
  return {
    state: 'ready',
    profileSummary: '1 dog · 20 lb',
    scanSupport: 'Dogs up to 25 lb · $30 USD per pet, per stay',
    evaluation: {
      status: 'suitable',
      reasonCodes: [],
      explanation: 'The returned policy fits your stated pet.',
      unresolvedDimensions: [],
      costStatus: 'mandatory_known',
      policyEvidenceRef: 'pet-policy-1',
    },
    evidence: {
      availability: 'returned',
      permission: 'allowed',
      includedAnimalTypes: ['Dogs'],
      excludedAnimalTypes: ['cats'],
      feeStatus: 'mandatory_known',
      fee: { priceCents: 3000, currency: 'USD' },
      feeBasis: 'per_pet_per_stay',
      maximumPetCount: 2,
      maximumWeight: { value: 25, unit: 'lb' },
      restrictions: [
        { text: 'Pets must be leashed in shared areas.' },
        { text: 'Animals may not be left unattended.', supplierWording: true },
      ],
      restrictionsComplete: true,
      scope: 'selected_stay',
      sourceLabel: 'Example Provider',
      fetchedAt: '2026-07-20T12:00:00.000Z',
      schemaVersion: '1',
    },
    ...overrides,
  }
}

describe('HotelCard pet-policy presentation', () => {
  beforeEach(() => { expanded = false })

  it('does not expose pet UI when the opt-in presentation contract is absent', () => {
    const text = collectText(HotelCard({ hotel }))
    expect(text).not.toContain('Pet policy')
    expect(text).not.toContain('pet details')
  })

  it('places a complete suitable scan status before Deal Score and keeps charges separate', () => {
    const text = collectText(HotelCard({ hotel, petPolicy: readyPolicy() }))
    expect(text).toContain('Fits your pet')
    expect(text).toContain('Dogs up to 25 lb · $30 USD per pet, per stay')
    expect(text.indexOf('Fits your pet')).toBeLessThan(text.indexOf('Review hotel'))
    expect(text).not.toContain('$209')
  })

  it('renders attributed evidence after Location and before access and provider handoff', () => {
    expanded = true
    const card = HotelCard({ hotel, petPolicy: readyPolicy() })
    const text = collectText(card)
    const section = collectElements(card).find(node => node.type === 'section' && collectText(node).includes('Pet policy for your stay'))
    const labels = collectElements(section).filter(node => node.type === 'dt').map(collectText)

    expect(text.indexOf('Location')).toBeLessThan(text.indexOf('Pet policy for your stay'))
    expect(text.indexOf('Pet policy for your stay')).toBeLessThan(text.indexOf('Access & room requests'))
    expect(text.indexOf('Pet policy for your stay')).toBeLessThan(text.indexOf('Provider handoff'))
    expect(labels).toEqual(['Policy outcome', 'Animal types', 'Pet charge', 'Number of pets', 'Weight or size limit', 'Other restrictions', 'Applies to', 'Policy source', 'Policy checked'])
    expect(collectText(section)).toContain('$30 USD per pet, per stay.')
    expect(collectText(section)).toContain('Provider statement: “Animals may not be left unattended.”')
    expect(collectText(section)).toContain('Checked Jul 20, 2026.')
  })

  it('renders explicit non-fit copy without relying on color', () => {
    const policy = readyPolicy({
      scanSupport: 'This policy allows up to 1 pet.',
      evaluation: { ...readyPolicy().evaluation!, status: 'unsuitable', explanation: 'The policy allows up to 1 pet; your profile includes 2.' },
    })
    expect(collectText(HotelCard({ hotel, petPolicy: policy }))).toContain('Does not fit your petThis policy allows up to 1 pet.')
  })

  it.each([
    ['not_returned', 'Pet policy not returned', 'This provider did not return a pet policy.'],
    ['error', 'Pet policy could not be loaded', 'Pet policy could not be loaded.'],
    ['conflict', 'Pet policy information conflicts', 'Provider policy statements conflict.'],
  ] as const)('renders the %s state as confirmation, never a match', (availability, heading, scan) => {
    expanded = true
    const policy = readyPolicy({ evidence: { ...readyPolicy().evidence, availability } })
    const text = collectText(HotelCard({ hotel, petPolicy: policy }))
    expect(text).toContain('Pet policy needs confirmation')
    expect(text).toContain(scan)
    expect(text).toContain(heading)
    expect(text).not.toContain('Fits your pet')
  })

  it('shows by-arrangement, stale, malformed, conflict, and unresolved evidence truthfully', () => {
    expanded = true
    const byArrangement = collectText(HotelCard({ hotel, petPolicy: readyPolicy({ evidence: { ...readyPolicy().evidence, permission: 'by_arrangement' } }) }))
    expect(byArrangement).toContain('Property approval required')

    const stale = collectText(HotelCard({ hotel, petPolicy: readyPolicy({ evidence: { ...readyPolicy().evidence, stale: true } }) }))
    expect(stale).toContain('This pet policy was checked Jul 20, 2026 and may have changed.')
    expect(stale).not.toContain('Fits your pet')

    const malformed = readyPolicy({
      evidence: { ...readyPolicy().evidence, feeStatus: 'unconfirmed', malformedLimit: true },
      evaluation: { ...readyPolicy().evaluation!, status: 'unknown', unresolvedDimensions: ['pet_charge', 'weight_or_size'] },
    })
    const malformedText = collectText(HotelCard({ hotel, petPolicy: malformed }))
    expect(malformedText).toContain('A pet charge is listed, but its amount or basis could not be confirmed.')
    expect(malformedText).toContain('A pet limit is listed, but the value could not be confirmed.')
    expect(malformedText).toContain('Confirm pet charge, weight or size limit with the provider or property.')
  })

  it('preserves every conflicting statement and provides an unambiguous affiliate confirmation link', () => {
    expanded = true
    const policy = readyPolicy({
      confirmationHref: 'https://example.com/hotel?aid=expaify#pet-policy',
      evidence: { ...readyPolicy().evidence, availability: 'conflict', conflictStatements: ['Pets allowed.', 'Pets not allowed.'] },
    })
    const card = HotelCard({ hotel, petPolicy: policy })
    const text = collectText(card)
    const link = collectElements(card).find(node => node.type === 'a' && collectText(node) === 'Confirm pet policy with provider')
    expect(text).toContain('Pets allowed.')
    expect(text).toContain('Pets not allowed.')
    expect(link?.props['aria-label']).toBe('Confirm pet policy for Hotel Luna with Example Provider')
    expect(link?.props.href).toContain('aid=expaify')
  })

  it('keeps Review hotel usable while policy evidence loads', () => {
    expanded = true
    const card = HotelCard({ hotel, petPolicy: { state: 'loading', profileSummary: '1 dog' } })
    const text = collectText(card)
    expect(text).toContain("Checking this hotel's pet policy…")
    expect(text).toContain('Checking pet policy…')
    expect(text).toContain('Review hotel')
  })

  it('shows availability without a profile but never a fit outcome', () => {
    const text = collectText(HotelCard({ hotel, petPolicy: readyPolicy({ profileSummary: undefined, evaluation: undefined }) }))
    expect(text).toContain('Pet policy available in Details.')
    expect(text).not.toContain('Fits your pet')
    expect(text).not.toContain('Does not fit your pet')
  })

  it('downgrades unsafe positive claims with prohibition, property-only scope, or missing provenance', () => {
    const prohibited = collectText(HotelCard({ hotel, petPolicy: readyPolicy({ evidence: { ...readyPolicy().evidence, permission: 'prohibited' } }) }))
    const propertyOnly = collectText(HotelCard({ hotel, petPolicy: readyPolicy({ evidence: { ...readyPolicy().evidence, scope: 'property' } }) }))
    const sourceMissing = collectText(HotelCard({ hotel, petPolicy: readyPolicy({ evidence: { ...readyPolicy().evidence, sourceLabel: ' ' } }) }))
    const nonFitSourceMissing = collectText(HotelCard({
      hotel,
      petPolicy: readyPolicy({
        evidence: { ...readyPolicy().evidence, sourceLabel: ' ' },
        evaluation: {
          ...readyPolicy().evaluation!,
          status: 'unsuitable',
          explanation: 'The provider says this property does not allow pets.',
        },
      }),
    }))
    expect(prohibited).toContain('Pet policy needs confirmation')
    expect(propertyOnly).toContain('Pet policy needs confirmation')
    expect(sourceMissing).toContain('Pet policy needs confirmation')
    expect(nonFitSourceMissing).toContain('Pet policy needs confirmation')
    expect(prohibited).not.toContain('Fits your pet')
    expect(propertyOnly).not.toContain('Fits your pet')
    expect(sourceMissing).not.toContain('Fits your pet')
    expect(nonFitSourceMissing).not.toContain('Does not fit your pet')
  })

  it.each([
    ['allowed animal types', { includedAnimalTypes: undefined }],
    ['pet count limit', { maximumPetCount: undefined }],
    ['weight limit', { maximumWeight: undefined }],
    ['restriction completeness', { restrictionsComplete: false }],
    ['checked date', { fetchedAt: undefined }],
    ['schema version', { schemaVersion: ' ' }],
  ] as const)('does not claim a fit without resolved %s evidence', (_label, evidenceOverride) => {
    const policy = readyPolicy({ evidence: { ...readyPolicy().evidence, ...evidenceOverride } })
    const text = collectText(HotelCard({ hotel, petPolicy: policy }))
    expect(text).toContain('Pet policy needs confirmation')
    expect(text).not.toContain('Fits your pet')
  })

  it('quarantines invalid count and weight values as unconfirmed limits', () => {
    expanded = true
    const policy = readyPolicy({
      evidence: {
        ...readyPolicy().evidence,
        maximumPetCount: -1,
        maximumWeight: { value: Number.NaN, unit: 'lb' },
      },
    })
    const text = collectText(HotelCard({ hotel, petPolicy: policy }))
    expect(text.match(/A pet limit is listed, but the value could not be confirmed\./g)).toHaveLength(2)
    expect(text).not.toContain('Up to -1')
    expect(text).not.toContain('Up to NaN')
  })
})
