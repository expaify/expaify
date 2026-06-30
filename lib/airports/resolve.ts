import { AIRPORTS } from './data';

/**
 * Resolves a user-supplied origin string to an IATA airport code.
 *
 * Accepts:
 *  - A 3-letter IATA code (returned uppercased as-is)
 *  - A 5-digit US ZIP code (mapped to the nearest major airport)
 *  - A known city name (exact or prefix match)
 *
 * Throws an Error for any unrecognised input so the caller can return 400.
 */

/** Hardcoded ZIP → IATA map for the ~30 most common US metro areas. */
const ZIP_TO_IATA: Record<string, string> = {
  '10001': 'JFK', // New York
  '90001': 'LAX', // Los Angeles
  '60601': 'ORD', // Chicago
  '02101': 'BOS', // Boston
  '77001': 'IAH', // Houston
  '85001': 'PHX', // Phoenix
  '19101': 'PHL', // Philadelphia
  '78201': 'SAT', // San Antonio
  '92101': 'SAN', // San Diego
  '75201': 'DFW', // Dallas
  '95101': 'SJC', // San Jose
  '78701': 'AUS', // Austin
  '32099': 'JAX', // Jacksonville
  '32301': 'TLH', // Tallahassee
  '28201': 'CLT', // Charlotte
  '43085': 'CMH', // Columbus
  '46201': 'IND', // Indianapolis
  '37201': 'BNA', // Nashville
  '53201': 'MKE', // Milwaukee
  '33101': 'MIA', // Miami
  '30301': 'ATL', // Atlanta
  '98101': 'SEA', // Seattle
  '80201': 'DEN', // Denver
  '89101': 'LAS', // Las Vegas
  '85701': 'TUS', // Tucson
  '87101': 'ABQ', // Albuquerque
  '84101': 'SLC', // Salt Lake City
  '97201': 'PDX', // Portland
  '99501': 'ANC', // Anchorage
};

const IATA_RE = /^[A-Za-z]{3}$/;
const ZIP_RE = /^\d{5}$/;

export function resolveToIATA(input: string): string {
  const trimmed = input.trim();

  if (IATA_RE.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  if (ZIP_RE.test(trimmed)) {
    const iata = ZIP_TO_IATA[trimmed];
    if (iata) return iata;
    throw new Error(`Unknown origin: ${trimmed}`);
  }

  const normalized = trimmed.toLowerCase();
  const cityMatch = AIRPORTS.find(a => a.city.toLowerCase() === normalized);
  if (cityMatch) return cityMatch.iata;

  const partial = AIRPORTS.find(a => a.city.toLowerCase().startsWith(normalized));
  if (partial) return partial.iata;

  throw new Error(`Unrecognised airport: ${trimmed}`);
}
