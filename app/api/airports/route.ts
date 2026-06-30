import { NextRequest } from 'next/server'
import { AIRPORTS } from '@/lib/airports/data'

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase()
  if (q.length < 1) return Response.json([])

  const scored = AIRPORTS
    .map(a => {
      const iata = a.iata.toLowerCase()
      const city = a.city.toLowerCase()
      const name = a.name.toLowerCase()
      let score = 0
      if (iata === q) score = 100
      else if (iata.startsWith(q)) score = 90
      else if (city === q) score = 80
      else if (city.startsWith(q)) score = 70
      else if (city.includes(q)) score = 50
      else if (name.includes(q)) score = 30
      else return null
      return { ...a, score }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ score: _, ...a }) => a)

  return Response.json(scored)
}
