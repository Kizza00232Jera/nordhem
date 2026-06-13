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
    // category is a cross-cutting bool.filter clause...
    expect(body.query).toEqual({
      bool: {
        must: [
          {
            multi_match: {
              query: "oak",
              type: "best_fields",
              fields: ["name^3", "product_class^2", "description"],
              fuzziness: "AUTO",
            },
          },
        ],
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
