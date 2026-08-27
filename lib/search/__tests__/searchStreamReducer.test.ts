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

  it('accumulates hotel offers and retains the real page coverage', () => {
    const state = reduceAll([
      {
        type: 'hotels',
        source: 'booking.com',
        data: [{ id: 'hotel-1' }, { id: 'hotel-2' }],
        page: { coverage: 'more_available', nextPageToken: 'next' },
      },
      {
        type: 'hotels',
        source: 'booking.com',
        data: [{ id: 'hotel-3' }],
        page: { coverage: 'confirmed_end' },
      },
    ]);

    expect(state.hotels.map(hotel => hotel.id)).toEqual(['hotel-1', 'hotel-2', 'hotel-3']);
    expect(state.hotelCoverage).toBe('confirmed_end');
  });

  it('captures hotel inventory, access, and smoking-policy statuses independently', () => {
    const state = reduceAll([
      { type: 'hotel-status', status: 'available', coverage: 'unconfirmed' },
      { type: 'hotel-access-status', status: 'error', message: 'Access details could not be checked.' },
      { type: 'hotel-smoking-policy-status', status: 'ready', filterEnabled: false },
    ]);

    expect(state.hotelStatus).toEqual({ status: 'available', message: undefined });
    expect(state.hotelCoverage).toBe('unconfirmed');
    expect(state.hotelAccessStatus).toEqual({ status: 'error', message: 'Access details could not be checked.' });
    expect(state.hotelSmokingPolicyStatus).toEqual({ status: 'ready', message: undefined });
  });

  it('retains the route-provided hotel empty/skipped/error message without inventing copy', () => {
    const state = reduceAll([
      { type: 'hotel-status', status: 'empty', coverage: 'confirmed_end', message: 'No hotels were returned for these dates.' },
      { type: 'hotel-status', status: 'skipped', message: 'Enter a destination plus depart and return dates to check hotel availability.' },
      { type: 'hotel-smoking-policy-status', status: 'error', message: 'Smoking policy could not be checked.' },
    ]);

    expect(state.hotelStatus).toEqual({
      status: 'skipped',
      message: 'Enter a destination plus depart and return dates to check hotel availability.',
    });
    expect(state.hotelSmokingPolicyStatus).toEqual({
      status: 'error',
      message: 'Smoking policy could not be checked.',
    });
  });

  it('still leaves flight-date-coverage unhandled', () => {
    const state = reduceAll([
      { type: 'flight-date-coverage', data: { status: 'complete' } },
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
