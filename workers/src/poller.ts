import pg from "pg";
import { indexRepository } from "./indexer.js";

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://codeatlas:codeatlas@localhost:5432/codeatlas",
});

const inFlight = new Set<string>();

export async function pollPendingRepositories() {
  const result = await pool.query<{ id: string; user_id: string }>(
    `SELECT id, user_id FROM repositories
     WHERE status = 'pending'
     ORDER BY created_at ASC
     LIMIT 3`
  );

  for (const row of result.rows) {
    if (inFlight.has(row.id)) continue;
    inFlight.add(row.id);
    indexRepository(row.id, row.user_id)
      .catch(() => undefined)
      .finally(() => inFlight.delete(row.id));
  }
}
