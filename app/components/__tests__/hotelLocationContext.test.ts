import { getHotelLocationAnalytics, getHotelLocationDisplay } from '../hotelLocationContext';
import { withCalculatedAnchorDistance } from '@/lib/hotels/locationEvidence';

describe('hotel location comparison display', () => {
  it.each([
    [
      'address + pin',
      { area: 'Midtown', location: { address: '1 Main St', lat: 0, lng: 0, source: 'provider' as const } },
      ['address_pin', 'Address', '1 Main St', true],
    ],
    [
      'address only',
      { area: 'Midtown', location: { address: '1 Main St', source: 'provider' as const } },
      ['address_only', 'Address', '1 Main St', false],
    ],
    [
      'provider pin',
      { area: 'Midtown', location: { lat: 40, lng: -73, providerLocationName: 'Theater District', source: 'provider' as const } },
      ['provider_pin', 'Provider map pin', 'Theater District', true],
    ],
    [
      'area only',
      { area: 'Midtown', location: { area: 'Midtown', source: 'provider' as const } },
      ['area_only', 'Area only', 'Midtown', false],
    ],
    [
      'search area only',
      { location: { label: 'New York', source: 'search_fallback' as const } },
      ['search_area_only', 'Search area only', 'New York', false],
    ],
    [
      'unavailable',
      { location: { source: 'unavailable' as const } },
      ['unavailable', 'Location unavailable', 'Confirm location with provider', false],
    ],
  ])('derives the %s evidence state without legacy confidence labels', (_name, source, expected) => {
    const display = getHotelLocationDisplay(source);

    expect([display.evidenceState, display.label, display.value, Boolean(display.mapUrl)]).toEqual(expected);
    expect(display.label).not.toMatch(/^(Exact location|Map position|Area|Search area)$/);
  });

  it('constructs an allowlisted coordinate-only map target and property-safe analytics', () => {
    const display = getHotelLocationDisplay({
      location: {
        address: 'Private street value',
        lat: 40.7484,
        lng: -73.9857,
        source: 'provider',
      },
    });
    const analytics = getHotelLocationAnalytics('hotel-1', display);

    expect(display.mapUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=40\.7484%2C-73\.9857$/);
    expect(display.mapUrl).not.toContain('Private');
    expect(analytics).toEqual({
      hotelId: 'hotel-1',
      evidenceState: 'address_pin',
      anchorKind: 'none',
      anchorId: 'none',
      hasDistance: false,
      distanceBucket: 'none',
    });
  });

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
