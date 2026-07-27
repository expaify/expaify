export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, adminAuthStatus } from '@/lib/admin/role'
import { getAdminDossier } from '@/lib/admin/dossier'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }): Promise<NextResponse> {
  const admin = await requireAdmin()
  if (!admin.ok) {
    return NextResponse.json({ ok: false, reason: admin.reason }, { status: adminAuthStatus(admin.reason) })
  }

  const { userId } = await params
  const result = await getAdminDossier(userId, admin.data)
  return NextResponse.json(result, { status: result.ok ? 200 : 404 })
}
