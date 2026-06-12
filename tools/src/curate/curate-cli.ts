import { createDb, ensureSchema, productsRaw } from "@nordhem/db";
import { CATEGORIES } from "./categories.ts";
import { selectShopProducts } from "./select.ts";
import { writeShopProducts } from "./write.ts";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";
const perCategory = Number(process.env.PER_CATEGORY ?? 100);
const dryRun = process.argv.includes("--dry-run");

const { db, close } = createDb(databaseUrl);
try {
  await ensureSchema(db);
  const candidates = await db
    .select({
      productId: productsRaw.productId,
      name: productsRaw.name,
      productClass: productsRaw.productClass,
      description: productsRaw.description,
      ratingCount: productsRaw.ratingCount,
    })
    .from(productsRaw);

  const curated = selectShopProducts(candidates, perCategory);
  console.log(`curation plan (${perCategory} per category${dryRun ? ", dry run" : ""}):`);
  for (const cat of CATEGORIES) {
    const n = curated.filter((p) => p.category === cat.slug).length;
    console.log(`  ${cat.slug.padEnd(12)} ${n}`);
  }
  console.log(`  total        ${curated.length}`);

  if (dryRun) {
    console.log("dry run: nothing written");
  } else {
    const written = await writeShopProducts(db, curated);
    console.log(`wrote ${written} rows to shop_products`);
  }
} finally {
  await close();
}
