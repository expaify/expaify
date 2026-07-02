import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FlightResults from '../FlightResults';
import type { NormalizedFare } from '@/lib/types';

jest.mock('@/app/components/FlightCard', () => ({
  __esModule: true,
  default: () => {
    const React = require('react') as typeof import('react');
    return React.createElement('div', null, 'Flight card');
  },
}));

function collectText(props: React.ComponentProps<typeof FlightResults>): string {
  return renderToStaticMarkup(React.createElement(FlightResults, props))
    .replace(/<[^>]*>/g, '');
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
  origin: 'JFK',
  dest: 'LAX',
  depart: '2026-09-01',
  returnDate: '2026-09-08',
  tripType: 'roundtrip' as const,
  flexDates: false,
  searchContext: 'Flight search · JFK → LAX · 2026-09-01 - 2026-09-08 · 1 traveler',
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
    const text = collectText({
      ...defaultProps,
      providerNotices: [{
        provider: 'Travelpayouts',
        status: 'unavailable',
        message: 'Travelpayouts is unavailable for this search.',
      }],
    });

    expect(text).toContain('Travelpayouts is unavailable for this search.');
    expect(text).toContain('Flights unavailable');
    expect(text).toContain('Retry search');
    expect(text).not.toContain('No current fares matched');
  });

  it('explains missing departure date context before showing an empty inventory state', () => {
    const text = collectText({
      ...defaultProps,
      depart: '',
    });

    expect(text).toContain('Departure date is missing');
    expect(text).toContain('Dates needed for a complete search');
    expect(text).toContain('Add a departure date');
  });

  it('distinguishes filters hiding fares from no provider inventory', () => {
    const text = collectText({
      ...defaultProps,
      flights: [fare],
      displayFlights: [],
      filterStops: 1,
    });

    expect(text).toContain('Filters are hiding the available fares');
    expect(text).toContain('Clear the stops filter');
    expect(text).not.toContain('No current fares matched');
  });

  it('does not show route tracking when filters hide returned fares', () => {
    const text = collectText({
      ...defaultProps,
      flights: [fare],
      displayFlights: [],
      filterStops: 1,
    });

    expect(text).toContain('Filters are hiding the available fares');
    expect(text).not.toContain('Track this route');
  });

  it('offers recovery actions and nearby airport buttons for true empty results', () => {
    const text = collectText({
      ...defaultProps,
      suggestion: 'Nearby airports may include SFO, OAK, and SFO.',
      onEditSearch: jest.fn(),
      onTryFlexibleDates: jest.fn(),
      onSearchAnywhere: jest.fn(),
      onTryNearbyOrigin: jest.fn(),
    });

    expect(text).toContain('No flights returned');
    expect(text).toContain('No flights were returned for this route.');
    expect(text).toContain('Try flexible dates');
    expect(text).toContain('Search anywhere from JFK');
    expect(text).toContain('Edit search');
    expect(text).toContain('Search from a nearby airport');
    expect(text).toContain('Try SFO');
    expect(text).toContain('Try OAK');
  });

  it('keeps retry primary when flight providers are unavailable', () => {
    const text = collectText({
      ...defaultProps,
      providerNotices: [{
        provider: 'Travelpayouts',
        status: 'unavailable',
        message: 'Travelpayouts is unavailable for this search.',
      }],
      onEditSearch: jest.fn(),
      onRetrySearch: jest.fn(),
      onTryFlexibleDates: jest.fn(),
      onSearchAnywhere: jest.fn(),
    });

    expect(text).toContain('Flights unavailable');
    expect(text).toContain('Flight inventory was not confirmed because a provider is unavailable.');
    expect(text).toContain('Retry search');
    expect(text).toContain('Edit search');
    expect(text).not.toContain('Try flexible dates');
    expect(text).not.toContain('Search anywhere from JFK');
  });

  it('uses restrained ranking update copy without changing result controls', () => {
    const text = collectText({
      ...defaultProps,
      flights: [fare],
      displayFlights: [fare],
      rankingUpdating: true,
    });

    expect(text).toContain('Best deal');
    expect(text).toContain('Lowest price');
    expect(text).toContain('Updating deal ranking as scores finish.');
  });

  it('adds list-level baggage controls and estimate context for returned fares', () => {
    const text = collectText({
      ...defaultProps,
      flights: [fare],
      displayFlights: [fare],
    });

    expect(text).toContain('Estimated bags');
    expect(text).toContain('Carry-on');
    expect(text).toContain('Checked');
    expect(text).toContain('Lowest est. total');
    expect(text).toContain('Estimating bag totals for visible fares.');
    expect(text).toContain('1 carry-on, 0 checked');
  });

  it('shows route tracking above the flight cards for one returned fare', () => {
    const text = collectText({
      ...defaultProps,
      flights: [fare],
      displayFlights: [fare],
    });

    expect(text).toContain('Track this route');
    expect(text).toContain('Get an email when this search drops below $250 USD. Only 1 live fare returned');
    expect(text).toContain('Notify me');
  });

  it('shows a blocked route tracking prompt for completed empty searches', () => {
    const text = collectText({
      ...defaultProps,
      flights: [],
      displayFlights: [],
    });

    expect(text).toContain('Track this route after a fare appears');
    expect(text).toContain('Alert unavailable');
  });
});
