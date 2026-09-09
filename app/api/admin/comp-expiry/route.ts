export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { expireDueComps } from '@/lib/admin/entitlement'
import { isValidPipelineSecret } from '@/lib/pipeline/auth'

export async function POST(req: NextRequest) {
  if (!isValidPipelineSecret(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const result = await expireDueComps()
  return NextResponse.json({ ok: true, ...result })
}
