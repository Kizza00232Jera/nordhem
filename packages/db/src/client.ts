import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export type Db = ReturnType<typeof buildDb>;

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
