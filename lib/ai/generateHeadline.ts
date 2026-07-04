import OpenAI from 'openai'
import { query } from '../db/client'

let client: OpenAI | null = null

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  if (!client) client = new OpenAI({ apiKey })
  return client
}

type DealInput = {
  id: string
  hotelName: string
  city: string
  stars: number | null
  discountPct: number
  dealPriceCents: number
  medianPriceCents: number
  checkInWindow: string
}

type DealCopy = {
  headline: string
  description: string
}

function sentenceCount(text: string): number {
  return text.split(/[.!?]+/).map(part => part.trim()).filter(Boolean).length
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function containsHotelName(text: string, hotelName: string): boolean {
  const normalized = text.toLowerCase()
  const hotelWords = hotelName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(word => word.length >= 4 && !['hotel', 'resort', 'inn', 'suites'].includes(word))

  return hotelWords.some(word => new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(normalized))
}

function containsGeneratedFact(text: string, deal: DealInput): boolean {
  const compact = text.replace(/\s+/g, ' ')
  const priceDollars = Math.round(deal.dealPriceCents / 100)
  const medianDollars = Math.round(deal.medianPriceCents / 100)
  const forbiddenPatterns = [
    /\$\s*\d+/,
    /\b\d+\s*%/,
    new RegExp(`\\b${deal.discountPct}\\b`),
    new RegExp(`\\b${priceDollars}\\b`),
    new RegExp(`\\b${medianDollars}\\b`),
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\b/i,
    /\b\d{1,2}\/\d{1,2}\b/,
    /\b(?:available|only|last chance|expires?|book now|limited)\b/i,
  ]

  return forbiddenPatterns.some(pattern => pattern.test(compact)) || containsHotelName(compact, deal.hotelName)
}

function normalizeCopy(raw: unknown, deal: DealInput): DealCopy | null {
  if (!raw || typeof raw !== 'object') return null
  const maybe = raw as { headline?: unknown; description?: unknown }
  const headline = typeof maybe.headline === 'string' ? maybe.headline.trim() : ''
  const description = typeof maybe.description === 'string' ? maybe.description.trim() : ''

  if (!headline || headline.length > 70) return null
  if (!description || sentenceCount(description) !== 2) return null
  if (containsGeneratedFact(`${headline} ${description}`, deal)) return null

  return { headline, description }
}

export function fallbackDealCopy(deal: DealInput): DealCopy {
  const stars = deal.stars ? `${Math.round(deal.stars)}★ ` : ''
  const headline = `${stars}${deal.hotelName} in ${deal.city} - ${deal.discountPct}% below its usual price`
  return {
    headline: headline.length <= 70 ? headline : `${stars}${deal.hotelName} - ${deal.discountPct}% below usual`.slice(0, 70),
    description: `${deal.hotelName} is priced below its recent median for ${deal.checkInWindow}. expaify compares this rate against ${deal.medianPriceCents > 0 ? 'recent tracked prices' : 'available tracked prices'} before showing it as a deal.`,
  }
}

async function generateOne(deal: DealInput): Promise<DealCopy | null> {
  const openai = getClient()
  if (!openai) return null

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    max_tokens: 160,
    messages: [
      {
        role: 'system',
        content: [
          'You write restrained travel deal copy for expaify.',
          'Return JSON only with keys headline and description.',
          'Headline must be 70 characters or fewer.',
          'Description must be exactly two short sentences.',
          'Do not mention hotel names, prices, discounts, dates, availability, urgency, amenities, or superlatives.',
          'You may mention the city and star rating only if supplied.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          city: deal.city,
          hotel_name: deal.hotelName,
          stars: deal.stars,
          discount_pct: deal.discountPct,
          deal_price: { priceCents: deal.dealPriceCents, currency: 'USD' },
          median_price: { priceCents: deal.medianPriceCents, currency: 'USD' },
          check_in_window: deal.checkInWindow,
        }),
      },
    ],
  })

  const text = res.choices[0]?.message?.content?.trim()
  if (!text) return null

  try {
    return normalizeCopy(JSON.parse(text), deal)
  } catch {
    return null
  }
}

export async function generateHeadlines(deals: DealInput[]): Promise<void> {
  if (deals.length === 0) return

  await Promise.allSettled(
    deals.map(async (deal) => {
      const fallback = fallbackDealCopy(deal)
      try {
        const generated = await Promise.race([
          generateOne(deal),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ])
        const copy = generated ?? fallback
        await query(
          'UPDATE deals SET headline = $1, description = $2, updated_at = NOW() WHERE id = $3',
          [copy.headline, copy.description, deal.id]
        )
      } catch {
        await query(
          'UPDATE deals SET headline = $1, description = $2, updated_at = NOW() WHERE id = $3',
          [fallback.headline, fallback.description, deal.id]
        ).catch(() => undefined)
      }
    })
  )
}
