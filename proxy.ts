import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that require authentication
const PROTECTED_ROUTES = ['/account', '/admin']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // www.expaify.com previously served full 200 content independently of
  // expaify.com -- a duplicate-content risk beyond what per-page canonical
  // tags alone mitigate. Redirect it to the canonical apex domain.
  if (request.headers.get('host') === 'www.expaify.com') {
    const url = new URL(request.url)
    url.protocol = 'https'
    url.hostname = 'expaify.com'
    url.port = ''
    return NextResponse.redirect(url, 308)
  }

  if (PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
    const session = await auth()
    if (!session) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
