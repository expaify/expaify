import { type NextRequest, NextResponse } from 'next/server';
import { resolveToIATA } from '../../../lib/airports/resolve';
import { travelpayouts } from '../../../lib/providers/travelpayouts';
import { duffel } from '../../../lib/providers/duffel';
import { hotellook } from '../../../lib/providers/hotellook';
import type { NormalizedFare, HotelOffer } from '../../../lib/types';

/**
 * GET /api/search
 *
 * Query params:
 *   origin  (required) — IATA code or US ZIP
 *   dest    (optional) — IATA code or US ZIP
 *   depart  (optional) — departure date string
 *   return  (optional) — return date string
 *
 * Response: { flights: NormalizedFare[]; hotels: HotelOffer[]; notice?: string }
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const originRaw = params.get('origin');
  if (!originRaw) {
    return NextResponse.json({ error: 'origin is required' }, { status: 400 });
  }

  let originIATA: string;
  try {
    originIATA = resolveToIATA(originRaw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const destRaw = params.get('dest');
  let destIATA: string | undefined;
  if (destRaw) {
    try {
      destIATA = resolveToIATA(destRaw);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  const depart = params.get('depart') ?? '';
  const ret = params.get('return') ?? '';

  const notices: string[] = [];

  // ── Flights — fan out to Travelpayouts + Duffel in parallel ────────────────
  let flights: NormalizedFare[] = [];
  const [tpResult, duffelResult] = await Promise.all([
    travelpayouts.searchFares(originIATA, destIATA ?? '', { depart, return: ret || undefined }),
    duffel.searchFares(originIATA, destIATA ?? '', { depart, return: ret || undefined }),
  ]);

  if (tpResult.ok) flights.push(...tpResult.data);
  else notices.push(`Travelpayouts: ${tpResult.reason}`);

  if (duffelResult.ok) flights.push(...duffelResult.data);
  else if (duffelResult.reason !== 'Duffel not configured') notices.push(`Duffel: ${duffelResult.reason}`);

  // Deduplicate by deeplink, sort cheapest first
  const seen = new Set<string>();
  flights = flights
    .filter(f => { const key = f.deeplink; return seen.has(key) ? false : (seen.add(key), true); })
    .sort((a, b) => a.price.priceCents - b.price.priceCents);

  // ── Hotels ──────────────────────────────────────────────────────────────────
  // Hotels require a destination city and both dates to be useful
  let hotels: HotelOffer[] = [];
  if (destIATA && depart && ret) {
    const hotelsResult = await hotellook.searchHotels(
      destIATA,
      { checkin: depart, checkout: ret },
    );
    if (hotelsResult.ok) {
      hotels = hotelsResult.data;
    } else {
      notices.push(`Hotels unavailable: ${hotelsResult.reason}`);
    }
  }

  const response: {
    flights: NormalizedFare[];
    hotels: HotelOffer[];
    notice?: string;
  } = { flights, hotels };

  if (notices.length > 0) {
    response.notice = notices.join(' ');
  }

  return NextResponse.json(response);
}
