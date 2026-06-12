export { createDb, type Db } from "./client.ts";
export { ensureSchema } from "./ensure-schema.ts";
export * from "./schema.ts";

// Query operators re-exported so consumers don't need their own
// drizzle-orm dependency (one version, owned here).
export { and, asc, desc, eq, ilike, inArray, isNull, notInArray, sql } from "drizzle-orm";
