export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { AIRPORTS } from '@/lib/airports/data'
import type { AirportLookupAirport, AirportLookupData, Result } from '@/lib/types'

const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 64
const RESULT_LIMIT = 8

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
}

function ok(data: AirportLookupData) {
  return Response.json({ ok: true, data } satisfies Result<AirportLookupData>, {
    headers: CACHE_HEADERS,
  })
}

function fail(reason: string, status: number) {
  return Response.json({ ok: false, reason } satisfies Result<AirportLookupData>, {
    status,
    headers: CACHE_HEADERS,
  })
}

function emptyData(query: string, status: AirportLookupData['status']): AirportLookupData {
  return {
    airports: [],
    query,
    status,
    minQueryLength: MIN_QUERY_LENGTH,
    limit: RESULT_LIMIT,
  }
}

function normalizeAirportQuery(value: string): Result<string> {
  if (/[\u0000-\u001F\u007F]/.test(value)) {
    return { ok: false, reason: 'Airport query contains unsupported characters' }
  }

  if (value.length > MAX_QUERY_LENGTH) {
    return { ok: false, reason: `Airport query must be ${MAX_QUERY_LENGTH} characters or fewer` }
  }

  const query = value.replace(/\s+/g, ' ').trim().toLowerCase()
  if (query.length > MAX_QUERY_LENGTH) {
    return { ok: false, reason: `Airport query must be ${MAX_QUERY_LENGTH} characters or fewer` }
  }

  return { ok: true, data: query }
}

function toAirportLookupAirport(airport: {
  iata: string
  name: string
  city: string
  country: string
}): AirportLookupAirport {
  return {
    iata: airport.iata,
    name: airport.name,
    city: airport.city,
    country: airport.country,
  }
}

export async function GET(req: NextRequest) {
  try {
    if (req.nextUrl.searchParams.getAll('q').length > 1) {
      return fail('Provide a single airport query', 400)
    }

    const normalized = normalizeAirportQuery(req.nextUrl.searchParams.get('q') ?? '')
    if (!normalized.ok) return fail(normalized.reason, 400)

    const q = normalized.data
    if (q.length < MIN_QUERY_LENGTH) return ok(emptyData(q, 'too_short'))

    const airports = AIRPORTS
      .map(a => {
        const iata = a.iata.toLowerCase()
        const city = a.city.toLowerCase()
        const name = a.name.toLowerCase()
        let score = 0
        if (iata === q) score = 100
        else if (iata.startsWith(q)) score = 90
        else if (city === q) score = 80
        else if (city.startsWith(q)) score = 70
        else if (city.includes(q)) score = 50
        else if (name.includes(q)) score = 30
        else return null
        return { airport: a, score }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score || a.airport.iata.localeCompare(b.airport.iata))
      .slice(0, RESULT_LIMIT)
      .map(({ airport }) => toAirportLookupAirport(airport))

    return ok({
      airports,
      query: q,
      status: 'ok',
      minQueryLength: MIN_QUERY_LENGTH,
      limit: RESULT_LIMIT,
    })
  } catch {
    return fail('Airport lookup is unavailable', 503)
  }
}
