import type { ReactElement } from 'react'
import type { PetProfileDraft } from '../PetProfilePanel'

type TestElement = ReactElement<Record<string, unknown>>
let stateOverrides: unknown[] = []

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')
  return {
    ...actual,
    useEffect: jest.fn(),
    useRef: jest.fn(() => ({ current: null })),
    useState: jest.fn((initial: unknown) => [stateOverrides.length ? stateOverrides.shift() : typeof initial === 'function' ? (initial as () => unknown)() : initial, jest.fn()]),
  }
})

const { default: PetProfilePanel, validatePetProfileDraft } = jest.requireActual('../PetProfilePanel') as typeof import('../PetProfilePanel')

function childrenOf(node: TestElement | null): unknown[] {
  const children = node?.props?.children
  return Array.isArray(children) ? children : [children].filter(Boolean)
}

function resolveFunctionElement(node: TestElement): TestElement | null {
  if (typeof node.type === 'function') return (node.type as (props: Record<string, unknown>) => TestElement | null)(node.props)
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
  if (!resolved) return []
  return [resolved, ...childrenOf(resolved).flatMap(collectElements)]
}

const emptyDraft: PetProfileDraft = {
  type: '',
  otherAnimalType: '',
  count: '',
  knowsWeights: '',
  weights: [{ value: '', unit: 'lb' }],
}

describe('PetProfilePanel', () => {
  beforeEach(() => { stateOverrides = [] })

  it('renders a stable loading state without flashing the empty profile action', () => {
    const panel = PetProfilePanel({ state: 'loading', onSave: jest.fn() })
    const text = collectText(panel)
    expect(text).toContain('Your pet details')
    expect(text).toContain('Loading your pet details…')
    expect(text).not.toContain('Add pet details')
    expect(collectElements(panel).find(node => node.type === 'section')?.props['aria-busy']).toBe('true')
  })

  it('renders the default and saved entry points without filter language', () => {
    const emptyText = collectText(PetProfilePanel({ onSave: jest.fn() }))
    const savedText = collectText(PetProfilePanel({
      profile: { type: 'dog', count: 1, knowsWeights: true, weights: [{ value: 20, unit: 'lb' }] },
      onSave: jest.fn(),
      onRemove: jest.fn(),
    }))
    expect(emptyText).toContain('Travelling with a pet?')
    expect(emptyText).toContain('Add pet details')
    expect(savedText).toContain('Your pet details')
    expect(savedText).toContain('1 dog · 20 lb')
    expect(savedText).toContain('Edit pet details')
    expect(`${emptyText}${savedText}`).not.toContain('Pet-friendly')
    expect(`${emptyText}${savedText}`).not.toContain('filter')
  })

  it('keeps save errors explicit and leaves retry available', () => {
    const panel = PetProfilePanel({ state: 'error', onSave: jest.fn(), onRetry: jest.fn() })
    expect(collectText(panel)).toContain("We couldn't apply your pet details. Your hotel results have not changed.")
    expect(collectText(panel)).toContain('Try again')
    expect(collectElements(panel).some(node => node.props.role === 'alert')).toBe(true)
  })

  it('renders the complete mobile-first editor and disables it while policies are checked', () => {
    stateOverrides = [
      true,
      { type: 'other', otherAnimalType: 'rabbit', count: '2', knowsWeights: 'yes', weights: [{ value: '8', unit: 'lb' }, { value: '4', unit: 'kg' }] },
      {},
      new Set(),
      false,
    ]
    const panel = PetProfilePanel({ busy: true, resultCount: 4, onSave: jest.fn() })
    const text = collectText(panel)
    const controls = collectElements(panel).filter(node => ['input', 'select', 'button'].includes(String(node.type)))

    expect(text).toContain('Type of pet')
    expect(text).toContain('Animal type')
    expect(text).toContain('Number of pets')
    expect(text).toContain("Do you know each pet's weight?")
    expect(text).toContain('Pet 1 weight')
    expect(text).toContain('Pet 2 weight')
    expect(text).toContain('Checking hotel policies…')
    expect(text).toContain('Checking pet policies for 4 hotels.')
    expect(controls.length).toBeGreaterThan(8)
    expect(controls.every(control => control.props.disabled === true)).toBe(true)
    expect(collectElements(panel).find(node => node.type === 'form')?.props.noValidate).toBe(true)

    const labels = collectElements(panel).filter(node => node.type === 'label').map(collectText)
    expect(labels.indexOf('Animal type')).toBeLessThan(labels.indexOf('Number of pets'))
  })

  it('validates required, bounded count, conditional animal type, and weight limits', () => {
    expect(validatePetProfileDraft(emptyDraft)).toMatchObject({
      type: 'Choose a pet type.',
      count: 'Enter a whole number of pets.',
      knowsWeights: 'Choose Yes or Not sure.',
    })
    expect(validatePetProfileDraft({ ...emptyDraft, type: 'other', count: '10', knowsWeights: 'yes', weights: [{ value: '301', unit: 'lb' }] })).toMatchObject({
      otherAnimalType: 'Enter the type of animal travelling.',
      count: 'Enter between 1 and 9 pets.',
      'weight-0': 'Check this weight and enter 300 lb / 136 kg or less.',
    })
    expect(validatePetProfileDraft({ ...emptyDraft, type: 'dog', count: '1', knowsWeights: 'yes', weights: [{ value: '0', unit: 'kg' }] })).toMatchObject({
      'weight-0': 'Enter a weight greater than 0.',
    })
  })
})
