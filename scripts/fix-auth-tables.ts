/**
 * Fixes NextAuth table names and schema to match @auth/pg-adapter v1.x:
 *   - users, accounts, sessions  → plural (already done)
 *   - verification_token          → singular (revert the over-rename)
 *   - users.id                   → add DEFAULT gen_random_uuid()::TEXT
 */
import { query } from '../lib/db/client'

async function main(): Promise<void> {
  // 1. Rename verification_tokens → verification_token (adapter uses singular)
  const vtExists = await query(
    `SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='verification_tokens'`
  )
  if (vtExists.rowCount && vtExists.rowCount > 0) {
    await query(`ALTER TABLE verification_tokens RENAME TO verification_token`)
    console.log('renamed: verification_tokens → verification_token')
  } else {
    console.log('verification_token: already correct')
  }

  // 2. Add DEFAULT gen_random_uuid()::TEXT to users.id
  // Check if default already exists
  const hasDefault = await query<{ column_default: string | null }>(
    `SELECT column_default FROM information_schema.columns
     WHERE table_name='users' AND column_name='id'`
  )
  if (!hasDefault.rows[0]?.column_default) {
    await query(`ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid()::TEXT`)
    console.log('added DEFAULT gen_random_uuid()::TEXT to users.id')
  } else {
    console.log('users.id default: already set —', hasDefault.rows[0].column_default)
  }

  // Verify final state
  const tables = await query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
     WHERE schemaname='public'
       AND tablename IN ('users','accounts','sessions','verification_token')
     ORDER BY tablename`
  )
  console.log('\nAuth tables:', tables.rows.map(r => r.tablename).join(', '))

  const idCol = await query<{ column_default: string }>(
    `SELECT column_default FROM information_schema.columns
     WHERE table_name='users' AND column_name='id'`
  )
  console.log('users.id default:', idCol.rows[0]?.column_default)
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
