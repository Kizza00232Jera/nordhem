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

export const SearchResponseSchema = z.object({
  query: z.string(),
  mode: z.enum(["full", "fallback"]),
  total: z.number().int().nonnegative(),
  tookMs: z.number().nonnegative(),
  hits: z.array(SearchHitSchema),
  // "Did you mean" — present only when the engine has a better-scoring
  // rewrite of the query (full mode; the lite fallback never suggests).
  suggestion: z.string().optional(),
});

export type SearchHit = z.infer<typeof SearchHitSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
