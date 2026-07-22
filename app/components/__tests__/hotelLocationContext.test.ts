import { getHotelLocationDisplay } from '../hotelLocationContext';
import { withCalculatedAnchorDistance } from '@/lib/hotels/locationEvidence';

describe('hotel location comparison display', () => {
  it('shows a rounded US-locale distance only for a provenance-verified comparison', () => {
    const location = withCalculatedAnchorDistance(
      {
        precision: 'coordinates',
        lat: 40.7484,
        lng: -73.9857,
        providerLocationName: 'Midtown',
        source: 'provider',
      },
      {
        kind: 'airport',
        id: 'JFK',
        name: 'John F. Kennedy International (JFK)',
        lat: 40.6413,
        lng: -73.7781,
        source: 'search_linked',
      }
    );

    expect(getHotelLocationDisplay({ area: 'New York', location }).distanceText)
      .toBe('13 mi from John F. Kennedy International (JFK)');
  });

  it('suppresses a structurally complete but mathematically unverified comparison', () => {
    const location = withCalculatedAnchorDistance(
      { precision: 'coordinates', lat: 0, lng: 0, source: 'provider' },
      {
        kind: 'airport',
        id: 'AAA',
        name: 'Example Airport (AAA)',
        lat: 0,
        lng: 0,
        source: 'search_linked',
      }
    );
    const tampered = {
      ...location,
      distance: location.distance ? { ...location.distance, value: 10 } : undefined,
    };

    expect(getHotelLocationDisplay({ location: tampered }).distanceText).toBeUndefined();
  });
});
