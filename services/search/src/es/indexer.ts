import type { Client, estypes } from "@elastic/elasticsearch";
import type { RawProduct } from "../wands/parse.ts";
import { attachEmbeddings } from "../embed/index-embed.ts";
import { buildAnalysis, PRODUCT_MAPPINGS, SHOP_MAPPINGS } from "./analysis.ts";
import { loadSynonymRules } from "./synonyms.ts";

/** Index-time options shared by both indexes. */
export interface IndexOptions {
  /** Compute and store the e5 embedding for each document (Step 8). */
  embed?: boolean;
  /** Progress callback for the (slow) embedding batch. */
  onEmbedProgress?: (done: number, total: number) => void;
  /**
   * Synonym rules (Solr lines) baked into the search analyzer (Step 9).
   * Defaults to the synonyms.txt file; the CLIs pass the Postgres rules so the
   * editable rules are the source of truth.
   */
  synonymRules?: string[];
}

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
  /** e5 embedding (Step 8); absent on text-only indexing runs. */
  embedding?: number[];
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
  // Facet attributes derived from WANDS features (null when the product has
  // no recorded value — it is then simply absent from that facet).
  color: string | null;
  material: string | null;
  /** e5 embedding (Step 8); absent on text-only indexing runs. */
  embedding?: number[];
}

/**
 * Drop-and-rebuild indexing with the explicit step-3 mapping: custom English
 * analysis chain (see analysis.ts) instead of step 1's dynamic mapping with
 * the standard analyzer.
 */
async function recreateAndBulk<T extends { product_id: number }>(
  es: Client,
  index: string,
  docs: T[],
  mappings: estypes.MappingTypeMapping,
  synonymRules: string[],
): Promise<number> {
  if (await es.indices.exists({ index })) {
    await es.indices.delete({ index });
  }
  await es.indices.create({
    index,
    settings: { analysis: buildAnalysis(synonymRules) },
    mappings,
  });

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
  opts: IndexOptions = {},
): Promise<number> {
  const docs = products.map(toDocument);
  const finalDocs = opts.embed
    ? await attachEmbeddings(docs, { onProgress: opts.onEmbedProgress })
    : docs;
  return recreateAndBulk(es, index, finalDocs, PRODUCT_MAPPINGS, opts.synonymRules ?? loadSynonymRules());
}

export async function indexShopDocuments(
  es: Client,
  index: string,
  docs: ShopDocument[],
  opts: IndexOptions = {},
): Promise<number> {
  const finalDocs = opts.embed
    ? await attachEmbeddings(docs, { onProgress: opts.onEmbedProgress })
    : docs;
  return recreateAndBulk(es, index, finalDocs, SHOP_MAPPINGS, opts.synonymRules ?? loadSynonymRules());
}

/**
 * Hot-reload the search-time synonyms on a live index WITHOUT reindexing the
 * 43k documents (Step 9). Synonyms live only in the `english_search` analyzer,
 * which runs at query time; documents are indexed with `english_text` (no
 * synonyms), so changing the rules never touches stored data. Updating analysis
 * settings requires the index closed, so this closes it, rewrites the analysis
 * with the new rules, and reopens, a sub-second blip rather than a minutes-long
 * rebuild. The studio calls this after an editor changes a rule.
 */
export async function reloadSynonyms(
  es: Client,
  index: string,
  synonymRules: string[],
): Promise<void> {
  await es.indices.close({ index });
  try {
    await es.indices.putSettings({ index, settings: { analysis: buildAnalysis(synonymRules) } });
  } finally {
    await es.indices.open({ index });
  }
  await es.cluster.health({ index, wait_for_status: "yellow", timeout: "30s" });
}
