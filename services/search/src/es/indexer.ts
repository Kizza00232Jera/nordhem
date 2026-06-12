import type { Client } from "@elastic/elasticsearch";
import type { RawProduct } from "../wands/parse.ts";

/**
 * The document shape in the products index. snake_case mirrors the
 * Postgres columns so PG rows, ES docs, and WANDS columns line up 1:1.
 */
export interface ProductDocument {
  product_id: number;
  name: string;
  product_class: string | null;
  category_hierarchy: string | null;
  description: string | null;
  features: string | null;
  rating_count: number | null;
  average_rating: number | null;
  review_count: number | null;
}

export function toDocument(p: RawProduct): ProductDocument {
  return {
    product_id: p.productId,
    name: p.name,
    product_class: p.productClass,
    category_hierarchy: p.categoryHierarchy,
    description: p.description,
    features: p.features,
    rating_count: p.ratingCount,
    average_rating: p.averageRating,
    review_count: p.reviewCount,
  };
}

/**
 * The shop-index document: the searchable text fields plus everything a
 * storefront product card renders (D7's curated index).
 */
export interface ShopDocument {
  product_id: number;
  name: string;
  product_class: string | null;
  description: string | null;
  slug: string;
  category: string;
  price_cents: number;
  image_thumb_url: string | null;
}

/**
 * Drop-and-rebuild indexing, step-1 naive on purpose: no explicit mapping,
 * so Elasticsearch dynamic-maps strings to text + .keyword subfields with
 * the standard analyzer. Step 3 replaces this with a real mapping and
 * measures the difference in the relevance lab.
 */
async function recreateAndBulk<T extends { product_id: number }>(
  es: Client,
  index: string,
  docs: T[],
): Promise<number> {
  if (await es.indices.exists({ index })) {
    await es.indices.delete({ index });
  }
  await es.indices.create({ index });

  const result = await es.helpers.bulk<T>({
    datasource: docs,
    onDocument: (doc) => ({
      index: { _index: index, _id: String(doc.product_id) },
    }),
    onDrop: (doc) => {
      throw new Error(`Bulk indexing dropped product ${doc.document?.product_id}`);
    },
  });

  await es.indices.refresh({ index });
  return result.successful;
}

export async function indexProducts(
  es: Client,
  index: string,
  products: RawProduct[],
): Promise<number> {
  return recreateAndBulk(es, index, products.map(toDocument));
}

export async function indexShopDocuments(
  es: Client,
  index: string,
  docs: ShopDocument[],
): Promise<number> {
  return recreateAndBulk(es, index, docs);
}
