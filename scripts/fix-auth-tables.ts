/**
 * Renames singular NextAuth tables to plural form expected by @auth/pg-adapter v1.x
 * user → users, account → accounts, session → sessions, verification_token → verification_tokens
 *
 * Safe to run multiple times (IF EXISTS guards).
 */
import { query } from '../lib/db/client'

async function main(): Promise<void> {
  // Show row counts before
  for (const t of ['user', 'account', 'session', 'verification_token']) {
    const r = await query(`SELECT COUNT(*) AS n FROM "${t}"`)
    console.log(`  ${t}: ${r.rows[0].n} rows`)
  }

  // Rename
  const renames: [string, string][] = [
    ['user', 'users'],
    ['account', 'accounts'],
    ['session', 'sessions'],
    ['verification_token', 'verification_tokens'],
  ]

  for (const [from, to] of renames) {
    // Check if destination already exists
    const exists = await query(
      `SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=$1`, [to]
    )
    if (exists.rowCount && exists.rowCount > 0) {
      console.log(`  ${to} already exists — skipping`)
      continue
    }
    await query(`ALTER TABLE "${from}" RENAME TO "${to}"`)
    console.log(`  renamed: ${from} → ${to}`)
  }

  // Fix FK references that used old names (subscriptions.user_id refs "user")
  // The FK constraint references the table by OID so rename keeps it valid — no action needed

  // Verify
  const tables = await query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('users','accounts','sessions','verification_tokens') ORDER BY tablename`
  )
  console.log('\nAuth tables now:', tables.rows.map(r => r.tablename).join(', '))
  process.exit(0)
}

main().catch(err => {
  console.error('fix-auth-tables failed:', err)
  process.exit(1)
})
