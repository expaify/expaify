import { renderToStaticMarkup } from 'react-dom/server'
import {
  NO_QUIET_STAY_EVIDENCE,
  QuietStayEvidenceLedger,
  type QuietStayEvidence,
} from '../ui/QuietStayEvidenceLedger'

function render(evidence: QuietStayEvidence): string {
  return renderToStaticMarkup(<QuietStayEvidenceLedger evidence={evidence} />)
}

function available(overrides: Partial<QuietStayEvidence> = {}): QuietStayEvidence {
  return {
    overallState: 'evidence_available',
    providerFacts: [],
    nearbyContext: [],
    reviewTheme: null,
    locationPrecision: 'exact',
    conflictClasses: [],
    ...overrides,
  }
}

const propertyFact = {
  id: 'soundproofing_property' as const,
  scope: 'property' as const,
  certainty: 'supported' as const,
  sourceLabel: 'Licensed Hotel Source',
  fetchedAt: '2026-07-20T12:00:00.000Z',
}

const airportContext = {
  category: 'airport' as const,
  referencePoint: 'Example International Airport',
  distance: 2.4,
  unit: 'miles',
  method: 'straight_line' as const,
  sourceLabel: 'Licensed Map Source',
  sourceUpdatedAt: '2026-07-18T12:00:00.000Z',
  propertyLocationLabel: 'Exact address' as const,
}

const reviewTheme = {
  summary: 'street noise at night',
  sourceLabel: 'Licensed Review Source',
  windowStart: '2026-01-01T00:00:00.000Z',
  windowEnd: '2026-06-30T00:00:00.000Z',
  reviewCount: 128,
}

