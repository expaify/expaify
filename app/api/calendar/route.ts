import { type NextRequest } from 'next/server';
import { travelpayouts } from '../../../lib/providers/travelpayouts';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const origin = searchParams.get('origin')?.toUpperCase();
  const dest = searchParams.get('dest')?.toUpperCase();

  if (!origin || !dest) return Response.json({}, { status: 400 });

  const result = await travelpayouts.priceTrends(origin, dest);
  if (!result.ok) return Response.json({});

  const map: Record<string, number> = {};
  for (const pricePoint of result.data) {
    map[pricePoint.date.slice(0, 10)] = pricePoint.priceCents;
  }

  return Response.json(map, {
    headers: { 'Cache-Control': 'public,max-age=3600' },
  });
}
