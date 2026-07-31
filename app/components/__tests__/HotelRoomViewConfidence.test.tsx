import type { ReactElement } from 'react'
import { HotelRoomViewConfidence, type HotelRoomViewPresentation } from '../HotelRoomViewConfidence'

type TestElement = ReactElement<Record<string, unknown>>

function childrenOf(node: unknown): unknown[] {
  if (!node || typeof node !== 'object') return []
  const children = (node as TestElement).props?.children
  return Array.isArray(children) ? children : [children].filter(child => child !== null && child !== undefined)
}

function resolveFunctionElement(node: TestElement): unknown {
  let current: unknown = node

  while (current && typeof current === 'object' && typeof (current as TestElement).type === 'function') {
    const element = current as TestElement
    current = (element.type as (props: Record<string, unknown>) => unknown)(element.props)
  }

  return current
}

function textContent(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (!node || typeof node !== 'object') return ''
  const resolved = resolveFunctionElement(node as TestElement)
  if (!resolved || typeof resolved !== 'object') return textContent(resolved)
  return childrenOf(resolved).map(textContent).join('')
}

function findElements(node: unknown, predicate: (element: TestElement) => boolean): TestElement[] {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(child => findElements(child, predicate))
  const resolved = resolveFunctionElement(node as TestElement)
  if (!resolved || typeof resolved !== 'object') return []
  const element = resolved as TestElement
  return [
    ...(predicate(element) ? [element] : []),
    ...childrenOf(element).flatMap(child => findElements(child, predicate)),
  ]
}

const fixtures: ReadonlyArray<{
  name: string
  presentation: HotelRoomViewPresentation
  expected: readonly string[]
  excluded?: readonly string[]
}> = [
  {
    name: 'guaranteed qualified view',
    presentation: { state: 'guaranteed', viewLabel: 'Partial ocean view', sourceMetadata: 'Source: Example Provider. Updated Jul 31, 2026.' },
    expected: ['Guaranteed room view', 'Provider lists “Partial ocean view” for this room and rate.', 'Source: Example Provider. Updated Jul 31, 2026.'],
  },
  {
    name: 'request-only view',
    presentation: { state: 'request_only', viewLabel: 'Ocean view', sourceMetadata: 'Source: Example Provider. Updated Jul 31, 2026.' },
    expected: ['View request only', 'Provider offers “Ocean view” as a request for this stay. Not guaranteed until the property confirms it for this stay.'],
  },
  {
    name: 'category-only term',
    presentation: { state: 'category_only', viewLabel: 'Partial ocean view', sourceMetadata: 'Source: Example Provider. Updated Jul 31, 2026.' },
    expected: ['View not confirmed', 'Provider lists “Partial ocean view” for this room category, but not for this rate.', 'Photos may show the property or other room categories.'],
  },
  {
    name: 'stale evidence',
    presentation: { state: 'stale', sourceMetadata: 'Source: Example Provider. Last updated Jul 1, 2026.' },
    expected: ['View not confirmed', 'The provider’s room-view details are out of date.', 'Last updated Jul 1, 2026.'],
  },
  {
    name: 'conflicting evidence',
    presentation: { state: 'conflict' },
    expected: ['View not confirmed', 'The provider’s room-view details do not agree.'],
    excluded: ['Ocean view', 'City view'],
  },
  {
    name: 'explicit no-view fact',
    presentation: { state: 'no_view' },
    expected: ['View not confirmed', 'Provider states this room and rate do not include a specified view.'],
  },
  {
    name: 'async error',
    presentation: { state: 'error' },
    expected: ['View not confirmed', 'Room-view details could not be checked.', 'Photos may show the property or other room categories.'],
  },
]

describe('HotelRoomViewConfidence', () => {
  it('renders the production-safe fallback without source, live region, or interaction', () => {
    const tree = HotelRoomViewConfidence({})
    const text = textContent(tree)
    const section = findElements(tree, element => element.type === 'section')[0]

    expect(text).toContain('Room view')
    expect(text).toContain('View not confirmed')
    expect(text).toContain('View not confirmed for the room you choose. Photos may show the property or other room categories. Confirm the room’s view with the provider before booking.')
    expect(text).not.toContain('Source:')
    expect(section.props.role).toBeUndefined()
    expect(section.props['aria-live']).toBeUndefined()
    expect(findElements(tree, element => ['a', 'button', 'input', 'details'].includes(String(element.type)))).toHaveLength(0)
  })

  it('keeps a supplier room name separate without promoting it to evidence', () => {
    const text = textContent(HotelRoomViewConfidence({ roomName: 'Ocean View King' }))

    expect(text).toContain('Provider room nameOcean View King')
    expect(text).toContain('View not confirmed')
    expect(text).not.toContain('Guaranteed room view')
    expect(text).not.toContain('Provider lists “Ocean View King”')
  })

  it.each(fixtures)('renders the fixture-only $name presentation', ({ presentation, expected, excluded = [] }) => {
    const text = textContent(HotelRoomViewConfidence({ presentation }))
    expected.forEach(value => expect(text).toContain(value))
    excluded.forEach(value => expect(text).not.toContain(value))
  })

  it('renders a reserved loading state with static reduced-motion-safe skeletons', () => {
    const tree = HotelRoomViewConfidence({ presentation: { state: 'loading' } })
    const section = findElements(tree, element => element.type === 'section')[0]
    const status = findElements(tree, element => element.props.role === 'status')[0]
    const skeletons = findElements(tree, element => String(element.props.className).includes('motion-safe:animate-pulse'))

    expect(section.props['aria-busy']).toBe(true)
    expect(textContent(status)).toBe('Checking room-view details.')
    expect(skeletons).toHaveLength(2)
  })
})
