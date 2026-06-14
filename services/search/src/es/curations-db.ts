import { curations, eq, type Db } from "@nordhem/db";
import { normalizeCurationQuery, type Curation } from "../search/curate.ts";

/**
 * Load the curation for a query (Step 9), or undefined if none. Read on every
 * shop search, keyed by the normalized query, so an editor's pin/hide takes
 * effect on the very next search with no reindex and no analyzer reload.
 */
export async function loadCuration(db: Db, query: string): Promise<Curation | undefined> {
  const [row] = await db
    .select()
    .from(curations)
    .where(eq(curations.query, normalizeCurationQuery(query)));
  if (!row) return undefined;
  return { pinned: row.pinned ?? [], hidden: row.hidden ?? [] };
}
