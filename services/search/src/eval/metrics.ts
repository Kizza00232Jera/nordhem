/**
 * Offline relevance metrics for the eval harness (step 6).
 *
 * Grades are the WANDS judgments mapped to integers: Exact=2, Partial=1,
 * Irrelevant=0 (see grades.ts). A "relevant" document is one with grade >= 1.
 *
 * Everything here is pure (numbers in, numbers out) so it is unit-tested with
 * hand-computed fixtures and carries no dependency on Elasticsearch. The
 * harness supplies the ranked grades of the retrieved results plus, per query,
 * the full set of judged grades (for the ideal ranking) and the relevant count.
 */

/** Relevance threshold: Exact or Partial count as relevant for MRR and recall. */
export const RELEVANT_GRADE = 1;

/**
 * Exponential gain, the industry-standard form (also Elasticsearch rank_eval):
 * an Exact (2 -> 3) is worth more than three Partials (1 -> 1 each). Swap this
 * one line for `grade` to get the original linear nDCG.
 */
function gain(grade: number): number {
  return Math.pow(2, grade) - 1;
}

/** Rank is 1-based, so rank 1 divides by log2(2) = 1 (no discount at the top). */
function discount(rank: number): number {
  return Math.log2(rank + 1);
}

/** Discounted cumulative gain of the first k grades, in the given order. */
function dcgAtK(grades: number[], k: number): number {
  let sum = 0;
  const limit = Math.min(k, grades.length);
  for (let i = 0; i < limit; i++) {
    sum += gain(grades[i] ?? 0) / discount(i + 1);
  }
  return sum;
}

/**
 * nDCG@k: the retrieved ranking's DCG over the best achievable DCG. The ideal
 * is built from ALL the query's judged grades sorted best-first, so a relevant
 * document the search never returned still inflates the denominator and pulls
 * the score down. Returns 0 when the query has no relevant docs (IDCG = 0).
 */
export function ndcgAtK(
  retrievedGrades: number[],
  allJudgedGrades: number[],
  k: number,
): number {
  const ideal = [...allJudgedGrades].sort((a, b) => b - a);
  const idcg = dcgAtK(ideal, k);
  if (idcg === 0) return 0;
  return dcgAtK(retrievedGrades, k) / idcg;
}

/**
 * Reciprocal rank: 1 / (rank of the first relevant result), or 0 if none.
 * Averaging this across the query set gives MRR.
 */
export function reciprocalRank(retrievedGrades: number[]): number {
  for (let i = 0; i < retrievedGrades.length; i++) {
    if ((retrievedGrades[i] ?? 0) >= RELEVANT_GRADE) return 1 / (i + 1);
  }
  return 0;
}

/**
 * recall@k: how many of the query's relevant documents appear in the top k,
 * over the total number of relevant documents. 0 when there are none.
 */
export function recallAtK(
  retrievedGrades: number[],
  k: number,
  totalRelevant: number,
): number {
  if (totalRelevant === 0) return 0;
  const limit = Math.min(k, retrievedGrades.length);
  let found = 0;
  for (let i = 0; i < limit; i++) {
    if ((retrievedGrades[i] ?? 0) >= RELEVANT_GRADE) found++;
  }
  return found / totalRelevant;
}
