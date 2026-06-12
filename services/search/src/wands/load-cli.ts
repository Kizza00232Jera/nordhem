import { readFile } from "node:fs/promises";
import path from "node:path";
import { createDb, ensureSchema } from "@nordhem/db";
import { loadProducts } from "./load.ts";
import { parseProductsTsv } from "./parse.ts";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";
const productsFile = path.resolve(
  import.meta.dirname,
  "../../../../data/wands/product.csv",
);

const { db, close } = createDb(databaseUrl);
try {
  await ensureSchema(db);
  const products = parseProductsTsv(await readFile(productsFile, "utf8"));
  const count = await loadProducts(db, products);
  console.log(`loaded ${count} products into products_raw`);
} finally {
  await close();
}