describe('QuietStayEvidenceLedger', () => {
  it('renders exactly one honest production fallback without empty class groups or live semantics', () => {
    const html = render(NO_QUIET_STAY_EVIDENCE)

    expect(html).toContain('Quiet-stay evidence')
    expect(html).toContain('These details describe provider information, nearby places, or guest opinion.')
    expect(html).toContain('Quiet-stay details were not provided by this hotel source.')
    expect(html).not.toContain('Provider facts')
    expect(html).not.toContain('Nearby context')
    expect(html).not.toContain('Guest review theme')
    expect(html).not.toContain('role="status"')
    expect(html).not.toMatch(/score|risk|guaranteed quiet/i)
  })

  it('keeps checking and failure independent, polite, and free of retry controls', () => {
    const checking = render({ ...NO_QUIET_STAY_EVIDENCE, overallState: 'checking' })
    const failed = render({ ...NO_QUIET_STAY_EVIDENCE, overallState: 'check_failed' })

    expect(checking).toContain('aria-busy="true"')
    expect(checking).toContain('role="status"')
    expect(checking).toContain('aria-live="polite"')
    expect(checking).toContain('Checking quiet-stay evidence…')
    expect(failed).toContain('Quiet-stay evidence could not be checked.')
    expect(failed).toContain('role="status"')
    expect(`${checking}${failed}`).not.toMatch(/<button|retry/i)
  })

  it('renders populated evidence as three source-separated groups in fixed order', () => {
    const html = render(available({
      providerFacts: [propertyFact],
      nearbyContext: [airportContext],
      reviewTheme,
    }))

    expect(html.indexOf('Provider facts')).toBeLessThan(html.indexOf('Nearby context'))
    expect(html.indexOf('Nearby context')).toBeLessThan(html.indexOf('Guest review theme'))
    expect(html).toContain('Provider lists soundproofing for this property. It may not apply to every room.')
    expect(html).toContain('Property information from Licensed Hotel Source · Updated Jul 20, 2026')
    expect(html).toContain('Example International Airport is 2.4 miles away in a straight line.')
    expect(html).toContain('Proximity does not predict noise in a specific room.')
    expect(html).toContain('Nearby data from Licensed Map Source · Updated Jul 18, 2026 · Property location: Exact address')
    expect(html).toContain('Guests mention street noise at night. Summary of guest reviews via Licensed Review Source.')
    expect(html).toContain('Based on 128 guest reviews from Jan 1, 2026–Jun 30, 2026')
  })

  it('uses exact room, requestable, and selected-stay certainty copy', () => {
    const html = render(available({
      providerFacts: [
        {
          id: 'soundproofing_room',
          scope: 'room_type',
          certainty: 'supported',
          sourceLabel: 'Licensed Hotel Source',
          fetchedAt: '2026-07-20T12:00:00.000Z',
          roomTypeLabel: 'Courtyard King',
        },
        {
          id: 'quiet_room_option',
          scope: 'room_type',
          certainty: 'requestable',
          sourceLabel: 'Licensed Hotel Source',
          fetchedAt: '2026-07-20T12:00:00.000Z',
        },
        {
          id: 'quiet_room_option',
          scope: 'selected_stay',
          certainty: 'guaranteed',
          sourceLabel: 'Licensed Hotel Source',
          fetchedAt: '2026-07-20T12:00:00.000Z',
        },
      ],
    }))

    expect(html).toContain('Provider lists soundproofing for this room type. Confirm the selected room before payment.')
    expect(html).toContain('Courtyard King · Room information from Licensed Hotel Source')
    expect(html).toContain('A quieter room can be requested. Requests depend on availability and are not guaranteed.')
    expect(html).toContain('Provider confirms this quiet-room attribute for the selected stay.')
  })

  it('suppresses proximity claims for insufficient and stale location context', () => {
    const insufficient = render(available({
      nearbyContext: [airportContext],
      locationPrecision: 'area',
      contextState: 'insufficient_location',
    }))
    const stale = render(available({
      nearbyContext: [airportContext],
      contextState: 'stale',
      staleContext: {
        sourceLabel: 'Licensed Map Source',
        sourceUpdatedAt: '2025-01-02T00:00:00.000Z',
      },
    }))

    expect(insufficient).toContain('Property-level proximity cannot be calculated from the area information provided.')
    expect(insufficient).not.toContain('Example International Airport')
    expect(stale).toContain('Nearby context is out of date and is not shown.')
    expect(stale).toContain('Last source update: Jan 2, 2025 · Licensed Map Source')
    expect(stale).not.toContain('Example International Airport')
    expect(stale).not.toContain('2.4 miles')
  })

  it('keeps conflicting valid evidence visible beside partial class errors', () => {
    const html = render(available({
      providerFacts: [propertyFact],
      reviewTheme,
      conflictClasses: ['provider_fact__review_theme'],
      contextState: 'error',
    }))

    expect(html).toContain('Sources differ. Review each source before deciding.')
    expect(html).toContain('Provider lists soundproofing for this property.')
    expect(html).toContain('Guests mention street noise at night.')
    expect(html).toContain('Nearby context could not be checked.')
    expect(html).not.toContain('role="alert"')
  })

  it('suppresses malformed or unattributable fixture values instead of printing claims', () => {
    const html = render(available({
      providerFacts: [{
        ...propertyFact,
        sourceLabel: 'x'.repeat(81),
      }],
      nearbyContext: [{
        ...airportContext,
        distance: -2.4,
      }],
      reviewTheme: {
        ...reviewTheme,
        windowEnd: 'not-a-date',
      },
    }))

    expect(html).toContain('No provider fact was supplied.')
    expect(html).toContain('No usable nearby context was supplied.')
    expect(html).toContain('No licensed guest noise theme was supplied.')
    expect(html).not.toContain('x'.repeat(81))
    expect(html).not.toContain('Example International Airport')
    expect(html).not.toContain('street noise at night')
  })

  it('keeps production mounting limited to detail and leaves DealCard and handoff unchanged', () => {
    const fs = jest.requireActual('node:fs') as typeof import('node:fs')
    const detail = fs.readFileSync('app/deals/[dealId]/page.tsx', 'utf8')
    const card = fs.readFileSync('app/components/ui/DealCard.tsx', 'utf8')
    const handoff = fs.readFileSync('app/book/BookingFlow.tsx', 'utf8')

    const scoreIndex = detail.indexOf('{/* Deal score')
    const ledgerIndex = detail.indexOf('<QuietStayEvidenceLedger evidence={NO_QUIET_STAY_EVIDENCE} />')
    const photoIndex = detail.indexOf('<PropertyPhoto src={deal.photo_url}')
    const actionIndex = detail.indexOf('{/* Primary action zone */}')

    expect(scoreIndex).toBeLessThan(ledgerIndex)
    expect(ledgerIndex).toBeLessThan(photoIndex)
    expect(photoIndex).toBeLessThan(actionIndex)
    expect(card).not.toMatch(/quiet-stay|quiet evidence/i)
    expect(handoff).toContain('Special requests')
    expect(handoff).not.toContain('QuietStayEvidenceLedger')
  })
})
