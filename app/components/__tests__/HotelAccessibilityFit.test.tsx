import fs from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { DealCard } from '../ui/DealCard'
import { LockedDealCard } from '../ui/LockedDealCard'
import {
  AccessibilityFitLedger,
  AccessibilityHandoffBoundary,
  createAccessibilityPresentation,
  type AccessibilityFact,
  type AccessibilityNeedId,
} from '../ui/HotelAccessibilityFit'

const deal = {
  id: 'hotel-1', hotelName: 'Example Hotel', city: 'Boston', stars: 4,
  dealPrice: { priceCents: 15900, currency: 'USD' },
  medianPrice: { priceCents: 22900, currency: 'USD' },
  discountPct: 31, checkInWindow: 'Aug 12–15', snapshotCount: 20, links: {},
}

function fact(overrides: Partial<AccessibilityFact> = {}): AccessibilityFact {
  return {
    canonicalId: 'roll_in_shower',
    needId: 'roll_in_shower',
    label: 'Roll-in shower documented for the selected room',
    state: 'ready',
    scope: 'selected_stay',
    sourceLabel: 'Example Provider',
    observedAt: '2026-07-30T12:00:00.000Z',
    certainty: 'guaranteed',
    propertyId: 'property-1',
    roomProductId: 'room-1',
    roomLabel: 'Accessible King',
    rateId: 'rate-1',
    stayFingerprint: 'stay-1',
    confirmationReference: 'confirmation-1',
    rawProviderId: 'provider:roll-in-shower',
    ...overrides,
  }
}

