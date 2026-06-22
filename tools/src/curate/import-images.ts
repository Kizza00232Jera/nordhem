import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createDb, productImages, sql } from "@nordhem/db";

/**
 * Restores product_images from the committed images-snapshot.json so a fresh
 * Docker volume (or production) reproduces the exact judged photos instead of
 * re-fetching live, non-deterministic Unsplash/Pexels results. Upserts by
 * product_id — overwrites whatever is there with the snapshot.
 *
 * The snapshot is the output of the offline image-judge pass: each curated
 * product's photo was checked by an LLM-as-judge against the product (correct
 * type, colour, clean presentation) and the kept image was frozen here.
 *
 * Prereq: shop_products must already exist (product_images references it), so
 * run after curate-shop and BEFORE index-shop (the shop index bakes in the
 * thumb URL from this table).
 *
 *   pnpm -F @nordhem/tools import-images
 *   DATABASE_URL=<neon-url> pnpm -F @nordhem/tools import-images   # to production
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  // fine — DATABASE_URL may come from the environment
}

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";

const SNAPSHOT = join(import.meta.dirname, "images-snapshot.json");

interface Row {
  productId: number;
  url: string;
  thumbUrl: string;
  photographerName: string;
  photographerUrl: string;
  source: string;
  searchQuery: string;
  status: string;
}

const rows = JSON.parse(await readFile(SNAPSHOT, "utf8")) as Row[];
if (rows.length === 0) {
  console.error("snapshot is empty — nothing to import");
  process.exit(0);
}

const { db, close } = createDb(databaseUrl);
try {
  await db
    .insert(productImages)
    .values(rows)
    .onConflictDoUpdate({
      target: productImages.productId,
      set: {
        url: sql`excluded.url`,
        thumbUrl: sql`excluded.thumb_url`,
        photographerName: sql`excluded.photographer_name`,
        photographerUrl: sql`excluded.photographer_url`,
        source: sql`excluded.source`,
        searchQuery: sql`excluded.search_query`,
        status: sql`excluded.status`,
      },
    });
  console.log(`imported ${rows.length} product_images rows from the snapshot`);
} finally {
  await close();
}
