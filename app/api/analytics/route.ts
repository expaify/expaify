import { NextResponse } from 'next/server'
import { query } from '@/lib/db/client'

export const runtime = 'nodejs'

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EVENT = /^[a-z][a-z0-9_]{1,79}$/
const PATH = /^\/[A-Za-z0-9_\-./]{0,299}$/

type Primitive = string | number | boolean

function parseBody(value: unknown): {
  eventId: string
  sessionId: string
  event: string
  occurredAt: Date
  path: string
  props: Record<string, Primitive>
} | null {
  if (!value || typeof value !== 'object') return null
  const body = value as Record<string, unknown>
  if (
    typeof body.eventId !== 'string' || !ID.test(body.eventId) ||
    typeof body.sessionId !== 'string' || !ID.test(body.sessionId) ||
    typeof body.event !== 'string' || !EVENT.test(body.event) ||
    typeof body.path !== 'string' || !PATH.test(body.path) ||
    typeof body.occurredAt !== 'string'
  ) return null
  const occurredAt = new Date(body.occurredAt)
  if (!Number.isFinite(occurredAt.getTime()) || Math.abs(Date.now() - occurredAt.getTime()) > 86_400_000) return null
  if (!body.props || typeof body.props !== 'object' || Array.isArray(body.props)) return null
  const entries = Object.entries(body.props as Record<string, unknown>)
  if (entries.length > 30) return null
  const props: Record<string, Primitive> = {}
  for (const [key, item] of entries) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(key)) return null
    if (typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'boolean') return null
    if (typeof item === 'string' && item.length > 500) return null
    if (typeof item === 'number' && !Number.isFinite(item)) return null
    props[key] = item
  }
  return { eventId: body.eventId, sessionId: body.sessionId, event: body.event, occurredAt, path: body.path, props }
}

export async function POST(request: Request) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'Invalid analytics payload' }, { status: 400 })
  }
  const event = parseBody(raw)
  if (!event) return NextResponse.json({ ok: false, reason: 'Invalid analytics payload' }, { status: 400 })

  try {
    await query(
      `INSERT INTO analytics_events
        (event_id, session_id, event_name, occurred_at, path, properties)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (event_id) DO NOTHING`,
      [event.eventId, event.sessionId, event.event, event.occurredAt.toISOString(), event.path, JSON.stringify(event.props)],
    )
  } catch {
    return NextResponse.json({ ok: false, reason: 'Analytics unavailable' }, { status: 503 })
  }
  return new NextResponse(null, { status: 202 })
}
