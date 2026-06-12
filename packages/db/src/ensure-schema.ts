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
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS shop_products (
      product_id integer PRIMARY KEY REFERENCES products_raw(product_id),
      slug text NOT NULL UNIQUE,
      category text NOT NULL,
      price_cents integer NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS product_images (
      product_id integer PRIMARY KEY REFERENCES shop_products(product_id) ON DELETE CASCADE,
      url text NOT NULL,
      thumb_url text NOT NULL,
      photographer_name text NOT NULL,
      photographer_url text NOT NULL,
      source text NOT NULL,
      search_query text NOT NULL,
      status text NOT NULL DEFAULT 'auto'
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS photo_pool (
      id serial PRIMARY KEY,
      search_query text NOT NULL,
      url text NOT NULL,
      thumb_url text NOT NULL,
      photographer_name text NOT NULL,
      photographer_url text NOT NULL,
      source text NOT NULL
    )
  `);
}
