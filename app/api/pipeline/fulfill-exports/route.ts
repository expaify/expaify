export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fulfillDueExportRequests } from '@/lib/admin/privacyRequests'
import { isValidPipelineSecret } from '@/lib/pipeline/auth'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  if (!isValidPipelineSecret(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const result = await fulfillDueExportRequests()
  return NextResponse.json({ ok: true, ...result })
}
