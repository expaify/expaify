import { NextRequest } from 'next/server'
import { middleware } from '../middleware'

describe('middleware', () => {
  it('redirects www.expaify.com to the apex domain with a 308, preserving path and query', () => {
    const request = new NextRequest('https://www.expaify.com/deals?city=paris', {
      headers: { host: 'www.expaify.com' },
    })

    const response = middleware(request)

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe('https://expaify.com/deals?city=paris')
  })

  it('passes expaify.com requests through unchanged', () => {
    const request = new NextRequest('https://expaify.com/deals', {
      headers: { host: 'expaify.com' },
    })

    const response = middleware(request)

    expect(response.headers.get('location')).toBeNull()
  })
})
