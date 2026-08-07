import * as crypto from 'node:crypto';

import { cache } from '../cache/redis';
import { Result } from '../types';

// A hotel's real neighborhood quality, derived from actual nearby Google
// Places data -- never invented. Catches the case a raw price-drop % alone
// can't: a deal that's cheap because the hotel is in a location nobody
// actually wants to stay in (industrial zone, airport-adjacent, etc).
export type LocationQuality = {
  vibeTag: string;
  summary: string;
  poiCount: number;
};

const PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const NEARBY_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const IO_NET_URL = 'https://api.intelligence.io.solutions/api/v1/chat/completions';

const PLACES_FIELDMASK_TEXT = 'places.displayName,places.formattedAddress,places.rating,places.location';
const NEARBY_FIELDMASK = 'places.displayName,places.rating,places.types,places.location';

// Location quality doesn't change often and the Places+LLM round trip is
// the expensive part of this feature -- cache both the success case and
// the honest "not enough data" outcome, so a real hotel with a thin
// surrounding POI set doesn't get re-queried on every request.
const CACHE_TTL_SECONDS = 2_592_000; // 30 days

const MIN_QUALIFYING_POIS = 3;
const MIN_POI_RATING = 4.0;
const NEARBY_RADIUS_METERS = 1000;

function cacheKeyFor(hotelName: string, city: string): string {
  const hash = crypto.createHash('sha256').update(`${hotelName}::${city}`).digest('hex');
  return `loc-quality:${hash}`;
}

interface Poi {
  name: string;
  types: string[];
  rating: number;
}

async function resolveCoordinates(
  hotelName: string,
  city: string,
  apiKey: string,
): Promise<Result<{ lat: number; lng: number }>> {
  let res: Response;
  try {
    res = await fetch(PLACES_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': PLACES_FIELDMASK_TEXT,
      },
      body: JSON.stringify({ textQuery: `${hotelName}, ${city}` }),
    });
  } catch (err) {
    return { ok: false, reason: `Places text search error: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (!res.ok) {
    return { ok: false, reason: `Places text search HTTP ${res.status}` };
  }

  const body = await res.json();
  const places = body?.places;
  if (!Array.isArray(places) || places.length === 0) {
    return { ok: false, reason: `Could not find "${hotelName}, ${city}" in Google Places.` };
  }

  const location = places[0]?.location;
  if (typeof location?.latitude !== 'number' || typeof location?.longitude !== 'number') {
    return { ok: false, reason: 'Google Places returned no coordinates for this hotel.' };
  }

  return { ok: true, data: { lat: location.latitude, lng: location.longitude } };
}

async function fetchQualifyingPois(
  lat: number,
  lng: number,
  apiKey: string,
): Promise<Result<Poi[]>> {
  let res: Response;
  try {
    res = await fetch(NEARBY_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': NEARBY_FIELDMASK,
      },
      body: JSON.stringify({
        includedTypes: ['restaurant', 'tourist_attraction', 'transit_station'],
        maxResultCount: 20,
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lng }, radius: NEARBY_RADIUS_METERS },
        },
      }),
    });
  } catch (err) {
    return { ok: false, reason: `Places nearby search error: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (!res.ok) {
    return { ok: false, reason: `Places nearby search HTTP ${res.status}` };
  }

  const body = await res.json();
  const places = Array.isArray(body?.places) ? body.places : [];

  const pois: Poi[] = [];
  for (const place of places) {
    const rating = place?.rating;
    const name = place?.displayName?.text?.trim();
    if (typeof rating !== 'number' || rating < MIN_POI_RATING || !name) continue;
    pois.push({ name, rating, types: Array.isArray(place?.types) ? place.types : [] });
  }

  return { ok: true, data: pois };
}

async function classifyVibe(
  pois: Poi[],
  apiKey: string,
): Promise<Result<{ vibeTag: string; summary: string }>> {
  const poiLines = pois
    .map((p, i) => `${i + 1}. ${p.name} (${p.types.join(', ') || 'place'}, rating ${p.rating})`)
    .join('\n');

  const prompt = `Given this real list of points of interest near a hotel, output ONLY a JSON object with exactly two string fields: "vibeTag" (2-4 words describing the neighborhood, e.g. "Walkable foodie hub") and "summary" (one honest sentence, grounded ONLY in the list below -- do not invent any place, distance, or fact not implied by this data).

POIs:
${poiLines}

Output only the JSON object, no other text.`;

  let res: Response;
  try {
    res = await fetch(IO_NET_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'zai-org/GLM-4.7-Flash', messages: [{ role: 'user', content: prompt }] }),
    });
  } catch (err) {
    return { ok: false, reason: `Location classification error: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (!res.ok) {
    return { ok: false, reason: `Location classification HTTP ${res.status}` };
  }

  const body = await res.json();
  const content: unknown = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    return { ok: false, reason: 'Location classification returned no content.' };
  }

  let parsed: unknown;
  try {
    // Strip a ```json fence if the model wrapped its output in one anyway.
    const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, reason: 'Location classification did not return valid JSON.' };
  }

  const vibeTag = (parsed as { vibeTag?: unknown })?.vibeTag;
  const summary = (parsed as { summary?: unknown })?.summary;
  if (typeof vibeTag !== 'string' || !vibeTag.trim() || typeof summary !== 'string' || !summary.trim()) {
    return { ok: false, reason: 'Location classification response is missing vibeTag or summary.' };
  }

  return { ok: true, data: { vibeTag: vibeTag.trim(), summary: summary.trim() } };
}

export async function getLocationQuality(hotelName: string, city: string): Promise<Result<LocationQuality>> {
  const trimmedName = hotelName.trim();
  const trimmedCity = city.trim();
  if (!trimmedName || !trimmedCity) {
    return { ok: false, reason: 'Hotel name and city are required.' };
  }

  const key = cacheKeyFor(trimmedName, trimmedCity);
  const cached = await cache.get<Result<LocationQuality>>(key);
  if (cached !== null) return cached;

  const placesApiKey = process.env.GOOGLE_PLACES_API_KEY ?? '';
  if (!placesApiKey) return { ok: false, reason: 'Location quality is not configured.' };

  const ioNetApiKey = process.env.IONET_API_KEY ?? '';
  if (!ioNetApiKey) return { ok: false, reason: 'Location quality is not configured.' };

  const coords = await resolveCoordinates(trimmedName, trimmedCity, placesApiKey);
  if (!coords.ok) return coords;

  const pois = await fetchQualifyingPois(coords.data.lat, coords.data.lng, placesApiKey);
  if (!pois.ok) return pois;

  if (pois.data.length < MIN_QUALIFYING_POIS) {
    const result: Result<LocationQuality> = {
      ok: false,
      reason: 'Not enough nearby points of interest to assess this location.',
    };
    // Cache this too -- it's a real evaluation outcome, not a transient failure.
    await cache.set(key, result, CACHE_TTL_SECONDS);
    return result;
  }

  const vibe = await classifyVibe(pois.data, ioNetApiKey);
  if (!vibe.ok) return vibe;

  const result: Result<LocationQuality> = {
    ok: true,
    data: { vibeTag: vibe.data.vibeTag, summary: vibe.data.summary, poiCount: pois.data.length },
  };
  await cache.set(key, result, CACHE_TTL_SECONDS);
  return result;
}
