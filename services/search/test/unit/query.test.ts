import { describe, expect, it } from "vitest";
import { buildAutocompleteBody, buildSearchBody } from "../../src/search/query.ts";

describe("buildSearchBody", () => {
  // Expected DSL written from the Elasticsearch multi_match docs.
  // Step-3 upgrade over the step-1 baseline: explicit best_fields with
  // field boosts — a name hit is worth more than a description hit.
  // best_fields (not cross_fields): product names are short, self-contained
  // phrases, so the best single field should win; cross_fields treats fields
  // as one big field and also cannot combine with fuzziness.
  it("builds a boosted best_fields multi_match over the three text fields", () => {
    expect(buildSearchBody("outdoor chair", 20)).toEqual({
      query: {
        multi_match: {
          query: "outdoor chair",
          type: "best_fields",
          fields: ["name^3", "product_class^2", "description"],
          fuzziness: "AUTO",
        },
      },
      highlight: {
        pre_tags: ["<mark>"],
        post_tags: ["</mark>"],
        fields: {
          name: { number_of_fragments: 0 },
          description: { number_of_fragments: 1, fragment_size: 150 },
        },
      },
      suggest: {
        text: "outdoor chair",
        did_you_mean: {
          phrase: {
            field: "name.trigram",
            size: 1,
            gram_size: 3,
            direct_generator: [{ field: "name.trigram", suggest_mode: "always" }],
          },
        },
      },
      size: 20,
    });
  });
});

describe("buildAutocompleteBody", () => {
  // Expected DSL from the ES search_as_you_type docs: bool_prefix over
  // the sayt field and its generated 2/3-gram companions.
  it("builds a bool_prefix multi_match over the sayt subfields", () => {
    expect(buildAutocompleteBody("fabric so", 8)).toEqual({
      query: {
        multi_match: {
          query: "fabric so",
          type: "bool_prefix",
          fields: ["name.sayt", "name.sayt._2gram", "name.sayt._3gram"],
        },
      },
      size: 8,
    });
  });
});
