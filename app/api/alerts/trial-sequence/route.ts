export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { runTrialSequencePass } from '@/lib/email/runTrialSequence'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.PIPELINE_SECRET ?? ''}`
  if (!process.env.PIPELINE_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const result = await runTrialSequencePass()
  return NextResponse.json({ ok: true, ...result })
}
