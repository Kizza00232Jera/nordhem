import { sql } from "drizzle-orm";
import type { Db } from "./client.ts";

/**
 * Idempotent schema bootstrap. Deliberately not drizzle-kit migrations yet:
 * a handful of tables, no evolution history to manage. Proper migration
 * files start in step 5 when user/order tables make schema changes routine.
 * Must stay in sync with ./schema.ts.
 */
export async function ensureSchema(db: Db): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS products_raw (
      product_id integer PRIMARY KEY,
      name text NOT NULL,
      product_class text,
      category_hierarchy text,
      description text,
      features text,
      rating_count double precision,
      average_rating double precision,
      review_count double precision
    )
  `);
}
