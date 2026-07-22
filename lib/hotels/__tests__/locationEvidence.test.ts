import {
  calculateStraightLineDistanceKm,
  hasValidCoordinates,
  hasVerifiedHotelLocationComparison,
  withCalculatedAnchorDistance,
} from '../locationEvidence';
import type { HotelLocation, HotelLocationAnchor } from '../../types';

const anchor: HotelLocationAnchor = {
  kind: 'airport',
  id: 'JFK',
  name: 'John F. Kennedy International (JFK)',
  lat: 40.6413,
  lng: -73.7781,
  source: 'search_linked',
};

const property: HotelLocation = {
  precision: 'coordinates',
  lat: 40.7484,
  lng: -73.9857,
  source: 'provider',
};

describe('hotel location evidence', () => {
  it('accepts in-range zero coordinates and rejects partial or out-of-range pairs', () => {
    expect(hasValidCoordinates({ lat: 0, lng: 0 })).toBe(true);
    expect(hasValidCoordinates({ lat: 0 })).toBe(false);
    expect(hasValidCoordinates({ lat: 91, lng: 0 })).toBe(false);
    expect(hasValidCoordinates({ lat: 0, lng: -181 })).toBe(false);
  });

  it('calculates a canonical straight-line distance without early display rounding', () => {
    const value = calculateStraightLineDistanceKm(property as { lat: number; lng: number }, anchor);

    expect(value).toBeCloseTo(21.17, 2);
    expect(value).not.toBe(Math.round(value! * 10) / 10);
  });

  it('attaches complete anchor provenance and a verifiable calculated distance', () => {
    const location = withCalculatedAnchorDistance(property, anchor);

    expect(location).toMatchObject({
      anchor,
      distance: {
        unit: 'km',
        method: 'straight_line',
        source: 'expaify_calculated',
      },
    });
    expect(hasVerifiedHotelLocationComparison(location)).toBe(true);
  });

  it('removes a comparison when either property or anchor coordinates are invalid', () => {
    const invalidProperty = { ...property, lat: 120 };
    const invalidAnchor = { ...anchor, name: ' ' };

    expect(withCalculatedAnchorDistance(invalidProperty, anchor)).not.toHaveProperty('distance');
    expect(withCalculatedAnchorDistance(property, invalidAnchor)).not.toHaveProperty('anchor');
  });

  it('rejects a tampered calculated distance during continuity validation', () => {
    const location = withCalculatedAnchorDistance(property, anchor);
    const tampered = {
      ...location,
      distance: location.distance ? { ...location.distance, value: location.distance.value + 1 } : undefined,
    };

    expect(hasVerifiedHotelLocationComparison(tampered)).toBe(false);
  });
});
