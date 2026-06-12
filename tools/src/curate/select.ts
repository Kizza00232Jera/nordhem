import { categorize } from "./categories.ts";
import { syntheticPriceCents } from "./price.ts";

export interface ShopCandidate {
  productId: number;
  name: string;
  productClass: string | null;
  description: string | null;
  ratingCount: number | null;
}

export interface CuratedProduct {
  productId: number;
  slug: string;
  category: string;
  priceCents: number;
}

export function slugifyName(name: string, productId: number): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${productId}`;
}

/**
 * Deterministic curation: per category, prefer products that have a
 * description (they make a real PDP), then higher rating counts (a
 * popularity proxy), then productId as the total-order tie-break.
 * Same input always yields the same shop catalog.
 */
export function selectShopProducts(
  candidates: ShopCandidate[],
  perCategory: number,
): CuratedProduct[] {
  const byCategory = new Map<string, ShopCandidate[]>();
  for (const c of candidates) {
    const category = categorize(c.productClass);
    if (category === null) continue;
    let bucket = byCategory.get(category);
    if (!bucket) byCategory.set(category, (bucket = []));
    bucket.push(c);
  }

  const picked: CuratedProduct[] = [];
  for (const [category, bucket] of byCategory) {
    bucket.sort((a, b) => {
      const descDiff = Number(b.description !== null) - Number(a.description !== null);
      if (descDiff !== 0) return descDiff;
      const ratingDiff = (b.ratingCount ?? -1) - (a.ratingCount ?? -1);
      if (ratingDiff !== 0) return ratingDiff;
      return a.productId - b.productId;
    });
    for (const c of bucket.slice(0, perCategory)) {
      picked.push({
        productId: c.productId,
        slug: slugifyName(c.name, c.productId),
        category,
        priceCents: syntheticPriceCents(c.productId, category),
      });
    }
  }
  return picked;
}
