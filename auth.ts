import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Resend from 'next-auth/providers/resend'
import PostgresAdapter from '@auth/pg-adapter'
import { Pool } from 'pg'
import { sendWelcomeEmail } from './lib/email/sendWelcome'
import { sendMagicLink } from './lib/email/sendMagicLink'

// Singleton pool — only created when first request arrives (not at build time)
let _pool: Pool | null = null
function getPool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    _pool = new Pool({ connectionString: url })
  }
  return _pool
}

const providers = [
  Resend({
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM ?? 'expaify <dev@expaify.com>',
    async sendVerificationRequest({ identifier: to, url }) {
      await sendMagicLink({ to, url })
    },
  }),
  ...(process.env.GOOGLE_CLIENT_ID
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
          // Azure proxy loses the PKCE cookie; use state-only check instead.
          checks: ['state'],
          // Google verifies email ownership, so linking an existing magic-link
          // account to Google is safe — avoids OAuthAccountNotLinked error.
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : []),
]

// Pass a factory function so the pool is constructed lazily on first request
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: PostgresAdapter(getPool()),
  providers,
  trustHost: true,
  pages: {
    signIn: '/login',
    verifyRequest: '/login/verify',
    error: '/auth/error',
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
    redirect({ url, baseUrl }) {
      // Honour same-origin relative and absolute callbackUrls.
      // Never rely on a cookie — default to /deals so the proxy can't break it.
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (url.startsWith(baseUrl)) return url
      return `${baseUrl}/deals`
    },
  },
  events: {
    async createUser({ user }) {
      if (user.email) {
        await sendWelcomeEmail(user.email)
      }
    },
  },
}))
