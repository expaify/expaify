import type {
  HotelLocation,
  HotelLocationAnchor,
  HotelLocationDistance,
} from '../types';

const EARTH_RADIUS_KM = 6371.0088;
const CALCULATED_DISTANCE_TOLERANCE_KM = 0.000001;

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function isValidLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

export function hasValidCoordinates(value: { lat?: unknown; lng?: unknown }): value is { lat: number; lng: number } {
  return isValidLatitude(value.lat) && isValidLongitude(value.lng);
}

export function isValidHotelLocationAnchor(value: HotelLocationAnchor | undefined): value is HotelLocationAnchor {
  return value !== undefined &&
    (value.kind === 'airport' || value.kind === 'venue' || value.kind === 'landmark' || value.kind === 'city_center') &&
    isNonEmpty(value.id) &&
    isNonEmpty(value.name) &&
    hasValidCoordinates(value) &&
    (value.source === 'user_selected' || value.source === 'search_linked' || value.source === 'provider_declared');
}

export function calculateStraightLineDistanceKm(
  property: { lat: number; lng: number },
  anchor: { lat: number; lng: number }
): number | undefined {
  if (!hasValidCoordinates(property) || !hasValidCoordinates(anchor)) return undefined;

  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const propertyLat = toRadians(property.lat);
  const anchorLat = toRadians(anchor.lat);
  const latitudeDelta = toRadians(anchor.lat - property.lat);
  const longitudeDelta = toRadians(anchor.lng - property.lng);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(propertyLat) * Math.cos(anchorLat) * Math.sin(longitudeDelta / 2) ** 2;
  const distance = EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return Number.isFinite(distance) ? distance : undefined;
}

export function withCalculatedAnchorDistance(
  location: HotelLocation,
  anchor: HotelLocationAnchor | undefined
): HotelLocation {
  if (anchor === undefined) return location;

  if (!hasValidCoordinates(location) || !isValidHotelLocationAnchor(anchor)) {
    const { anchor: _anchor, distance: _distance, ...propertyEvidence } = location;
    return propertyEvidence;
  }

  const value = calculateStraightLineDistanceKm(location, anchor);
  if (value === undefined) {
    const { anchor: _anchor, distance: _distance, ...propertyEvidence } = location;
    return propertyEvidence;
  }

  return {
    ...location,
    anchor: { ...anchor, id: anchor.id.trim(), name: anchor.name.trim() },
    distance: {
      value,
      unit: 'km',
      method: 'straight_line',
      source: 'expaify_calculated',
    },
  };
}

function isValidDistance(distance: HotelLocationDistance | undefined): distance is HotelLocationDistance {
  return distance !== undefined &&
    typeof distance.value === 'number' &&
    Number.isFinite(distance.value) &&
    distance.value >= 0 &&
    (distance.unit === 'mi' || distance.unit === 'km') &&
    distance.method === 'straight_line' &&
    (distance.source === 'expaify_calculated' || distance.source === 'provider_documented');
}

export function hasVerifiedHotelLocationComparison(
  location: HotelLocation | undefined
): location is HotelLocation & { anchor: HotelLocationAnchor; distance: HotelLocationDistance; lat: number; lng: number } {
  if (
    !location ||
    !hasValidCoordinates(location) ||
    !isValidHotelLocationAnchor(location.anchor) ||
    !isValidDistance(location.distance)
  ) {
    return false;
  }

  if (location.distance.source === 'provider_documented') return true;

  const calculatedKm = calculateStraightLineDistanceKm(location, location.anchor);
  if (calculatedKm === undefined) return false;
  const recordedKm = location.distance.unit === 'km'
    ? location.distance.value
    : location.distance.value * 1.609344;

  return Math.abs(calculatedKm - recordedKm) <= CALCULATED_DISTANCE_TOLERANCE_KM;
}
