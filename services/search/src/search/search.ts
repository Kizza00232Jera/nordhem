import type { Client, estypes } from "@elastic/elasticsearch";
import type { FacetBucket, PriceBucket, SearchFacets, SearchHit, SearchResponse } from "@nordhem/shared";
import type { ProductDocument, ShopDocument } from "../es/indexer.ts";
import { embedQuery } from "../embed/embed.ts";
import { curateIds, curationActive, type Curation } from "./curate.ts";
import { type AffinityBoost, buildSearchBody, type SearchFilters, type SortOption } from "./query.ts";
import { hybridProductIds, knnProductIds } from "./semantic.ts";

const DEFAULT_SIZE = 20;
const KNN_NUM_CANDIDATES = 200;

type AnyProductDocument = ProductDocument & Partial<ShopDocument>;

/** Which retrieval strategy answers the query (Step 8). */
export type SearchMode = "lexical" | "semantic" | "hybrid";

export interface SearchOptions {
  size?: number;
  /** 1-based page number; combined with size to compute the offset. */
  page?: number;
  /** Shop scope only: compute and return facet counts (D7). */
  facets?: boolean;
  /** Selected facet values to constrain the result set. */
  filters?: SearchFilters;
  /** Result ordering. */
  sort?: SortOption;
  /** Retrieval strategy; defaults to lexical (BM25), the original behaviour. */
  mode?: SearchMode;
  /** Per-query curation to pin/hide products (Step 9); applied on page 1. */
  curation?: Curation;
  /**
   * Per-query learned click-affinity boosts (Step 11a). Lexical-mode only —
   * they ride into the BM25 query as function_score weights, so semantic/hybrid
   * (which rank by vector distance / RRF, not BM25) are left untouched.
   */
  affinityBoosts?: AffinityBoost[];
}

/** Read a terms aggregation's buckets into the contract's value/count pairs. */
function termsBuckets(
  agg: estypes.AggregationsAggregate | undefined,
): FacetBucket[] {
  const buckets = (agg as estypes.AggregationsStringTermsAggregate | undefined)
    ?.buckets;
  if (!Array.isArray(buckets)) return [];
  return buckets.map((b) => ({ value: String(b.key), count: b.doc_count }));
}

/** Read a range aggregation's buckets into price bands with their bounds. */
function rangeBuckets(
  agg: estypes.AggregationsAggregate | undefined,
): PriceBucket[] {
  const buckets = (agg as estypes.AggregationsRangeAggregate | undefined)
    ?.buckets;
  if (!Array.isArray(buckets)) return [];
  return buckets.map((b) => ({
    key: String(b.key),
    ...(b.from !== undefined && { from: b.from }),
    ...(b.to !== undefined && { to: b.to }),
    count: b.doc_count,
  }));
}

/** Map one ES hit (search or mget) to the contract's SearchHit shape. */
function toSearchHit(hit: {
  _id?: string;
  _score?: number | null;
  _source?: AnyProductDocument;
  highlight?: Record<string, string[]>;
}): SearchHit {
  const source = hit._source;
  return {
    id: hit._id ?? "",
    name: source?.name ?? "",
    productClass: source?.product_class ?? null,
    description: source?.description ?? null,
    score: hit._score ?? 0,
    ...(hit.highlight?.["name"]?.[0] !== undefined && {
      highlightName: hit.highlight["name"][0],
    }),
    ...(hit.highlight?.["description"]?.[0] !== undefined && {
      highlightDescription: hit.highlight["description"][0],
    }),
    // Card fields exist only in shop-index documents.
    ...(source?.slug !== undefined && {
      slug: source.slug,
      category: source.category,
      priceCents: source.price_cents,
      imageThumbUrl: source.image_thumb_url ?? null,
    }),
  };
}

/**
 * Semantic / hybrid search: get a ranked id list (kNN, or RRF over BM25 + kNN),
 * then hydrate just the requested page with mget, preserving the fused order.
 * Facets, highlights, and did-you-mean are lexical-only features and are not
 * produced here; these modes are a relevance experiment over the same corpus.
 */
