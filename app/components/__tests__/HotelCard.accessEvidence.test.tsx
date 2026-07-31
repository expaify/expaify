import type { ReactElement } from 'react'
import type { HotelAmenityEvidence, HotelOffer } from '@/lib/types'

type TestElement = ReactElement<Record<string, unknown>>

let expanded = false

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')

  return {
    ...actual,
    useState: jest.fn(() => [expanded, jest.fn()]),
  }
})

jest.mock('../hotelFundsPolicyAnalytics', () => ({
  trackHotelFundsPolicyDetailsOpened: jest.fn(),
  useHotelFundsPolicyExposure: jest.fn(() => ({ current: null })),
}))

jest.mock('../hotelAdmissionPolicyAnalytics', () => ({
  useHotelAdmissionPolicyViewed: jest.fn(),
  trackHotelHandoffWithAdmissionRestriction: jest.fn(),
}))

const { default: HotelCard } = jest.requireActual('../HotelCard') as typeof import('../HotelCard')

const hotel: HotelOffer = {
  id: 'access-hotel',
  name: 'Access Test Hotel',
  area: 'Central district',
  stars: 4,
  pricePerNight: { priceCents: 17900, currency: 'USD' },
  deeplink: 'https://www.booking.com/hotel/example?aid=test-marker',
  source: 'hotellook',
  documentReadiness: {
    status: 'not_provided', scope: 'rate', documentTypes: [], issuerByDocument: {},
    billingDetailsStep: 'unknown', source: { label: 'Hotellook' },
  },
  fundsPolicy: { state: 'not_returned', obligations: [], sourceLabel: 'Hotellook', scope: 'not_returned' },
}

function evidence(overrides: Partial<HotelAmenityEvidence> = {}): HotelAmenityEvidence {
  return {
    id: 'elevator',
    label: 'Elevator',
    status: 'confirmed',
    scope: 'property',
    sourceLabel: 'Example Provider',
    certainty: 'guaranteed',
    ...overrides,
  }
}

function childrenOf(node: TestElement): unknown[] {
  const children = node.props?.children
  return Array.isArray(children) ? children : [children].filter(Boolean)
}

function resolveFunctionElement(node: TestElement): TestElement {
  if (typeof node.type === 'function') {
    return (node.type as (props: Record<string, unknown>) => TestElement)(node.props)
  }
  return node
}

function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(collectText).join('')
  if (typeof node === 'object') {
    const resolved = resolveFunctionElement(node as TestElement)
    if (resolved === null || resolved === undefined) return ''
    return childrenOf(resolved).map(collectText).join('')
  }
  return ''
}

