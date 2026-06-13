import { describe, expect, it } from "vitest";
import { buildSearchBody, DEFAULT_RANKING } from "../../src/search/query.ts";

// Step 7: the scoring query is now driven by a RankingConfig so the relevance
// lab can try and measure different configs. DEFAULT_RANKING reproduces the
// step-3 query byte-for-byte (covered by query.test.ts); here we pin that a
// TUNED config emits the extra DSL the tuning step adds.
describe("RankingConfig drives the scoring query", () => {
  it("default ranking is the graduated step-7 config (prefix_length 2 + phrase boost)", () => {
    expect(DEFAULT_RANKING).toMatchObject({
      fields: { name: 3, productClass: 2, description: 1 },
      fuzziness: "AUTO",
      fuzzyPrefixLength: 2,
      minimumShouldMatch: undefined,
      phraseBoost: 4,
      popularityWeight: 0,
    });
  });

  it("a tuned config adds prefix_length, minimum_should_match, a phrase boost, and popularity", () => {
    const body = buildSearchBody("light chair", 20, {
      ranking: {
        fields: { name: 4, productClass: 2, description: 1 },
        fuzziness: "AUTO",
        fuzzyPrefixLength: 2,
        minimumShouldMatch: "2<75%",
        phraseBoost: 5,
        popularityWeight: 0.3,
      },
    });
    expect(body.query).toEqual({
      function_score: {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: "light chair",
                  type: "best_fields",
                  fields: ["name^4", "product_class^2", "description"],
                  fuzziness: "AUTO",
                  prefix_length: 2,
                  minimum_should_match: "2<75%",
                },
              },
            ],
            should: [{ match_phrase: { name: { query: "light chair", slop: 2, boost: 5 } } }],
          },
        },
        functions: [
          { field_value_factor: { field: "review_count", modifier: "ln1p", missing: 0, factor: 0.3 } },
        ],
        boost_mode: "sum",
      },
    });
  });

  it("a config without fuzziness, phrase boost or popularity is a bare multi_match", () => {
    const body = buildSearchBody("oak bed", 20, {
      ranking: {
        fields: { name: 3, productClass: 2, description: 1 },
        fuzziness: undefined,
        fuzzyPrefixLength: 0,
        phraseBoost: 0,
        popularityWeight: 0,
      },
    });
    expect(body.query).toEqual({
      multi_match: {
        query: "oak bed",
        type: "best_fields",
        fields: ["name^3", "product_class^2", "description"],
      },
    });
  });
});
