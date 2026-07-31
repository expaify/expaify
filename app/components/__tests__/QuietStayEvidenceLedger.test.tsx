import { renderToStaticMarkup } from 'react-dom/server'
import {
  getQuietEvidenceResultCue,
  NO_QUIET_STAY_EVIDENCE,
  QuietStayEvidenceHandoff,
  QuietStayEvidenceLedger,
  type GuestNoisePattern,
  type QuietStayEvidence,
} from '../ui/QuietStayEvidenceLedger'
import { DealCard } from '../ui/DealCard'

function available(overrides: Partial<QuietStayEvidence> = {}): QuietStayEvidence {
  return {
    overallState: 'evidence_available',
    selectedStayFacts: [],
    propertyFacts: [],
    guestPatterns: [],
    nearbyContext: [],
    locationPrecision: 'exact',
    ...overrides,
  }
}

const selectedStayFact = {
  normalizedId: 'documented_selected_attribute',
  rawProviderId: 'provider:selected:42',
  scope: 'selected_stay' as const,
  attributeLabel: 'a room away from the lifts',
  sourceLabel: 'Licensed Hotel Source',
  observedAt: '2026-07-20T12:00:00.000Z',
  certainty: 'guaranteed' as const,
  selectedProductId: 'product-42',
}

const roomTypeFact = {
  normalizedId: 'soundproofing_room',
  rawProviderId: 'provider:room:11',
  scope: 'room_type' as const,
  attributeLabel: 'soundproofing',
  sourceLabel: 'Licensed Hotel Source',
  observedAt: '2026-07-20T12:00:00.000Z',
  certainty: 'supported' as const,
  selectedProductId: 'product-11',
  roomTypeLabel: 'Courtyard King',
}

const propertyFact = {
  normalizedId: 'soundproofing_property' as const,
  rawProviderId: 'provider:property:8',
  sourceLabel: 'Licensed Hotel Source',
  observedAt: '2026-07-20T12:00:00.000Z',
}

const guestPattern = (pattern: GuestNoisePattern['pattern']): GuestNoisePattern => ({
  pattern,
  sourceLabel: 'Licensed Review Source',
  licensedForDisplay: true,
  windowStart: '2026-01-01T00:00:00.000Z',
  windowEnd: '2026-06-30T00:00:00.000Z',
  observedAt: '2026-07-15T00:00:00.000Z',
  reviewCount: 128,
})

const airportContext = {
  category: 'airport' as const,
  referencePoint: 'Example International Airport',
  distance: 2.4,
  unit: 'miles',
  method: 'straight_line' as const,
  sourceLabel: 'Licensed Map Source',
  sourceUpdatedAt: '2026-07-18T12:00:00.000Z',
  sourceVersion: 'places-2026-07',
  propertyLocationLabel: 'Exact address' as const,
}

function renderLedger(evidence: QuietStayEvidence): string {
  return renderToStaticMarkup(<QuietStayEvidenceLedger evidence={evidence} />)
}

