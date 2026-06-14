import { curations, eq, inArray, productImages, productsRaw, shopProducts } from "@nordhem/db";
import { db } from "./db";

export function normalizeCurationQuery(q: string): string {
  return q.trim().toLowerCase();
}

export interface CurationData {
  pinned: number[];
  hidden: number[];
}

export async function getCuration(query: string): Promise<CurationData> {
  const [row] = await db()
    .select()
    .from(curations)
    .where(eq(curations.query, normalizeCurationQuery(query)));
  return { pinned: row?.pinned ?? [], hidden: row?.hidden ?? [] };
}

export async function saveCuration(query: string, data: CurationData): Promise<void> {
  const key = normalizeCurationQuery(query);
  // Empty curation = no rule; delete the row so the query falls back to ranking.
  if (data.pinned.length === 0 && data.hidden.length === 0) {
    await db().delete(curations).where(eq(curations.query, key));
    return;
  }
  await db()
    .insert(curations)
    .values({ query: key, pinned: data.pinned, hidden: data.hidden, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: curations.query,
      set: { pinned: data.pinned, hidden: data.hidden, updatedAt: new Date() },
    });
}

export interface ProductCard {
  id: number;
  name: string;
  slug: string | null;
  priceCents: number | null;
  imageThumbUrl: string | null;
}

/** Hydrate product cards for a set of ids (for rendering pinned/hidden items). */
export async function cardsByIds(ids: number[]): Promise<ProductCard[]> {
  if (ids.length === 0) return [];
  const rows = await db()
    .select({
      id: shopProducts.productId,
      name: productsRaw.name,
      slug: shopProducts.slug,
      priceCents: shopProducts.priceCents,
      imageThumbUrl: productImages.thumbUrl,
    })
    .from(shopProducts)
    .innerJoin(productsRaw, eq(shopProducts.productId, productsRaw.productId))
    .leftJoin(productImages, eq(shopProducts.productId, productImages.productId))
    .where(inArray(shopProducts.productId, ids));
  return rows.map((r) => ({ ...r, imageThumbUrl: r.imageThumbUrl ?? null }));
}
