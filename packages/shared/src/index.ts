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
/**
 * A price band with its count. `from`/`to` are the cents bounds (either may
 * be absent for the open-ended first/last band); `key` is the stable bucket
 * id the UI maps to a label and to the priceMin/priceMax filter.
 */
export const PriceBucketSchema = z.object({
  key: z.string(),
  from: z.number().int().optional(),
  to: z.number().int().optional(),
  count: z.number().int().nonnegative(),
});

export const SearchFacetsSchema = z.object({
  categories: z.array(FacetBucketSchema),
  colors: z.array(FacetBucketSchema),
  materials: z.array(FacetBucketSchema),
  prices: z.array(PriceBucketSchema),
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
export type PriceBucket = z.infer<typeof PriceBucketSchema>;
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

// ---------------------------------------------------------------------------
// Step 5 commerce contracts (validated at the Server Action boundary — a form
// post is untrusted input).
// ---------------------------------------------------------------------------

const nonBlank = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`);

/** A shipping address. line2 is optional; country is an ISO 3166-1 alpha-2 code. */
export const AddressSchema = z.object({
  fullName: nonBlank("Full name"),
  line1: nonBlank("Address line 1"),
  line2: z.string().trim().nullable().optional().default(null),
  city: nonBlank("City"),
  postalCode: nonBlank("Postal code"),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Country must be a 2-letter code"),
});

/** One line of the cart as the UI renders it — live price, no snapshot. */
export const CartLineViewSchema = z.object({
  productId: z.number().int(),
  name: z.string(),
  slug: z.string(),
  imageThumbUrl: z.string().nullable().optional(),
  unitPriceCents: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
});

/** The whole cart for the drawer and /cart page. */
export const CartViewSchema = z.object({
  items: z.array(CartLineViewSchema),
  itemCount: z.number().int().nonnegative(),
  subtotalCents: z.number().int().nonnegative(),
  shippingCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
});

/** A frozen order line, as snapshotted at checkout. */
export const OrderItemViewSchema = z.object({
  productId: z.number().int(),
  nameSnapshot: z.string(),
  slugSnapshot: z.string(),
  imageUrlSnapshot: z.string().nullable(),
  unitPriceCents: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
});

/** A placed order for the confirmation page and order history. */
export const OrderSummarySchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  subtotalCents: z.number().int().nonnegative(),
  shippingCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  items: z.array(OrderItemViewSchema),
});

export type Address = z.infer<typeof AddressSchema>;
export type CartLineView = z.infer<typeof CartLineViewSchema>;
export type CartView = z.infer<typeof CartViewSchema>;
export type OrderItemView = z.infer<typeof OrderItemViewSchema>;
export type OrderSummary = z.infer<typeof OrderSummarySchema>;
