export const dynamic = 'force-dynamic'

import { estimateBaggageFees } from '@/lib/baggage/fees';
import type { BaggageCabinClass, BaggageFeeInput } from '@/lib/baggage/types';

const CABIN_CLASSES = new Set<BaggageCabinClass>(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST']);

function json(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function parseBagCount(value: string | null, name: string): number | Response {
  if (value === null || value.trim() === '') {
    return json({ error: `${name} is required` }, { status: 400 });
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return json({ error: `${name} must be a number` }, { status: 400 });
  }

  return parsed;
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const carrierCode = params.get('carrierCode')?.trim().toUpperCase();
  const originCountry = params.get('originCountry')?.trim().toUpperCase();
  const destinationCountry = params.get('destinationCountry')?.trim().toUpperCase();
  const cabinClass = params.get('cabinClass')?.trim().toUpperCase();

  if (!carrierCode) return json({ error: 'carrierCode is required' }, { status: 400 });
  if (!originCountry) return json({ error: 'originCountry is required' }, { status: 400 });
  if (!destinationCountry) return json({ error: 'destinationCountry is required' }, { status: 400 });
  if (!cabinClass || !CABIN_CLASSES.has(cabinClass as BaggageCabinClass)) {
    return json({ error: 'cabinClass must be ECONOMY, PREMIUM_ECONOMY, BUSINESS, or FIRST' }, { status: 400 });
  }

  const checkedBags = parseBagCount(params.get('checkedBags'), 'checkedBags');
  if (checkedBags instanceof Response) return checkedBags;

  const carryOnBags = parseBagCount(params.get('carryOnBags'), 'carryOnBags');
  if (carryOnBags instanceof Response) return carryOnBags;

  const input: BaggageFeeInput = {
    carrierCode,
    originCountry,
    destinationCountry,
    cabinClass: cabinClass as BaggageCabinClass,
    checkedBags,
    carryOnBags,
  };

  return json(estimateBaggageFees(input), {
    headers: {
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
