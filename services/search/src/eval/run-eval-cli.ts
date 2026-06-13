import { createDb, evalJudgments, evalQueries } from "@nordhem/db";
import { createEsClient } from "../es/client.ts";
import { buildSearchBody } from "../search/query.ts";
import { runEval, type Judgment } from "./harness.ts";
import { saveEvalRun } from "./store.ts";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";
const esUrl = process.env.ES_URL ?? "http://localhost:9200";
const index = process.env.SEARCH_INDEX ?? "products";
const RETRIEVE = 100; // depth: enough for recall@100
// A label for this run, e.g. `pnpm run-eval "bm25 + fuzzy baseline"`.
const label = process.argv[2] ?? "baseline (bm25 + field boosts + fuzziness)";

const es = createEsClient(esUrl);
const { db, close } = createDb(databaseUrl);

try {
  const queries = await db.select().from(evalQueries).orderBy(evalQueries.queryId);
  const judgmentRows = await db.select().from(evalJudgments);

  const judgmentsByQueryId = new Map<number, Judgment[]>();
  for (const row of judgmentRows) {
    const list = judgmentsByQueryId.get(row.queryId) ?? [];
    list.push({ productId: row.productId, grade: row.grade });
    judgmentsByQueryId.set(row.queryId, list);
  }

  // The injected search: run the real production query against the benchmark
  // index and return the ranked product ids (doc _id is String(productId)).
  const search = async (text: string): Promise<number[]> => {
    const res = await es.search<unknown>({
      index,
      ...buildSearchBody(text, RETRIEVE, {}),
    });
    return res.hits.hits
      .map((hit) => Number(hit._id))
      .filter((id) => Number.isFinite(id));
  };

  const started = Date.now();
  const result = await runEval({ queries, judgmentsByQueryId, search });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  const runId = await saveEvalRun(
    db,
    { label, indexName: index, config: { ndcgK: 10, recallK: 100, retrieve: RETRIEVE } },
    result,
  );

  const worst = [...result.perQuery].sort((a, b) => a.ndcg - b.ndcg).slice(0, 10);
  const pct = (n: number) => (n * 100).toFixed(1) + "%";

  console.log(`\nEvaluated ${result.queryCount} queries against "${index}" in ${seconds}s`);
  console.log(`  saved run ${runId} ("${label}")`);
  console.log(`  nDCG@10    ${result.ndcg.toFixed(4)}`);
  console.log(`  MRR        ${result.mrr.toFixed(4)}`);
  console.log(`  recall@100 ${pct(result.recall)}`);
  console.log(`\nWorst 10 queries by nDCG@10:`);
  for (const q of worst) {
    console.log(`  ${q.ndcg.toFixed(3)}  [${q.queryId}] ${q.query}`);
  }
} finally {
  await close();
}
