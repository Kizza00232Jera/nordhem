import { z } from "zod";

export * from "./categories.ts";

/**
 * The search API contract between services/search (producer), the Next.js
 * backend (consumer + fallback producer in lite mode), and the storefront UI.
 *
 * `mode` is part of the contract from day one: every response declares whether
 * it came from Elasticsearch ("full") or the Postgres FTS fallback
 * ("fallback"), so the UI can be honest about degraded results (D12).
 */
export const SearchHitSchema = z.object({
  id: z.string(),
  name: z.string(),
  productClass: z.string().nullable(),
  description: z.string().nullable(),
  score: z.number(),
  // Highlighted variants with <mark> tags around matched terms. The raw
  // text is NOT html-escaped by the engine — render by splitting on the
  // tags, never via innerHTML.
  highlightName: z.string().optional(),
  highlightDescription: z.string().optional(),
  // Present on shop-index hits only — everything a product card needs.
  // Benchmark-index hits (the 43k corpus) never carry these.
  slug: z.string().optional(),
  category: z.string().optional(),
  priceCents: z.number().int().optional(),
  imageThumbUrl: z.string().nullable().optional(),
});

/**
 * One facet value plus its live result count — the number rendered beside
 * each filter option, computed by an Elasticsearch terms aggregation over
 * the current result set (the count JYSK shows: "White 19").
 */
export const FacetBucketSchema = z.object({
  value: z.string(),
  count: z.number().int().nonnegative(),
});

/**
 * Aggregated facet buckets for the shop scope. Each facet grows in as its
 * slice lands; absent entirely on the benchmark scope and the lite-mode
 * fallback, so the whole block is optional (never null — D35).
 */
export const SearchFacetsSchema = z.object({
  categories: z.array(FacetBucketSchema),
});

export const SearchResponseSchema = z.object({
  query: z.string(),
  mode: z.enum(["full", "fallback"]),
  total: z.number().int().nonnegative(),
  tookMs: z.number().nonnegative(),
  hits: z.array(SearchHitSchema),
  // "Did you mean" — present only when the engine has a better-scoring
  // rewrite of the query (full mode; the lite fallback never suggests).
  suggestion: z.string().optional(),
  // Facet counts for the shop scope; absent on benchmark scope / fallback.
  facets: SearchFacetsSchema.optional(),
});

export type FacetBucket = z.infer<typeof FacetBucketSchema>;
export type SearchFacets = z.infer<typeof SearchFacetsSchema>;

export type SearchHit = z.infer<typeof SearchHitSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

/**
 * Autocomplete contract: deliberately lighter than a search hit — the
 * combobox needs a label and enough to render a thumbnail row, nothing
 * else. Card fields appear on shop-scope suggestions only.
 */
export const AutocompleteSuggestionSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().optional(),
  priceCents: z.number().int().optional(),
  imageThumbUrl: z.string().nullable().optional(),
});

export const AutocompleteResponseSchema = z.object({
  query: z.string(),
  tookMs: z.number().nonnegative(),
  suggestions: z.array(AutocompleteSuggestionSchema),
});

export type AutocompleteSuggestion = z.infer<typeof AutocompleteSuggestionSchema>;
export type AutocompleteResponse = z.infer<typeof AutocompleteResponseSchema>;
