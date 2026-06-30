import { type NextRequest } from 'next/server';
import { resolveToIATA } from '../../../lib/airports/resolve';
import { travelpayouts } from '../../../lib/providers/travelpayouts';
import { duffel } from '../../../lib/providers/duffel';
import { amadeus } from '../../../lib/providers/amadeus';
import { kiwi } from '../../../lib/providers/kiwi';
import { hotellook } from '../../../lib/providers/hotellook';
import { query } from '../../../lib/db/client';

/**
 * GET /api/search
 *
 * Streams results as newline-delimited JSON (NDJSON).
 * Each line: { type: 'flights'|'hotels'|'notice'|'done', ... }
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
  const passengers = parseInt(params.get('passengers') ?? '1', 10);
  const range = { depart, return: ret || undefined, passengers };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

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
        travelpayouts.searchFares(originIATA, destIATA ?? '', range).then(r => {
          if (r.ok && r.data.length > 0) send({ type: 'flights', source: 'travelpayouts', data: r.data });
          else if (!r.ok) send({ type: 'notice', message: `Travelpayouts: ${r.reason}` });
        }),
        duffel.searchFares(originIATA, destIATA ?? '', range).then(r => {
          if (r.ok && r.data.length > 0) send({ type: 'flights', source: 'duffel', data: r.data });
          else if (!r.ok && !r.reason.includes('not configured')) send({ type: 'notice', message: `Duffel: ${r.reason}` });
        }),
        amadeus.searchFares(originIATA, destIATA ?? '', range).then(r => {
          if (r.ok && r.data.length > 0) send({ type: 'flights', source: 'amadeus', data: r.data });
        }),
        kiwi.searchFares(originIATA, destIATA ?? '', range).then(r => {
          if (r.ok && r.data.length > 0) send({ type: 'flights', source: 'kiwi', data: r.data });
        }),
      ]);

      // Hotels after all flight providers resolve
      if (destIATA && depart && ret) {
        const hotelsResult = await hotellook.searchHotels(destIATA, { checkin: depart, checkout: ret });
        if (hotelsResult.ok && hotelsResult.data.length > 0)
          send({ type: 'hotels', source: 'hotellook', data: hotelsResult.data });
        else if (!hotelsResult.ok)
          send({ type: 'notice', message: `Hotels unavailable: ${hotelsResult.reason}` });
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
