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

const { default: HotelCard } = jest.requireActual('../HotelCard') as typeof import('../HotelCard')

const hotel: HotelOffer = {
  id: 'access-hotel',
  name: 'Access Test Hotel',
  area: 'Central district',
  stars: 4,
  pricePerNight: { priceCents: 17900, currency: 'USD' },
  deeplink: 'https://example.com/hotel',
  source: 'hotellook',
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
    return childrenOf(resolveFunctionElement(node as TestElement)).map(collectText).join('')
  }
  return ''
}

function collectElements(node: unknown): TestElement[] {
  if (node === null || node === undefined || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(collectElements)
  const resolved = resolveFunctionElement(node as TestElement)
  return [resolved, ...childrenOf(resolved).flatMap(collectElements)]
}

function accessSection(root: unknown): TestElement {
  const match = collectElements(root).find(node => (
    node.type === 'section' && collectText(node).includes('Access & room requests')
  ))
  if (!match) throw new Error('Could not find access evidence section')
  return match
}

describe('HotelCard access evidence', () => {
  beforeEach(() => {
    expanded = false
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
      'Access details not documented by this provider. Confirm elevator, parking, step-free access, and room requests directly with the provider before booking.'
    )
    expect(section.props['aria-label']).toBe(
      'Access and room requests. Access details not documented by this provider. Confirm directly before booking.'
    )
    expect(text.indexOf('Access & room requests')).toBeLessThan(text.indexOf('Provider handoff'))
    expect(String(section.props.className)).toContain('bg-[color:var(--bg-raised)]')
  })

  it.each([
    ['loading', 'Checking access details…'],
    ['error', 'Access details could not be checked. Confirm elevator, parking, step-free access, and room requests directly with the provider before booking.'],
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
          id: 'on_site_parking',
          label: 'On-site parking',
          fee: 'paid',
        }),
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

    expect(text.indexOf('Elevator')).toBeLessThan(text.indexOf('On-site parking'))
    expect(text.indexOf('On-site parking')).toBeLessThan(text.indexOf('Step-free route, entrance to room'))
    expect(text.indexOf('Step-free route, entrance to room')).toBeLessThan(text.indexOf('Ground-floor room'))
    expect(text).toContain('The provider states this property has no elevator.')
    expect(text).toContain('Provider confirms this property has on-site parking. Parking fee: additional charge applies.')
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
        evidence({ id: 'on_site_parking', label: 'On-site parking', certainty: 'requestable' }),
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

    expect(collectText(section).split(clause)).toHaveLength(6)
    expect(requestableAriaLabels).toHaveLength(5)
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
})
