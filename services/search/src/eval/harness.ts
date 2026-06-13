import { ndcgAtK, recallAtK, reciprocalRank } from "./metrics.ts";

export interface Judgment {
  productId: number;
  grade: number;
}

export interface EvalConfig {
  ndcgK?: number;
  recallK?: number;
}

export interface QueryScore {
  queryId: number;
  query: string;
  ndcg: number;
  rr: number;
  recall: number;
}

export interface EvalResult {
  queryCount: number;
  ndcg: number; // mean nDCG@ndcgK
  mrr: number; // mean reciprocal rank
  recall: number; // mean recall@recallK
  perQuery: QueryScore[];
}

const DEFAULT_NDCG_K = 10;
const DEFAULT_RECALL_K = 100;
const DEFAULT_CONCURRENCY = 12;
const TEST_MODULO = 5; // every 5th query id is held out for the test set

/**
 * Deterministic train/test split of the query set: tune on train, confirm on
 * test, so we do not overfit the judgments. Holding out by query id (id %
 * TEST_MODULO === 0) keeps the split stable across runs and input orders.
 */
export function trainTestSplit(queryIds: number[]): {
  train: number[];
  test: number[];
} {
  const train: number[] = [];
  const test: number[] = [];
  for (const id of queryIds) {
    (id % TEST_MODULO === 0 ? test : train).push(id);
  }
  return { train, test };
}

/**
 * Score one query: line the ranked retrieved ids up against the judgments
 * (an id with no judgment counts as grade 0), then compute nDCG@k, reciprocal
 * rank, and recall@k. Pure, so it is unit-tested with hand-computed fixtures.
 */
export function scoreQuery(
  retrievedIds: number[],
  judgments: Judgment[],
  config: EvalConfig = {},
): { ndcg: number; rr: number; recall: number } {
  const ndcgK = config.ndcgK ?? DEFAULT_NDCG_K;
  const recallK = config.recallK ?? DEFAULT_RECALL_K;

  const gradeByProduct = new Map(judgments.map((j) => [j.productId, j.grade]));
  const retrievedGrades = retrievedIds.map((id) => gradeByProduct.get(id) ?? 0);
  const allGrades = judgments.map((j) => j.grade);
  const totalRelevant = judgments.filter((j) => j.grade >= 1).length;

  return {
    ndcg: ndcgAtK(retrievedGrades, allGrades, ndcgK),
    rr: reciprocalRank(retrievedGrades),
    recall: recallAtK(retrievedGrades, recallK, totalRelevant),
  };
}

/**
 * Run the whole query set through an injected search function and average the
 * per-query scores. The search function maps a query string to a ranked list
 * of product ids; the CLI wires it to Elasticsearch, tests pass a fake.
 */
export async function runEval(params: {
  queries: { queryId: number; query: string }[];
  judgmentsByQueryId: Map<number, Judgment[]>;
  search: (text: string) => Promise<number[]>;
  config?: EvalConfig;
  /** How many searches to run at once; a full set over real ES is I/O bound. */
  concurrency?: number;
}): Promise<EvalResult> {
  const { queries, judgmentsByQueryId, search, config = {} } = params;
  const concurrency = Math.max(1, params.concurrency ?? DEFAULT_CONCURRENCY);

  // Score one query (pure once the search resolves).
  const scoreOne = async (q: { queryId: number; query: string }): Promise<QueryScore> => {
    const judgments = judgmentsByQueryId.get(q.queryId) ?? [];
    const ids = await search(q.query);
    return { queryId: q.queryId, query: q.query, ...scoreQuery(ids, judgments, config) };
  };

  // Bounded concurrency, results kept in the input query order.
  const perQuery: QueryScore[] = [];
  for (let i = 0; i < queries.length; i += concurrency) {
    const chunk = queries.slice(i, i + concurrency);
    perQuery.push(...(await Promise.all(chunk.map(scoreOne))));
  }
  const n = perQuery.length;
  const mean = (sel: (x: QueryScore) => number) =>
    n === 0 ? 0 : perQuery.reduce((acc, x) => acc + sel(x), 0) / n;
  return {
    queryCount: n,
    ndcg: mean((x) => x.ndcg),
    mrr: mean((x) => x.rr),
    recall: mean((x) => x.recall),
    perQuery,
  };
}