async function rankedIdSearch(
  es: Client,
  index: string,
  query: string,
  mode: Exclude<SearchMode, "lexical">,
  from: number,
  size: number,
): Promise<SearchResponse> {
  const started = Date.now();
  const depth = Math.max(from + size, 100);
  const ids =
    mode === "hybrid"
      ? await hybridProductIds(es, index, query, { k: depth, numCandidates: KNN_NUM_CANDIDATES })
      : await knnProductIds(es, index, await embedQuery(query), {
          k: depth,
          numCandidates: KNN_NUM_CANDIDATES,
        });

  const pageIds = ids.slice(from, from + size);
  const docs = pageIds.length
    ? (await es.mget<AnyProductDocument>({ index, ids: pageIds.map(String) })).docs
    : [];

  const hits = docs
    .filter((d): d is estypes.GetGetResult<AnyProductDocument> => "found" in d && d.found)
    .map((d) => toSearchHit(d));

  return {
    query,
    mode: "full",
    total: ids.length,
    tookMs: Date.now() - started,
    hits,
  };
}

/** The lexical (BM25) path: rich hits with highlights, facets, did-you-mean. */
async function lexicalSearch(
  es: Client,
  index: string,
  query: string,
  opts: SearchOptions,
  size: number,
  from: number,
): Promise<SearchResponse> {
  const res = await es.search<AnyProductDocument>({
    index,
    ...buildSearchBody(query, size, {
      facets: opts.facets,
      filters: opts.filters,
      sort: opts.sort,
      from,
      ...(opts.affinityBoosts && { affinityBoosts: opts.affinityBoosts }),
    }),
  });

  const total =
    typeof res.hits.total === "number"
      ? res.hits.total
      : (res.hits.total?.value ?? 0);

  // The client types options as T | T[]; ES returns an array for phrase
  // suggesters. The text is present only when the suggester beat the query.
  const dymEntry = res.suggest?.["did_you_mean"]?.[0];
  const dymOptions = dymEntry ? [dymEntry.options].flat() : [];
  const suggestion = dymOptions[0]?.text;

  const facets: SearchFacets | undefined = opts.facets
    ? {
        categories: termsBuckets(res.aggregations?.["categories"]),
        colors: termsBuckets(res.aggregations?.["colors"]),
        materials: termsBuckets(res.aggregations?.["materials"]),
        prices: rangeBuckets(res.aggregations?.["prices"]),
      }
    : undefined;

  return {
    query,
    mode: "full",
    ...(suggestion !== undefined && { suggestion }),
    ...(facets !== undefined && { facets }),
    total,
    tookMs: res.took,
    hits: res.hits.hits.map(toSearchHit),
  };
}

/**
 * Apply a curation to a page of hits: reorder by curateIds (pinned first, hidden
 * dropped), then hydrate any pinned product the ranking never returned via mget.
 * Curations are read per-query at search time, so a saved change takes effect on
 * the next search with no reindex and no analyzer reload.
 */
async function applyCuration(
  es: Client,
  index: string,
  hits: SearchHit[],
  curation: Curation,
  size: number,
): Promise<SearchHit[]> {
  const order = curateIds(hits.map((h) => Number(h.id)), curation);
  const byId = new Map(hits.map((h) => [Number(h.id), h]));
  const missing = order.filter((id) => !byId.has(id));
  if (missing.length) {
    const docs = (await es.mget<AnyProductDocument>({ index, ids: missing.map(String) })).docs;
    for (const d of docs) {
      if ("found" in d && d.found) byId.set(Number(d._id), toSearchHit(d));
    }
  }
  return order
    .map((id) => byId.get(id))
    .filter((h): h is SearchHit => h !== undefined)
    .slice(0, size);
}

export async function searchProducts(
  es: Client,
  index: string,
  query: string,
  opts: SearchOptions = {},
): Promise<SearchResponse> {
  const size = opts.size ?? DEFAULT_SIZE;
  const from = Math.max(0, ((opts.page ?? 1) - 1) * size);
  const mode = opts.mode ?? "lexical";

  const response =
    mode !== "lexical"
      ? await rankedIdSearch(es, index, query, mode, from, size)
      : await lexicalSearch(es, index, query, opts, size, from);

  // Curations override ranking, on page 1 only (pinned products belong up top).
  if (from === 0 && curationActive(opts.curation)) {
    return { ...response, hits: await applyCuration(es, index, response.hits, opts.curation, size) };
  }
  return response;
}
