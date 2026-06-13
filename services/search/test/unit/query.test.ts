import { describe, expect, it } from "vitest";
import { buildAutocompleteBody, buildSearchBody } from "../../src/search/query.ts";

describe("buildSearchBody", () => {
  // Step-7 graduated default (DEFAULT_RANKING): the step-3 boosted best_fields
  // multi_match, now with a fuzziness prefix_length of 2 (so "light" cannot
  // fuzzy-match "right") and a match_phrase `should` that rewards the typed
  // words appearing together in the name. Measured to lift full-set nDCG@10
  // from 0.6532 to ~0.6629 and confirmed on the held-out test split.
  it("builds the graduated step-7 query: boosted multi_match + prefix_length + phrase boost", () => {
    expect(buildSearchBody("outdoor chair", 20)).toEqual({
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: "outdoor chair",
                type: "best_fields",
                fields: ["name^3", "product_class^2", "description"],
                fuzziness: "AUTO",
                prefix_length: 2,
              },
            },
          ],
          should: [{ match_phrase: { name: { query: "outdoor chair", slop: 2, boost: 4 } } }],
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

describe("buildSearchBody facets", () => {
  // Step 4: when the shop scope asks for facets, the body grows a terms
  // aggregation over the keyword `category` field. Aggregation DSL written
  // from the ES terms-aggregation docs. size 20 comfortably covers the 8
  // shop categories. Facets are opt-in so the benchmark scope (which has no
  // `category` field) and the no-facet callers stay byte-for-byte unchanged.
  it("adds category, colour and material terms aggregations when facets are requested", () => {
    const body = buildSearchBody("oak", 20, { facets: true });
    expect(body.aggregations).toEqual({
      categories: { terms: { field: "category", size: 20 } },
      colors: { terms: { field: "color", size: 50 } },
      materials: { terms: { field: "material", size: 50 } },
      prices: {
        range: {
          field: "price_cents",
          ranges: [
            { key: "under-500", to: 50_000 },
            { key: "500-1000", from: 50_000, to: 100_000 },
            { key: "1000-2000", from: 100_000, to: 200_000 },
            { key: "2000-plus", from: 200_000 },
          ],
        },
      },
    });
  });

  it("puts multi-select colour/material in post_filter, not bool.filter", () => {
    const body = buildSearchBody("oak", 20, {
      filters: { color: ["white"], category: ["sofas"] },
    });
    // category is a cross-cutting bool.filter clause, alongside the graduated
    // multi_match (with prefix_length) and the phrase-boost should clause.
    expect(body.query).toEqual({
      bool: {
        must: [
          {
            multi_match: {
              query: "oak",
              type: "best_fields",
              fields: ["name^3", "product_class^2", "description"],
              fuzziness: "AUTO",
              prefix_length: 2,
            },
          },
        ],
        should: [{ match_phrase: { name: { query: "oak", slop: 2, boost: 4 } } }],
        filter: [{ terms: { category: ["sofas"] } }],
      },
    });
    // ...while colour is applied after aggregations via post_filter.
    expect(body.post_filter).toEqual({
      bool: { filter: [{ terms: { color: ["white"] } }] },
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
