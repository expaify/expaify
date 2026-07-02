import Anthropic from '@anthropic-ai/sdk'
import { query } from '../db/client'

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
    _client = new Anthropic({ apiKey })
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
  const prompt = `You write short hotel deal headlines for a travel deals app.
Rules:
- Max 60 characters including spaces
- Lead with city or hotel name
- Include "${pricePerNight}/night" using the actual price
- Include ${deal.discountPct}% discount
- Factual, no hype words (no "amazing", "incredible", "unbelievable")
- No punctuation at end
- Write one headline only, nothing else

Hotel: ${deal.hotelName}, City: ${deal.city}, Price: ${pricePerNight}/night, Discount: ${deal.discountPct}%`

  const msg = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 60,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : null
  if (!text || text.length > 70) return null
  return text
}

export async function generateHeadlines(deals: DealInput[]): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY || deals.length === 0) return

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
