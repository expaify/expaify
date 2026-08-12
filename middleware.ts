import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// www.expaify.com currently serves full 200 content independently of
// expaify.com -- a duplicate-content risk beyond what per-page canonical
// tags alone mitigate. Redirect it to the canonical apex domain.
export function middleware(request: NextRequest) {
  const host = request.headers.get('host')
  if (host === 'www.expaify.com') {
    const url = new URL(request.url)
    url.host = 'expaify.com'
    return NextResponse.redirect(url, 308)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
