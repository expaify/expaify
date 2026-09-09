import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
  const client = await pool.connect();
  try {
    const schema = readFileSync(resolve('lib/db/schema.sql'), 'utf8');
    const migration = schema.split('-- BEGIN complete-alert-contract migration')[1]?.split('-- END complete-alert-contract migration')[0];
    if (!migration) throw new Error('Alert migration not found');
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '15s'");
    await client.query('LOCK TABLE price_alerts IN ACCESS EXCLUSIVE MODE');
    await client.query(`-- BEGIN complete-alert-contract migration${migration}`);
    const result = await client.query("SELECT retired_rows, applied_at FROM alert_contract_migrations WHERE id = 'complete-alert-contract-v1'");
    await client.query('COMMIT');
    console.log(JSON.stringify({ migration: 'complete-alert-contract-v1', ...result.rows[0] }));
  } catch {
    await client.query('ROLLBACK');
    throw new Error('Alert migration failed; transaction rolled back');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(() => { console.warn('Alert migration failed (credential details suppressed)'); process.exitCode = 1; });