describe('QuietStayEvidenceLedger', () => {
  it('renders the production fallback as one explicit, static unknown state', () => {
    const html = renderLedger(NO_QUIET_STAY_EVIDENCE)

    expect(html).toContain('Quiet-stay details were not provided by this hotel source.')
    expect(html).toContain('These details do not predict whether a specific room will be quiet.')
    expect(html).not.toContain('Selected room or stay')
    expect(html).not.toContain('role="status"')
    expect(html).not.toMatch(/likely quiet|noisy|noise risk|quiet-stay score/i)
  })

  it('keeps checking and failure polite, atomic, non-blocking, and free of fake retry controls', () => {
    const checking = renderLedger({ ...NO_QUIET_STAY_EVIDENCE, overallState: 'checking' })
    const failed = renderLedger({ ...NO_QUIET_STAY_EVIDENCE, overallState: 'check_failed' })

    expect(checking).toContain('aria-busy="true"')
    expect(checking).toContain('role="status"')
    expect(checking).toContain('aria-live="polite"')
    expect(checking).toContain('aria-atomic="true"')
    expect(failed).toContain('Quiet-stay evidence could not be checked.')
    expect(`${checking}${failed}`).not.toMatch(/<button|retry/i)
  })

  it('enforces selected stay, room type, property, guest pattern, and nearby reading order', () => {
    const html = renderLedger(available({
      selectedStayFacts: [roomTypeFact, selectedStayFact],
      propertyFacts: [propertyFact],
      guestPatterns: [guestPattern('corridors'), guestPattern('street_or_traffic')],
      nearbyContext: [airportContext],
    }))

    const selectedIndex = html.indexOf('The provider confirms a room away from the lifts')
    const roomIndex = html.indexOf('Provider lists soundproofing for Courtyard King')
    const propertyIndex = html.indexOf('Provider lists soundproofing for this property')
    const guestIndex = html.indexOf('Guest-reported patterns')
    const nearbyIndex = html.indexOf('Nearby context')
    expect(selectedIndex).toBeLessThan(roomIndex)
    expect(roomIndex).toBeLessThan(propertyIndex)
    expect(propertyIndex).toBeLessThan(guestIndex)
    expect(guestIndex).toBeLessThan(nearbyIndex)
    expect(html).toContain('Guests mention street or traffic.')
    expect(html).toContain('Guests mention corridors.')
    expect(html).toContain('Based on 128 guest reviews from Jan 1, 2026–Jun 30, 2026')
    expect(html).toContain('Example International Airport is 2.4 miles away in a straight line.')
  })

  it('keeps requestable, transmitted, acknowledged, and selected-stay evidence distinct', () => {
    const base = { ...selectedStayFact, certainty: 'requestable' as const }
    const html = renderLedger(available({ selectedStayFacts: [
      base,
      { ...selectedStayFact, normalizedId: 'sent-request', certainty: 'transmitted', requestReference: 'REQ-42' },
      { ...selectedStayFact, normalizedId: 'ack-request', certainty: 'acknowledged' },
      { ...selectedStayFact, normalizedId: 'selected-attribute' },
    ] }))

    expect(html).toContain('Nothing has been sent by expaify')
    expect(html).toContain('The booking provider says it sent your quieter-room request.')
    expect(html).toContain('Request receipt from Licensed Hotel Source · REQ-42')
    expect(html).toContain('The property acknowledged your quieter-room request.')
    expect(html).toContain('The provider confirms a room away from the lifts for this selected stay.')
  })

  it('renders each unusable class state explicitly while preserving valid classes', () => {
    const html = renderLedger(available({
      selectedStayFacts: [selectedStayFact],
      selectedStayState: 'stale',
      propertyFacts: [propertyFact],
      guestPatterns: [guestPattern('nightlife')],
      guestPatternState: 'malformed',
      contextState: 'error',
    }))

    expect(html).toContain('Selected-room or selected-stay details are out of date and are not shown.')
    expect(html).not.toContain('a room away from the lifts for this selected stay')
    expect(html).toContain('Provider lists soundproofing for this property.')
    expect(html).toContain('Some guest-pattern details could not be verified and are not shown.')
    expect(html).not.toContain('Guests mention nightlife.')
    expect(html).toContain('Nearby context could not be checked.')
  })

  it('suppresses proximity for insufficient or stale location evidence', () => {
    const insufficient = renderLedger(available({
      propertyFacts: [propertyFact],
      nearbyContext: [airportContext],
      locationPrecision: 'area',
      contextState: 'insufficient_location',
    }))
    const stale = renderLedger(available({
      propertyFacts: [propertyFact],
      nearbyContext: [airportContext],
      contextState: 'stale',
      staleContext: { sourceLabel: 'Licensed Map Source', sourceUpdatedAt: '2025-01-02T00:00:00.000Z' },
    }))

    expect(insufficient).toContain('Property-level proximity cannot be calculated from the area information provided.')
    expect(insufficient).not.toContain('Example International Airport')
    expect(stale).toContain('Nearby context is out of date and is not shown.')
    expect(stale).toContain('Last source update: Jan 2, 2025 · Licensed Map Source')
    expect(stale).not.toContain('2.4 miles')
  })

  it('keeps conflicting evidence visible without alert or polarity styling', () => {
    const html = renderLedger(available({
      propertyFacts: [propertyFact],
      guestPatterns: [guestPattern('corridors')],
      propertyFactState: 'conflicting',
      guestPatternState: 'conflicting',
    }))

    expect(html).toContain('Sources differ. Review each source before deciding.')
    expect(html).toContain('Provider lists soundproofing for this property.')
    expect(html).toContain('Guests mention corridors.')
    expect(html).not.toContain('role="alert"')
    expect(html).not.toMatch(/var\(--success\)|var\(--warning\)|var\(--error\)/)
  })

  it('turns malformed-only available input into overall failure instead of ordinary absence', () => {
    const html = renderLedger(available({ propertyFacts: [{ ...propertyFact, sourceLabel: 'x'.repeat(81) }] }))

    expect(html).toContain('Quiet-stay evidence could not be checked.')
    expect(html).not.toContain('No property-level quiet-stay fact was provided.')
    expect(html).not.toContain('x'.repeat(81))
  })

  it('labels a malformed partial class distinctly when another class remains usable', () => {
    const html = renderLedger(available({
      propertyFacts: [propertyFact],
      guestPatterns: [{ ...guestPattern('aircraft'), windowEnd: 'not-a-date' }],
    }))

    expect(html).toContain('Provider lists soundproofing for this property.')
    expect(html).toContain('Some guest-pattern details could not be verified and are not shown.')
    expect(html).not.toContain('No licensed guest noise pattern was provided.')
  })

  it('keeps valid siblings visible while disclosing malformed items in the same class', () => {
    const html = renderLedger(available({
      propertyFacts: [propertyFact],
      guestPatterns: [guestPattern('corridors'), { ...guestPattern('aircraft'), sourceLabel: ' ' }],
      guestPatternState: 'ready',
    }))

    expect(html).toContain('Guests mention corridors.')
    expect(html).toContain('Some guest-pattern details could not be verified and are not shown.')
    expect(html).not.toContain('Guests mention aircraft.')
  })

  it('creates a result cue only from current valid evidence using strongest-class precedence', () => {
    expect(getQuietEvidenceResultCue()).toBeNull()
    expect(getQuietEvidenceResultCue(NO_QUIET_STAY_EVIDENCE)).toBeNull()
    expect(getQuietEvidenceResultCue(available({ propertyFacts: [{ ...propertyFact, sourceLabel: ' ' }] }))).toBeNull()
    expect(getQuietEvidenceResultCue(available({ nearbyContext: [airportContext] }))).toBe('Quiet-stay evidence available · Nearby context')
    expect(getQuietEvidenceResultCue(available({
      selectedStayFacts: [roomTypeFact],
      propertyFacts: [propertyFact],
      guestPatterns: [guestPattern('aircraft')],
      nearbyContext: [airportContext],
    }))).toBe('Quiet-stay evidence available · Room type')
  })

  it('adds the bounded cue inside the existing result link without a new control', () => {
    const deal = {
      id: 'hotel-1',
      hotelName: 'Example Hotel',
      city: 'London',
      stars: 4,
      dealPrice: { priceCents: 18000, currency: 'USD' },
      medianPrice: { priceCents: 22000, currency: 'USD' },
      discountPct: 18,
      checkInWindow: 'Aug 10–12',
      snapshotCount: 22,
      links: {},
      updatedAt: '2026-07-30T00:00:00.000Z',
    }
    const populated = renderToStaticMarkup(
      <DealCard deal={deal} href="/deals/hotel-1" quietStayEvidence={available({ propertyFacts: [propertyFact] })} />,
    )
    const unknown = renderToStaticMarkup(
      <DealCard deal={deal} href="/deals/hotel-1" quietStayEvidence={NO_QUIET_STAY_EVIDENCE} />,
    )

    expect(populated.match(/Quiet-stay evidence available · Property/g)).toHaveLength(1)
    expect(populated).toContain('aria-label="View deal: Example Hotel; Quiet-stay evidence available: Property"')
    expect(unknown).not.toContain('Quiet-stay evidence available')
    expect(populated.match(/<a /g)).toHaveLength(1)
  })

  it('preserves only still-applicable room evidence at handoff and adds no request control', () => {
    const evidence = available({
      selectedStayFacts: [roomTypeFact],
      propertyFacts: [propertyFact],
    })
    const matching = renderToStaticMarkup(<QuietStayEvidenceHandoff evidence={evidence} selectedProductId="product-11" />)
    const changed = renderToStaticMarkup(<QuietStayEvidenceHandoff evidence={evidence} selectedProductId="product-99" />)

    expect(matching).toContain('Quiet-stay evidence for this choice')
    expect(matching).toContain('Courtyard King')
    expect(changed).not.toContain('Courtyard King')
    expect(changed).toContain('Provider lists soundproofing for this property.')
    expect(`${matching}${changed}`).not.toMatch(/<button|<input|<select|<textarea/)
  })

  it('mounts the one production ledger inside Hotel fit before provider handoff', () => {
    const fs = jest.requireActual('node:fs') as typeof import('node:fs')
    const detail = fs.readFileSync('app/deals/[dealId]/page.tsx', 'utf8')
    const card = fs.readFileSync('app/components/ui/DealCard.tsx', 'utf8')
    const fitIndex = detail.indexOf('<section aria-labelledby="saved-hotel-fit-title"')
    const ledgerIndex = detail.indexOf('<QuietStayEvidenceLedger evidence={NO_QUIET_STAY_EVIDENCE} />')
    const actionIndex = detail.indexOf('<section aria-labelledby="saved-provider-title"')
    const supportingIndex = detail.indexOf('<section aria-labelledby="saved-supporting-title"')

    expect(fitIndex).toBeLessThan(ledgerIndex)
    expect(ledgerIndex).toBeLessThan(actionIndex)
    expect(actionIndex).toBeLessThan(supportingIndex)
    expect(detail.match(/<QuietStayEvidenceLedger/g)).toHaveLength(1)
    expect(card.indexOf('{quietEvidenceCue ? (')).toBeGreaterThan(card.indexOf("{' · '}{deal.city}"))
    expect(card.indexOf('{quietEvidenceCue ? (')).toBeLessThan(card.indexOf('<div className="space-y-2">'))
  })
})
