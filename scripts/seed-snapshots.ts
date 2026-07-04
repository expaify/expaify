/**
 * Seeds MOCK "historical high-price" rows for the past days so deal detection
 * can be exercised end-to-end against today's real prices.
 *
 * Backfills enough snapshot days to clear the MIN_SNAPSHOTS floor.
 * Seeded rows are always is_mock = true: deals derived from them inherit the
 * mock flag (bool_or in detection) and are excluded from the production feed.
 * Never inserts or deletes is_mock = false rows — real history is untouchable.
 *
 * Logic: backfill days = 1.8x–2.5x today's real price
 *        → median lands well above today → ratio ≲ 0.55 → triggers ≤0.70 threshold
 *
 * Usage: DATABASE_URL=<url> npx tsx scripts/seed-snapshots.ts
 */
import { query } from '../lib/db/client'
import { MIN_SNAPSHOTS } from '../lib/pipeline/dealRules'

// Today's real row + this many mock backfill days must clear the floor
const BACKFILL_DAYS = MIN_SNAPSHOTS

async function main(): Promise<void> {
  // Show current state
  const before = await query<{ snapshot_date: string; cnt: string }>(
    `SELECT snapshot_date::TEXT, COUNT(*) AS cnt
     FROM price_snapshots
     WHERE snapshot_date >= CURRENT_DATE - ${BACKFILL_DAYS + 1} AND is_mock = false
     GROUP BY snapshot_date ORDER BY snapshot_date`
  )
  console.log('Before (real rows):')
  before.rows.forEach(r => console.log(`  ${r.snapshot_date}: ${r.cnt} rows`))

  // Delete previously-seeded mock backfill rows only — never real data
  const del = await query(
    `DELETE FROM price_snapshots
     WHERE snapshot_date < CURRENT_DATE AND is_mock = true`
  )
  console.log(`\nDeleted stale mock backfill rows: ${del.rowCount ?? 0}`)

  // Backfill: past days priced at 1.8x–2.5x today's real price (historical peak),
  // flagged is_mock = true so derived deals stay out of the production feed
  let seeded = 0
  for (let day = 1; day <= BACKFILL_DAYS; day++) {
    const ins = await query(
      `INSERT INTO price_snapshots
         (hotel_id, hotel_name, stars, photo_url, market_id, check_in, nights,
          price_cents, currency, snapshot_date, is_mock, captured_at)
       SELECT
         hotel_id, hotel_name, stars, photo_url, market_id, check_in, nights,
         GREATEST(1000, ROUND(price_cents * (1.80 + random() * 0.70))::INT),
         currency,
         CURRENT_DATE - $1::INT,
         true,
         NOW() - ($1::INT * INTERVAL '24 hours') - INTERVAL '1 hour'
       FROM price_snapshots
       WHERE snapshot_date = CURRENT_DATE AND is_mock = false
       ON CONFLICT ON CONSTRAINT price_snapshots_unique DO NOTHING`,
      [day]
    )
    seeded += ins.rowCount ?? 0
  }
  console.log(`Seeded mock high-price backfill rows: ${seeded}`)

  // Count combos that now clear the detection floor
  const eligible = await query<{ total: string }>(
    `SELECT COUNT(*) AS total FROM (
       SELECT hotel_id, market_id, check_in
       FROM price_snapshots
       WHERE check_in >= CURRENT_DATE
       GROUP BY hotel_id, market_id, check_in
       HAVING COUNT(DISTINCT snapshot_date) >= ${MIN_SNAPSHOTS}
     ) q`
  )
  console.log(`\nEligible for detection (≥${MIN_SNAPSHOTS} snapshot days): ${eligible.rows[0]?.total ?? 0}`)

  process.exit(0)
}

main().catch(err => {
  console.error('seed-snapshots failed:', err)
  process.exit(1)
})
