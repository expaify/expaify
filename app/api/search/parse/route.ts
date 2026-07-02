export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const CITIES = new Set([
  'Miami', 'New York', 'Cancún', 'Paris', 'Rome', 'Barcelona', 'Lisbon',
  'London', 'Tokyo', 'Bangkok', 'Dubai', 'Las Vegas', 'Orlando', 'San Juan',
  'Tulum', 'Amsterdam', 'Athens', 'Punta Cana', 'Charlotte', 'Nashville',
])

type ParseResult = {
  city?: string
  maxPriceCents?: number
  minDiscount?: number
}

function fallbackParse(query: string): ParseResult {
  const q = query.toLowerCase()
  const city = [...CITIES].find(c => q.includes(c.toLowerCase()))
  const priceMatch = q.match(/\$(\d+)/)
  const discountMatch = q.match(/(\d+)%/)
  return {
    ...(city ? { city } : {}),
    ...(priceMatch ? { maxPriceCents: parseInt(priceMatch[1], 10) * 100 } : {}),
    ...(discountMatch ? { minDiscount: parseInt(discountMatch[1], 10) } : {}),
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { query?: unknown }
  const query = typeof body.query === 'string' ? body.query.slice(0, 200) : ''

  if (!query.trim()) {
    return NextResponse.json({})
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(fallbackParse(query))
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 128,
      messages: [
        {
          role: 'user',
          content: `Extract travel deal search filters from this query. Output only valid JSON, no explanation.
Keys allowed: city (string, must be exactly one of: Miami, New York, Cancún, Paris, Rome, Barcelona, Lisbon, London, Tokyo, Bangkok, Dubai, Las Vegas, Orlando, San Juan, Tulum, Amsterdam, Athens, Punta Cana, Charlotte, Nashville), maxPriceCents (integer, price per night in cents), minDiscount (integer 0-99).
Only include keys present in the query. If city is not in the list, omit it.
Query: "${query}"`,
        },
      ],
    })

    const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json(fallbackParse(query))

    const parsed = JSON.parse(jsonMatch[0]) as ParseResult

    // Validate city against allowlist
    if (parsed.city && !CITIES.has(parsed.city)) delete parsed.city
    if (parsed.maxPriceCents && (typeof parsed.maxPriceCents !== 'number' || parsed.maxPriceCents <= 0)) delete parsed.maxPriceCents
    if (parsed.minDiscount && (typeof parsed.minDiscount !== 'number' || parsed.minDiscount < 0 || parsed.minDiscount > 99)) delete parsed.minDiscount

    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json(fallbackParse(query))
  }
}
