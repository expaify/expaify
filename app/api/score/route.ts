import { NextResponse } from 'next/server';
import { getBaseline } from '../../../lib/db/getBaseline';
import { scoreDeal } from '../../../lib/scoring/scoreDeal';
import type { NormalizedFare } from '../../../lib/types';

/**
 * POST /api/score
 *
 * Body: { fare: NormalizedFare }
 *
 * Response: DealScore
 */
export async function POST(request: Request) {
  let body: { fare?: NormalizedFare };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'fare is required' }, { status: 400 });
  }

  const fare = body?.fare;
  if (!fare) {
    return NextResponse.json({ error: 'fare is required' }, { status: 400 });
  }

  let history;
  try {
    history = await getBaseline(fare.origin, fare.destination);
  } catch {
    return NextResponse.json(
      { error: 'Could not load baseline' },
      { status: 502 },
    );
  }

  const dealScore = scoreDeal(fare, history);
  return NextResponse.json(dealScore);
}
