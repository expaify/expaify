import { Pool, QueryResult, QueryResultRow } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function query<T extends QueryResultRow = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}
