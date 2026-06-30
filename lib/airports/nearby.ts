import { AIRPORTS, type Airport } from './data';

type LocatedAirport = Airport & { lat: number; lon: number };

function hasCoordinates(airport: Airport): airport is LocatedAirport {
  return typeof airport.lat === 'number' && typeof airport.lon === 'number';
}

function dist(a: LocatedAirport, b: LocatedAirport): number {
  const radiusKm = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const latA = a.lat * Math.PI / 180;
  const latB = b.lat * Math.PI / 180;
  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;

  return radiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function getNearby(iata: string, maxKm = 150): string[] {
  const code = iata.trim().toUpperCase();
  const base = AIRPORTS.find(airport => airport.iata === code);
  if (!base || !hasCoordinates(base)) return [];

  return AIRPORTS
    .filter((airport): airport is LocatedAirport =>
      airport.iata !== code && hasCoordinates(airport) && dist(base, airport) <= maxKm
    )
    .map(airport => airport.iata);
}
