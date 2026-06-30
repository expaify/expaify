import type { ReactElement } from 'react'
import type { Airport } from '@/lib/airports/data'

type TestElement = ReactElement<Record<string, unknown>>

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')

  return {
    ...actual,
    useEffect: jest.fn(),
    useRef: jest.fn(() => ({ current: null })),
    useState: jest.fn((initialValue: unknown) => [initialValue, jest.fn()]),
  }
})

const ReactMock = jest.requireMock('react') as typeof import('react') & {
  useState: jest.Mock
}

const { default: AirportInput } = jest.requireActual('../AirportInput') as typeof import('../AirportInput')

const airports: Airport[] = [
  {
    iata: 'JFK',
    city: 'New York',
    name: 'John F. Kennedy International',
    country: 'US',
  },
  {
    iata: 'LGA',
    city: 'New York',
    name: 'LaGuardia',
    country: 'US',
  },
]

function childrenOf(node: TestElement): unknown[] {
  const children = node.props?.children
  return Array.isArray(children) ? children : [children].filter(Boolean)
}

function walk(node: unknown): TestElement[] {
  if (node === null || node === undefined || typeof node !== 'object') return []

  const element = node as TestElement
  return [element, ...childrenOf(element).flatMap(walk)]
}

function findByType(node: TestElement, type: string): TestElement {
  const match = walk(node).find(element => element.type === type)
  if (!match) throw new Error(`Unable to find ${type}`)
  return match
}

function findByRole(node: TestElement, role: string): TestElement {
  const match = walk(node).find(element => element.props?.role === role)
  if (!match) throw new Error(`Unable to find role ${role}`)
  return match
}

function renderAirportInput(overrides: Partial<Parameters<typeof AirportInput>[0]> = {}) {
  return AirportInput({
    id: 'origin',
    value: '',
    displayValue: '',
    onChange: jest.fn(),
    placeholder: 'City or airport code',
    ...overrides,
  })
}

describe('AirportInput', () => {
  beforeEach(() => {
    ReactMock.useState.mockClear()
  })

  it('exposes combobox and listbox semantics with a quiet no-match state', () => {
    ReactMock.useState
      .mockImplementationOnce(() => ['zzzz', jest.fn()])
      .mockImplementationOnce(() => [true, jest.fn()])
      .mockImplementationOnce(() => [[], jest.fn()])
      .mockImplementationOnce(() => [0, jest.fn()])
      .mockImplementationOnce(() => ['settled', jest.fn()])

    const tree = renderAirportInput()
    const input = findByType(tree, 'input')
    const listbox = findByRole(tree, 'listbox')

    expect(input.props.role).toBe('combobox')
    expect(input.props['aria-expanded']).toBe(true)
    expect(input.props['aria-controls']).toBe('origin-airport-listbox')
    expect(listbox.props.id).toBe('origin-airport-listbox')
    expect(walk(tree).some(element => childrenOf(element).includes('No matching airports found.'))).toBe(true)
  })

  it('clears the submitted IATA code when the user edits display text manually', () => {
    const onChange = jest.fn()
    const tree = renderAirportInput({
      value: 'JFK',
      displayValue: 'New York (JFK)',
      onChange,
    })
    const input = findByType(tree, 'input')

    ;(input.props.onChange as (event: { target: { value: string } }) => void)({
      target: { value: 'Los Angeles' },
    })

    expect(onChange).toHaveBeenCalledWith('', 'Los Angeles')
  })

  it('selects the highlighted airport with Enter', async () => {
    const onChange = jest.fn()
    ReactMock.useState
      .mockImplementationOnce(() => ['New York', jest.fn()])
      .mockImplementationOnce(() => [true, jest.fn()])
      .mockImplementationOnce(() => [airports, jest.fn()])
      .mockImplementationOnce(() => [1, jest.fn()])
      .mockImplementationOnce(() => ['settled', jest.fn()])

    const tree = renderAirportInput({ onChange })
    const input = findByType(tree, 'input')
    const preventDefault = jest.fn()

    await (input.props.onKeyDown as (event: { key: string; preventDefault: () => void }) => Promise<void>)({
      key: 'Enter',
      preventDefault,
    })

    expect(preventDefault).toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith('LGA', 'New York (LGA)')
  })
})
