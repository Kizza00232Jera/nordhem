import {
  asc,
  desc,
  eq,
  inArray,
  productImages,
  productsRaw,
  shopProducts,
} from "@nordhem/db";
import { db } from "./db";

const cardColumns = {
  productId: shopProducts.productId,
  slug: shopProducts.slug,
  category: shopProducts.category,
  priceCents: shopProducts.priceCents,
  name: productsRaw.name,
  averageRating: productsRaw.averageRating,
  ratingCount: productsRaw.ratingCount,
  imageUrl: productImages.url,
  imageThumbUrl: productImages.thumbUrl,
};

export type ProductCard = {
  productId: number;
  slug: string;
  category: string;
  priceCents: number;
  name: string;
  averageRating: number | null;
  ratingCount: number | null;
  imageUrl: string | null;
  imageThumbUrl: string | null;
};

function baseQuery() {
  return db()
    .select(cardColumns)
    .from(shopProducts)
    .innerJoin(productsRaw, eq(shopProducts.productId, productsRaw.productId))
    .leftJoin(productImages, eq(shopProducts.productId, productImages.productId));
}

export async function productsByCategory(category: string): Promise<ProductCard[]> {
  return baseQuery()
    .where(eq(shopProducts.category, category))
    .orderBy(desc(productsRaw.ratingCount), asc(shopProducts.productId));
}

/**
 * Cards for a set of product ids, returned in the SAME order as `ids` (the
 * favorites page wants newest-favorited first, which the DB won't preserve).
 * One query, then reordered in memory.
 */
export async function productsByIds(ids: number[]): Promise<ProductCard[]> {
  if (ids.length === 0) return [];
  const rows = await baseQuery().where(inArray(shopProducts.productId, ids));
  const byId = new Map(rows.map((r) => [r.productId, r]));
  return ids.map((id) => byId.get(id)).filter((p): p is ProductCard => !!p);
}

export async function featuredProducts(limit = 8): Promise<ProductCard[]> {
  return baseQuery()
    .orderBy(desc(productsRaw.ratingCount), asc(shopProducts.productId))
    .limit(limit);
}

export async function categoryShowcase(): Promise<Map<string, ProductCard>> {
  // Best-rated product per category — the home page category tile images.
  const all = await baseQuery().orderBy(
    desc(productsRaw.ratingCount),
    asc(shopProducts.productId),
  );
  const byCategory = new Map<string, ProductCard>();
  for (const p of all) {
    if (!byCategory.has(p.category)) byCategory.set(p.category, p);
  }
  return byCategory;
}

export type ProductDetail = ProductCard & {
  description: string | null;
  features: string | null;
  photographerName: string | null;
  photographerUrl: string | null;
  imageSource: string | null;
};

export async function productBySlug(slug: string): Promise<ProductDetail | null> {
  const rows = await db()
    .select({
      ...cardColumns,
      description: productsRaw.description,
      features: productsRaw.features,
      photographerName: productImages.photographerName,
      photographerUrl: productImages.photographerUrl,
      imageSource: productImages.source,
    })
    .from(shopProducts)
    .innerJoin(productsRaw, eq(shopProducts.productId, productsRaw.productId))
    .leftJoin(productImages, eq(shopProducts.productId, productImages.productId))
    .where(eq(shopProducts.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}
