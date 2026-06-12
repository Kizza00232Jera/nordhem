import { z } from "zod";

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
});

export const SearchResponseSchema = z.object({
  query: z.string(),
  mode: z.enum(["full", "fallback"]),
  total: z.number().int().nonnegative(),
  tookMs: z.number().nonnegative(),
  hits: z.array(SearchHitSchema),
});

export type SearchHit = z.infer<typeof SearchHitSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
