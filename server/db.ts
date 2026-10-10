/**
 * Acesso ao PostgreSQL com `pg` (mesmo padrão do iVent NeoPed).
 * Todas as consultas são parametrizadas — nenhum valor é interpolado em SQL.
 */
import pg from "pg";
import type { PoolClient, QueryResultRow } from "pg";

// NUMERIC chega como string por padrão; as notas cabem com folga em double.
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
// BIGINT (contagens) também vira número.
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

let pool: pg.Pool | null = null;

export function initPool(connectionString: string, ssl: boolean): pg.Pool {
  if (pool) return pool;
  pool = new pg.Pool({
    connectionString,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  });
  return pool;
}

export function getPool(): pg.Pool {
  if (!pool) throw new Error("Pool do banco não inicializado");
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export type Queryable = Pick<PoolClient, "query">;

export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = [], db: Queryable = getPool()): Promise<T[]> {
  const result = await db.query<T>(sql, params);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow>(sql: string, params: unknown[] = [], db: Queryable = getPool()): Promise<T | null> {
  const rows = await query<T>(sql, params, db);
  return rows[0] ?? null;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
