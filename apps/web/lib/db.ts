import { createDb, type Db } from "@nordhem/db";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";

// One connection pool per server process; survives Next dev HMR reloads
// via globalThis (the standard Next + ORM singleton pattern).
const globalForDb = globalThis as unknown as { __nordhemDb?: Db };

export function db(): Db {
  if (!globalForDb.__nordhemDb) {
    globalForDb.__nordhemDb = createDb(DATABASE_URL).db;
  }
  return globalForDb.__nordhemDb;
}
