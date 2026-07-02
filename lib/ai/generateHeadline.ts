import OpenAI from 'openai'
import { query } from '../db/client'

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
    _client = new OpenAI({ apiKey })
  }
  return _client
}

type DealInput = {
  id: string
  hotelName: string
  city: string
  discountPct: number
  dealPriceCents: number
}

async function generateOne(deal: DealInput): Promise<string | null> {
  const pricePerNight = `$${Math.round(deal.dealPriceCents / 100)}`
  const res = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 60,
    messages: [
      {
        role: 'system',
        content: 'You write short hotel deal headlines for a travel deals app. Output one headline only, nothing else.',
      },
      {
        role: 'user',
        content: `Rules: max 60 characters, lead with city or hotel name, include "${pricePerNight}/night", include ${deal.discountPct}% discount, factual, no hype words, no punctuation at end.\n\nHotel: ${deal.hotelName}, City: ${deal.city}, Price: ${pricePerNight}/night, Discount: ${deal.discountPct}%`,
      },
    ],
  })

  const text = res.choices[0]?.message?.content?.trim() ?? null
  if (!text || text.length > 70) return null
  return text
}

export async function generateHeadlines(deals: DealInput[]): Promise<void> {
  if (!process.env.OPENAI_API_KEY || deals.length === 0) return

  await Promise.allSettled(
    deals.map(async (deal) => {
      try {
        const headline = await Promise.race([
          generateOne(deal),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ])
        if (headline) {
          await query(
            'UPDATE deals SET headline = $1, updated_at = NOW() WHERE id = $2',
            [headline, deal.id]
          )
        }
      } catch {
        // Silent — don't break the pipeline
      }
    })
  )
}
