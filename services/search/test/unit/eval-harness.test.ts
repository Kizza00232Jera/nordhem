import { describe, expect, it } from "vitest";
import { runEval, scoreQuery } from "../../src/eval/harness.ts";

// The harness scores each query by lining its retrieved product ids up against
// the judgments (unjudged retrievals count as grade 0), then averages per-query
// scores into nDCG@k, MRR and recall@k. Search is injected so the orchestration
// is tested without Elasticsearch; the CLI passes the real ES-backed search.
describe("scoreQuery", () => {
  it("maps retrieved ids to grades and scores one query", () => {
    const judgments = [
      { productId: 10, grade: 2 },
      { productId: 11, grade: 1 },
      { productId: 12, grade: 0 },
    ];
    // retrieved [10, 99, 11] -> grades [2, 0, 1]; 99 is unjudged -> 0.
    const s = scoreQuery([10, 99, 11], judgments);
    expect(s.ndcg).toBeCloseTo(0.9639, 3); // DCG 3.5 / IDCG 3.63093
    expect(s.rr).toBe(1); // grade-2 hit at rank 1
    expect(s.recall).toBeCloseTo(1, 6); // both relevant docs in the top 100
  });

  it("scores a query whose relevant docs were all missed as zero", () => {
    const s = scoreQuery([99, 98], [{ productId: 20, grade: 2 }]);
    expect(s.ndcg).toBe(0);
    expect(s.rr).toBe(0);
    expect(s.recall).toBe(0);
  });
});

describe("runEval", () => {
  it("runs every query and averages the per-query scores", async () => {
    const queries = [
      { queryId: 0, query: "chair" },
      { queryId: 1, query: "table" },
    ];
    const judgmentsByQueryId = new Map([
      [0, [{ productId: 10, grade: 2 }, { productId: 11, grade: 1 }, { productId: 12, grade: 0 }]],
      [1, [{ productId: 20, grade: 2 }]],
    ]);
    const search = async (text: string) =>
      text === "chair" ? [10, 99, 11] : [99, 98];

    const result = await runEval({ queries, judgmentsByQueryId, search });

    expect(result.queryCount).toBe(2);
    expect(result.perQuery[0]).toMatchObject({ queryId: 0, query: "chair" });
    expect(result.perQuery[0]?.ndcg).toBeCloseTo(0.9639, 3);
    expect(result.perQuery[1]?.ndcg).toBe(0);
    // means across the two queries
    expect(result.ndcg).toBeCloseTo(0.482, 3);
    expect(result.mrr).toBeCloseTo(0.5, 6);
    expect(result.recall).toBeCloseTo(0.5, 6);
  });
});
