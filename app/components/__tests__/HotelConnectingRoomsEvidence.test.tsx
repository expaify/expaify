import type { ReactElement } from 'react'
import { HotelConnectingRoomsEvidence } from '../HotelConnectingRoomsEvidence'
import { CONNECTING_ROOMS_FACT_ID } from '@/lib/hotels/connectingRoomsEvidence'
import type { HotelAmenityEvidence } from '@/lib/types'

function fact(overrides: Partial<HotelAmenityEvidence> = {}): HotelAmenityEvidence {
  return {
    id: CONNECTING_ROOMS_FACT_ID,
    label: 'Connecting rooms',
    status: 'confirmed',
    scope: 'selected_stay',
    sourceLabel: 'Hotellook',
    certainty: 'guaranteed',
    fetchedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

type TestElement = ReactElement<Record<string, unknown>>

function childrenOf(node: TestElement): unknown[] {
  const children = node.props.children
  return Array.isArray(children) ? children : [children].filter(Boolean)
}

function resolveFunctionElement(node: TestElement): unknown {
  let current: unknown = node
  while (current && typeof current === 'object' && typeof (current as TestElement).type === 'function') {
    const element = current as TestElement
    current = (element.type as (props: Record<string, unknown>) => unknown)(element.props)
  }
  return current
}

function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(collectText).join('')
  if (typeof node === 'object') {
    const resolved = resolveFunctionElement(node as TestElement)
    if (!resolved || typeof resolved !== 'object') return collectText(resolved)
    return childrenOf(resolved as TestElement).map(collectText).join('')
  }
  return ''
}

function collectAriaLabels(node: unknown): string[] {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(collectAriaLabels)
  const resolved = resolveFunctionElement(node as TestElement)
  if (!resolved || typeof resolved !== 'object') return []
  const element = resolved as TestElement
  const own = typeof element.props['aria-label'] === 'string' ? [element.props['aria-label'] as string] : []
  return [...own, ...childrenOf(element).flatMap(collectAriaLabels)]
}

function panel(props: Parameters<typeof HotelConnectingRoomsEvidence>[0]) {
  return HotelConnectingRoomsEvidence(props)
}

describe('HotelConnectingRoomsEvidence', () => {
  it('renders the loading state', () => {
    const tree = panel({ loadState: 'loading' })
    expect(collectText(tree)).toContain('Checking connecting-room details…')
    expect((tree as TestElement).props['aria-busy']).toBe('true')
  })

  it('renders the error state', () => {
    const text = collectText(panel({ loadState: 'error' }))
    expect(text).toContain('Connecting-room details could not be checked.')
  })

  it('renders the not_returned copy when no amenity evidence is supplied', () => {
    const text = collectText(panel({ amenityEvidence: undefined }))
    expect(text).toContain('Connecting-room details were not documented by this provider.')
  })

  it('renders a confirmed guarantee with the provider named in the aria label', () => {
    const tree = panel({ amenityEvidence: [fact()] })
    expect(collectText(tree)).toContain('The provider guarantees connecting rooms for this selected stay.')
    expect(collectAriaLabels(tree).some(label => label.includes('Guaranteed for this selected stay by Hotellook'))).toBe(true)
  })

  it('renders a requestable confirmation with the non-guarantee clause', () => {
    const text = collectText(panel({ amenityEvidence: [fact({ scope: 'room', certainty: 'requestable' })] }))
    expect(text).toContain('You can request connecting rooms.')
    expect(text).toContain('not guaranteed until the provider confirms')
  })

  it('renders the unavailable state', () => {
    const text = collectText(panel({ amenityEvidence: [fact({ status: 'unavailable', certainty: undefined, scope: 'room' })] }))
    expect(text).toContain('The provider states connecting rooms cannot be requested for this stay.')
  })

  it('renders the unknown state when the fact is malformed', () => {
    const text = collectText(panel({ amenityEvidence: [fact({ sourceLabel: '' })] }))
    expect(text).toContain("the provider's information is unclear")
  })

  it('always shows the scope caveat distinguishing this from occupancy/bed-config facts', () => {
    const text = collectText(panel({ amenityEvidence: [fact()] }))
    expect(text).toContain('This is separate from how many guests a room fits and what beds it has.')
  })

  it('never asserts acceptance language when the fact is not_returned', () => {
    const text = collectText(panel({ amenityEvidence: undefined }))
    expect(text).not.toMatch(/\bguaranteed\b/i)
    expect(text).not.toContain('You can request')
  })
})
