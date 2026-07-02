import { buildConfirmedItinerary } from '../itinerary';

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
