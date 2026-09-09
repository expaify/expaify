import { timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

export function isValidPipelineSecret(req: NextRequest): boolean {
  const secret = process.env.PIPELINE_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  const authBuf = Buffer.from(auth)
  const expectedBuf = Buffer.from(expected)
  if (authBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(authBuf, expectedBuf)
}
