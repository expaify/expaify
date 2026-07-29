/* Throwaway UXR go/no-go query. Read-only. Delete after run. */
import { Pool } from 'pg'
import { readFileSync } from 'fs'

const env = readFileSync('/Users/admin/dev/expaify/.env.local', 'utf8')
const url = env.split('\n').find((l) => l.startsWith('DATABASE_URL='))!.slice('DATABASE_URL='.length).trim()
const pool = new Pool({ connectionString: url })

async function q(label: string, sql: string) {
  try {
    const r = await pool.query(sql)
    console.log('\n=== ' + label + ' ===')
    console.log(JSON.stringify(r.rows, null, 2))
  } catch (e) {
    console.log('\n=== ' + label + ' === ERROR: ' + (e as Error).message)
  }
}

async function main() {
  await q('deals columns', `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='deals' ORDER BY ordinal_position`)
  await q('deal lifespan', `SELECT min(first_seen) AS oldest, max(first_seen) AS newest, max(updated_at) AS last_update, count(DISTINCT market_id) AS markets FROM deals`)
  await q('deals by week', `SELECT date_trunc('week', first_seen) AS wk, count(*) FROM deals GROUP BY 1 ORDER BY 1 DESC LIMIT 8`)
  await q('subscriptions/users volume', `SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM subscriptions) AS subs`)
  await pool.end()
}
main()
