import { shopProducts, type Db } from "@nordhem/db";
import type { CuratedProduct } from "./select.ts";

const BATCH_SIZE = 500;

/**
 * Truncate-and-reload, same semantics as the raw loader: the shop catalog
 * is a derived, deterministic selection, so a re-curation replaces it
 * wholesale. product_images cascade away on delete — image assignment
 * re-runs after curation by design.
 */
export async function writeShopProducts(
  db: Db,
  products: CuratedProduct[],
): Promise<number> {
  await db.transaction(async (tx) => {
    await tx.delete(shopProducts);
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      await tx.insert(shopProducts).values(products.slice(i, i + BATCH_SIZE));
    }
  });
  return products.length;
}
