export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createDeletionRequest, createExportRequest } from '@/lib/admin/privacyRequests'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { type?: unknown } | null
  if (body?.type !== 'export' && body?.type !== 'deletion') {
    return NextResponse.json({ ok: false, reason: 'Invalid privacy request type' }, { status: 400 })
  }

  const input = {
    targetUserId: session.user.id,
    source: 'self_service_account_page',
    actor: {
      userId: session.user.id,
      email: session.user.email ?? '',
    },
  }
  const result = body.type === 'export'
    ? await createExportRequest(input)
    : await createDeletionRequest(input)

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
