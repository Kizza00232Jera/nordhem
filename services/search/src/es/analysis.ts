import type { estypes } from "@elastic/elasticsearch";

/**
 * The analysis chain, rebuilt from the ES docs' built-in `english` analyzer
 * (possessive stemmer → lowercase → stop words → stemmer) as a custom
 * analyzer instead of using `english` directly, so this step and later ones
 * can extend the chain (query-time synonyms, suggester fields) without
 * starting over.
 *
 * Synonyms are query-time only: `english_search` = `english_text` +
 * synonym_graph. Documents are indexed without synonyms, so editing rules
 * never forces a 43k-doc reindex (and step 9 can hot-reload them).
 * synonym_graph sits AFTER the stemmer — ES runs the preceding filters
 * over the rule text too, so rules and query tokens arrive stemmed alike
 * ("sofas" still hits the "sofa, couch" rule).
 */
export function buildAnalysis(
  synonymRules: string[],
): estypes.IndicesIndexSettingsAnalysis {
  return {
    filter: {
      english_possessive_stemmer: { type: "stemmer", language: "possessive_english" },
      english_stop: { type: "stop", stopwords: "_english_" },
      english_stemmer: { type: "stemmer", language: "english" },
      // lenient: a single malformed rule (e.g. a multi-word term whose stopword
      // is stripped, leaving a position gap) is skipped instead of failing the
      // whole analyzer. Editors can add rules without risking taking down search.
      english_synonyms: { type: "synonym_graph", synonyms: synonymRules, lenient: true },
      trigram_shingles: {
        type: "shingle",
        min_shingle_size: 2,
        max_shingle_size: 3,
      },
    },
    analyzer: {
      english_text: {
        type: "custom",
        tokenizer: "standard",
        filter: ["english_possessive_stemmer", "lowercase", "english_stop", "english_stemmer"],
      },
      english_search: {
        type: "custom",
        tokenizer: "standard",
        filter: [
          "english_possessive_stemmer",
          "lowercase",
          "english_stop",
          "english_stemmer",
          "english_synonyms",
        ],
      },
      // Did-you-mean field: lowercase + 1-3 word shingles, deliberately
      // unstemmed — suggestions must be surface words, not stems.
      trigram: {
        type: "custom",
        tokenizer: "standard",
        filter: ["lowercase", "trigram_shingles"],
      },
    },
  };
}

const englishText: estypes.MappingProperty = {
  type: "text",
  analyzer: "english_text",
  search_analyzer: "english_search",
};

/**
 * Semantic-search vector field (Step 8): the multilingual-e5-small embedding of
 * the product text, 384 dims. index: true builds an HNSW graph for fast
 * approximate kNN; cosine similarity, since the embed module L2-normalizes.
 * Optional at index time, so a text-only (un-embedded) document is still valid.
 */
const embeddingField: estypes.MappingProperty = {
  type: "dense_vector",
  dims: 384,
  index: true,
  similarity: "cosine",
};

/**
 * `name` carries the multi-field subfields: `.keyword` for exact values
 * (sorting, aggregations — parity with what dynamic mapping gave step 1/2).
 */
const nameField: estypes.MappingProperty = {
  type: "text",
  analyzer: "english_text",
  search_analyzer: "english_search",
  fields: {
    keyword: { type: "keyword", ignore_above: 256 },
    trigram: { type: "text", analyzer: "trigram" },
    // search_as_you_type builds ._2gram, ._3gram and ._index_prefix
    // companions automatically — the autocomplete query targets those.
    sayt: { type: "search_as_you_type" },
  },
};

/** Benchmark index: the full WANDS corpus, text-only. */
export const PRODUCT_MAPPINGS: estypes.MappingTypeMapping = {
  // strict: a document with an unexpected field is a bug, not a schema change
  dynamic: "strict",
  properties: {
    product_id: { type: "integer" },
    name: nameField,
    product_class: { ...englishText, fields: { keyword: { type: "keyword" } } },
    category_hierarchy: englishText,
    description: englishText,
    features: englishText,
    rating_count: { type: "integer" },
    average_rating: { type: "float" },
    review_count: { type: "integer" },
    embedding: embeddingField,
  },
};

/** Shop index: searchable text plus the product-card fields. */
export const SHOP_MAPPINGS: estypes.MappingTypeMapping = {
  dynamic: "strict",
  properties: {
    product_id: { type: "integer" },
    name: nameField,
    product_class: { ...englishText, fields: { keyword: { type: "keyword" } } },
    description: englishText,
    slug: { type: "keyword" },
    category: { type: "keyword" },
    price_cents: { type: "integer" },
    image_thumb_url: { type: "keyword", index: false },
    // Facet fields: exact keyword values (no analysis), aggregated and
    // filtered like `category`. Derived from WANDS features at index time.
    color: { type: "keyword" },
    material: { type: "keyword" },
    embedding: embeddingField,
  },
};
