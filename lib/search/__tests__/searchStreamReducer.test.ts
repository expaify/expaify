import type { NormalizedFare } from '@/lib/types';
import { applySearchStreamEvent, initialSearchStreamState, type SearchStreamState } from '../searchStreamReducer';

function makeFare(id: string): NormalizedFare {
  return {
    id,
    fareType: 'cash',
    origin: 'JFK',
    destination: 'LAX',
    depart: '2026-09-01T08:00:00.000Z',
    stops: 0,
    carrier: 'AA',
    price: { priceCents: 25000, currency: 'USD' },
    deeplink: 'https://example.com/book',
    source: 'travelpayouts',
    fetchedAt: '2026-06-30T00:00:00.000Z',
  };
}

function reduceAll(events: unknown[]): SearchStreamState {
  return events.reduce(applySearchStreamEvent, initialSearchStreamState);
}

describe('applySearchStreamEvent', () => {
  it('accumulates flights across multiple flights events instead of replacing them', () => {
    const state = reduceAll([
      { type: 'flights', source: 'travelpayouts', data: [makeFare('a')] },
      { type: 'flights', source: 'duffel', data: [makeFare('b'), makeFare('c')] },
    ]);

    expect(state.flights.map(f => f.id)).toEqual(['a', 'b', 'c']);
  });

  it('accumulates provider notices in arrival order', () => {
    const state = reduceAll([
      { type: 'notice', provider: 'Kiwi', status: 'unavailable', message: 'Kiwi is unavailable for this search.' },
      { type: 'notice', provider: 'Amadeus', status: 'no_supply', message: 'Amadeus returned no matching fares.' },
    ]);

    expect(state.providerNotices).toEqual([
      { provider: 'Kiwi', status: 'unavailable', message: 'Kiwi is unavailable for this search.' },
      { provider: 'Amadeus', status: 'no_supply', message: 'Amadeus returned no matching fares.' },
    ]);
  });

  it('ignores a notice event with an unrecognized status rather than fabricating one', () => {
    const state = applySearchStreamEvent(initialSearchStreamState, {
      type: 'notice',
      provider: 'Kiwi',
      status: 'made_up_status',
      message: 'should not appear',
    });

    expect(state.providerNotices).toEqual([]);
  });

  it('sets the suggestion message and lets a later suggestion replace it', () => {
    const state = reduceAll([
      { type: 'suggestion', message: 'No flights found. Try nearby: EWR, JFK.' },
      { type: 'suggestion', message: 'Updated suggestion.' },
    ]);

    expect(state.suggestion).toBe('Updated suggestion.');
  });

  it('marks done true on a done event', () => {
    const state = applySearchStreamEvent(initialSearchStreamState, { type: 'done' });
    expect(state.done).toBe(true);
  });

  it('leaves state untouched for out-of-scope event types like hotels and flight-date-coverage', () => {
    const state = reduceAll([
      { type: 'hotels', source: 'booking.com', data: [{ id: 'hotel-1' }] },
      { type: 'flight-date-coverage', data: { status: 'complete' } },
      { type: 'hotel-status', status: 'available' },
    ]);

    expect(state).toEqual(initialSearchStreamState);
  });

  it('ignores a malformed flights event whose data is not an array', () => {
    const state = applySearchStreamEvent(initialSearchStreamState, { type: 'flights', data: 'not-an-array' });
    expect(state.flights).toEqual([]);
  });

  it('ignores events with no type field and non-object values without throwing', () => {
    expect(applySearchStreamEvent(initialSearchStreamState, {})).toBe(initialSearchStreamState);
    expect(applySearchStreamEvent(initialSearchStreamState, null)).toBe(initialSearchStreamState);
    expect(applySearchStreamEvent(initialSearchStreamState, 'a string')).toBe(initialSearchStreamState);
  });
});
