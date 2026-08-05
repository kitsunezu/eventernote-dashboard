import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import type { Pool } from 'pg'

const { Pool: PostgresPool } = pg

export function createPool(databaseUrl?: string): Pool {
  const pool = new PostgresPool({
    ...(databaseUrl ? { connectionString: databaseUrl } : {}),
    max: 10,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  })
  pool.on('error', (error) => {
    console.error('Unexpected PostgreSQL pool error', error)
  })
  return pool
}

export async function migrate(pool: Pool): Promise<void> {
  const schemaPath = fileURLToPath(new URL('./db/schema.sql', import.meta.url))
  const sql = await readFile(schemaPath, 'utf8')
  await pool.query(sql)
}
