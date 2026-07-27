export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, adminAuthStatus } from '@/lib/admin/role'
import { lookupAdminAccount } from '@/lib/admin/lookup'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin()
  if (!admin.ok) {
    return NextResponse.json({ ok: false, reason: admin.reason }, { status: adminAuthStatus(admin.reason) })
  }

  const q = req.nextUrl.searchParams.get('q')
  if (!q || !q.trim()) {
    return NextResponse.json({ ok: false, reason: 'Query parameter "q" is required' }, { status: 400 })
  }

  const result = await lookupAdminAccount(q)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