function collectElements(node: unknown): TestElement[] {
  if (node === null || node === undefined || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(collectElements)
  const resolved = resolveFunctionElement(node as TestElement)
  if (resolved === null || resolved === undefined) return []
  return [resolved, ...childrenOf(resolved).flatMap(collectElements)]
}

function accessSection(root: unknown): TestElement {
  const match = collectElements(root).find(node => (
    node.type === 'section' && collectText(node).includes('Access & room requests')
  ))
  if (!match) throw new Error('Could not find access evidence section')
  return match
}

function roomRateSection(root: unknown): TestElement {
  const match = collectElements(root).find(node => (
    node.type === 'section' && node.props['aria-label'] === 'Room and rate details'
  ))
  if (!match) throw new Error('Could not find room and rate details section')
  return match
}

describe('HotelCard access evidence', () => {
  beforeEach(() => {
    expanded = false
  })

  it('shows the Hotellook not-returned funds policy before review and between price and handoff detail', () => {
    const collapsedCard = HotelCard({ hotel })
    const collapsedText = collectText(collapsedCard)
    const reviewLink = collectElements(collapsedCard).find(node => node.type === 'a' && collectText(node).includes('Review hotel'))

    expect(collapsedText).toContain('Deposit and hold policy not provided. Additional available funds may still be required.')
    expect(collapsedText.indexOf('Deposit and hold policy not provided')).toBeLessThan(collapsedText.indexOf('Review hotel'))
    expect(reviewLink?.props['aria-label']).toContain('Deposit and hold policy was not provided.')

    expanded = true
    const expandedText = collectText(HotelCard({ hotel }))
    expect(expandedText).toContain('Additional funds at the property')
    expect(expandedText).toContain('Source checked: Hotellook · Scope not provided')
    expect(expandedText.indexOf('Price scope')).toBeLessThan(expandedText.indexOf('Additional funds at the property'))
    expect(expandedText.indexOf('Additional funds at the property')).toBeLessThan(expandedText.indexOf('Provider handoff'))
  })

  it('shows only the highest-priority guaranteed property chip when collapsed', () => {
    const card = HotelCard({
      hotel,
      amenityEvidence: [
        evidence({ id: 'on_site_parking', label: 'On-site parking' }),
        evidence(),
      ],
    })
    const text = collectText(card)
    const elevator = collectElements(card).find(node => node.props['aria-label'] ===
      'Elevator. Example Provider confirms this property has an elevator.')

    expect(text).toContain('Elevator')
    expect(text).not.toContain('On-site parking')
    expect(elevator?.props['aria-label']).toBe(
      'Elevator. Example Provider confirms this property has an elevator.'
    )
    expect(String(elevator?.props.className)).toContain('max-w-full')
    expect(collectElements(elevator).some(node => String(node.props.className).includes('truncate'))).toBe(true)
  })

  it('uses evidence and access state attached to the hotel offer by the data layer', () => {
    expanded = true
    const card = HotelCard({
      hotel: {
        ...hotel,
        amenityEvidence: [evidence()],
        accessEvidenceState: 'loading',
      },
    })
    const section = accessSection(card)

    expect(collectText(section)).toContain('Provider confirms this property has an elevator.')
    expect(collectText(section)).toContain('Refreshing access details…')
  })

  it('never promotes requestable or unclear evidence into a collapsed chip', () => {
    const card = HotelCard({
      hotel,
      amenityEvidence: [
        evidence({
          id: 'on_site_parking',
          label: 'On-site parking',
          certainty: 'requestable',
        }),
        evidence({ certainty: 'requestable' }),
      ],
    })

    expect(collectText(card)).not.toContain('On-site parking')
    expect(collectText(card)).not.toContain('Elevator')
  })

  it('renders the neutral all-not-returned default before provider handoff', () => {
    expanded = true
    const card = HotelCard({ hotel })
    const text = collectText(card)
    const section = accessSection(card)

    expect(text).toContain(
      'Access details not documented by this provider. Confirm elevator, step-free access, and room requests directly with the provider before booking.'
    )
    expect(section.props['aria-label']).toBe(
      'Access and room requests. Access details not documented by this provider. Confirm directly before booking.'
    )
    expect(text.indexOf('Access & room requests')).toBeLessThan(text.indexOf('Provider handoff'))
    expect(String(section.props.className)).toContain('bg-[color:var(--bg-raised)]')
  })

  it('renders one honest room and bed disclosure in the expanded room-rate panel', () => {
    expanded = true
    const card = HotelCard({ hotel })
    const section = roomRateSection(card)
    const text = collectText(section)
    const roomRows = collectElements(section).filter(node => (
      node.type === 'dt' && collectText(node) === 'Room & bed'
    ))
    const responsiveGrid = collectElements(section).find(node => (
      node.type === 'dl' && collectText(node).includes('Room & bed')
    ))

    expect(text).toContain('Room & rate details')
    expect(text).toContain('Refundability not provided by this provider — confirm before payment')
    expect(text).toContain('Cancellation deadline not provided by this provider')
    expect(text).toContain('Room type not provided by this provider')
    expect(text).toContain('Meal plan not provided by this provider for this rate')
    expect(roomRows).toHaveLength(1)
    expect(String(responsiveGrid?.props.className)).toContain('grid-cols-1')
    expect(String(responsiveGrid?.props.className)).toContain('sm:grid-cols-2')
    expect(collectElements(section).some(node => node.props.tabIndex !== undefined)).toBe(false)
  })

  it.each([
    ['loading', 'Checking access details…'],
    ['error', 'Access details could not be checked. Confirm elevator, step-free access, and room requests directly with the provider before booking.'],
  ] as const)('keeps the hotel usable in the %s access state', (accessEvidenceState, expected) => {
    expanded = true
    const card = HotelCard({ hotel, accessEvidenceState })
    const section = accessSection(card)
    const status = collectElements(section).find(node => node.props.role === 'status')

    expect(collectText(card)).toContain('Review hotel')
    expect(collectText(section)).toContain(expected)
    expect(status?.props['aria-live']).toBe('polite')
    expect(collectText(section)).not.toContain('Try access details again')
    expect(collectElements(section).map(node => String(node.props.className)).join(' ')).not.toContain('var(--warning)')
  })

  it('renders guaranteed, requestable, unavailable, unknown, and missing facts in canonical order', () => {
    expanded = true
    const card = HotelCard({
      hotel,
      amenityEvidence: [
        evidence({
          id: 'room_pref_ground_floor',
          label: 'Ground-floor room',
          scope: 'room',
          certainty: 'requestable',
          fetchedAt: '2026-07-20T12:00:00.000Z',
        }),
        evidence({ id: 'elevator', status: 'unavailable', certainty: 'guaranteed' }),
        evidence({
          id: 'step_free_route',
          label: 'Step-free route, entrance to room',
          status: 'unknown',
          certainty: undefined,
          fetchedAt: 'not-a-date',
        }),
      ],
    })
    const section = accessSection(card)
    const text = collectText(section)

    expect(text.indexOf('Elevator')).toBeLessThan(text.indexOf('Step-free route, entrance to room'))
    expect(text.indexOf('Step-free route, entrance to room')).toBeLessThan(text.indexOf('Ground-floor room'))
    expect(text).toContain('The provider states this property has no elevator.')
    expect(text).not.toContain('On-site parking')
    expect(text).toContain("Step-free route, entrance to room: the provider's information is unclear. Confirm directly before booking.")
    expect(text).toContain(`You can request a ground-floor room. ${'Request only — not guaranteed until the provider confirms.'}`)
    expect(text).toContain('Source: Example Provider. Updated Jul 20, 2026.')
    expect(text).toContain('Other access and room-request details were not documented by this provider.')
    expect(text).not.toContain('Invalid Date')
  })

  it('includes the exact non-guarantee clause in every requestable visible and accessible string', () => {
    expanded = true
    const card = HotelCard({
      hotel,
      amenityEvidence: [
        evidence({ id: 'room_pref_ground_floor', label: 'Ground-floor room', scope: 'room', certainty: 'requestable' }),
        evidence({ id: 'room_pref_high_floor', label: 'High-floor room', scope: 'room', certainty: 'requestable' }),
        evidence({ id: 'room_pref_near_elevator', label: 'Room near the elevator', scope: 'room', certainty: 'requestable' }),
        evidence({ id: 'room_pref_connecting', label: 'Connecting rooms', scope: 'selected_stay', certainty: 'requestable' }),
      ],
    })
    const section = accessSection(card)
    const clause = 'Request only — not guaranteed until the provider confirms.'
    const requestableAriaLabels = collectElements(section)
      .map(node => node.props['aria-label'])
      .filter(label => typeof label === 'string' && label.includes(clause))

    expect(collectText(section).split(clause)).toHaveLength(5)
    expect(requestableAriaLabels).toHaveLength(4)
  })

  it('uses warning tokens only on unavailable rows within access evidence', () => {
    expanded = true
    const card = HotelCard({
      hotel,
      amenityEvidence: [
        evidence({ status: 'unavailable' }),
        evidence({
          id: 'room_pref_high_floor',
          label: 'High-floor room',
          scope: 'room',
          certainty: 'requestable',
        }),
        evidence({
          id: 'step_free_route',
          label: 'Step-free route, entrance to room',
          status: 'unknown',
          certainty: undefined,
        }),
      ],
    })
    const section = accessSection(card)
    const warningNodes = collectElements(section).filter(node => String(node.props.className).includes('var(--warning'))

    expect(warningNodes).toHaveLength(2)
    expect(warningNodes.every(node => collectText(node).includes('no elevator'))).toBe(true)
  })

  it('consolidates an all-unknown response without warning styling', () => {
    expanded = true
    const card = HotelCard({
      hotel,
      amenityEvidence: [
        evidence({ status: 'unknown', certainty: undefined }),
        evidence({
          id: 'on_site_parking',
          label: 'On-site parking',
          status: 'unknown',
          certainty: undefined,
        }),
      ],
    })
    const section = accessSection(card)

    expect(collectText(section)).toContain(
      'Access and room-request information from this provider is unclear. Confirm details directly before booking.'
    )
    expect(collectText(section)).not.toContain('Other access and room-request details')
    expect(collectElements(section).map(node => String(node.props.className)).join(' ')).not.toContain('var(--warning)')
  })

  it('keeps the safest duplicate and downgrades invalid confirmed combinations', () => {
    expanded = true
    const card = HotelCard({
      hotel,
      amenityEvidence: [
        evidence(),
        evidence({ status: 'unavailable' }),
        evidence({
          id: 'step_free_route',
          label: 'Step-free route, entrance to room',
          certainty: 'requestable',
        }),
      ],
    })
    const text = collectText(accessSection(card))

    expect(text).toContain('The provider states this property has no elevator.')
    expect(text).not.toContain('Provider confirms this property has an elevator.')
    expect(text).toContain("Step-free route, entrance to room: the provider's information is unclear.")
  })

  it('preserves responsive one-column-to-two-column classes and disclosure semantics', () => {
    const collapsedCard = HotelCard({ hotel })
    const toggle = collectElements(collapsedCard).find(node => node.type === 'button' && collectText(node) === 'Details')

    expect(toggle?.props['aria-expanded']).toBe(false)
    expect(toggle?.props['aria-controls']).toBe('hotel-details-access-hotel')

    expanded = true
    const expandedCard = HotelCard({ hotel, amenityEvidence: [evidence()] })
    const list = collectElements(accessSection(expandedCard)).find(node => node.type === 'dl')
    const expandedToggle = collectElements(expandedCard).find(node => node.type === 'button' && collectText(node) === 'Hide details')

    expect(String(list?.props.className)).toContain('grid-cols-1')
    expect(String(list?.props.className)).toContain('sm:grid-cols-2')
    expect(expandedToggle?.props['aria-expanded']).toBe(true)
    expect(collectElements(accessSection(expandedCard)).some(node => node.props.tabIndex !== undefined)).toBe(false)
  })

  it('preserves known evidence and announces background refresh', () => {
    expanded = true
    const section = accessSection(HotelCard({
      hotel,
      accessEvidenceState: 'loading',
      amenityEvidence: [evidence()],
    }))

    expect(collectText(section)).toContain('Provider confirms this property has an elevator.')
    expect(collectText(section)).toContain('Refreshing access details…')
  })

  it('builds review continuity from the displayed policy override and keeps mobile actions at 44px', () => {
    const overriddenPolicy = {
      state: 'explicit_none' as const,
      obligations: [],
      sourceLabel: 'Selected rate policy',
      scope: 'rate' as const,
    }
    const card = HotelCard({ hotel, fundsPolicy: overriddenPolicy })
    const elements = collectElements(card)
    const review = elements.find(node => node.type === 'a' && collectText(node).includes('Review hotel'))
    const details = elements.find(node => node.type === 'button' && collectText(node) === 'Details')
    const policyParam = new URL(String(review?.props.href), 'https://expaify.test').searchParams.get('fundsPolicy')

    expect(JSON.parse(policyParam ?? '{}')).toMatchObject(overriddenPolicy)
    expect(String(review?.props.className)).toContain('min-h-11')
    expect(String(details?.props.className)).toContain('min-h-11')
  })
})
