export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, adminAuthStatus } from '@/lib/admin/role'
import { grantCompAccess } from '@/lib/admin/entitlement'

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }): Promise<NextResponse> {
  const admin = await requireAdmin()
  if (!admin.ok) {
    return NextResponse.json({ ok: false, reason: admin.reason }, { status: adminAuthStatus(admin.reason) })
  }

  const { userId } = await params
  const body = await req.json().catch(() => null) as { reason?: unknown; expiresAt?: unknown } | null
  if (!body) {
    return NextResponse.json({ ok: false, reason: 'Invalid request body' }, { status: 400 })
  }

  const expiresAt = typeof body.expiresAt === 'string' && body.expiresAt.trim() ? body.expiresAt : null

  const result = await grantCompAccess({
    targetUserId: userId,
    reason: typeof body.reason === 'string' ? body.reason : '',
    expiresAt,
    actor: admin.data,
  })

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
