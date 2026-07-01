import { type NextRequest } from 'next/server';
import { resolveToIATA } from '../../../lib/airports/resolve';
import { getNearby } from '../../../lib/airports/nearby';
import { travelpayouts } from '../../../lib/providers/travelpayouts';
import { duffel } from '../../../lib/providers/duffel';
import { amadeus } from '../../../lib/providers/amadeus';
import { kiwi } from '../../../lib/providers/kiwi';
import { hotellook } from '../../../lib/providers/hotellook';
import { query } from '../../../lib/db/client';
import {
  type HotelOffer,
  type NormalizedFare,
  type ProviderIssueStatus,
  type ProviderNotice,
  type Result,
} from '../../../lib/types';

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function dedupFares(fares: NormalizedFare[]): NormalizedFare[] {
  const best = new Map<string, NormalizedFare>();

  for (const fare of fares) {
    const key = `${fare.price.currency}:${fare.carrier}:${fare.origin}:${fare.destination}:${fare.depart.slice(0, 16)}`;
    const existing = best.get(key);
    if (!existing || fare.price.priceCents < existing.price.priceCents) {
      best.set(key, fare);
    }
  }

  return Array.from(best.values()).sort((a, b) =>
    a.price.currency.localeCompare(b.price.currency) ||
    a.price.priceCents - b.price.priceCents
  );
}

function parsePassengers(value: string | null): number {
  const parsed = Number(value ?? '1');
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 9) {
    throw new Error('Passenger count must be between 1 and 9');
  }
  return parsed;
}

function validateDateParam(name: string, value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name} must use YYYY-MM-DD format`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${name} is not a valid date`);
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function classifyProviderIssue(reason: string): ProviderIssueStatus {
  const normalized = reason.toLowerCase();
  if (normalized.includes('malformed')) return 'malformed_response';
  if (
    normalized.includes('timed out') ||
    normalized.includes('timeout') ||
    normalized.includes('aborted') ||
    normalized.includes('not configured') ||
    normalized.includes('not approved') ||
    normalized.includes('http ') ||
    normalized.includes('network') ||
    normalized.includes('fetch') ||
    normalized.includes('econn')
  ) {
    return 'unavailable';
  }

  return 'unavailable';
}

function providerMessage(provider: string, status: ProviderIssueStatus): string {
  if (status === 'malformed_response') {
    return `${provider} returned a response we could not use.`;
  }
  if (status === 'no_supply') {
    return `${provider} returned no matching fares for this search.`;
  }
  return `${provider} is unavailable for this search.`;
}

function providerExceptionReason(provider: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return detail
    ? `${provider} provider call failed: ${detail}`
    : `${provider} provider call failed`;
}

function isTimeoutReason(reason: string): boolean {
  const normalized = reason.toLowerCase();
  return normalized.includes('timed out') || normalized.includes('timeout') || normalized.includes('aborted');
}

async function searchHotelAvailability(
  area: string,
  range: { checkin: string; checkout: string }
): Promise<Result<HotelOffer[]>> {
  try {
    return await hotellook.searchHotels(area, range);
  } catch (error) {
    return { ok: false, reason: providerExceptionReason('HotelLook', error) };
  }
}

