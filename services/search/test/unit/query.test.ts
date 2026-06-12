import { describe, expect, it } from "vitest";
import { buildSearchBody } from "../../src/search/query.ts";

describe("buildSearchBody", () => {
  // Expected DSL written from the Elasticsearch multi_match docs.
  // Step-1 baseline: best_fields + OR + standard analyzer, no boosts —
  // the relevance lab exists to measure exactly how naive this is.
  it("builds a naive multi_match over the three text fields", () => {
    expect(buildSearchBody("outdoor chair", 20)).toEqual({
      query: {
        multi_match: {
          query: "outdoor chair",
          fields: ["name", "product_class", "description"],
        },
      },
      size: 20,
    });
  });
});
