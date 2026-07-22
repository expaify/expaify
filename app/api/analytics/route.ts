import { validateAnalyticsEvent, writeAnalyticsEvent } from '@/lib/analytics/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > 8_192) {
    return Response.json({ ok: false, reason: 'Analytics payload too large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: 'Invalid analytics payload' }, { status: 400 });
  }

  const event = validateAnalyticsEvent(body);
  if (!event) return Response.json({ ok: false, reason: 'Invalid analytics event' }, { status: 400 });

  try {
    await writeAnalyticsEvent(event);
    return Response.json({ ok: true }, { status: 202 });
  } catch {
    return Response.json({ ok: false, reason: 'Analytics sink unavailable' }, { status: 503 });
  }
}
