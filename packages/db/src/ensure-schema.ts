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

  // Step 5 commerce tables (D43, D44). Mirror schema.ts exactly.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cart (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id text UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cart_items (
      cart_id uuid NOT NULL REFERENCES cart(id) ON DELETE CASCADE,
      product_id integer NOT NULL REFERENCES shop_products(product_id) ON DELETE CASCADE,
      quantity integer NOT NULL,
      PRIMARY KEY (cart_id, product_id)
    )
  `);
  await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_number text NOT NULL UNIQUE,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'paid',
      ship_full_name text NOT NULL,
      ship_line1 text NOT NULL,
      ship_line2 text,
      ship_city text NOT NULL,
      ship_postal_code text NOT NULL,
      ship_country text NOT NULL,
      subtotal_cents integer NOT NULL,
      shipping_cents integer NOT NULL,
      total_cents integer NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS order_items (
      id serial PRIMARY KEY,
      order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id integer NOT NULL,
      name_snapshot text NOT NULL,
      slug_snapshot text NOT NULL,
      image_url_snapshot text,
      unit_price_cents integer NOT NULL,
      quantity integer NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS favorites (
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      product_id integer NOT NULL REFERENCES shop_products(product_id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, product_id)
    )
  `);

  // Step 6 relevance lab: WANDS evaluation set. Mirror schema.ts exactly.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS eval_queries (
      query_id integer PRIMARY KEY,
      query text NOT NULL,
      query_class text
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS eval_judgments (
      query_id integer NOT NULL REFERENCES eval_queries(query_id) ON DELETE CASCADE,
      product_id integer NOT NULL,
      grade integer NOT NULL,
      PRIMARY KEY (query_id, product_id)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS eval_runs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      label text NOT NULL,
      index_name text NOT NULL,
      query_count integer NOT NULL,
      ndcg double precision NOT NULL,
      mrr double precision NOT NULL,
      recall double precision NOT NULL,
      config jsonb NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS eval_query_scores (
      run_id uuid NOT NULL REFERENCES eval_runs(id) ON DELETE CASCADE,
      query_id integer NOT NULL,
      ndcg double precision NOT NULL,
      rr double precision NOT NULL,
      recall double precision NOT NULL,
      PRIMARY KEY (run_id, query_id)
    )
  `);

  // Step 9 editor tools: synonym rules. Mirror schema.ts exactly.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS synonym_rules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      kind text NOT NULL,
      terms text NOT NULL,
      maps_to text,
      enabled boolean NOT NULL DEFAULT true,
      source text NOT NULL DEFAULT 'manual',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  // Step 9 editor tools: per-query curations (pin/hide). Mirror schema.ts.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS curations (
      query text PRIMARY KEY,
      pinned jsonb NOT NULL DEFAULT '[]'::jsonb,
      hidden jsonb NOT NULL DEFAULT '[]'::jsonb,
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  // Step 9 editor tools: change history (audit log). Mirror schema.ts.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS change_log (
      id serial PRIMARY KEY,
      entity text NOT NULL,
      action text NOT NULL,
      summary text NOT NULL,
      detail jsonb,
      actor text NOT NULL DEFAULT 'editor',
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);

  // Step 10 analytics: first-party search telemetry. Mirror schema.ts exactly.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS search_events (
      id serial PRIMARY KEY,
      type text NOT NULL,
      query text NOT NULL,
      mode text,
      result_count integer,
      zero_result boolean,
      product_id integer,
      position integer,
      latency_ms integer,
      source text NOT NULL DEFAULT 'live',
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS search_events_type_idx ON search_events (type)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS search_events_query_idx ON search_events (query)`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS search_events_created_idx ON search_events (created_at)`,
  );

  // Step 11a learning loop: the click-affinity table. Mirror schema.ts exactly.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS click_affinity (
      query text NOT NULL,
      product_id integer NOT NULL,
      observations integer NOT NULL,
      raw_score double precision NOT NULL,
      affinity double precision NOT NULL,
      source text NOT NULL DEFAULT 'live',
      updated_at timestamp NOT NULL DEFAULT now(),
      PRIMARY KEY (query, product_id)
    )
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS click_affinity_query_idx ON click_affinity (query)`,
  );
}
