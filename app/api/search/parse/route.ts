export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { DEAL_SEARCH_CITIES, validateDealSearchFilters } from '@/lib/ai/dealSearchFilters'
import { getPaywallContext } from '@/lib/paywall'

let client: OpenAI | null = null

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  if (!client) client = new OpenAI({ apiKey })
  return client
}

async function parseWithOpenAI(query: string): Promise<unknown> {
  const openai = getClient()
  if (!openai) return null

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    max_tokens: 120,
    messages: [
      {
        role: 'system',
        content: [
          'Translate a premium hotel deal search into strict JSON filters.',
          'Return JSON only. Do not include explanations or markdown.',
          'Allowed keys: destination_type, city, max_price, min_stars, min_discount, date_from, date_to.',
          'destination_type may only be "hotel".',
          `city must be exactly one of: ${DEAL_SEARCH_CITIES.join(', ')}. Omit unsupported cities.`,
          'max_price is an integer dollar amount per night, not cents.',
          'min_stars is an integer 1-5. min_discount is an integer 0-99.',
          'date_from and date_to must be YYYY-MM-DD. Omit unknown filters.',
        ].join(' '),
      },
      { role: 'user', content: query },
    ],
  })

  const text = response.choices[0]?.message?.content?.trim()
  if (!text) return null
  return JSON.parse(text) as unknown
}

export async function POST(req: NextRequest) {
  const paywall = await getPaywallContext()
  if (!paywall.premium) {
    return NextResponse.json({ error: 'premium required' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as { query?: unknown }
  const naturalQuery = typeof body.query === 'string' ? body.query.trim().slice(0, 200) : ''
  if (!naturalQuery) return NextResponse.json({ filters: {} })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Couldn't parse that — try the filters instead" }, { status: 422 })
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = await parseWithOpenAI(naturalQuery)
      const validation = validateDealSearchFilters(parsed)
      if (validation.ok) return NextResponse.json({ filters: validation.filters })
    } catch {
      // Retry once, then return the product copy below.
    }
  }

  return NextResponse.json({ error: "Couldn't parse that — try the filters instead" }, { status: 422 })
}
