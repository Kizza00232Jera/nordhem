import type { estypes } from "@elastic/elasticsearch";

export interface SearchFilters {
  /** Keep only products in any of these categories (exact keyword match). */
  category?: string[];
  /** Multi-select colour values (post_filter — keeps its own facet counts). */
  color?: string[];
  /** Multi-select material values (post_filter). */
  material?: string[];
  /** Inclusive price bounds in cents (cross-cutting bool.filter range). */
  priceMin?: number;
  priceMax?: number;
}

/**
 * Fixed price bands (cents), shopper-friendly like JYSK's rather than a raw
 * histogram — our shop prices are synthetic/deterministic (D29), so fixed
 * bands read cleanly and give hand-countable test fixtures. Reused as both
 * the range-aggregation buckets and the band-id vocabulary.
 */
export const PRICE_BANDS: { key: string; from?: number; to?: number }[] = [
  { key: "under-500", to: 50_000 },
  { key: "500-1000", from: 50_000, to: 100_000 },
  { key: "1000-2000", from: 100_000, to: 200_000 },
  { key: "2000-plus", from: 200_000 },
];

/** Map a price-band key (the facet bucket id) to inclusive cents bounds. */
export function priceBandBounds(
  key: string | undefined,
): { priceMin?: number; priceMax?: number } {
  const band = PRICE_BANDS.find((b) => b.key === key);
  if (!band) return {};
  return {
    ...(band.from != null && { priceMin: band.from }),
    ...(band.to != null && { priceMax: band.to }),
  };
}

function termsClause(
  field: string,
  values?: string[],
): estypes.QueryDslQueryContainer | null {
  return values?.length ? { terms: { [field]: values } } : null;
}

function priceRangeClause(
  filters: SearchFilters,
): estypes.QueryDslQueryContainer | null {
  const { priceMin, priceMax } = filters;
  if (priceMin == null && priceMax == null) return null;
  const range: { gte?: number; lte?: number } = {};
  if (priceMin != null) range.gte = priceMin;
  if (priceMax != null) range.lte = priceMax;
  return { range: { price_cents: range } };
}

export type SortOption = "relevance" | "price_asc" | "price_desc";

export interface SearchBodyOptions {
  /**
   * Shop scope only: attach the facet aggregations (terms over `category`,
   * etc.). Opt-in so the benchmark index — which has no `category` field and
   * needs no facets (D7) — and every existing caller stay unchanged.
   */
  facets?: boolean;
  /** Selected facet values to constrain the result set (filter context). */
  filters?: SearchFilters;
  /** Result ordering; "relevance" (default) leaves the BM25 _score order. */
  sort?: SortOption;
  /** Offset for pagination (page-1)*size; omitted means the first page. */
  from?: number;
  /** Ranking knobs (Step 7); defaults to DEFAULT_RANKING (the step-3 query). */
  ranking?: RankingConfig;
}

function sortClause(sort?: SortOption): estypes.Sort | undefined {
  if (sort === "price_asc") return [{ price_cents: { order: "asc" } }];
  if (sort === "price_desc") return [{ price_cents: { order: "desc" } }];
  return undefined;
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
  return [termsClause("category", filters.category), priceRangeClause(filters)].filter(
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
 * The tunable ranking knobs (Step 7). The relevance lab tries different
 * configs and measures each against the 480 judged queries; the storefront
 * uses DEFAULT_RANKING. Keeping every knob in one object means a config is a
 * single value to eval, store with a run, and graduate.
 */
export interface RankingConfig {
  /** Per-field BM25 boosts; a name hit outweighs a class hit outweighs a description hit. */
  fields: { name: number; productClass: number; description: number };
  /** Typo tolerance; undefined turns fuzziness off entirely. */
  fuzziness?: estypes.Fuzziness;
  /** Exact leading chars before any edit is allowed; >0 stops "light" matching "right". */
  fuzzyPrefixLength: number;
  /** How many query terms must match (e.g. "2<75%"); undefined keeps OR semantics. */
  minimumShouldMatch?: string;
  /** Boost for the whole query appearing as a phrase in the name; 0 disables. */
  phraseBoost: number;
  /** function_score weight on review_count (ln1p saturated); 0 disables popularity. */
  popularityWeight: number;
}

/** The step-3 query as a config: the behaviour-preserving storefront default. */
export const DEFAULT_RANKING: RankingConfig = {
  fields: { name: 3, productClass: 2, description: 1 },
  fuzziness: "AUTO",
  fuzzyPrefixLength: 0,
  minimumShouldMatch: undefined,
  phraseBoost: 0,
  popularityWeight: 0,
};

/** Field boost strings; boost 1 stays bare ("description") to match the legacy shape. */
function fieldList(f: RankingConfig["fields"]): string[] {
  const b = (name: string, boost: number) => (boost === 1 ? name : `${name}^${boost}`);
  return [b("name", f.name), b("product_class", f.productClass), b("description", f.description)];
}

function buildMultiMatch(
  query: string,
  r: RankingConfig,
): estypes.QueryDslQueryContainer {
  const mm: estypes.QueryDslMultiMatchQuery = {
    query,
    type: "best_fields",
    fields: fieldList(r.fields),
  };
  if (r.fuzziness !== undefined) mm.fuzziness = r.fuzziness;
  if (r.fuzzyPrefixLength > 0) mm.prefix_length = r.fuzzyPrefixLength;
  if (r.minimumShouldMatch) mm.minimum_should_match = r.minimumShouldMatch;
  return { multi_match: mm };
}

/**
 * The `query` clause, built from a RankingConfig. With the default config and
 * no filters it is the bare multi_match (the step-3 shape, unchanged). A phrase
 * boost adds a match_phrase `should`; facet filters add `filter` (filter
 * context — yes/no, cached); a popularity weight wraps the lot in a
 * function_score that adds an ln1p of review_count onto the BM25 score.
 */
function buildQueryClause(
  query: string,
  filters?: SearchFilters,
  ranking: RankingConfig = DEFAULT_RANKING,
): estypes.QueryDslQueryContainer {
  const mm = buildMultiMatch(query, ranking);
  const should: estypes.QueryDslQueryContainer[] =
    ranking.phraseBoost > 0
      ? [{ match_phrase: { name: { query, slop: 2, boost: ranking.phraseBoost } } }]
      : [];
  const filter = queryFilterClauses(filters);

  let base: estypes.QueryDslQueryContainer;
  if (should.length === 0 && filter.length === 0) {
    base = mm;
  } else {
    base = {
      bool: {
        must: [mm],
        ...(should.length ? { should } : {}),
        ...(filter.length ? { filter } : {}),
      },
    };
  }

  if (ranking.popularityWeight > 0) {
    return {
      function_score: {
        query: base,
        functions: [
          {
            field_value_factor: {
              field: "review_count",
              modifier: "ln1p",
              missing: 0,
              factor: ranking.popularityWeight,
            },
          },
        ],
        boost_mode: "sum",
      },
    };
  }
  return base;
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
    query: buildQueryClause(query, opts.filters, opts.ranking),
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
        prices: { range: { field: "price_cents", ranges: PRICE_BANDS } },
      },
    }),
    ...(sortClause(opts.sort) && { sort: sortClause(opts.sort) }),
    ...(opts.from ? { from: opts.from } : {}),
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
