import { createDb } from "../db/client.ts";
import { createEsClient } from "./client.ts";
import { indexProducts } from "./indexer.ts";
import { productsRaw } from "../db/schema.ts";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";
const esUrl = process.env.ES_URL ?? "http://localhost:9200";
const index = process.env.SEARCH_INDEX ?? "products";

const { db, close } = createDb(databaseUrl);
try {
  const products = await db.select().from(productsRaw);
  console.log(`read ${products.length} products from postgres`);
  const es = createEsClient(esUrl);
  const indexed = await indexProducts(es, index, products);
  console.log(`indexed ${indexed} products into "${index}"`);
} finally {
  await close();
}
