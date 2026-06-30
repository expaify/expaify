import * as React from 'react';
import type { ReactElement, ReactNode } from 'react';
import FlightResults from '../FlightResults';

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
  handleAlertSubmit: jest.fn(),
};

describe('FlightResults', () => {
  it('surfaces provider notices and avoids presenting them as no inventory', () => {
    const text = collectText(FlightResults({
      ...defaultProps,
      providerNotices: ['Travelpayouts: provider temporarily unavailable'],
    }));

    expect(text).toContain('Travelpayouts: provider temporarily unavailable');
    expect(text).toContain('Providers unavailable');
    expect(text).not.toContain('No flights found');
  });

  it('explains missing departure date context before showing an empty inventory state', () => {
    const text = collectText(FlightResults({
      ...defaultProps,
      depart: '',
    }));

    expect(text).toContain('A departure date is missing');
    expect(text).toContain('Add a departure date');
    expect(text).toContain('needed before live fares can be compared reliably');
  });
});
