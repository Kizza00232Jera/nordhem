import type { estypes } from "@elastic/elasticsearch";

/**
 * The step-3 query: best_fields multi_match with field boosts — a match in
 * the product name outweighs one in the class, which outweighs one in the
 * description. best_fields over cross_fields because product names are
 * short self-contained phrases (the best single field should win) and
 * because cross_fields cannot combine with fuzziness.
 */
export function buildSearchBody(
  query: string,
  size: number,
): estypes.SearchRequest {
  return {
    query: {
      multi_match: {
        query,
        type: "best_fields",
        fields: ["name^3", "product_class^2", "description"],
        // AUTO scales allowed edits with term length: 0 edits up to 2
        // chars, 1 edit for 3-5, 2 edits above 5.
        fuzziness: "AUTO",
      },
    },
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
