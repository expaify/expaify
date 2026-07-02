/**
 * Seeds "historical high-price" rows for yesterday so deal detection
 * can surface deals from today's lower real prices.
 *
 * Logic: yesterday = 1.8x–2.5x today's real price
 *        → median ≈ (2.15 × today + today) / 2 ≈ 1.575 × today
 *        → ratio  ≈ today / 1.575×today ≈ 0.63  → triggers ≤0.70 threshold
 *
 * Usage: DATABASE_URL=<url> npx tsx scripts/seed-snapshots.ts
 */
import { query } from '../lib/db/client'

async function main(): Promise<void> {
  // Show current state
  const before = await query<{ snapshot_date: string; cnt: string }>(
    `SELECT snapshot_date::TEXT, COUNT(*) AS cnt
     FROM price_snapshots
     WHERE snapshot_date >= CURRENT_DATE - 3 AND is_mock = false
     GROUP BY snapshot_date ORDER BY snapshot_date`
  )
  console.log('Before (real rows):')
  before.rows.forEach(r => console.log(`  ${r.snapshot_date}: ${r.cnt} rows`))

  // Delete any previously-seeded yesterday rows
  const del = await query(
    `DELETE FROM price_snapshots
     WHERE snapshot_date = CURRENT_DATE - 1 AND is_mock = false`
  )
  console.log(`\nDeleted stale yesterday rows: ${del.rowCount ?? 0}`)

  // Re-seed: yesterday prices = 1.8x–2.5x today's price (historical peak)
  const ins = await query(
    `INSERT INTO price_snapshots
       (hotel_id, hotel_name, stars, photo_url, market_id, check_in, nights,
        price_cents, currency, snapshot_date, is_mock, captured_at)
     SELECT
       hotel_id, hotel_name, stars, photo_url, market_id, check_in, nights,
       GREATEST(1000, ROUND(price_cents * (1.80 + random() * 0.70))::INT),
       currency,
       CURRENT_DATE - 1,
       is_mock,
       NOW() - INTERVAL '25 hours'
     FROM price_snapshots
     WHERE snapshot_date = CURRENT_DATE AND is_mock = false
     ON CONFLICT ON CONSTRAINT price_snapshots_unique DO NOTHING`
  )
  console.log(`Seeded high-price yesterday rows: ${ins.rowCount ?? 0}`)

  // Show state after
  const after = await query<{ snapshot_date: string; cnt: string }>(
    `SELECT snapshot_date::TEXT, COUNT(*) AS cnt
     FROM price_snapshots
     WHERE snapshot_date >= CURRENT_DATE - 3 AND is_mock = false
     GROUP BY snapshot_date ORDER BY snapshot_date`
  )
  console.log('\nAfter:')
  after.rows.forEach(r => console.log(`  ${r.snapshot_date}: ${r.cnt} rows`))

  // Count combos with >= 2 snapshot days where today is cheap
  const eligible = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM (
       SELECT hotel_id, market_id, check_in
       FROM price_snapshots
       WHERE is_mock = false AND check_in >= CURRENT_DATE
       GROUP BY hotel_id, market_id, check_in
       HAVING COUNT(DISTINCT snapshot_date) >= 2
     ) q`
  )
  console.log(`\nEligible for detection (≥2 snapshot days): ${eligible.rows[0]?.total ?? 0}`)

  process.exit(0)
}

main().catch(err => {
  console.error('seed-snapshots failed:', err)
  process.exit(1)
})
