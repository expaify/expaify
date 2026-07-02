import type {
  NormalizedFlightSegment,
  NormalizedItinerary,
  NormalizedLayover,
} from '../types';

function parseTime(value: string): number | null {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function hasExplicitTimezone(value: string): boolean {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
}

function minutesBetween(start: string, end: string): number | null {
  const startTime = parseTime(start);
  const endTime = parseTime(end);
  if (startTime === null || endTime === null || endTime < startTime) return null;
  return Math.round((endTime - startTime) / 60_000);
}

function crossesLocalDate(start: string, end: string): boolean {
  return start.slice(0, 10) !== end.slice(0, 10);
}

function cleanSegment(segment: NormalizedFlightSegment): NormalizedFlightSegment | null {
  const origin = segment.origin.trim().toUpperCase();
  const destination = segment.destination.trim().toUpperCase();
  if (!origin || !destination || !segment.depart || !segment.arrive) return null;
  if (!hasExplicitTimezone(segment.depart) || !hasExplicitTimezone(segment.arrive)) return null;
  if (minutesBetween(segment.depart, segment.arrive) === null) return null;

  return {
    origin,
    destination,
    depart: segment.depart,
    arrive: segment.arrive,
    carrier: segment.carrier?.trim() || undefined,
    flightNumber: segment.flightNumber?.trim() || undefined,
  };
}

export function buildConfirmedItinerary(
  rawSegments: NormalizedFlightSegment[]
): NormalizedItinerary | null {
  if (rawSegments.length === 0) return null;

  const segments = rawSegments.map(cleanSegment);
  if (segments.some(segment => segment === null)) return null;

  const completeSegments = segments as NormalizedFlightSegment[];
  const firstSegment = completeSegments[0];
  const lastSegment = completeSegments[completeSegments.length - 1];
  const durationMinutes = minutesBetween(firstSegment.depart, lastSegment.arrive);
  if (durationMinutes === null) return null;

  const layovers: NormalizedLayover[] = [];
  for (let index = 0; index < completeSegments.length - 1; index += 1) {
    const current = completeSegments[index];
    const next = completeSegments[index + 1];
    const duration = minutesBetween(current.arrive, next.depart);
    if (duration === null) return null;

    layovers.push({
      airport: current.destination,
      durationMinutes: duration,
      overnight: crossesLocalDate(current.arrive, next.depart) || undefined,
      airportChange: current.destination !== next.origin || undefined,
    });
  }

  return {
    certainty: 'confirmed',
    durationMinutes,
    arrive: lastSegment.arrive,
    segments: completeSegments,
    layovers: layovers.length > 0 ? layovers : undefined,
  };
}

export function buildPartialItinerary(params: {
  durationMinutes?: number | null;
  depart?: string;
  arrive?: string | null;
}): NormalizedItinerary {
  const itinerary: NormalizedItinerary = { certainty: 'partial' };

  if (
    typeof params.durationMinutes === 'number' &&
    Number.isFinite(params.durationMinutes) &&
    params.durationMinutes >= 0
  ) {
    itinerary.durationMinutes = Math.round(params.durationMinutes);
  }

  if (params.arrive) {
    itinerary.arrive = params.arrive;
  } else if (params.depart && itinerary.durationMinutes !== undefined) {
    const departTime = parseTime(params.depart);
    if (departTime !== null) {
      itinerary.arrive = new Date(departTime + itinerary.durationMinutes * 60_000).toISOString();
    }
  }

  return itinerary;
}

export function buildPartialOrUnavailable(params: {
  durationMinutes?: number | null;
  depart?: string;
  arrive?: string | null;
}): NormalizedItinerary {
  const partial = buildPartialItinerary(params);
  return partial.durationMinutes !== undefined || partial.arrive
    ? partial
    : unavailableItinerary();
}

export function unavailableItinerary(): NormalizedItinerary {
  return { certainty: 'unavailable' };
}
