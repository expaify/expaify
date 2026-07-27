import type { ReactElement } from 'react'
import SmokingPolicyPanel, {
  getCollapsedSmokingPolicy,
  type HotelSmokingPolicyView,
  type SupplierSmokingStatement,
} from '../SmokingPolicyPanel'

type TestElement = ReactElement<Record<string, unknown>>

function childrenOf(node: TestElement): unknown[] {
  const children = node.props?.children
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

function statement(overrides: Partial<SupplierSmokingStatement> = {}): SupplierSmokingStatement {
  return {
    id: 'statement-1',
    value: 'all_rooms_non_smoking',
    scope: 'property_room_inventory',
    sourceLabel: 'Example Supplier',
    sourceText: 'All guest rooms are non-smoking.',
    fetchedAt: '2026-07-20T12:00:00.000Z',
    ...overrides,
  }
}

function policy(overrides: Partial<HotelSmokingPolicyView> = {}): HotelSmokingPolicyView {
  return {
    loadState: 'ready',
    room: { state: 'not_provided', statements: [] },
    property: { state: 'not_provided', statements: [] },
    ...overrides,
  }
}

describe('SmokingPolicyPanel', () => {
  it('separates the two current-provider missing states and preserves semantic order', () => {
    const tree = SmokingPolicyPanel({ offerId: 'hotel-1', surface: 'result_detail', policy: policy() })
    const text = collectText(tree)
    const sections = findElements(tree, element => element.type === 'section')

    expect(text.indexOf('Room policy')).toBeLessThan(text.indexOf('Property & common areas'))
    expect(text.match(/Not provided/g)).toHaveLength(2)
    expect(text.match(/Smoking policy not provided by this supplier\./g)).toHaveLength(2)
    expect(text).toContain('Supplier policy; expaify has not verified enforcement or smoke conditions.')
    expect(String(sections[0].props.className)).toContain('px-3.5')
    expect(String(sections[1].props.className)).toContain('min-w-0')
    expect(String(findElements(tree, element => element.type === 'div')[0].props.className)).toContain('lg:grid-cols-2')
  })

  it.each([
    ['all_rooms_non_smoking', 'All rooms non-smoking', 'The supplier states that all guest rooms at this property are non-smoking.'],
    ['smoking_rooms_offered', 'Property offers smoking rooms', 'Availability for your dates is not confirmed.'],
    ['selected_room_non_smoking', 'Selected room: Non-smoking', 'Confirmed for Sep 10, 2026 to Sep 12, 2026 and this selected room and rate.'],
    ['selected_room_smoking', 'Selected room: Smoking permitted', 'Confirmed for Sep 10, 2026 to Sep 12, 2026 and this selected room and rate.'],
  ] as const)('renders exact confirmed room copy for %s', (value, claim, support) => {
    const roomStatement = statement({
      value,
      scope: value.startsWith('selected_') ? 'selected_room_rate' : value === 'smoking_rooms_offered' ? 'property_room_capability' : 'property_room_inventory',
      checkin: '2026-09-10',
      checkout: '2026-09-12',
      roomId: 'room-1',
      rateId: 'rate-1',
    })
    const text = collectText(SmokingPolicyPanel({
      offerId: 'hotel-1',
      surface: 'result_detail',
      policy: policy({ room: { state: 'confirmed', value, scope: roomStatement.scope, statements: [roomStatement] } }),
    }))

    expect(text).toContain(claim)
    expect(text).toContain(support)
    expect(text).toContain('All guest rooms are non-smoking.')
    expect(text).toContain('Source: Example Supplier. Observed July 20, 2026.')
  })

  it.each([
    ['smoke_free_property', 'Smoke-free property', 'The supplier applies this rule to the entire property.'],
    ['indoor_common_areas_smoke_free', 'Indoor common areas are smoke-free', 'not necessarily guest rooms or outdoor areas.'],
    ['designated_smoking_areas', 'Designated smoking areas', 'Review the supplier wording for location details.'],
    ['smoking_permitted_in_stated_areas', 'Smoking permitted in stated areas', 'only in the areas named below.'],
  ] as const)('renders exact confirmed property copy for %s', (value, claim, support) => {
    const propertyStatement = statement({ value, scope: value === 'smoke_free_property' ? 'entire_property' : 'stated_areas' })
    const text = collectText(SmokingPolicyPanel({
      offerId: 'hotel-1',
      surface: 'review',
      policy: policy({ property: { state: 'confirmed', value, scope: propertyStatement.scope, statements: [propertyStatement] } }),
    }))

    expect(text).toContain(claim)
    expect(text).toContain(support)
  })

  it('preserves ambiguous supplier wording verbatim, including whitespace and long tokens', () => {
    const sourceText = 'Smoking allowed?\n  Ask-property: SUPERLONGTOKENWITHOUTBREAKS012345678901234567890.'
    const tree = SmokingPolicyPanel({
      offerId: 'hotel-1',
      surface: 'result_detail',
      policy: policy({ room: { state: 'ambiguous', scope: 'unclear', statements: [statement({ sourceText, scope: 'unclear' })] } }),
    })
    const quote = findElements(tree, element => element.type === 'blockquote')[0]

    expect(collectText(quote)).toBe(sourceText)
    expect(String(quote.props.className)).toContain('whitespace-pre-wrap')
    expect(String(quote.props.className)).toContain('[overflow-wrap:anywhere]')
    expect(collectText(tree)).toContain('Policy wording provided; scope unclear.')
    expect(collectText(tree)).toContain('Scope: Scope unclear')
  })

  it('shows every conflicting statement with scope and provenance without hiding records', () => {
    const first = statement({ id: 'a', sourceText: 'Non-smoking rooms only.', scope: 'property_room_inventory' })
    const second = statement({ id: 'b', sourceText: 'Smoking rooms available.', scope: 'property_room_capability', fetchedAt: '2026-07-21T12:00:00.000Z' })
    const tree = SmokingPolicyPanel({
      offerId: 'hotel-1',
      surface: 'result_detail',
      policy: policy({ room: { state: 'conflicting', statements: [first, second] } }),
    })
    const list = findElements(tree, element => element.type === 'ol')[0]

    expect(list.props['aria-label']).toBe('Conflicting supplier statements')
    expect(findElements(list, element => element.type === 'li')).toHaveLength(2)
    expect(collectText(list)).toContain('Scope: All guest-room inventory')
    expect(collectText(list)).toContain('Scope: Property room capability')
    expect(collectText(list)).toContain('Non-smoking rooms only.')
    expect(collectText(list)).toContain('Smoking rooms available.')
  })

  it.each([
    ['loading', 'Checking supplier smoking policy…'],
    ['error', 'Smoking policy could not be checked.Confirm this with the booking partner before you book.'],
  ] as const)('keeps lifecycle state %s distinct and politely announced', (loadState, expected) => {
    const tree = SmokingPolicyPanel({ offerId: 'hotel-1', surface: 'result_detail', policy: policy({ loadState }) })
    const statuses = findElements(tree, element => element.props.role === 'status')

    expect(collectText(tree)).toContain(expected)
    if (loadState === 'loading') expect(statuses[0].props['aria-live']).toBe('polite')
    expect(tree.props['aria-busy']).toBe(loadState === 'loading')
  })

  it('retains refreshing evidence as stale and reports refresh failure without a current summary', () => {
    const stalePolicy = policy({
      loadState: 'refreshing',
      refreshFailed: true,
      room: { state: 'confirmed', value: 'all_rooms_non_smoking', statements: [statement()] },
    })
    const tree = SmokingPolicyPanel({ offerId: 'hotel-1', surface: 'review', policy: stalePolicy })

    expect(collectText(tree)).toContain('Policy refresh failed. The previous supplier statement is shown and is not treated as current confirmation.')
    expect(collectText(tree)).toContain('Previous supplier policy — refresh required')
    expect(collectText(tree)).toContain('This supplier statement is out of date and is not treated as a current confirmation.')
    expect(getCollapsedSmokingPolicy(stalePolicy)).toBeNull()
  })

  it('does not describe a prior missing state as a stale supplier statement while refreshing', () => {
    const tree = SmokingPolicyPanel({ offerId: 'hotel-1', surface: 'review', policy: policy({ loadState: 'refreshing' }) })

    expect(collectText(tree)).toContain('Refreshing supplier policy…')
    expect(collectText(tree)).toContain('Not provided')
    expect(collectText(tree)).not.toContain('Previous supplier policy — refresh required')
  })

  it('uses the specified collapsed priority and excludes non-current or non-confirmed evidence', () => {
    const selected = statement({
      value: 'selected_room_non_smoking',
      scope: 'selected_room_rate',
      checkin: '2026-09-10',
      checkout: '2026-09-12',
      roomId: 'room-1',
      rateId: 'rate-1',
    })
    const mixed = policy({
      room: { state: 'confirmed', value: 'selected_room_non_smoking', scope: 'selected_room_rate', statements: [selected] },
      property: { state: 'confirmed', value: 'smoke_free_property', scope: 'entire_property', statements: [statement({ value: 'smoke_free_property', scope: 'entire_property' })] },
    })

    expect(getCollapsedSmokingPolicy(mixed)?.label).toBe('Selected room: Non-smoking')
    expect(getCollapsedSmokingPolicy(mixed)?.ariaLabel).toContain('Open Details for full supplier evidence.')
    expect(getCollapsedSmokingPolicy(policy({ room: { state: 'ambiguous', statements: [statement()] } }))).toBeNull()
    expect(getCollapsedSmokingPolicy(policy({ room: { state: 'confirmed', value: 'all_rooms_non_smoking', scope: 'property_room_inventory', statements: [statement()], isStale: true } }))).toBeNull()
  })

  it('withholds collapsed claims unless provenance, scope, and selected-stay binding are complete', () => {
    const selected = statement({
      value: 'selected_room_non_smoking',
      scope: 'selected_room_rate',
      checkin: '2026-09-10',
      checkout: '2026-09-12',
      roomId: 'room-1',
      rateId: 'rate-1',
    })
    const qualified = policy({
      room: { state: 'confirmed', value: 'selected_room_non_smoking', scope: 'selected_room_rate', statements: [selected] },
    })

    expect(getCollapsedSmokingPolicy(qualified)?.label).toBe('Selected room: Non-smoking')
    expect(getCollapsedSmokingPolicy(policy({
      room: { state: 'confirmed', value: 'selected_room_non_smoking', scope: 'selected_room_rate', statements: [{ ...selected, rateId: undefined }] },
    }))).toBeNull()
    expect(getCollapsedSmokingPolicy(policy({
      room: { state: 'confirmed', value: 'all_rooms_non_smoking', scope: 'property_room_inventory', statements: [statement({ sourceLabel: '' })] },
    }))).toBeNull()
    expect(getCollapsedSmokingPolicy(policy({
      property: { state: 'confirmed', value: 'smoke_free_property', scope: 'indoor_common_areas', statements: [statement({ value: 'smoke_free_property', scope: 'entire_property' })] },
    }))).toBeNull()
  })
})
