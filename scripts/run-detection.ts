/**
 * Runs deal detection locally against the Neon DB.
 * Usage: DATABASE_URL=<url> npx tsx scripts/run-detection.ts
 */
import { getActiveMarkets } from '../lib/pipeline/snapshot'
import { detectDealsForMarket, getActiveDeals } from '../lib/pipeline/dealDetection'

async function main(): Promise<void> {
  const markets = await getActiveMarkets()
  console.log(`Running deal detection for ${markets.length} markets…\n`)

  let total = 0
  for (const market of markets) {
    const n = await detectDealsForMarket(market)
    console.log(`  ${market.iata}: ${n} deals`)
    total += n
  }

  console.log(`\nTotal deals upserted: ${total}`)

  // Show top 10
  const deals = await getActiveDeals({ limit: 10, sort: 'newest', includeMock: false })
  console.log(`\nTop ${deals.length} active real deals:`)
  for (const d of deals) {
    console.log(`  [${d.city}] ${d.hotel_name} — ${d.discount_pct}% off — $${(d.deal_price_cents / 100).toFixed(0)}/nt  id=${d.id}`)
  }

  process.exit(0)
}

main().catch(err => {
  console.error('run-detection failed:', err)
  process.exit(1)
})
