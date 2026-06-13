import type { estypes } from "@elastic/elasticsearch";

export interface SearchFilters {
  /** Keep only products in any of these categories (exact keyword match). */
  category?: string[];
  /** Multi-select colour values (post_filter — keeps its own facet counts). */
  color?: string[];
  /** Multi-select material values (post_filter). */
  material?: string[];
}

function termsClause(
  field: string,
  values?: string[],
): estypes.QueryDslQueryContainer | null {
  return values?.length ? { terms: { [field]: values } } : null;
}

export interface SearchBodyOptions {
  /**
   * Shop scope only: attach the facet aggregations (terms over `category`,
   * etc.). Opt-in so the benchmark index — which has no `category` field and
   * needs no facets (D7) — and every existing caller stay unchanged.
   */
  facets?: boolean;
  /** Selected facet values to constrain the result set (filter context). */
  filters?: SearchFilters;
}

/**
 * Cross-cutting filters go in bool.filter — they run BEFORE aggregations, so
 * they narrow both the hits and every facet's counts. Category (and price,
 * later) are single-select navigators: it's fine for them to constrain the
 * other facets' counts.
 */
function queryFilterClauses(
  filters: SearchFilters = {},
): estypes.QueryDslQueryContainer[] {
  return [termsClause("category", filters.category)].filter(
    (c): c is estypes.QueryDslQueryContainer => c !== null,
  );
}

/**
 * Multi-select facets go in post_filter — applied AFTER aggregations, so a
 * colour selection narrows the returned hits without shrinking the colour
 * facet's own counts (you ticked white but can still see black to add it).
 * The documented trade-off: these selections also don't narrow the OTHER
 * facets' counts, since aggregations never see them (acceptable for Step 4).
 */
function postFilterClauses(
  filters: SearchFilters = {},
): estypes.QueryDslQueryContainer[] {
  return [
    termsClause("color", filters.color),
    termsClause("material", filters.material),
  ].filter((c): c is estypes.QueryDslQueryContainer => c !== null);
}

/**
 * The `query` clause. With no filters it is the bare multi_match (the step-3
 * shape, unchanged). With filters it becomes a bool: the multi_match in
 * `must` (query context — it drives the BM25 score, since relevance should
 * reflect the typed words) and the facet selections in `filter` (filter
 * context — yes/no membership, no scoring, cached as a reusable bitset).
 */
function buildQueryClause(
  query: string,
  filters?: SearchFilters,
): estypes.QueryDslQueryContainer {
  const multiMatch: estypes.QueryDslQueryContainer = {
    multi_match: {
      query,
      type: "best_fields",
      fields: ["name^3", "product_class^2", "description"],
      fuzziness: "AUTO",
    },
  };
  const clauses = queryFilterClauses(filters);
  if (clauses.length === 0) return multiMatch;
  return { bool: { must: [multiMatch], filter: clauses } };
}

/**
 * The step-3 query: best_fields multi_match with field boosts — a match in
 * the product name outweighs one in the class, which outweighs one in the
 * description. best_fields over cross_fields because product names are
 * short self-contained phrases (the best single field should win) and
 * because cross_fields cannot combine with fuzziness.
 *
 * Step 4 adds opt-in facet aggregations: counts per category value computed
 * over the query's matching documents, the numbers the storefront renders
 * beside each filter option.
 */
export function buildSearchBody(
  query: string,
  size: number,
  opts: SearchBodyOptions = {},
): estypes.SearchRequest {
  return {
    // multi_match alone, or wrapped in a bool with the facet filters.
    // AUTO scales allowed edits with term length: 0 edits up to 2 chars,
    // 1 edit for 3-5, 2 edits above 5.
    query: buildQueryClause(query, opts.filters),
    highlight: {
      pre_tags: ["<mark>"],
      post_tags: ["</mark>"],
      fields: {
        // Names are short: highlight the whole field, never fragment it.
        name: { number_of_fragments: 0 },
        description: { number_of_fragments: 1, fragment_size: 150 },
      },
    },
    // Did-you-mean rides along with every search: the phrase suggester
    // scores candidate rewrites against the shingle field, and the default
    // confidence (1.0) only returns rewrites that score higher than the
    // query as typed — well-spelled queries get no suggestion.
    suggest: {
      text: query,
      did_you_mean: {
        phrase: {
          field: "name.trigram",
          size: 1,
          gram_size: 3,
          direct_generator: [{ field: "name.trigram", suggest_mode: "always" }],
        },
      },
    },
    // Multi-select facet selections are applied after aggregations so each
    // such facet keeps its own counts (see postFilterClauses).
    ...(() => {
      const post = postFilterClauses(opts.filters);
      return post.length ? { post_filter: { bool: { filter: post } } } : {};
    })(),
    // Facet counts ride along on the same request: one round trip returns
    // hits, highlights, did-you-mean, and the aggregation buckets together.
    // size 50 on colour/material comfortably covers their value vocabularies.
    ...(opts.facets && {
      aggregations: {
        categories: { terms: { field: "category", size: 20 } },
        colors: { terms: { field: "color", size: 50 } },
        materials: { terms: { field: "material", size: 50 } },
      },
    }),
    size,
  };
}

/**
 * Autocomplete: bool_prefix scores completed words like a normal match
 * and treats only the word being typed as a prefix. The 2/3-gram
 * subfields make multi-word prefixes ("fabric so") rank phrases whose
 * words appear together, in order.
 */
export function buildAutocompleteBody(
  query: string,
  size: number,
): estypes.SearchRequest {
  return {
    query: {
      multi_match: {
        query,
        type: "bool_prefix",
        fields: ["name.sayt", "name.sayt._2gram", "name.sayt._3gram"],
      },
    },
    size,
  };
}
