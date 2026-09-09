import { buildConfirmedItinerary, buildPartialItinerary, buildPartialOrUnavailable } from '../itinerary';

describe('partial itinerary arrival bounds', () => {
  it.each([
    ['2026-09-22T08:00:00Z', 1e20],
    ['2026-09-22T08:00:00Z', Number.MAX_VALUE],
    ['+275760-09-13T00:00:00.000Z', 1],
  ])('omits an unrepresentable arrival for departure %s and duration %s', (depart, durationMinutes) => {
    const expected = { certainty: 'partial', durationMinutes };
    expect(buildPartialItinerary({ depart, durationMinutes })).toEqual(expected);
    expect(buildPartialOrUnavailable({ depart, durationMinutes })).toEqual(expected);
  });

  it('still derives representable arrivals and preserves provider-supplied arrivals', () => {
    expect(buildPartialItinerary({ depart: '2026-09-22T08:00:00Z', durationMinutes: 90 })).toEqual({
      certainty: 'partial', durationMinutes: 90, arrive: '2026-09-22T09:30:00.000Z',
    });
    expect(buildPartialItinerary({ depart: '2026-09-22T08:00:00Z', durationMinutes: 1e20, arrive: '2026-09-22T09:30:00Z' })).toEqual({
      certainty: 'partial', durationMinutes: 1e20, arrive: '2026-09-22T09:30:00Z',
    });
  });
});

describe('buildConfirmedItinerary', () => {
  it('rejects offsetless local timestamps instead of computing confirmed elapsed time', () => {
    const itinerary = buildConfirmedItinerary([
      {
        origin: 'JFK',
        destination: 'LAX',
        depart: '2026-09-22T08:00:00',
        arrive: '2026-09-22T11:30:00',
      },
    ]);

    expect(itinerary).toBeNull();
  });

  it('confirms duration and layovers when every segment boundary has an explicit offset', () => {
    const itinerary = buildConfirmedItinerary([
      {
        origin: 'JFK',
        destination: 'ATL',
        depart: '2026-09-22T08:00:00-04:00',
        arrive: '2026-09-22T10:30:00-04:00',
      },
      {
        origin: 'ATL',
        destination: 'LAX',
        depart: '2026-09-22T12:00:00-04:00',
        arrive: '2026-09-22T14:45:00-07:00',
      },
    ]);

    expect(itinerary).toMatchObject({
      certainty: 'confirmed',
      durationMinutes: 585,
      arrive: '2026-09-22T14:45:00-07:00',
      layovers: [{ airport: 'ATL', durationMinutes: 90 }],
    });
  });
});
