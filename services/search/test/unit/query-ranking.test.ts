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

  // Step 11a: learned click-affinity boosts ride into the query as per-product
  // function_score functions. A logged (query, product) affinity becomes a
  // capped additive weight on that product's score, so results people actually
  // click for this query float up — without an LLM in the hot path.
  it("affinity boosts wrap the query in a function_score with per-product weights", () => {
    const body = buildSearchBody("oak bed", 20, {
      affinityBoosts: [
        { productId: 200, weight: 5 },
        { productId: 100, weight: 2.5 },
      ],
    });
    expect(body.query).toEqual({
      function_score: {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: "oak bed",
                  type: "best_fields",
                  fields: ["name^3", "product_class^2", "description"],
                  fuzziness: "AUTO",
                  prefix_length: 2,
                },
              },
            ],
            should: [{ match_phrase: { name: { query: "oak bed", slop: 2, boost: 4 } } }],
          },
        },
        functions: [
          { filter: { term: { product_id: 200 } }, weight: 5 },
          { filter: { term: { product_id: 100 } }, weight: 2.5 },
        ],
        // sum so popularity + affinity add rather than multiply; boost_mode sum
        // adds the lot onto the BM25 _score.
        score_mode: "sum",
        boost_mode: "sum",
      },
    });
  });

  it("merges affinity weights with a popularity factor in one function_score", () => {
    const body = buildSearchBody("oak bed", 20, {
      ranking: { ...DEFAULT_RANKING, popularityWeight: 0.3 },
      affinityBoosts: [{ productId: 200, weight: 5 }],
    });
    expect((body.query as { function_score: { functions: unknown[] } }).function_score.functions).toEqual([
      { field_value_factor: { field: "review_count", modifier: "ln1p", missing: 0, factor: 0.3 } },
      { filter: { term: { product_id: 200 } }, weight: 5 },
    ]);
  });

  it("drops non-positive or non-finite affinity weights", () => {
    const body = buildSearchBody("oak bed", 20, {
      affinityBoosts: [
        { productId: 1, weight: 0 },
        { productId: 2, weight: -3 },
        { productId: 3, weight: Number.NaN },
        { productId: 4, weight: 1.5 },
      ],
    });
    expect((body.query as { function_score: { functions: unknown[] } }).function_score.functions).toEqual([
      { filter: { term: { product_id: 4 } }, weight: 1.5 },
    ]);
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
