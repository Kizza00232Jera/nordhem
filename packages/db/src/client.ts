import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export type Db = ReturnType<typeof buildDb>;

/** The transaction handle drizzle hands to db.transaction(async (tx) => ...). */
export type DbTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Either a pooled connection or an open transaction. Repo functions take this
 * so the same helper works standalone and inside db.transaction().
 */
export type DbOrTx = Db | DbTx;

function buildDb(sql: ReturnType<typeof postgres>) {
  return drizzle(sql, { schema });
}

export function createDb(databaseUrl: string): {
  db: Db;
  close: () => Promise<void>;
} {
  const sql = postgres(databaseUrl, { onnotice: () => {} });
  return {
    db: buildDb(sql),
    close: () => sql.end(),
  };
}
