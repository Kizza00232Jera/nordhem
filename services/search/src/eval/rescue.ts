import type { QueryScore } from "./harness.ts";

export interface RescueResult {
  /** Queries the baseline scored 0 on, but the candidate scored above 0. */
  rescued: number;
  /** Queries the baseline scored above 0, but the candidate dropped to 0. */
  regressed: number;
  /** Queries both left at 0 (still unsolved). */
  bothZero: number;
  /** Queries compared (present in the baseline). */
  total: number;
}

/**
 * Zero-result rescue analysis (Step 8): compare two runs query by query and
 * count where the candidate fixed a total miss (the point of semantic/hybrid),
 * where it newly broke one, and where both still fail. Matched by query id, so
 * input order does not matter. Pure, so it is unit-tested with fixtures.
 */
export function rescueAnalysis(
  baseline: QueryScore[],
  candidate: QueryScore[],
  metric: (s: QueryScore) => number = (s) => s.ndcg,
): RescueResult {
  const candById = new Map(candidate.map((s) => [s.queryId, s]));
  const result: RescueResult = { rescued: 0, regressed: 0, bothZero: 0, total: 0 };
  for (const base of baseline) {
    const cand = candById.get(base.queryId);
    if (!cand) continue;
    result.total++;
    const b = metric(base);
    const c = metric(cand);
    if (b === 0 && c > 0) result.rescued++;
    else if (b > 0 && c === 0) result.regressed++;
    else if (b === 0 && c === 0) result.bothZero++;
  }
  return result;
}
