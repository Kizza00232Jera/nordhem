import { describe, expect, it } from "vitest";
import { rescueAnalysis } from "../../src/eval/rescue.ts";
import type { QueryScore } from "../../src/eval/harness.ts";

function q(queryId: number, ndcg: number, recall = ndcg): QueryScore {
  return { queryId, query: `q${queryId}`, ndcg, rr: ndcg, recall };
}

describe("rescueAnalysis", () => {
  const baseline = [q(1, 0), q(2, 0.5), q(3, 0.8), q(4, 0)];
  const candidate = [q(1, 0.4), q(2, 0.6), q(3, 0), q(4, 0)];

  it("counts queries the candidate rescues, regresses, and leaves at zero", () => {
    const r = rescueAnalysis(baseline, candidate);
    expect(r).toEqual({ rescued: 1, regressed: 1, bothZero: 1, total: 4 });
  });

  it("matches queries by id regardless of order", () => {
    const shuffled = [q(4, 0), q(2, 0.6), q(1, 0.4), q(3, 0)];
    expect(rescueAnalysis(baseline, shuffled).rescued).toBe(1);
  });

  it("can analyse a different metric (recall)", () => {
    const base = [q(1, 0.9, 0)]; // good ndcg but zero recall
    const cand = [q(1, 0.9, 0.3)]; // recall rescued
    expect(rescueAnalysis(base, cand, (s) => s.recall).rescued).toBe(1);
  });
});
