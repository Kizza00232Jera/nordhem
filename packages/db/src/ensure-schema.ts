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
  // Better Auth core tables (D42). Columns mirror schema.ts exactly; "user"
  // is quoted because it is a reserved word in Postgres.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "user" (
      id text PRIMARY KEY,
      name text NOT NULL,
      email text NOT NULL UNIQUE,
      email_verified boolean NOT NULL DEFAULT false,
      image text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS session (
      id text PRIMARY KEY,
      expires_at timestamp NOT NULL,
      token text NOT NULL UNIQUE,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      ip_address text,
      user_agent text,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS account (
      id text PRIMARY KEY,
      account_id text NOT NULL,
      provider_id text NOT NULL,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      access_token text,
      refresh_token text,
      id_token text,
      access_token_expires_at timestamp,
      refresh_token_expires_at timestamp,
      scope text,
      password text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS verification (
      id text PRIMARY KEY,
      identifier text NOT NULL,
      value text NOT NULL,
      expires_at timestamp NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
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
