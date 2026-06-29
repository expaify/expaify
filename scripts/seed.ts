import { readFileSync } from 'fs';
import { join } from 'path';
import { query } from '../lib/db/client';

async function main(): Promise<void> {
  const schemaPath = join(__dirname, '../lib/db/schema.sql');
  const sql = readFileSync(schemaPath, 'utf8');

  await query(sql);
  console.log('Schema ready');

  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
