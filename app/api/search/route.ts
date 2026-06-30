import { type NextRequest, NextResponse } from 'next/server';
import { resolveToIATA } from '../../../lib/airports/resolve';
import { travelpayouts } from '../../../lib/providers/travelpayouts';
import { duffel } from '../../../lib/providers/duffel';
import { amadeus } from '../../../lib/providers/amadeus';
import { kiwi } from '../../../lib/providers/kiwi';
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

  // ── Flights — fan out to all 4 providers in parallel ───────────────────────
  let flights: NormalizedFare[] = [];
  const range = { depart, return: ret || undefined };
  const [tpResult, duffelResult, amadeusResult, kiwiResult] = await Promise.all([
    travelpayouts.searchFares(originIATA, destIATA ?? '', range),
    duffel.searchFares(originIATA, destIATA ?? '', range),
    amadeus.searchFares(originIATA, destIATA ?? '', range),
    kiwi.searchFares(originIATA, destIATA ?? '', range),
  ]);

  if (tpResult.ok) flights.push(...tpResult.data);
  else notices.push(`Travelpayouts: ${tpResult.reason}`);

  if (duffelResult.ok) flights.push(...duffelResult.data);
  else if (duffelResult.reason !== 'Duffel not configured') notices.push(`Duffel: ${duffelResult.reason}`);

  if (amadeusResult.ok) flights.push(...amadeusResult.data);
  else if (!amadeusResult.reason.includes('not configured')) notices.push(`Amadeus: ${amadeusResult.reason}`);

  if (kiwiResult.ok) flights.push(...kiwiResult.data);
  else if (!kiwiResult.reason.includes('not configured')) notices.push(`Kiwi: ${kiwiResult.reason}`);

  // Deduplicate by flight identity (carrier + route + depart minute), keep cheapest fare
  const bestByKey = new Map<string, NormalizedFare>();
  for (const f of flights) {
    const key = `${f.carrier}:${f.origin}:${f.destination}:${f.depart.slice(0, 16)}`;
    const existing = bestByKey.get(key);
    if (!existing || f.price.priceCents < existing.price.priceCents) {
      bestByKey.set(key, f);
    }
  }
  flights = Array.from(bestByKey.values())
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
