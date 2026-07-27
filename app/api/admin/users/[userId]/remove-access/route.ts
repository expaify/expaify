export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, adminAuthStatus } from '@/lib/admin/role'
import { removeLocalAccess } from '@/lib/admin/entitlement'

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }): Promise<NextResponse> {
  const admin = await requireAdmin()
  if (!admin.ok) {
    return NextResponse.json({ ok: false, reason: admin.reason }, { status: adminAuthStatus(admin.reason) })
  }

  const { userId } = await params
  const body = await req.json().catch(() => null) as { reason?: unknown } | null
  if (!body) {
    return NextResponse.json({ ok: false, reason: 'Invalid request body' }, { status: 400 })
  }

  const result = await removeLocalAccess({
    targetUserId: userId,
    reason: typeof body.reason === 'string' ? body.reason : '',
    actor: admin.data,
  })

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
