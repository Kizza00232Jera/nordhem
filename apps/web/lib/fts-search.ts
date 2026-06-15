import {
  eq,
  productImages,
  productsRaw,
  shopProducts,
  sql,
  type Db,
} from "@nordhem/db";
import type { SearchHit, SearchResponse } from "@nordhem/shared";

/**
 * Lite-mode search (D12): Postgres full-text search over the shop catalog, used
 * when the circuit breaker has decided the PC Elasticsearch service is
 * unreachable. It matches and stems with `plainto_tsquery('english', ...)` and
 * ranks with `ts_rank`. Honestly degraded: no facets, no synonyms, no semantic
 * recall. The response is labelled `mode: "fallback"` so the UI can say so.
 */
export interface FtsParams {
  page?: number;
  size?: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export async function ftsSearchShop(
  db: Db,
  query: string,
  params: FtsParams = {},
): Promise<SearchResponse> {
  const size = clamp(Math.trunc(params.size ?? 24), 1, 100);
  const page = Math.max(1, Math.trunc(params.page ?? 1));
  const offset = (page - 1) * size;
  const started = Date.now();

  // The searchable document: name + description + category, English-analyzed.
  const tsv = sql`to_tsvector('english', coalesce(${productsRaw.name}, '') || ' ' || coalesce(${productsRaw.description}, '') || ' ' || coalesce(${shopProducts.category}, ''))`;
  // OR semantics: plainto_tsquery ANDs the terms, so a two-word query like
  // "oak bed" returns nothing unless one product contains both. A fallback
  // should favour recall, so rewrite the AND query to OR (ts_rank still ranks
  // products matching more terms higher). plainto_tsquery sanitizes the input,
  // so rewriting its text output stays injection-safe.
  const tsq = sql`replace(plainto_tsquery('english', ${query})::text, '&', '|')::tsquery`;
  const match = sql`${tsv} @@ ${tsq}`;
  const rank = sql<number>`ts_rank(${tsv}, ${tsq})`;

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(shopProducts)
    .innerJoin(productsRaw, eq(productsRaw.productId, shopProducts.productId))
    .where(match);
  const total = Number(countRow?.total ?? 0);

  const rows = total
    ? await db
        .select({
          id: shopProducts.productId,
          name: productsRaw.name,
          description: productsRaw.description,
          productClass: productsRaw.productClass,
          slug: shopProducts.slug,
          category: shopProducts.category,
          priceCents: shopProducts.priceCents,
          imageThumbUrl: productImages.thumbUrl,
          score: rank,
        })
        .from(shopProducts)
        .innerJoin(productsRaw, eq(productsRaw.productId, shopProducts.productId))
        .leftJoin(productImages, eq(productImages.productId, shopProducts.productId))
        .where(match)
        .orderBy(sql`${rank} desc`, shopProducts.productId)
        .limit(size)
        .offset(offset)
    : [];

  const hits: SearchHit[] = rows.map((r) => ({
    id: String(r.id),
    name: r.name,
    productClass: r.productClass,
    description: r.description,
    score: Number(r.score),
    slug: r.slug,
    category: r.category,
    priceCents: r.priceCents,
    imageThumbUrl: r.imageThumbUrl ?? null,
  }));

  return { query, mode: "fallback", total, tookMs: Date.now() - started, hits };
}
