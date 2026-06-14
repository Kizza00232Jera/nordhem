export interface RrfOptions {
  /**
   * The rank constant. A larger k flattens the contribution of top ranks (so
   * agreement across lists matters more than being #1 in one); a smaller k
   * sharpens the advantage of the very top results. 60 is the common default.
   */
  k?: number;
}

const DEFAULT_K = 60;

/**
 * Reciprocal Rank Fusion: combine several ranked id-lists into one ranking
 * without needing their scores to be comparable. Each list contributes
 * 1 / (k + rank) for every id it ranks (rank is 1-based), and an id's fused
 * score is the sum across lists. This is how we blend lexical (BM25) and
 * semantic (kNN) results in Step 8: BM25 scores and cosine similarities live on
 * totally different scales, but ranks are universal, so fusing ranks sidesteps
 * the scale problem entirely. An id in both lists beats an id ranked higher in
 * only one. Pure and deterministic (ties break by id ascending), so it is
 * unit-tested with hand-computed fixtures.
 */
export function rrfFuse(rankings: number[][], opts: RrfOptions = {}): number[] {
  const k = opts.k ?? DEFAULT_K;
  const score = new Map<number, number>();
  for (const list of rankings) {
    list.forEach((id, i) => {
      const rank = i + 1;
      score.set(id, (score.get(id) ?? 0) + 1 / (k + rank));
    });
  }
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([id]) => id);
}
