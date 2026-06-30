import { type NextRequest } from 'next/server';
import { resolveToIATA } from '../../../lib/airports/resolve';
import { getNearby } from '../../../lib/airports/nearby';
import { travelpayouts } from '../../../lib/providers/travelpayouts';
import { duffel } from '../../../lib/providers/duffel';
import { amadeus } from '../../../lib/providers/amadeus';
import { kiwi } from '../../../lib/providers/kiwi';
import { hotellook } from '../../../lib/providers/hotellook';
import { query } from '../../../lib/db/client';
import { type NormalizedFare, type ProviderIssueStatus, type ProviderNotice } from '../../../lib/types';

function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function dedupFares(fares: NormalizedFare[]): NormalizedFare[] {
  const best = new Map<string, NormalizedFare>();

  for (const fare of fares) {
    const key = `${fare.carrier}:${fare.origin}:${fare.destination}:${fare.depart.slice(0, 16)}`;
    const existing = best.get(key);
    if (!existing || fare.price.priceCents < existing.price.priceCents) {
      best.set(key, fare);
    }
  }

  return Array.from(best.values()).sort((a, b) => a.price.priceCents - b.price.priceCents);
}

function parsePassengers(value: string | null): number {
  const parsed = Number(value ?? '1');
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 9) {
    throw new Error('Passenger count must be between 1 and 9');
  }
  return parsed;
}

function validateDateParam(name: string, value: string): void {
  if (!value) return;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name} must use YYYY-MM-DD format`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${name} is not a valid date`);
  }
}

function classifyProviderIssue(reason: string): ProviderIssueStatus {
  const normalized = reason.toLowerCase();
  if (normalized.includes('malformed')) return 'malformed_response';
  if (
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
  let passengers: number;
  try {
    validateDateParam('depart', depart);
    validateDateParam('return', ret);
    if (depart && ret && ret < depart) {
      throw new Error('Return date must be after departure date');
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

      const sendProviderNotice = (provider: string, reason: string) => {
        const status = classifyProviderIssue(reason);
        const notice: ProviderNotice = {
          provider,
          status,
          message: providerMessage(provider, status),
        };
        flightProviderIssues.push(notice);
        send({ type: 'notice', ...notice });
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
      await Promise.allSettled([
        (async () => {
          if (flexDates && depart) {
            const settled = await Promise.allSettled(
              [-3, -2, -1, 0, 1, 2, 3].map(days =>
                travelpayouts.searchFares(originIATA, destIATA ?? '', {
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
            if (fares.length === 0 && firstFailure?.status === 'fulfilled' && !firstFailure.value.ok) {
              sendProviderNotice('Travelpayouts', firstFailure.value.reason);
            }
            return;
          }

          const r = await travelpayouts.searchFares(originIATA, destIATA ?? '', range);
          if (r.ok && r.data.length > 0) sendFlights('travelpayouts', r.data);
          else if (!r.ok) sendProviderNotice('Travelpayouts', r.reason);
        })(),
        duffel.searchFares(originIATA, destIATA ?? '', range).then(r => {
          if (r.ok && r.data.length > 0) sendFlights('duffel', r.data);
          else if (!r.ok) sendProviderNotice('Duffel', r.reason);
        }),
        amadeus.searchFares(originIATA, destIATA ?? '', range).then(r => {
          if (r.ok && r.data.length > 0) sendFlights('amadeus', r.data);
          else if (!r.ok) sendProviderNotice('Amadeus', r.reason);
        }),
        kiwi.searchFares(originIATA, destIATA ?? '', range).then(r => {
          if (r.ok && r.data.length > 0) sendFlights('kiwi', r.data);
          else if (!r.ok) sendProviderNotice('Kiwi', r.reason);
        }),
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
        const hotelsResult = await hotellook.searchHotels(destIATA, { checkin: depart, checkout: ret });
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
            providerStatus: status,
            message: status === 'malformed_response'
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
