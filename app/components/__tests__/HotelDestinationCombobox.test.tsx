import type { ReactElement } from 'react'
import type { HotelDestination } from '../HotelDestinationCombobox'

type TestElement = ReactElement<Record<string, unknown>>

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')

  return {
    ...actual,
    useEffect: jest.fn(),
    useMemo: jest.fn((factory: () => unknown) => factory()),
    useRef: jest.fn(() => ({ current: null })),
    useState: jest.fn((initialValue: unknown) => [initialValue, jest.fn()]),
  }
})

const ReactMock = jest.requireMock('react') as typeof import('react') & {
  useState: jest.Mock
}

const {
  default: HotelDestinationCombobox,
  hotelDestinationScopeHelper,
  isCompleteHotelDestination,
  usableHotelDestinations,
} = jest.requireActual('../HotelDestinationCombobox') as typeof import('../HotelDestinationCombobox')

const chicago: HotelDestination = {
  provider: 'approved-provider',
  locationId: 'city-1',
  locationType: 'city',
  name: 'Chicago',
  parentLabel: 'Illinois, United States',
  fullLabel: 'Chicago, City in Illinois, United States',
}

const airportArea: HotelDestination = {
  provider: 'approved-provider',
  locationId: 'airport-area-1',
  locationType: 'airport_area',
  name: 'O’Hare International Airport',
  parentLabel: 'Chicago, Illinois, United States',
  fullLabel: 'O’Hare International Airport, Airport area near Chicago, Illinois, United States',
}

function childrenOf(node: TestElement): unknown[] {
  const children = node.props?.children
  return Array.isArray(children) ? children : [children].filter(Boolean)
}

function walk(node: unknown): TestElement[] {
  if (node === null || node === undefined || typeof node !== 'object') return []
  const element = node as TestElement
  return [element, ...childrenOf(element).flatMap(walk)]
}

function renderCombobox(overrides: Partial<Parameters<typeof HotelDestinationCombobox>[0]> = {}) {
  return HotelDestinationCombobox({
    id: 'hotel-destination',
    selectedDestination: null,
    suggestions: [],
    lookupState: 'idle',
    minimumCharacters: 2,
    onQueryChange: jest.fn(),
    onSelect: jest.fn(),
    onClear: jest.fn(),
    onRetry: jest.fn(),
    ...overrides,
  })
}

describe('HotelDestinationCombobox contract', () => {
  beforeEach(() => {
    ReactMock.useState.mockClear()
  })

  it('renders an accessible collapsed field without opening an empty suggestion popup', () => {
    const tree = renderCombobox()
    const input = walk(tree).find(element => element.type === 'input')

    expect(input?.props.role).toBe('combobox')
    expect(input?.props['aria-expanded']).toBe(false)
    expect(input?.props['aria-controls']).toBe('hotel-destination-hotel-destination-listbox')
    expect(walk(tree).some(element => element.props.role === 'listbox')).toBe(false)
    expect(walk(tree).some(element => childrenOf(element).includes('Choose a suggestion to set the hotel search area.'))).toBe(true)
  })

  it('renders provider-backed suggestions with the required two-line anatomy', () => {
    ReactMock.useState
      .mockImplementationOnce(() => ['Chi', jest.fn()])
      .mockImplementationOnce(() => [true, jest.fn()])
      .mockImplementationOnce(() => [true, jest.fn()])
      .mockImplementationOnce(() => [0, jest.fn()])
      .mockImplementationOnce(() => [null, jest.fn()])
      .mockImplementationOnce(() => ['', jest.fn()])

    const tree = renderCombobox({
      suggestions: [chicago, airportArea],
      lookupState: 'ready',
    })
    const options = walk(tree).filter(element => element.props.role === 'option')

    expect(options).toHaveLength(2)
    expect(options[0].props['aria-label']).toBe(chicago.fullLabel)
    expect(walk(options[0]).some(element => childrenOf(element).includes('Chicago'))).toBe(true)
    expect(walk(options[0]).some(element => childrenOf(element).includes('Illinois, United States'))).toBe(true)
  })

  it('fails closed for malformed or visually indistinguishable provider rows', () => {
    const malformed = { ...chicago, locationId: '' }
    const indistinguishable = { ...chicago, locationId: 'city-2' }

    expect(isCompleteHotelDestination(malformed)).toBe(false)
    expect(usableHotelDestinations([chicago, indistinguishable, malformed])).toEqual([])
  })

  it('deduplicates provider tuples using the richest returned hierarchy', () => {
    const richer = {
      ...chicago,
      parentLabel: 'Cook County, Illinois, United States',
      fullLabel: 'Chicago, City in Cook County, Illinois, United States',
    }

    expect(usableHotelDestinations([chicago, richer])).toEqual([richer])
  })

  it('uses type-specific scope language without inferring geography', () => {
    expect(hotelDestinationScopeHelper(chicago)).toBe('City in Illinois, United States')
    expect(hotelDestinationScopeHelper(airportArea)).toBe('Airport area near Chicago, Illinois, United States')
  })
})
