import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Resend from 'next-auth/providers/resend'
import PostgresAdapter from '@auth/pg-adapter'
import { Pool } from 'pg'
import { sendWelcomeEmail } from './lib/email/sendWelcome'

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
    from: process.env.EMAIL_FROM ?? 'noreply@expaify.com',
  }),
  ...(process.env.GOOGLE_CLIENT_ID
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        }),
      ]
    : []),
]

// Pass a factory function so the pool is constructed lazily on first request
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: PostgresAdapter(getPool()),
  providers,
  pages: {
    signIn: '/login',
    verifyRequest: '/login/verify',
  },
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
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
