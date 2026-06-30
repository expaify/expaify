import * as React from 'react';
import type { ReactElement, ReactNode } from 'react';
import { getTripInspiration } from '@/lib/search/tripInspiration';
import {
  createSearchPanelSubmitPayload,
  createTripInspirationSelectionHandler,
} from '../SearchPanel';
import { TripInspirationRail } from '../TripInspirationRail';

describe('getTripInspiration', () => {
  it('returns deterministic results for NYC', () => {
    const today = new Date('2026-06-30T00:00:00.000Z');
    const first = getTripInspiration('NYC', today);
    const second = getTripInspiration('nyc', today);

    expect(first).toEqual(second);
    expect(first.map((item) => item.destinationIata)).toEqual(['YUL', 'MSY', 'SJU', 'YYZ']);
    expect(first.map((item) => item.suggestedMonth)).toEqual(['2026-09', '2026-09', '2026-11', '2026-08']);
  });

  it('returns fallback recommendations for unknown origins', () => {
    const items = getTripInspiration('BOI', new Date('2026-06-30T00:00:00.000Z'));

    expect(items).toHaveLength(4);
    expect(items[0]).toMatchObject({
      originIata: 'BOI',
      destinationIata: 'BOS',
      destinationCity: 'Boston',
    });
  });
});

describe('TripInspirationRail', () => {
  it('calls onSelect with readable labels, flexible dates, and valid ISO dates', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-30T00:00:00.000Z'));

    const onSelect = jest.fn();
    const rail = TripInspirationRail({
      originIata: 'NYC',
      originDisplay: 'New York (NYC)',
      onSelect,
    });
    const button = findElement(rail, (element) => element.type === 'button');

    expect(button).toBeTruthy();
    (button?.props.onClick as () => void)();

    expect(onSelect).toHaveBeenCalledWith({
      originIata: 'NYC',
      originDisplay: 'New York (NYC)',
      destinationIata: 'YUL',
      destinationDisplay: 'Montreal (YUL)',
      departDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      returnDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      flexible: true,
    });
    expect(onSelect.mock.calls[0][0].departDate).toBe('2026-09-04');
    expect(onSelect.mock.calls[0][0].returnDate).toBe('2026-09-07');

    jest.useRealTimers();
  });

  it('keeps origin display labels aligned when inspiration uses a city alias', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-30T00:00:00.000Z'));

    const onSelect = jest.fn();
    const rail = TripInspirationRail({
      originIata: 'JFK',
      originDisplay: 'New York (JFK)',
      onSelect,
    });
    const button = findElement(rail, (element) => element.type === 'button');

    (button?.props.onClick as () => void)();

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      originIata: 'NYC',
      originDisplay: 'New York (NYC)',
      destinationDisplay: 'Montreal (YUL)',
    }));

    jest.useRealTimers();
  });
});

describe('SearchPanel', () => {
  it('receives a rail selection and updates the existing fields with readable labels', () => {
    const setters = {
      setOrigin: jest.fn(),
      setOriginDisplay: jest.fn(),
      setDestination: jest.fn(),
      setDestinationDisplay: jest.fn(),
      setDepartDate: jest.fn(),
      setReturnDate: jest.fn(),
      setTripType: jest.fn(),
      setFlexible: jest.fn(),
    };
    const handleSelect = createTripInspirationSelectionHandler(setters);

    handleSelect({
      originIata: 'NYC',
      originDisplay: 'New York (NYC)',
      destinationIata: 'SJU',
      destinationDisplay: 'San Juan (SJU)',
      departDate: '2026-11-06',
      returnDate: '2026-11-10',
      flexible: true,
    });

    expect(setters.setOrigin).toHaveBeenCalledWith('NYC');
    expect(setters.setOriginDisplay).toHaveBeenCalledWith('New York (NYC)');
    expect(setters.setDestination).toHaveBeenCalledWith('SJU');
    expect(setters.setDestinationDisplay).toHaveBeenCalledWith('San Juan (SJU)');
    expect(setters.setDepartDate).toHaveBeenCalledWith('2026-11-06');
    expect(setters.setReturnDate).toHaveBeenCalledWith('2026-11-10');
    expect(setters.setTripType).toHaveBeenCalledWith('roundtrip');
    expect(setters.setFlexible).toHaveBeenCalledWith(true);
  });

  it('submits a blank return date for one-way trips without changing round-trip payloads', () => {
    expect(createSearchPanelSubmitPayload({
      originIata: 'NYC',
      destinationIata: 'SJU',
      departDate: '2026-11-06',
      returnDate: '2026-11-10',
      flexible: true,
      tripType: 'roundtrip',
    })).toEqual({
      originIata: 'NYC',
      destinationIata: 'SJU',
      departDate: '2026-11-06',
      returnDate: '2026-11-10',
      flexible: true,
      tripType: 'roundtrip',
    });

    expect(createSearchPanelSubmitPayload({
      originIata: 'NYC',
      destinationIata: 'SJU',
      departDate: '2026-11-06',
      returnDate: '2026-11-10',
      flexible: false,
      tripType: 'oneway',
    })).toEqual({
      originIata: 'NYC',
      destinationIata: 'SJU',
      departDate: '2026-11-06',
      returnDate: '',
      flexible: false,
      tripType: 'oneway',
    });
  });
});

function findElement(
  node: ReactNode,
  predicate: (element: ReactElement<Record<string, unknown>>) => boolean,
): ReactElement<Record<string, unknown>> | null {
  if (!React.isValidElement(node)) return null;

  const element = node as ReactElement<Record<string, unknown>>;
  if (predicate(element)) return element;

  const children = element.props.children as ReactNode;
  const childArray = React.Children.toArray(children);

  for (const child of childArray) {
    const match = findElement(child, predicate);
    if (match) return match;
  }

  return null;
}
