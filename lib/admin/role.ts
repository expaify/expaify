import { auth } from '@/auth'
import { query } from '@/lib/db/client'

export interface AdminActor {
  userId: string
  email: string
}

export async function isAdmin(userId: string): Promise<boolean> {
  const result = await query('SELECT 1 FROM admin_users WHERE user_id = $1 LIMIT 1', [userId])
  return (result.rowCount ?? 0) > 0
}

export type AdminAuthFailure = 'unauthenticated' | 'forbidden' | 'role_check_failed'

export type AdminAuthResult =
  | { ok: true; data: AdminActor }
  | { ok: false; reason: AdminAuthFailure }

// Verifies the admin role server-side on every call — never trust a client
// session claim alone. Every /api/admin/* route must call this first.
export async function requireAdmin(): Promise<AdminAuthResult> {
  const session = await auth()
  if (!session?.user?.id) {
    return { ok: false, reason: 'unauthenticated' }
  }

  let admin: boolean
  try {
    admin = await isAdmin(session.user.id)
  } catch {
    return { ok: false, reason: 'role_check_failed' }
  }

  if (!admin) {
    return { ok: false, reason: 'forbidden' }
  }

  return { ok: true, data: { userId: session.user.id, email: session.user.email ?? '' } }
}

export function adminAuthStatus(reason: AdminAuthFailure): number {
  switch (reason) {
    case 'unauthenticated':
      return 401
    case 'forbidden':
      return 403
    case 'role_check_failed':
      return 500
  }
}
