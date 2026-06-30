import { NextRequest } from 'next/server'
import type { AirportLookupData, Result } from '@/lib/types'
import { GET } from '../route'

function getAirportLookup(queryString: string): Promise<Response> {
  return GET(new NextRequest(`https://expaify.test/api/airports${queryString}`))
}

async function readBody(response: Response): Promise<Result<AirportLookupData>> {
  return await response.json() as Result<AirportLookupData>
}

describe('GET /api/airports', () => {
  it('returns stable minimal airport records for a valid query', async () => {
    const response = await getAirportLookup('?q=jfk')
    const body = await readBody(response)

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      data: expect.objectContaining({
        query: 'jfk',
        status: 'ok',
        minQueryLength: 2,
        limit: 8,
        airports: expect.arrayContaining([
          {
            iata: 'JFK',
            name: 'John F. Kennedy International',
            city: 'New York',
            country: 'US',
          },
        ]),
      }),
    })

    if (!body.ok) throw new Error('expected ok response')
    expect(body.data.airports).toHaveLength(1)
    expect(Object.keys(body.data.airports[0]).sort()).toEqual(['city', 'country', 'iata', 'name'])
  })

  it('returns an empty too-short result for blank and one-character queries', async () => {
    const blankResponse = await getAirportLookup('?q=%20%20')
    const blankBody = await readBody(blankResponse)

    expect(blankResponse.status).toBe(200)
    expect(blankBody).toEqual({
      ok: true,
      data: {
        airports: [],
        query: '',
        status: 'too_short',
        minQueryLength: 2,
        limit: 8,
      },
    })

    const response = await getAirportLookup('?q=%20%20j%20%20')
    const body = await readBody(response)

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      data: {
        airports: [],
        query: 'j',
        status: 'too_short',
        minQueryLength: 2,
        limit: 8,
      },
    })
  })

  it('returns an empty ok result for a valid query with no matches', async () => {
    const response = await getAirportLookup('?q=zzzz')
    const body = await readBody(response)

    expect(response.status).toBe(200)
    expect(body).toEqual({
      ok: true,
      data: {
        airports: [],
        query: 'zzzz',
        status: 'ok',
        minQueryLength: 2,
        limit: 8,
      },
    })
  })

  it('returns a clear validation error for malformed input', async () => {
    const response = await getAirportLookup(`?q=${encodeURIComponent('JFK\u0000')}`)
    const body = await readBody(response)

    expect(response.status).toBe(400)
    expect(body).toEqual({
      ok: false,
      reason: 'Airport query contains unsupported characters',
    })
  })
})