describe('hotel accessibility fit presentation', () => {
  it('renders no fit cue without selected needs and exposes the honest detail fallback', () => {
    const presentation = createAccessibilityPresentation()
    const card = renderToStaticMarkup(<DealCard deal={deal} href="/deals/hotel-1" accessibility={presentation} />)
    const ledger = renderToStaticMarkup(<AccessibilityFitLedger presentation={presentation} hotelName={deal.hotelName} />)
    const boundary = renderToStaticMarkup(<AccessibilityHandoffBoundary presentation={presentation} />)

    expect(card).not.toContain('Accessibility fit')
    expect(ledger).toContain('No accessibility needs were carried with this saved deal.')
    expect(ledger).toContain('No fit outcome without selected needs')
    expect(boundary).toContain('No accessibility needs were selected for comparison.')
    expect(boundary).toContain('No room selected — accessibility fit is not confirmed.')
  })

  it.each([
    ['loading', [fact({ state: 'loading', sourceLabel: undefined, observedAt: undefined })], 'loading'],
    ['source returned nothing', [], 'not_documented'],
    ['property-only evidence', [fact({ scope: 'property' })], 'not_documented'],
    ['requestable', [fact({ certainty: 'requestable', confirmationReference: undefined })], 'not_documented'],
    ['named room without rate binding', [fact({ rateId: undefined, stayFingerprint: undefined, confirmationReference: undefined })], 'not_documented'],
    ['selected-stay positive', [fact()], 'documented'],
    ['stale', [fact({ state: 'stale' })], 'not_documented'],
    ['malformed', [fact({ state: 'malformed', sourceLabel: undefined })], 'not_documented'],
    ['error', [fact({ state: 'error' })], 'not_documented'],
    ['conflicting', [fact({ state: 'conflicting' }), fact({ state: 'conflicting', sourceLabel: 'Second Provider', rawProviderId: 'provider-2' })], 'not_documented'],
  ] as Array<[string, AccessibilityFact[], string]>)('keeps %s inside the evidence gate', (_label, facts, outcome) => {
    expect(createAccessibilityPresentation(['roll_in_shower'], facts).needs[0]?.outcome).toBe(outcome)
  })

  it('requires valid explicit negative capability and relevant scope for mismatch', () => {
    const invalid = createAccessibilityPresentation(['roll_in_shower'], [fact({ state: 'unavailable', scope: 'property', negativeCapability: true })])
    const valid = createAccessibilityPresentation(['roll_in_shower'], [fact({ state: 'unavailable', negativeCapability: true })])
    const absence = createAccessibilityPresentation(['roll_in_shower'])

    expect(invalid.needs[0]?.outcome).toBe('not_documented')
    expect(valid.needs[0]?.outcome).toBe('mismatch')
    expect(absence.needs[0]?.outcome).not.toBe('mismatch')
  })

  it('never lets elevator evidence complete the step-free route', () => {
    const route = createAccessibilityPresentation(['step_free_route_to_room'], [fact({
      canonicalId: 'vertical_circulation',
      needId: 'step_free_route_to_room',
      label: 'Elevator documented',
    })])
    expect(route.needs[0]?.outcome).toBe('not_documented')
    const html = renderToStaticMarkup(<AccessibilityFitLedger presentation={route} hotelName="Example Hotel" />)
    expect(html).toContain('Elevator or accessible vertical circulation')
    expect(html).toContain('Step-free property entrance')
    expect(html).toContain('Route to guest-room entry')
  })

  it('keeps roll-in shower and accessible tub evidence independent', () => {
    const presentation = createAccessibilityPresentation(
      ['roll_in_shower', 'accessible_tub'],
      [fact()],
    )
    expect(presentation.needs.map(need => [need.id, need.outcome])).toEqual([
      ['roll_in_shower', 'documented'],
      ['accessible_tub', 'not_documented'],
    ])
    expect(presentation.rollup).toBe('needs_confirmation')
  })

  it('renders every selected need on the active linked card with matching accessible outcomes', () => {
    const presentation = createAccessibilityPresentation(['roll_in_shower', 'accessible_tub'], [fact()])
    const html = renderToStaticMarkup(<DealCard deal={deal} href="/deals/hotel-1" accessibility={presentation} />)

    expect(html).toContain('Some needs require confirmation')
    expect(html).toContain('Roll-in shower: Documented for this stay')
    expect(html).toContain('Accessible tub: Not documented — confirm')
    expect(html).toContain('Accessibility fit. Roll-in shower: Documented for this selected stay.')
    const articleStart = html.indexOf('<article')
    expect(html.indexOf('Accessibility fit', articleStart)).toBeLessThan(html.indexOf('usually', articleStart))
  })

  it('degrades expired evidence in both visible and accessible card copy', () => {
    const presentation = createAccessibilityPresentation(['roll_in_shower'], [fact()])
    const html = renderToStaticMarkup(<DealCard deal={{ ...deal, expired: true }} href="/deals/hotel-1" accessibility={presentation} />)
    expect(html).toContain('Saved accessibility details may be out of date.')
    expect(html).toContain('Roll-in shower: Out of date — confirm')
    expect(html).toContain('Roll-in shower: Not documented; confirm before booking.')
    expect(html).not.toContain('Roll-in shower: Documented for this selected stay.')
  })

  it('keeps locked evidence hidden while explaining when fit becomes available', () => {
    const html = renderToStaticMarkup(<LockedDealCard placeholderName="Members-only deal" placeholderCity="Boston" stars={4} accessibilityNeedsSelected />)
    expect(html).toContain('Accessibility fit available after this deal is unlocked.')
    expect(html).not.toContain('Documented for this stay')
  })

  it('renders loading, empty, conflict, and error states without blocking handoff', () => {
    const loading = createAccessibilityPresentation(['roll_in_shower'], [fact({ state: 'loading', sourceLabel: undefined, observedAt: undefined })])
    const empty = createAccessibilityPresentation(['roll_in_shower'])
    const conflict = createAccessibilityPresentation(['roll_in_shower'], [fact({ state: 'conflicting' }), fact({ state: 'conflicting', sourceLabel: 'Second Provider', rawProviderId: 'second' })])
    const error = createAccessibilityPresentation(['roll_in_shower'], [fact({ state: 'error' })])
    const loadingHtml = renderToStaticMarkup(<AccessibilityFitLedger presentation={loading} hotelName="Example Hotel" />)
    const emptyHtml = renderToStaticMarkup(<AccessibilityFitLedger presentation={empty} hotelName="Example Hotel" />)
    const conflictHtml = renderToStaticMarkup(<AccessibilityFitLedger presentation={conflict} hotelName="Example Hotel" />)
    const errorBoundary = renderToStaticMarkup(<AccessibilityHandoffBoundary presentation={error} />)

    expect(loadingHtml).toContain('aria-busy="true"')
    expect(loadingHtml).toContain('Checking accessibility details for Example Hotel.')
    expect(loadingHtml).toContain('skeleton h-4')
    expect(emptyHtml).toContain('This does not mean the features are unavailable.')
    expect(conflictHtml).toContain('Sources conflict — confirm')
    expect(conflictHtml).toContain('aria-label="Conflicting evidence sources for Roll-in shower."')
    expect(errorBoundary).toContain('Could not be checked — confirm')
    expect(errorBoundary).not.toMatch(/disabled|<button/)
  })

  it('orders the ledger before quiet-stay evidence and the boundary before provider actions', () => {
    const source = fs.readFileSync('app/deals/[dealId]/page.tsx', 'utf8')
    expect(source.indexOf('<AccessibilityFitLedger')).toBeLessThan(source.indexOf('<QuietStayEvidenceLedger'))
    expect(source.indexOf('<AccessibilityHandoffBoundary')).toBeLessThan(source.indexOf('<HotelDealCriteriaHandoff'))
    expect(source).toContain('Rate shown for these dates. No room is selected, and room-level accessibility fit is not confirmed.')
    expect(source).not.toContain('Rate shown for this stay context; the provider confirms room-level details.')
  })

  it('keeps canonical selected-need order regardless of caller order', () => {
    const input: AccessibilityNeedId[] = ['tactile_braille_wayfinding', 'roll_in_shower', 'step_free_route_to_room']
    expect(createAccessibilityPresentation(input).selectedNeeds).toEqual([
      'step_free_route_to_room', 'roll_in_shower', 'tactile_braille_wayfinding',
    ])
  })
})