/**
 * GET /api/search
 *
 * Streams results as newline-delimited JSON (NDJSON).
 * Each line: { type: 'flights'|'hotels'|'hotel-status'|'notice'|'suggestion'|'done', ... }
 * Providers are raced — first to return streams immediately.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const originRaw = params.get('origin');
  if (!originRaw) {
    return new Response(JSON.stringify({ error: 'origin is required' }), { status: 400 });
  }

  let originIATA: string;
  try {
    originIATA = resolveToIATA(originRaw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }

  const destRaw = params.get('dest');
  let destIATA: string | undefined;
  if (destRaw) {
    try {
      destIATA = resolveToIATA(destRaw);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ error: msg }), { status: 400 });
    }
  }

  const depart = params.get('depart') ?? '';
  const ret = params.get('return') ?? '';
  const trip = params.get('trip') ?? 'roundtrip';
  let passengers: number;
  try {
    if (trip !== 'roundtrip' && trip !== 'oneway') {
      throw new Error('Trip type must be roundtrip or oneway');
    }
    if (!depart) {
      throw new Error('Departure date is required. Choose a departure date before searching.');
    }
    if (trip === 'roundtrip' && !ret) {
      throw new Error('Return date is required for round trips. Choose a return date or switch to one way.');
    }
    if (trip === 'oneway' && ret) {
      throw new Error('One-way searches cannot include a return date. Remove the return date or switch to round trip.');
    }
    validateDateParam('depart', depart);
    if (ret) validateDateParam('return', ret);
    if (depart < todayIso()) {
      throw new Error('Departure date cannot be in the past. Choose today or a future date.');
    }
    if (ret && ret < depart) {
      throw new Error('Return date must be on or after departure date.');
    }
    passengers = parsePassengers(params.get('passengers'));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }
  const flexDates = params.get('flex') === '1';
  const range = { depart, return: ret || undefined, passengers };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      let flightResultCount = 0;
      const flightProviderIssues: ProviderNotice[] = [];

      const sendFlights = (source: string, data: NormalizedFare[]) => {
        flightResultCount += data.length;
        send({ type: 'flights', source, data });
      };

      const sendProviderNotice = (provider: string, reason: string, messageOverride?: string) => {
        const status = classifyProviderIssue(reason);
        const timedOut = isTimeoutReason(reason);
        const notice: ProviderNotice = {
          provider,
          status,
          message: messageOverride ?? (timedOut
            ? `${provider} did not respond in time. We could not confirm its inventory for this search.`
            : providerMessage(provider, status)),
        };
        flightProviderIssues.push(notice);
        send({ type: 'notice', ...notice });
      };

      const searchFlightProvider = async (
        provider: string,
        source: string,
        search: () => Promise<{ ok: true; data: NormalizedFare[] } | { ok: false; reason: string }>
      ) => {
        try {
          const result = await search();
          if (result.ok && result.data.length > 0) sendFlights(source, result.data);
          else if (!result.ok) sendProviderNotice(provider, result.reason);
        } catch (error) {
          sendProviderNotice(provider, providerExceptionReason(provider, error));
        }
      };

      // Enroll route in snapshot pipeline — fire-and-forget, never blocks response
      if (originIATA && destIATA) {
        query(
          `INSERT INTO searched_routes (origin, destination)
           VALUES ($1, $2)
           ON CONFLICT (origin, destination)
           DO UPDATE SET search_count = searched_routes.search_count + 1,
                         last_searched_at = now()`,
          [originIATA, destIATA]
        ).catch(() => {});
      }

      // Race all 4 providers — stream each chunk the moment it resolves
      await Promise.all([
        (async () => {
          try {
            if (flexDates && depart) {
              const settled = await Promise.allSettled(
                [-3, -2, -1, 0, 1, 2, 3].map(async days =>
                  await travelpayouts.searchFares(originIATA, destIATA ?? '', {
                    ...range,
                    depart: shiftDate(depart, days),
                  })
                )
              );
              const fares = settled.flatMap(result =>
                result.status === 'fulfilled' && result.value.ok ? result.value.data : []
              );
              const dedupedFares = dedupFares(fares);
              if (dedupedFares.length > 0) sendFlights('travelpayouts', dedupedFares);

              const firstFailure = settled.find(result =>
                result.status === 'fulfilled' && !result.value.ok
              );
              const firstRejection = settled.find(result => result.status === 'rejected');
              const incompleteFlexCoverage = firstFailure !== undefined || firstRejection !== undefined;
              if (fares.length > 0 && incompleteFlexCoverage) {
                const reason = firstFailure?.status === 'fulfilled' && !firstFailure.value.ok
                  ? firstFailure.value.reason
                  : firstRejection?.status === 'rejected'
                    ? providerExceptionReason('Travelpayouts', firstRejection.reason)
                    : 'Travelpayouts flexible-date coverage incomplete';
                sendProviderNotice(
                  'Travelpayouts',
                  reason,
                  'Travelpayouts flexible-date coverage is incomplete for this search.'
                );
              }
              if (fares.length === 0 && firstFailure?.status === 'fulfilled' && !firstFailure.value.ok) {
                sendProviderNotice('Travelpayouts', firstFailure.value.reason);
              } else if (fares.length === 0 && firstRejection?.status === 'rejected') {
                sendProviderNotice('Travelpayouts', providerExceptionReason('Travelpayouts', firstRejection.reason));
              }
              return;
            }

            const r = await travelpayouts.searchFares(originIATA, destIATA ?? '', range);
            if (r.ok && r.data.length > 0) sendFlights('travelpayouts', r.data);
            else if (!r.ok) sendProviderNotice('Travelpayouts', r.reason);
          } catch (error) {
            sendProviderNotice('Travelpayouts', providerExceptionReason('Travelpayouts', error));
          }
        })(),
        searchFlightProvider('Duffel', 'duffel', () => duffel.searchFares(originIATA, destIATA ?? '', range)),
        searchFlightProvider('Amadeus', 'amadeus', () => amadeus.searchFares(originIATA, destIATA ?? '', range)),
        searchFlightProvider('Kiwi', 'kiwi', () => kiwi.searchFares(originIATA, destIATA ?? '', range)),
      ]);

      const nearby = getNearby(originIATA);
      if (flightResultCount === 0 && flightProviderIssues.length === 0) {
        send({
          type: 'notice',
          provider: 'Flights',
          status: 'no_supply',
          message: 'No flight providers returned matching fares for this search.',
        } satisfies ProviderNotice & { type: 'notice' });
      }
      if (flightResultCount === 0 && nearby.length > 0) {
        send({ type: 'suggestion', message: `No flights found. Try nearby: ${nearby.join(', ')}` });
      }

      // Hotels after all flight providers resolve
      if (destIATA && depart && ret) {
        const hotelsResult = await searchHotelAvailability(destIATA, { checkin: depart, checkout: ret });
        if (hotelsResult.ok && hotelsResult.data.length > 0) {
          send({ type: 'hotel-status', status: 'available' });
          send({ type: 'hotels', source: 'hotellook', data: hotelsResult.data });
        } else if (hotelsResult.ok) {
          send({ type: 'hotel-status', status: 'empty', message: 'No hotels were returned for these dates.' });
        } else {
          const status = classifyProviderIssue(hotelsResult.reason);
          send({
            type: 'hotel-status',
            status: 'unavailable',
            provider: 'Hotellook',
            providerStatus: status,
            message: isTimeoutReason(hotelsResult.reason)
              ? 'The hotel provider did not respond in time. Hotel inventory was not confirmed for this search.'
              : status === 'malformed_response'
              ? 'The hotel provider returned a response we could not use.'
              : 'The hotel provider is unavailable right now.',
          });
        }
      } else {
        send({
          type: 'hotel-status',
          status: 'skipped',
          message: 'Enter a destination plus depart and return dates to check hotel availability.',
        });
      }

      send({ type: 'done' });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
