import type { Db } from "../db/client.ts";
import { productsRaw } from "../db/schema.ts";
import type { RawProduct } from "./parse.ts";

const BATCH_SIZE = 1_000;

/**
 * Truncate-and-reload: the raw table is a faithful copy of the dataset,
 * so a reload replaces it wholesale inside one transaction. Returns the
 * number of products inserted.
 */
export async function loadProducts(
  db: Db,
  products: RawProduct[],
): Promise<number> {
  await db.transaction(async (tx) => {
    await tx.delete(productsRaw);
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      await tx.insert(productsRaw).values(products.slice(i, i + BATCH_SIZE));
    }
  });
  return products.length;
}
