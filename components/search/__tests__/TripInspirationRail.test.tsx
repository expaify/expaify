import * as React from 'react';
import type { ReactElement, ReactNode } from 'react';
import { getTripInspiration } from '@/lib/search/tripInspiration';
import { createTripInspirationSelectionHandler } from '../SearchPanel';
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
  it('calls onSelect with flexible dates and valid ISO dates', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-30T00:00:00.000Z'));

    const onSelect = jest.fn();
    const rail = TripInspirationRail({ originIata: 'NYC', onSelect });
    const button = findElement(rail, (element) => element.type === 'button');

    expect(button).toBeTruthy();
    (button?.props.onClick as () => void)();

    expect(onSelect).toHaveBeenCalledWith({
      originIata: 'NYC',
      destinationIata: 'YUL',
      departDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      returnDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      flexible: true,
    });
    expect(onSelect.mock.calls[0][0].departDate).toBe('2026-09-04');
    expect(onSelect.mock.calls[0][0].returnDate).toBe('2026-09-07');

    jest.useRealTimers();
  });
});

describe('SearchPanel', () => {
  it('receives a rail selection and updates the existing destination field state', () => {
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
      destinationIata: 'SJU',
      departDate: '2026-11-06',
      returnDate: '2026-11-10',
      flexible: true,
    });

    expect(setters.setDestination).toHaveBeenCalledWith('SJU');
    expect(setters.setDestinationDisplay).toHaveBeenCalledWith('SJU (SJU)');
    expect(setters.setFlexible).toHaveBeenCalledWith(true);
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
