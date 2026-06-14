import {
  createDb,
  eq,
  productImages,
  productsRaw,
  shopProducts,
} from "@nordhem/db";
import { extractColor, extractMaterial } from "../wands/features.ts";
import { createEsClient } from "./client.ts";
import { indexShopDocuments } from "./indexer.ts";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";
const esUrl = process.env.ES_URL ?? "http://localhost:9200";
const index = process.env.SHOP_INDEX ?? "products-shop";

const { db, close } = createDb(databaseUrl);
try {
  const rows = await db
    .select({
      product_id: shopProducts.productId,
      name: productsRaw.name,
      product_class: productsRaw.productClass,
      description: productsRaw.description,
      features: productsRaw.features,
      slug: shopProducts.slug,
      category: shopProducts.category,
      price_cents: shopProducts.priceCents,
      image_thumb_url: productImages.thumbUrl,
    })
    .from(shopProducts)
    .innerJoin(productsRaw, eq(shopProducts.productId, productsRaw.productId))
    .leftJoin(productImages, eq(shopProducts.productId, productImages.productId));

  console.log(`read ${rows.length} shop products from postgres`);
  const es = createEsClient(esUrl);
  // Derive the colour/material facet values from the WANDS features blob.
  const docs = rows.map(({ features, ...row }) => ({
    ...row,
    color: extractColor(features),
    material: extractMaterial(features),
  }));
  // Pass --embed to store e5 vectors so the storefront can offer semantic and
  // hybrid modes; the shop index is small (~hundreds), so this is quick.
  const embed = process.argv.includes("--embed");
  const indexed = await indexShopDocuments(es, index, docs, { embed });
  console.log(`indexed ${indexed} products into "${index}"${embed ? " with embeddings" : ""}`);
} finally {
  await close();
}
