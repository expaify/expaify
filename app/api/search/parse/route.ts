export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

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

  if (!query.trim()) return NextResponse.json({})

  if (!process.env.OPENAI_API_KEY) return NextResponse.json(fallbackParse(query))

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 128,
      messages: [
        {
          role: 'system',
          content: `Extract travel deal search filters. Output only valid JSON, no explanation. Keys allowed: city (must be exactly one of: Miami, New York, Cancún, Paris, Rome, Barcelona, Lisbon, London, Tokyo, Bangkok, Dubai, Las Vegas, Orlando, San Juan, Tulum, Amsterdam, Athens, Punta Cana, Charlotte, Nashville), maxPriceCents (integer, price per night in cents), minDiscount (integer 0-99). Only include keys present in the query. If city is not in the list, omit it.`,
        },
        { role: 'user', content: query },
      ],
    })

    const text = res.choices[0]?.message?.content?.trim() ?? '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json(fallbackParse(query))

    const parsed = JSON.parse(jsonMatch[0]) as ParseResult
    if (parsed.city && !CITIES.has(parsed.city)) delete parsed.city
    if (parsed.maxPriceCents && typeof parsed.maxPriceCents !== 'number') delete parsed.maxPriceCents
    if (parsed.minDiscount && typeof parsed.minDiscount !== 'number') delete parsed.minDiscount

    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json(fallbackParse(query))
  }
}
