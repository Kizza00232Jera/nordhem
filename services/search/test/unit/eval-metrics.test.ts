import { describe, expect, it } from "vitest";
import { ndcgAtK, recallAtK, reciprocalRank } from "../../src/eval/metrics.ts";

// The relevance metrics, with grades mapped Exact=2, Partial=1, Irrelevant=0.
// All fixtures are hand-computed so the numbers are auditable. Gain is the
// exponential form 2^grade - 1; the discount is log2(rank + 1), rank 1-based.
//
// nDCG@k divides the DCG of the RETRIEVED ranking by the IDCG of the best
// possible ordering of ALL the query's judged grades. That is the honest
// definition: failing to retrieve a relevant document lowers the score,
// because the ideal ranking still contains it.

describe("ndcgAtK", () => {
  it("is 1.0 for a perfect ranking", () => {
    // DCG = 3/log2(2) + 1/log2(3) + 0 = 3.63093 ; IDCG identical.
    expect(ndcgAtK([2, 1, 0], [2, 1, 0], 3)).toBeCloseTo(1, 6);
  });

  it("drops sharply when a relevant doc is not retrieved", () => {
    // retrieved [1,0,0] -> DCG = 1/log2(2) = 1
    // ideal pool [2,1]  -> IDCG = 3/log2(2) + 1/log2(3) = 3.63093
    // nDCG = 1 / 3.63093 = 0.27541
    expect(ndcgAtK([1, 0, 0], [2, 1], 3)).toBeCloseTo(0.2754, 3);
  });

  it("rewards putting the best results first", () => {
    // retrieved [0,2,1] -> 0 + 3/log2(3) + 1/log2(4) = 2.39279
    // ideal [2,1,0]     -> 3.63093 ; nDCG = 0.65899
    expect(ndcgAtK([0, 2, 1], [2, 1, 0], 3)).toBeCloseTo(0.659, 3);
  });

  it("ignores relevant docs ranked below k", () => {
    // the only relevant doc sits at rank 3, so nDCG@2 sees nothing
    expect(ndcgAtK([0, 0, 2], [2], 2)).toBe(0);
  });

  it("is 0 when the query has no relevant docs (no division by zero)", () => {
    expect(ndcgAtK([0, 0], [0, 0], 2)).toBe(0);
  });
});

describe("reciprocalRank (per-query, averaged into MRR)", () => {
  it("is 1 when the first result is relevant", () => {
    expect(reciprocalRank([2, 0, 1])).toBe(1);
  });

  it("is 1/rank of the first relevant result", () => {
    expect(reciprocalRank([0, 0, 1])).toBeCloseTo(1 / 3, 6);
  });

  it("is 0 when nothing relevant was retrieved", () => {
    expect(reciprocalRank([0, 0, 0])).toBe(0);
  });
});

describe("recallAtK", () => {
  it("is the fraction of all relevant docs found in the top k", () => {
    // top 2 of [1,0,1,0] has 1 relevant; the query has 4 relevant overall
    expect(recallAtK([1, 0, 1, 0], 2, 4)).toBeCloseTo(0.25, 6);
  });

  it("counts more relevant docs as k grows", () => {
    expect(recallAtK([1, 0, 1, 0], 4, 4)).toBeCloseTo(0.5, 6);
  });

  it("is 0 when the query has no relevant docs", () => {
    expect(recallAtK([0, 0], 2, 0)).toBe(0);
  });
});
