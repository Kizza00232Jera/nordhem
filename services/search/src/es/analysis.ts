import type { estypes } from "@elastic/elasticsearch";

/**
 * The analysis chain, rebuilt from the ES docs' built-in `english` analyzer
 * (possessive stemmer → lowercase → stop words → stemmer) as a custom
 * analyzer instead of using `english` directly, so this step and later ones
 * can extend the chain (query-time synonyms, suggester fields) without
 * starting over.
 */
export const ANALYSIS: estypes.IndicesIndexSettingsAnalysis = {
  filter: {
    english_possessive_stemmer: { type: "stemmer", language: "possessive_english" },
    english_stop: { type: "stop", stopwords: "_english_" },
    english_stemmer: { type: "stemmer", language: "english" },
  },
  analyzer: {
    english_text: {
      type: "custom",
      tokenizer: "standard",
      filter: ["english_possessive_stemmer", "lowercase", "english_stop", "english_stemmer"],
    },
  },
};

const englishText: estypes.MappingProperty = {
  type: "text",
  analyzer: "english_text",
};

/**
 * `name` carries the multi-field subfields: `.keyword` for exact values
 * (sorting, aggregations — parity with what dynamic mapping gave step 1/2).
 */
const nameField: estypes.MappingProperty = {
  type: "text",
  analyzer: "english_text",
  fields: {
    keyword: { type: "keyword", ignore_above: 256 },
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
  },
};
