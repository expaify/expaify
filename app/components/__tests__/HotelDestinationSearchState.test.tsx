import type { ReactElement } from 'react'
import type { HotelDestination } from '../HotelDestinationCombobox'
import HotelDestinationSearchState, {
  UnsupportedHotelDestinationState,
} from '../HotelDestinationSearchState'

type TestElement = ReactElement<Record<string, unknown>>

const parent: HotelDestination = {
  provider: 'approved-provider',
  locationId: 'paris-city',
  locationType: 'city',
  name: 'Paris',
  parentLabel: 'France',
  fullLabel: 'Paris, City in France',
}

const destination: HotelDestination = {
  provider: 'approved-provider',
  locationId: 'district-1',
  locationType: 'neighborhood',
  name: 'Saint-Germain-des-Prés',
  parentLabel: 'Paris, France',
  fullLabel: 'Saint-Germain-des-Prés, Neighborhood in Paris, France',
  parent,
}

function childrenOf(node: TestElement): unknown[] {
  const children = node.props?.children
  return Array.isArray(children) ? children : [children].filter(Boolean)
}

function textContent(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (!node || typeof node !== 'object') return ''
  return childrenOf(node as TestElement).map(textContent).join('')
}

describe('HotelDestinationSearchState', () => {
  it('keeps the selected scope visible while hotel search is loading', () => {
    const tree = HotelDestinationSearchState({
      destination,
      state: { kind: 'loading' },
      onEditDestination: jest.fn(),
    })

    expect(textContent(tree)).toContain('Searching hotels in Saint-Germain-des-Prés…')
    expect(childrenOf(tree)[0]).toMatchObject({
      props: { destination },
    })
  })

  it('offers explicit parent broadening for zero inventory', () => {
    const tree = HotelDestinationSearchState({
      destination,
      state: {
        kind: 'empty',
        onEditDates: jest.fn(),
        onSearchParent: jest.fn(),
      },
      onEditDestination: jest.fn(),
    })

    expect(textContent(tree)).toContain('No hotels were returned in Saint-Germain-des-Prés for these dates.')
    expect(textContent(tree)).toContain('Search Paris')
  })

  it('does not offer a parent search when no complete parent action exists', () => {
    const tree = UnsupportedHotelDestinationState({
      destination: { ...destination, parent: undefined },
      onEditDestination: jest.fn(),
    })

    expect(textContent(tree)).toContain('We don’t support that destination yet. Try a nearby city or airport.')
    expect(textContent(tree)).not.toContain('Search Paris')
    expect(textContent(tree)).toContain('Edit destination')
  })

  it('preserves destination and dates in the search error recovery copy', () => {
    const tree = HotelDestinationSearchState({
      destination,
      state: { kind: 'error', onRetry: jest.fn() },
      onEditDestination: jest.fn(),
    })

    expect(textContent(tree)).toContain('We couldn’t search hotels in Saint-Germain-des-Prés.')
    expect(textContent(tree)).toContain('Your destination and dates are still selected. Try the same search again.')
  })
})
