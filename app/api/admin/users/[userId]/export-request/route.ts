export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, adminAuthStatus } from '@/lib/admin/role'
import { createExportRequest } from '@/lib/admin/privacyRequests'

export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }): Promise<NextResponse> {
  const admin = await requireAdmin()
  if (!admin.ok) {
    return NextResponse.json({ ok: false, reason: admin.reason }, { status: adminAuthStatus(admin.reason) })
  }

  const { userId } = await params
  const body = await req.json().catch(() => null) as { source?: unknown } | null
  if (!body) {
    return NextResponse.json({ ok: false, reason: 'Invalid request body' }, { status: 400 })
  }

  const result = await createExportRequest({
    targetUserId: userId,
    source: typeof body.source === 'string' ? body.source : '',
    actor: admin.data,
  })

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
