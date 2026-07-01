import * as React from 'react';
import type { ReactElement, ReactNode } from 'react';
import FlightResults from '../FlightResults';
import type { NormalizedFare } from '@/lib/types';

jest.mock('@/app/components/FlightCard', () => ({
  __esModule: true,
  default: () => {
    const React = require('react') as typeof import('react');
    return React.createElement('div', null, 'Flight card');
  },
}));

jest.mock('@/components/baggage/BaggageFeeEstimator', () => ({
  __esModule: true,
  BaggageFeeEstimator: () => {
    const React = require('react') as typeof import('react');
    return React.createElement('div', null, 'Baggage fee estimate');
  },
}));

function collectText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(collectText).join('');
  if (!React.isValidElement(node)) return '';

  const element = node as ReactElement<Record<string, unknown>>;
  if (typeof element.type === 'function') {
    return collectText((element.type as (props: Record<string, unknown>) => ReactNode)(element.props));
  }

  return collectText(element.props.children as ReactNode);
}

const defaultProps = {
  flights: [],
  displayFlights: [],
  isSearching: false,
  sortBy: 'deal' as const,
  setSortBy: jest.fn(),
  filterStops: null,
  setFilterStops: jest.fn(),
  scores: {},
  scoreLoading: new Set<string>(),
  suggestion: null,
  providerNotices: [],
  dest: 'LAX',
  depart: '2026-09-01',
  returnDate: '2026-09-08',
  tripType: 'roundtrip' as const,
  alertEmail: '',
  setAlertEmail: jest.fn(),
  alertSent: false,
  alertLoading: false,
  alertError: null,
  handleAlertSubmit: jest.fn(),
  onRetrySearch: jest.fn(),
};

const fare: NormalizedFare = {
  id: 'fare-1',
  fareType: 'cash',
  source: 'travelpayouts',
  carrier: 'AA',
  origin: 'JFK',
  destination: 'LAX',
  depart: '2026-09-01T08:00:00.000Z',
  return: '2026-09-08T17:00:00.000Z',
  price: { priceCents: 25000, currency: 'USD' },
  deeplink: 'https://example.com/book',
  stops: 0,
  cabin: 'economy',
  priceScope: 'per_person',
  passengerCount: 1,
  fetchedAt: '2026-06-30T00:00:00.000Z',
};

describe('FlightResults', () => {
  it('surfaces provider notices and avoids presenting them as no inventory', () => {
    const text = collectText(FlightResults({
      ...defaultProps,
      providerNotices: [{
        provider: 'Travelpayouts',
        status: 'unavailable',
        message: 'Travelpayouts is unavailable for this search.',
      }],
    }));

    expect(text).toContain('Travelpayouts is unavailable for this search.');
    expect(text).toContain('Flight providers unavailable');
    expect(text).toContain('Retry search');
    expect(text).not.toContain('No flight inventory found');
  });

  it('explains missing departure date context before showing an empty inventory state', () => {
    const text = collectText(FlightResults({
      ...defaultProps,
      depart: '',
    }));

    expect(text).toContain('Departure date is missing');
    expect(text).toContain('Dates needed for a complete search');
    expect(text).toContain('Add a departure date');
  });

  it('distinguishes filters hiding fares from no provider inventory', () => {
    const text = collectText(FlightResults({
      ...defaultProps,
      flights: [fare],
      displayFlights: [],
      filterStops: 1,
    }));

    expect(text).toContain('Filters are hiding the available fares');
    expect(text).toContain('Clear the stops filter');
    expect(text).not.toContain('No flight inventory found');
  });

  it('uses restrained ranking update copy without changing result controls', () => {
    const text = collectText(FlightResults({
      ...defaultProps,
      flights: [fare],
      displayFlights: [fare],
      rankingUpdating: true,
    }));

    expect(text).toContain('Best deal');
    expect(text).toContain('Lowest price');
    expect(text).toContain('Updating deal ranking as scores finish.');
  });
});
